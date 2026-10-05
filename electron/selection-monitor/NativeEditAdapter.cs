using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Automation;

namespace Lexforge.SelectionMonitor;

// Conservative fallback for standard Win32 Edit controls without TextPattern.
// Other controls must use their accessibility provider; EM_GETSEL offsets are
// not interchangeable with rich editors or browser contenteditable elements.
internal static class NativeEditAdapter
{
    private const uint EmGetSel = 0x00B0;
    private const uint EmSetSel = 0x00B1;
    private const uint SmtoAbortIfHung = 0x0002;

    internal sealed record State(IntPtr Handle, string Value, int SelectionStart, int SelectionEnd,
        double X, double Y, double Width, double Height);

    internal static bool TryRead(AutomationElement element, IntPtr foreground, out State state,
        bool allowReadOnly = false)
    {
        state = null!;
        if (element.Current.ControlType != ControlType.Edit || element.Current.IsPassword ||
            !element.Current.IsEnabled || element.Current.NativeWindowHandle == 0 ||
            !element.TryGetCurrentPattern(ValuePattern.Pattern, out var valueObject) ||
            valueObject is not ValuePattern valuePattern ||
            (!allowReadOnly && valuePattern.Current.IsReadOnly))
            return false;

        var handle = new IntPtr(element.Current.NativeWindowHandle);
        var className = new StringBuilder(64);
        if (GetClassName(handle, className, className.Capacity) == 0 ||
            !(string.Equals(className.ToString(), "Edit", StringComparison.OrdinalIgnoreCase) ||
              className.ToString().StartsWith("WindowsForms10.EDIT.", StringComparison.OrdinalIgnoreCase)))
            return false;

        var thread = GetWindowThreadProcessId(foreground, out _);
        var info = new GuiThreadInfo { Size = Marshal.SizeOf<GuiThreadInfo>() };
        if (thread == 0 || !GetGUIThreadInfo(thread, ref info) || info.Focus != handle ||
            !TryGetSelection(handle, out var start, out var end)) return false;

        var value = valuePattern.Current.Value;
        if (value.Length > 4000 || start > end || end > value.Length) return false;
        var caret = new NativePoint { X = info.Caret.Left, Y = info.Caret.Top };
        if (info.CaretWindow == IntPtr.Zero || !ClientToScreen(info.CaretWindow, ref caret)) return false;
        state = new State(handle, value, start, end, caret.X, caret.Y,
            Math.Max(info.Caret.Right - info.Caret.Left, 1),
            Math.Max(info.Caret.Bottom - info.Caret.Top, 1));
        return true;
    }

    internal static bool TrySelect(State state, int start, int length)
    {
        if (start < 0 || length < 0 || start + length > state.Value.Length) return false;
        if (SendMessageTimeout(state.Handle, EmSetSel, new IntPtr(start), new IntPtr(start + length),
                SmtoAbortIfHung, 150, out _) == IntPtr.Zero) return false;
        return TryGetSelection(state.Handle, out var selectedStart, out var selectedEnd) &&
            selectedStart == start && selectedEnd == start + length;
    }

    private static bool TryGetSelection(IntPtr handle, out int start, out int end)
    {
        start = end = 0;
        if (SendMessageTimeout(handle, EmGetSel, out uint from, out uint to,
                SmtoAbortIfHung, 150, out _) == IntPtr.Zero) return false;
        if (from > int.MaxValue || to > int.MaxValue) return false;
        start = (int)from;
        end = (int)to;
        return true;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint { public int X, Y; }

    [StructLayout(LayoutKind.Sequential)]
    private struct GuiThreadInfo
    {
        public int Size;
        public uint Flags;
        public IntPtr Active, Focus, Capture, MenuOwner, MoveSize, CaretWindow;
        public NativeRect Caret;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr window, StringBuilder className, int maxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetGUIThreadInfo(uint threadId, ref GuiThreadInfo info);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ClientToScreen(IntPtr window, ref NativePoint point);

    [DllImport("user32.dll", EntryPoint = "SendMessageTimeoutW", SetLastError = true)]
    private static extern IntPtr SendMessageTimeout(IntPtr window, uint message, out uint wParam,
        out uint lParam, uint flags, uint timeout, out IntPtr result);

    [DllImport("user32.dll", EntryPoint = "SendMessageTimeoutW", SetLastError = true)]
    private static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wParam,
        IntPtr lParam, uint flags, uint timeout, out IntPtr result);
}
