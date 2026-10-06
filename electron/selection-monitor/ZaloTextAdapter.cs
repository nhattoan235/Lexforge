using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Automation;
using Accessibility;

namespace Lexforge.SelectionMonitor;

// Zalo's Chromium window exposes its composer through MSAA/IAccessible2, but
// does not expose the text through Windows UI Automation on this build.
internal static class ZaloTextAdapter
{
    private static readonly Guid AccessibleId = new("618736e0-3c3d-11cf-810c-00aa00389b71");
    private static readonly Guid AccessibleTextId = new("24fd2ffb-3aad-4a08-8335-a3ad89c0fb4b");
    private const uint ObjIdClient = 0xFFFFFFFC;
    private const int MaxTextLength = 4_000;
    private const int MaxNodes = 900;

    internal sealed record State(IntPtr Renderer, string Value,
        int SelectionStart, int SelectionEnd, double X, double Y, double Width, double Height,
        string? ComposerName = null, string? EmptySignature = null);

    internal static bool TryReadEmpty(IntPtr foreground, out State state)
    {
        state = null!;
        var emptyTextConfirmed = false;
        if (TryRead(foreground, out var existing))
        {
            if (existing.Value.Length != 0 || existing.SelectionStart != 0 || existing.SelectionEnd != 0)
                return false;
            emptyTextConfirmed = true;
        }
        if (!IsZaloWindow(foreground) || !TryGetRoot(foreground, out var root, out var renderer) ||
            !TryFocusedComposer(root, out var group) ||
            !TryBounds(group, out var x, out var y, out var width, out var height)) return false;
        if (emptyTextConfirmed && (existing.Renderer != renderer || !MatchesBounds(group, existing))) return false;
        var nameAvailable = TryGetName(group, out var name);
        var signatureAvailable = TryGetStaticTextSignature(group, out var signature);
        // Even when IA2 exposes an empty text node, capture the composer's signature.
        // Returning the bare text state left EmptySignature null and made the later
        // focus verification reject the same empty composer.
        if (!signatureAvailable || !(emptyTextConfirmed || IsEmptyComposerName(name) || IsEmptyComposerSignature(signature)))
            return false;
        state = new State(renderer, "", 0, 0, x, y, width, height,
            nameAvailable && IsEmptyComposerName(name) ? name : null, signature);
        return true;
    }

    internal static bool TryFocusEmpty(IntPtr foreground, State original)
    {
        if (!TryFindEmptyComposer(foreground, original, out var group)) return false;
        try { group.accSelect(1, 0); }
        catch (COMException) { return false; }
        return TryVerifyEmptyFocused(foreground, original);
    }

    internal static bool TryVerifyEmptyFocused(IntPtr foreground, State original)
    {
        if (!TryGetRoot(foreground, out var root, out var renderer) ||
            renderer != original.Renderer || !TryFocusedComposer(root, out var group) ||
            !MatchesBounds(group, original) ||
            !TryGetStaticTextSignature(group, out var signature) ||
            signature != original.EmptySignature) return false;
        return !TryRead(foreground, out var current) || current.Value.Length == 0;
    }

    internal static bool TryConfirmEmpty(IntPtr foreground, State original) =>
        TryFindEmptyComposer(foreground, original, out _);

    private static bool TryFindEmptyComposer(IntPtr foreground, State original, out IAccessible group)
    {
        group = null!;
        if (!IsZaloWindow(foreground) || !TryGetRoot(foreground, out var root, out var renderer) ||
            renderer != original.Renderer) return false;
        foreach (var candidate in Walk(root))
        {
            if (!MatchesBounds(candidate, original)) continue;
            if (original.ComposerName is not null &&
                (!TryGetName(candidate, out var name) || name != original.ComposerName)) continue;
            if (!TryGetStaticTextSignature(candidate, out var signature) ||
                (original.EmptySignature is not null && signature != original.EmptySignature)) continue;
            group = candidate;
            return true;
        }
        return false;
    }

