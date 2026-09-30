using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows.Automation;
using System.Windows.Automation.Text;

namespace Lexforge.SelectionMonitor;

internal static class Program
{
    private const int MaxTextLength = 4_000;
    private const int MaxAncestorDepth = 12;
    private const int IdlePollIntervalMs = 240;
    private const int SelectionGesturePollIntervalMs = 30;
    private const int VirtualKeyLeftMouseButton = 0x01;
    private const int VirtualKeyRightMouseButton = 0x02;
    private const int VirtualKeyShift = 0x10;
    private const int MissingSelectionThreshold = 2;
    private const int WritingPollIntervalMs = 100;
    private const int MaxDraftLength = 350;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
    private static uint ignoredProcessId;

    [STAThread]
    private static void Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        if (args.Length > 0 && args[0] == "--watch-clicks")
        {
            WatchClicks();
            return;
        }

        if (args.Length > 0 && args[0] == "--watch-writing")
        {
            if (args.Length >= 3 && args[1] == "--ignore-pid")
                _ = uint.TryParse(args[2], out ignoredProcessId);
            WatchWriting();
            return;
        }

        if (args.Length >= 2 && args[0] == "--ignore-pid")
            _ = uint.TryParse(args[1], out ignoredProcessId);

        Emit(new MonitorEvent("ready"));

        string? lastSignature = null;
        var missingCount = 0;
        var clearSent = true;
        var gestureWasActive = IsSelectionGestureActive();

        while (true)
        {
            var gestureActive = IsSelectionGestureActive();
            if (gestureActive && !gestureWasActive)
            {
                lastSignature = null;
                missingCount = 0;
                if (!clearSent) Emit(new MonitorEvent("clear"));
                clearSent = true;
            }
            gestureWasActive = gestureActive;
            if (gestureActive)
            {
                Thread.Sleep(SelectionGesturePollIntervalMs);
                continue;
            }

            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero)
                {
                    ReportMissing(ref lastSignature, ref missingCount, ref clearSent);
                }
                else
                {
                    GetWindowThreadProcessId(foreground, out var processId);
                    if (processId == (uint)Environment.ProcessId || processId == ignoredProcessId)
                    {
                        ReportMissing(ref lastSignature, ref missingCount, ref clearSent);
                    }
                    else
                    {
                        var selection = ReadSelection();
                        if (selection is null)
                        {
                            ReportMissing(ref lastSignature, ref missingCount, ref clearSent);
                        }
                        else
                        {
                            missingCount = 0;
                            clearSent = false;
                            var signature = $"{processId}\u001f{selection.Text}\u001f{selection.Bounds.X:0.##},{selection.Bounds.Y:0.##},{selection.Bounds.Width:0.##},{selection.Bounds.Height:0.##}";
                            if (!string.Equals(signature, lastSignature, StringComparison.Ordinal))
                            {
                                lastSignature = signature;
                                Emit(new MonitorEvent("selection", selection.Text, selection.Bounds));
                            }
                        }
                    }
                }
            }
            catch
            {
                ReportMissing(ref lastSignature, ref missingCount, ref clearSent);
            }

            Thread.Sleep(IdlePollIntervalMs);
        }
    }

    private static void WatchClicks()
    {
        var wasDown = IsMouseButtonDown();
        while (true)
        {
            var isDown = IsMouseButtonDown();
            if (isDown && !wasDown && GetCursorPos(out var point))
            {
                string? foregroundProcess = null;
                var foreground = GetForegroundWindow();
                if (foreground != IntPtr.Zero)
                {
                    GetWindowThreadProcessId(foreground, out var processId);
                    try { foregroundProcess = Process.GetProcessById((int)processId).ProcessName; }
                    catch { /* The foreground process can exit between calls. */ }
                }

                Console.WriteLine(JsonSerializer.Serialize(new ClickEvent("mouseDown", point.X, point.Y, foregroundProcess), JsonOptions));
                Console.Out.Flush();
            }

            wasDown = isDown;
            Thread.Sleep(12);
        }
    }

    private static bool IsMouseButtonDown() =>
        GetAsyncKeyState(VirtualKeyLeftMouseButton) < 0 ||
        GetAsyncKeyState(VirtualKeyRightMouseButton) < 0;

    private static void WatchWriting()
    {
        if (OleInitialize(IntPtr.Zero) < 0)
            Console.Error.WriteLine("Writing monitor could not initialize OLE clipboard support.");
        var commands = new ConcurrentQueue<string>();
        var inputThread = new Thread(() =>
        {
            string? line;
            while ((line = Console.ReadLine()) is not null) commands.Enqueue(line);
        }) { IsBackground = true, Name = "Writing commands" };
        inputThread.Start();

        string? sourceKey = null;
        string? lastText = null;
        DraftSnapshot? draft = null;
        var revision = 0;
        Emit(new MonitorEvent("writingReady"));

        while (true)
        {
            while (commands.TryDequeue(out var line)) ProcessWritingCommand(line, draft);

            try
            {
                var foreground = GetForegroundWindow();
                GetWindowThreadProcessId(foreground, out var processId);
                if (processId == ignoredProcessId || processId == (uint)Environment.ProcessId)
                {
                    Thread.Sleep(WritingPollIntervalMs);
                    continue;
                }

                if (IsMouseButtonDown())
                {
                    Thread.Sleep(WritingPollIntervalMs);
                    continue;
                }

                var current = ReadDraft(foreground);
                if (current is null)
                {
                    if (sourceKey is not null) Emit(new MonitorEvent("draftClear"));
                    sourceKey = null;
                    lastText = null;
                    draft = null;
                }
                else if (current.SourceKey != sourceKey)
                {
                    var changedWithinWindow = draft is not null && current.Window == draft.Window && current.Text != lastText;
                    if (sourceKey is not null && !changedWithinWindow) Emit(new MonitorEvent("draftClear"));
                    sourceKey = current.SourceKey;
                    lastText = current.Text;
                    draft = changedWithinWindow && IsDraftEligible(current.Text)
                        ? current with { Revision = ++revision } : null;
                    if (draft is not null) Emit(new WritingEvent("draft", draft.Revision, draft.Text, draft.Bounds));
                }
                else if (current.Text != lastText)
                {
                    lastText = current.Text;
                    draft = IsDraftEligible(current.Text) ? current with { Revision = ++revision } : null;
                    if (draft is null) Emit(new MonitorEvent("draftClear"));
                    else Emit(new WritingEvent("draft", draft.Revision, draft.Text, draft.Bounds));
                }
            }
            catch
            {
                if (sourceKey is not null) Emit(new MonitorEvent("draftClear"));
                sourceKey = null;
                lastText = null;
                draft = null;
            }

            Thread.Sleep(WritingPollIntervalMs);
        }
    }

    private static bool IsDraftEligible(string text) =>
        text.Length is >= 12 and <= MaxDraftLength &&
        text.Count(char.IsLetter) >= 8 &&
        text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length >= 4;

    private static DraftSnapshot? ReadDraft(IntPtr foreground)
    {
        if (foreground == IntPtr.Zero) return null;
        var focused = AutomationElement.FocusedElement;
        for (var depth = 0; focused is not null && depth < MaxAncestorDepth; depth++)
        {
            var type = focused.Current.ControlType;
            if ((type == ControlType.Edit || type == ControlType.Document) &&
                focused.Current.IsEnabled && !focused.Current.IsPassword &&
                focused.TryGetCurrentPattern(TextPattern.Pattern, out var patternObject) &&
                patternObject is TextPattern pattern)
            {
                if (pattern.DocumentRange.GetAttributeValue(TextPattern.IsReadOnlyAttribute) is true) return null;
                var selections = pattern.GetSelection();
                if (selections.Length != 1 || !string.IsNullOrEmpty(selections[0].GetText(2))) return null;

                var line = selections[0].Clone();
                line.ExpandToEnclosingUnit(TextUnit.Line);
                var text = line.GetText(MaxDraftLength + 10).Trim();
                if (text.Length > MaxDraftLength || text.Contains('\n') || text.Contains('\r')) return null;
                var exactRange = line.FindText(text, false, true);
                if (exactRange is null || exactRange.GetText(MaxDraftLength + 1) != text) return null;
                var rect = selections[0].GetBoundingRectangles().LastOrDefault(r => !r.IsEmpty && r.Width >= 0 && r.Height > 0);
                if (rect.IsEmpty || rect.Height <= 0)
                    rect = exactRange.GetBoundingRectangles().LastOrDefault(r => !r.IsEmpty && r.Width > 0 && r.Height > 0);
                if (rect.IsEmpty || rect.Height <= 0) return null;
                var elementRect = focused.Current.BoundingRectangle;
                var key = $"{foreground}:{type.Id}:{elementRect.Left:0}";
                return new DraftSnapshot(0, key, text, new Bounds(rect.Left, rect.Top, Math.Max(rect.Width, 1), rect.Height), foreground, focused, exactRange, selections[0].Clone());
            }

            focused = TreeWalker.ControlViewWalker.GetParent(focused);
        }

        return null;
    }

    private static void ProcessWritingCommand(string line, DraftSnapshot? draft)
    {
        try
        {
            using var json = JsonDocument.Parse(line);
            var root = json.RootElement;
            var commandType = root.GetProperty("type").GetString();
            if (commandType == "focusPopup")
            {
                var popupRevision = root.GetProperty("revision").GetInt32();
                var handleText = root.GetProperty("window").GetString();
                var focused = false;
                if (long.TryParse(handleText, out var handleValue))
                {
                    var popup = new IntPtr(handleValue);
                    GetWindowThreadProcessId(popup, out var popupProcessId);
                    if (IsWindow(popup) && popupProcessId == ignoredProcessId)
                    {
                        for (var attempt = 0; attempt < 3 && !focused; attempt++)
                        {
                            focused = ActivateWindow(popup);
                            if (!focused) Thread.Sleep(60);
                        }
                        if (!focused)
                        {
                            var alt = new[] { KeyDown(0x12), KeyUp(0x12) };
                            if (SendInput(2, alt, Marshal.SizeOf<KeyboardInputEvent>()) == 2)
                            {
                                Thread.Sleep(40);
                                focused = ActivateWindow(popup);
                            }
                        }
                    }
                    else Console.Error.WriteLine("Writing popup focus rejected: window or process mismatch.");
                }
                if (!focused) Console.Error.WriteLine("Writing popup did not become foreground.");
                Emit(new FocusEvent("popupFocusResult", popupRevision, focused));
                return;
            }
            if (commandType == "restoreFocus")
            {
                var focusRevision = root.GetProperty("revision").GetInt32();
                var focused = false;
                try
                {
                    focused = draft is not null && draft.Revision == focusRevision &&
                        IsWindow(draft.Window) && TryPrepareDraftTarget(draft, out _);
                }
                catch (Exception error)
                {
                    Console.Error.WriteLine($"Writing focus restore failed: {error.GetType().Name}");
                }
                Emit(new FocusEvent("focusResult", focusRevision, focused));
                return;
            }
            if (commandType != "apply") return;
            var revision = root.GetProperty("revision").GetInt32();
            var mode = root.GetProperty("mode").GetString();
            var replacement = root.GetProperty("text").GetString();
            if (draft is null || revision != draft.Revision ||
                mode is not ("replace" or "insert") ||
                string.IsNullOrWhiteSpace(replacement) || replacement.Length > 500 ||
                !IsWindow(draft.Window) || draft.ExactRange.GetText(MaxDraftLength + 1) != draft.Text)
            {
                Emit(new ApplyEvent("applyResult", revision, false, "Văn bản đã thay đổi. Hãy thử lại."));
                return;
            }

            if (!TryPrepareDraftTarget(draft, out var currentPattern))
            {
                Emit(new ApplyEvent("applyResult", revision, false, "Không thể chuyển về ô đang viết. Hãy thử lại."));
                return;
            }
            if (draft.ExactRange.GetText(MaxDraftLength + 1) != draft.Text)
            {
                Emit(new ApplyEvent("applyResult", revision, false, "Văn bản đã thay đổi. Hãy thử lại."));
                return;
            }
            if (mode == "insert")
            {
                var currentSelection = currentPattern.GetSelection();
                if (currentSelection.Length != 1 || !draft.CaretRange.Compare(currentSelection[0]))
                {
                    Emit(new ApplyEvent("applyResult", revision, false, "Vị trí con trỏ đã thay đổi. Hãy thử lại."));
                    return;
                }
            }

            if (mode == "replace")
            {
                var selected = false;
                for (var attempt = 0; attempt < 3 && !selected; attempt++)
                {
                    try { selected = SelectDraftText(draft, currentPattern); }
                    catch (Exception error) when (error is InvalidOperationException or COMException)
                    { /* Retry after the editor settles. */ }
                    if (!selected) Thread.Sleep(70);
                }
                if (!selected)
                {
                    Emit(new ApplyEvent("applyResult", revision, false, "Không chọn được đúng câu cần sửa trong ô này."));
                    return;
                }
            }
            else draft.CaretRange.Select();
            var pasted = PasteAndVerify(draft, mode!, replacement);
            Emit(new ApplyEvent("applyResult", revision, pasted,
                pasted ? null : "Không xác nhận được câu sau khi dán. Hãy kiểm tra nội dung trong ô viết."));
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"Writing apply failed: {error.GetType().Name}: {error.Message}");
            Emit(new ApplyEvent("applyResult", draft?.Revision ?? 0, false, "Không áp dụng được bản sửa trong ô này."));
        }
    }

    private static bool PasteAndVerify(DraftSnapshot draft, string mode, string replacement)
    {
        if (OleGetClipboard(out var previousClipboard) != 0) return false;
        uint temporarySequence = 0;
        try
        {
            System.Windows.Clipboard.SetText(replacement);
            temporarySequence = GetClipboardSequenceNumber();

            for (var wait = 0; wait < 25 &&
                (GetAsyncKeyState(0x11) < 0 || GetAsyncKeyState(0x12) < 0); wait++)
                Thread.Sleep(20);
            if (GetAsyncKeyState(0x11) < 0 || GetAsyncKeyState(0x12) < 0) return false;

            var pasteKeys = new[]
            {
                KeyDown(0x11), KeyDown(0x56), KeyUp(0x56), KeyUp(0x11)
            };
            if (SendInput((uint)pasteKeys.Length, pasteKeys, Marshal.SizeOf<KeyboardInputEvent>()) != pasteKeys.Length)
                return false;

            for (var attempt = 0; attempt < 6; attempt++)
            {
                Thread.Sleep(100);
                var applied = ReadDraft(draft.Window);
                if (applied is not null && (mode == "replace"
                    ? applied.Text == replacement
                    : applied.Text.Contains(replacement, StringComparison.Ordinal))) return true;
            }
            return false;
        }
        finally
        {
            if (temporarySequence != 0 && GetClipboardSequenceNumber() == temporarySequence)
            {
                for (var attempt = 0; attempt < 3; attempt++)
                {
                    if (OleSetClipboard(previousClipboard) == 0) break;
                    Thread.Sleep(35);
                }
            }
            if (previousClipboard != IntPtr.Zero) Marshal.Release(previousClipboard);
        }
    }

    private static bool TryPrepareDraftTarget(DraftSnapshot draft, out TextPattern pattern)
    {
        pattern = null!;
        for (var attempt = 0; attempt < 3; attempt++)
        {
            try
            {
                if (GetForegroundWindow() != draft.Window) ActivateWindow(draft.Window);
                draft.Target.SetFocus();
                Thread.Sleep(70);
                if (GetForegroundWindow() == draft.Window &&
                    draft.Target.TryGetCurrentPattern(TextPattern.Pattern, out var objectPattern) &&
                    objectPattern is TextPattern textPattern)
                {
                    pattern = textPattern;
                    return true;
                }
            }
            catch (Exception error) when (error is InvalidOperationException or COMException)
            { /* The editor can recreate its accessibility element while focusing. */ }
            Thread.Sleep(70);
        }
        return false;
    }

    private static bool SelectDraftText(DraftSnapshot draft, TextPattern pattern)
    {
        try
        {
            draft.ExactRange.Select();
            Thread.Sleep(50);
            var selected = pattern.GetSelection();
            if (selected.Length == 1 && selected[0].GetText(MaxDraftLength + 1).Trim() == draft.Text) return true;
        }
        catch (Exception error) when (error is InvalidOperationException or COMException)
        { /* Some editors do not support selecting a UIA text range. */ }

        draft.CaretRange.Select();
        var keys = new[]
        {
            KeyDown(0x24), KeyUp(0x24),
            KeyDown(0x10), KeyDown(0x23), KeyUp(0x23), KeyUp(0x10)
        };
        if (SendInput((uint)keys.Length, keys, Marshal.SizeOf<KeyboardInputEvent>()) != keys.Length) return false;
        Thread.Sleep(40);
        var fallbackSelection = pattern.GetSelection();
        return fallbackSelection.Length == 1 && fallbackSelection[0].GetText(MaxDraftLength + 1).Trim() == draft.Text;
    }

    private static KeyboardInputEvent KeyDown(ushort key) => new()
    {
        Type = 1, Keyboard = new KeyboardData { VirtualKey = key }
    };

    private static KeyboardInputEvent KeyUp(ushort key) => new()
    {
        Type = 1, Keyboard = new KeyboardData { VirtualKey = key, Flags = 0x0002 }
    };

    private static bool ActivateWindow(IntPtr target)
    {
        if (GetForegroundWindow() == target) return true;

        var currentThread = GetCurrentThreadId();
        var foregroundThread = GetWindowThreadProcessId(GetForegroundWindow(), out _);
        var attached = foregroundThread != 0 && foregroundThread != currentThread &&
            AttachThreadInput(currentThread, foregroundThread, true);
        try
        {
            SetForegroundWindow(target);
        }
        finally
        {
            if (attached) AttachThreadInput(currentThread, foregroundThread, false);
        }
        return GetForegroundWindow() == target;
    }

    [StructLayout(LayoutKind.Explicit, Size = 40)]
    private struct KeyboardInputEvent
    {
        [FieldOffset(0)] public uint Type;
        [FieldOffset(8)] public KeyboardData Keyboard;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KeyboardData
    {
        public ushort VirtualKey;
        public ushort Scan;
        public uint Flags;
        public uint Time;
        public IntPtr ExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint count, KeyboardInputEvent[] inputs, int size);

    [DllImport("ole32.dll")]
    private static extern int OleInitialize(IntPtr reserved);

    [DllImport("ole32.dll")]
    private static extern int OleGetClipboard(out IntPtr dataObject);

    [DllImport("ole32.dll")]
    private static extern int OleSetClipboard(IntPtr dataObject);

    [DllImport("user32.dll")]
    private static extern uint GetClipboardSequenceNumber();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr window);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AttachThreadInput(uint attach, uint attachTo, [MarshalAs(UnmanagedType.Bool)] bool attachInput);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr window);

    private sealed record DraftSnapshot(int Revision, string SourceKey, string Text, Bounds Bounds,
        IntPtr Window, AutomationElement Target, TextPatternRange ExactRange, TextPatternRange CaretRange);
    private sealed record WritingEvent(string Type, int Revision, string Text, Bounds Bounds);
    private sealed record ApplyEvent(string Type, int Revision, bool Success, string? Error);
    private sealed record FocusEvent(string Type, int Revision, bool Success);

    private static void ReportMissing(ref string? lastSignature, ref int missingCount, ref bool clearSent)
    {
        missingCount++;
        if (!clearSent && missingCount >= MissingSelectionThreshold)
        {
            lastSignature = null;
            clearSent = true;
            Emit(new MonitorEvent("clear"));
        }
    }

    private static Selection? ReadSelection()
    {
        try
        {
            var current = AutomationElement.FocusedElement;
            for (var depth = 0; current is not null && depth < MaxAncestorDepth; depth++)
            {
                if (current.TryGetCurrentPattern(TextPattern.Pattern, out var patternObject) &&
                    patternObject is TextPattern textPattern)
                {
                    var ranges = textPattern.GetSelection();
                    var selectedParts = new List<string>();
                    var rectangles = new List<System.Windows.Rect>();

                    foreach (var range in ranges)
                    {
                        var text = range.GetText(MaxTextLength).Trim();
                        if (!string.IsNullOrWhiteSpace(text)) selectedParts.Add(text);
                        rectangles.AddRange(range.GetBoundingRectangles());
                    }

                    var combinedText = string.Join(Environment.NewLine, selectedParts);
                    var lastBounds = rectangles.LastOrDefault(rect =>
                        !rect.IsEmpty && rect.Width > 0 && rect.Height > 0);

                    if (!string.IsNullOrWhiteSpace(combinedText) &&
                        !lastBounds.IsEmpty && lastBounds.Width > 0 && lastBounds.Height > 0)
                    {
                        if (combinedText.Length > MaxTextLength)
                            combinedText = combinedText[..MaxTextLength];

                        return new Selection(combinedText, new Bounds(
                            lastBounds.Left, lastBounds.Top, lastBounds.Width, lastBounds.Height));
                    }
                }

                current = TreeWalker.ControlViewWalker.GetParent(current);
            }
        }
        catch (ElementNotAvailableException)
        {
            // The focused accessibility element can disappear during a selection change.
        }
        catch (InvalidOperationException)
        {
            // Some accessibility providers invalidate a range between UIA calls.
        }

        return null;
    }

    private static void Emit(object monitorEvent)
    {
        Console.WriteLine(JsonSerializer.Serialize(monitorEvent, JsonOptions));
        Console.Out.Flush();
    }

    private static bool IsSelectionGestureActive() =>
        GetAsyncKeyState(VirtualKeyLeftMouseButton) < 0 ||
        GetAsyncKeyState(VirtualKeyShift) < 0;

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int virtualKey);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetCursorPos(out NativePoint point);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint { public int X; public int Y; }

    private sealed record ClickEvent(string Type, int X, int Y, string? ForegroundProcess);
    private sealed record Selection(string Text, Bounds Bounds);
    private sealed record Bounds(double X, double Y, double Width, double Height);
    private sealed record MonitorEvent(string Type, string? Text = null, Bounds? Bounds = null);
}