    private static bool IsEmptyComposerName(string? name) =>
        name?.StartsWith("Nhập @", StringComparison.OrdinalIgnoreCase) == true ||
        name?.StartsWith("Type @", StringComparison.OrdinalIgnoreCase) == true;

    private static bool IsEmptyComposerSignature(string signature) =>
        signature.Contains("Nhập @", StringComparison.OrdinalIgnoreCase) ||
        signature.Contains("Nhập tin nhắn", StringComparison.OrdinalIgnoreCase) ||
        signature.Contains("Type @", StringComparison.OrdinalIgnoreCase) ||
        signature.Contains("Type a message", StringComparison.OrdinalIgnoreCase);

    private static bool TryGetStaticTextSignature(IAccessible group, out string signature)
    {
        var parts = new List<string>();
        foreach (var child in Walk(group, 10))
            if (!ReferenceEquals(child, group) && IsStaticText(child))
            {
                if (!TryQueryText(child, out var pointer)) { signature = ""; return false; }
                try
                {
                    if (!TryReadValue(pointer, out var value)) { signature = ""; return false; }
                    parts.Add($"{value.Length}:{value}");
                }
                finally { Marshal.Release(pointer); }
            }
        signature = string.Join("|", parts);
        return true;
    }

    private static bool TryGetName(IAccessible node, out string? name)
    {
        name = null;
        try { name = node.accName[0] as string; return true; }
        catch (COMException) { return false; }
    }

    private static bool MatchesBounds(State current, State original) =>
        Math.Abs(current.X - original.X) <= 3 && Math.Abs(current.Y - original.Y) <= 3 &&
        Math.Abs(current.Width - original.Width) <= 3 && Math.Abs(current.Height - original.Height) <= 30;

    internal static bool TryRead(IntPtr foreground, out State state)
    {
        state = null!;
        if (!IsZaloWindow(foreground) || !TryGetRoot(foreground, out var root, out var renderer))
            return false;
        if (!TryFocusedComposer(root, out var group)) return false;
        foreach (var child in Walk(group, 10))
        {
            if (ReferenceEquals(child, group) || !IsStaticText(child) ||
                !TryReadText(child, out var value, out var caret,
                    out var selectionStart, out var selectionEnd) || caret < 0)
                continue;
            if (!TryBounds(group, out var x, out var y, out var width, out var height))
                return false;
            state = new State(renderer, value, selectionStart, selectionEnd,
                x, y, width, height);
            return true;
        }
        return false;
    }

    internal static bool TryFocus(IntPtr foreground, State original)
    {
        if (!TryFindComposer(foreground, original, out var group, out _)) return false;
        try { group.accSelect(1, 0); } // SELFLAG_TAKEFOCUS
        catch (COMException) { return false; }
        return TryFindComposer(foreground, original, out _, out _);
    }

    internal static bool TryConfirmUnchanged(IntPtr window, State original, int start, string sentence) =>
        start >= 0 && start + sentence.Length <= original.Value.Length &&
        original.Value.Substring(start, sentence.Length) == sentence &&
        TryFindComposer(window, original, out _, out _);

    internal static bool TrySelect(IntPtr foreground, State original, int start, int length)
    {
        if (start < 0 || length <= 0 || start + length > original.Value.Length ||
            !TryFindComposer(foreground, original, out var group, out var text)) return false;
        try { group.accSelect(1, 0); }
        catch (COMException) { return false; }

        if (!TryQueryText(text, out var pointer)) return false;
        try
        {
            var countMethod = GetMethod<GetInt>(pointer, 7); // nSelections
            if (countMethod(pointer, out var count) != 0) return false;
            var end = start + length;
            var selected = count > 0
                ? GetMethod<SetSelection>(pointer, 16)(pointer, 0, start, end)
                : GetMethod<AddSelection>(pointer, 3)(pointer, start, end);
            if (selected != 0) return false;

            for (var attempt = 0; attempt < 4; attempt++)
            {
                Thread.Sleep(50);
                if (countMethod(pointer, out count) != 0 || count != 1) continue;
                if (GetMethod<GetSelection>(pointer, 9)(pointer, 0, out var from, out var to) == 0 &&
                    from == start && to == end &&
                    TryReadValue(pointer, out var value) && value == original.Value)
                    return true;
            }
            return false;
        }
        finally { Marshal.Release(pointer); }
    }

    private static bool TryFindComposer(IntPtr foreground, State original,
        out IAccessible group, out IAccessible text)
    {
        group = text = null!;
        if (!IsZaloWindow(foreground) || !TryGetRoot(foreground, out var root, out var renderer) ||
            renderer != original.Renderer) return false;

        var focused = TryFocusedComposer(root, out var focusedGroup) &&
            MatchesBounds(focusedGroup, original) ? focusedGroup : null;
        var candidates = focused is null ? Walk(root) : new[] { focused };
        foreach (var candidate in candidates)
        {
            if (!MatchesBounds(candidate, original)) continue;
            foreach (var child in Walk(candidate, 10))
            {
                if (ReferenceEquals(child, candidate) || !IsStaticText(child) ||
                    !TryQueryText(child, out var pointer)) continue;
                try
                {
                    if (!TryReadValue(pointer, out var value) || value != original.Value) continue;
                    group = candidate;
                    text = child;
                    return true;
                }
                finally { Marshal.Release(pointer); }
            }
        }
        return false;
    }

    private static bool TryFocusedComposer(IAccessible root, out IAccessible composer)
    {
        composer = null!;
        IAccessible? focused;
        try { focused = root.accFocus as IAccessible; }
        catch (COMException) { return false; }
        for (var depth = 0; focused is not null && depth < 8; depth++)
        {
            if (TryBounds(focused, out _, out _, out var width, out var height) &&
                width >= 150 && height is >= 18 and <= 200)
            {
                composer = focused;
                return true;
            }
            try { focused = focused.accParent as IAccessible; }
            catch (COMException) { return false; }
        }
        return false;
    }

    private static bool MatchesBounds(IAccessible candidate, State original) =>
        TryBounds(candidate, out var x, out var y, out var width, out var height) &&
        Math.Abs(x - original.X) <= 3 && Math.Abs(y - original.Y) <= 3 &&
        Math.Abs(width - original.Width) <= 3 && Math.Abs(height - original.Height) <= 30;

    private static bool IsZaloWindow(IntPtr window)
    {
        if (window == IntPtr.Zero) return false;
        try
        {
            GetWindowThreadProcessId(window, out var processId);
            return processId != 0 && Process.GetProcessById((int)processId).ProcessName
                .Equals("Zalo", StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    private static bool TryGetRoot(IntPtr window, out IAccessible root, out IntPtr renderer)
    {
        root = null!;
        renderer = IntPtr.Zero;
        try
        {
            var uiRoot = AutomationElement.FromHandle(window);
            var children = uiRoot.FindAll(TreeScope.Children, Condition.TrueCondition);
            foreach (AutomationElement child in children)
            {
                if (child.Current.ClassName != "Chrome_RenderWidgetHostHWND") continue;
                renderer = new IntPtr(child.Current.NativeWindowHandle);
                var id = AccessibleId;
                if (renderer != IntPtr.Zero &&
                    AccessibleObjectFromWindow(renderer, ObjIdClient, ref id, out var result) == 0 &&
                    result is IAccessible accessible)
                {
                    root = accessible;
                    return true;
                }
            }
        }
        catch (Exception error) when (error is COMException or ElementNotAvailableException or InvalidOperationException)
        { /* The Zalo renderer can be recreated when switching chats. */ }
        return false;
    }

    private static IEnumerable<IAccessible> Walk(IAccessible start, int depthLimit = 20)
    {
        var queue = new Queue<(IAccessible Node, int Depth)>();
        queue.Enqueue((start, 0));
        for (var seen = 0; queue.Count > 0 && seen < MaxNodes; seen++)
        {
            var (node, depth) = queue.Dequeue();
            yield return node;
            if (depth >= depthLimit) continue;
            int count;
            try { count = Math.Min(node.accChildCount, 100); }
            catch (COMException) { continue; }
            for (var index = 1; index <= count; index++)
            {
                try
                {
                    if (node.accChild[index] is IAccessible child)
                        queue.Enqueue((child, depth + 1));
                }
                catch (COMException) { /* Dynamic content can disappear while walking. */ }
            }
        }
    }

    private static bool IsStaticText(IAccessible node)
    {
        try { return Convert.ToInt32(node.accRole[0]) == 41; }
        catch (Exception error) when (error is COMException or InvalidCastException)
        { return false; }
    }

    private static bool TryBounds(IAccessible node, out int x, out int y, out int width, out int height)
    {
        x = y = width = height = 0;
        try
        {
            node.accLocation(out x, out y, out width, out height, 0);
            return width > 0 && height > 0;
        }
        catch (COMException) { return false; }
    }

    private static bool TryReadText(IAccessible node, out string value, out int caret,
        out int selectionStart, out int selectionEnd)
    {
        value = string.Empty;
        caret = selectionStart = selectionEnd = -1;
        if (!TryQueryText(node, out var pointer)) return false;
        try
        {
            if (!TryReadValue(pointer, out value) ||
                GetMethod<GetInt>(pointer, 5)(pointer, out caret) != 0 ||
                caret < 0 || caret > value.Length) return false;
            selectionStart = selectionEnd = caret;
            if (GetMethod<GetInt>(pointer, 7)(pointer, out var count) != 0 || count > 1)
                return false;
            if (count == 1 &&
                GetMethod<GetSelection>(pointer, 9)(pointer, 0, out selectionStart, out selectionEnd) != 0)
                return false;
            return selectionStart >= 0 && selectionEnd >= selectionStart && selectionEnd <= value.Length;
        }
        finally { Marshal.Release(pointer); }
    }

    private static bool TryReadValue(IntPtr pointer, out string value)
    {
        value = string.Empty;
        if (GetMethod<GetInt>(pointer, 17)(pointer, out var length) != 0 ||
            length < 0 || length > MaxTextLength) return false;
        var result = GetMethod<GetText>(pointer, 10)(pointer, 0, length, out var bstr);
        try
        {
            if (result != 0) return false;
            value = bstr == IntPtr.Zero ? string.Empty : Marshal.PtrToStringBSTR(bstr) ?? string.Empty;
            return value.Length == length;
        }
        finally { if (bstr != IntPtr.Zero) Marshal.FreeBSTR(bstr); }
    }

    private static bool TryQueryText(IAccessible node, out IntPtr pointer)
    {
        pointer = IntPtr.Zero;
        try
        {
            var service = (IServiceProvider)node;
            var accessible = AccessibleId;
            var text = AccessibleTextId;
            return service.QueryService(ref accessible, ref text, out pointer) == 0 && pointer != IntPtr.Zero;
        }
        catch (COMException) { return false; }
    }

    private static T GetMethod<T>(IntPtr pointer, int index) where T : Delegate =>
        Marshal.GetDelegateForFunctionPointer<T>(Marshal.ReadIntPtr(
            Marshal.ReadIntPtr(pointer), index * IntPtr.Size));

    [ComImport, Guid("6d5140c1-7436-11ce-8034-00aa006009fa"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IServiceProvider
    {
        [PreserveSig] int QueryService(ref Guid service, ref Guid interfaceId, out IntPtr pointer);
    }

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int GetInt(IntPtr self, out int value);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int GetText(IntPtr self, int start, int end, out IntPtr bstr);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int GetSelection(IntPtr self, int index, out int start, out int end);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int SetSelection(IntPtr self, int index, int start, int end);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int AddSelection(IntPtr self, int start, int end);

    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromWindow(IntPtr window, uint objectId,
        ref Guid interfaceId, [MarshalAs(UnmanagedType.Interface)] out object result);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
}
