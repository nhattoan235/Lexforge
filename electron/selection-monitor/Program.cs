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
    private const int IdlePollIntervalMs = 100;
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
        var selectionReadScheduler = new InputReadScheduler(70, 700);

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
                selectionReadScheduler.Reset();
                Thread.Sleep(SelectionGesturePollIntervalMs);
                continue;
            }

            try
            {
                var foreground = GetForegroundWindow();
                if (!selectionReadScheduler.ShouldRead(Environment.TickCount64, foreground, 0))
                {
                    Thread.Sleep(IdlePollIntervalMs);
                    continue;
                }
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
        GetCursorPos(out var lastPoint);
        while (true)
        {
            var isDown = IsMouseButtonDown();
            if (isDown && !wasDown && GetCursorPos(out var point))
            {
                lastPoint = point;
                var target = WindowFromPoint(point);
                var targetRoot = target == IntPtr.Zero ? IntPtr.Zero : GetAncestor(target, 3); // GA_ROOTOWNER
                string? foregroundProcess = null;
                var foreground = GetForegroundWindow();
                if (foreground != IntPtr.Zero)
                {
                    GetWindowThreadProcessId(foreground, out var processId);
                    try { foregroundProcess = Process.GetProcessById((int)processId).ProcessName; }
                    catch { /* The foreground process can exit between calls. */ }
                }

                Console.WriteLine(JsonSerializer.Serialize(new ClickEvent("mouseDown", point.X, point.Y,
                    foregroundProcess, targetRoot == IntPtr.Zero ? null : targetRoot.ToInt64().ToString()), JsonOptions));
                Console.Out.Flush();
            }
            else if (isDown && GetCursorPos(out point) &&
                     (point.X != lastPoint.X || point.Y != lastPoint.Y))
            {
                lastPoint = point;
                Emit(new ClickEvent("mouseMove", point.X, point.Y, null, null));
            }
            else if (!isDown && wasDown && GetCursorPos(out point))
            {
                lastPoint = point;
                Emit(new ClickEvent("mouseUp", point.X, point.Y, null, null));
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
        // Wait for a full pause in typing before reading UI Automation or suggesting a correction.
        var draftReadScheduler = new InputReadScheduler(700, 2000);
        var previousInputTick = CurrentInputTick();
        GetCursorPos(out var previousCursor);
        var previousForeground = IntPtr.Zero;
        var inputObservedInWindow = false;
        Emit(new MonitorEvent("writingReady"));

        while (true)
        {
            while (commands.TryDequeue(out var line)) ProcessWritingCommand(line, draft);

            try
            {
                var foreground = GetForegroundWindow();
                if (foreground != previousForeground)
                {
                    previousForeground = foreground;
                    inputObservedInWindow = false;
                }
                var inputTick = CurrentInputTick();
                var inputChanged = inputTick != previousInputTick;
                previousInputTick = inputTick;
                var cursorMoved = GetCursorPos(out var cursor) &&
                    (cursor.X != previousCursor.X || cursor.Y != previousCursor.Y);
                previousCursor = cursor;
                var shouldRead = draftReadScheduler.ShouldRead(Environment.TickCount64, foreground, inputTick);
                GetWindowThreadProcessId(foreground, out var processId);
                if (processId == ignoredProcessId || processId == (uint)Environment.ProcessId)
                {
                    Thread.Sleep(WritingPollIntervalMs);
                    continue;
                }

                if (inputChanged && !cursorMoved && !IsMouseButtonDown())
                {
                    inputObservedInWindow = true;
                    if (sourceKey is not null)
                    {
                        Emit(new MonitorEvent("draftInput"));
                        draft = null;
                        lastText = null;
                    }
                }

                if (IsMouseButtonDown() || !shouldRead)
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
                    var changedWithinWindow = draft is not null && current.Window == draft.Window;
                    if (sourceKey is not null && !changedWithinWindow) Emit(new MonitorEvent("draftClear"));
                    sourceKey = current.SourceKey;
                    lastText = current.Text;
                    draft = (changedWithinWindow || inputObservedInWindow) && SentenceSegmenter.IsDraftEligible(current.Text, MaxDraftLength)
                        ? current with { Revision = ++revision } : null;
                    if (draft is not null) Emit(new WritingEvent("draft", draft.Revision, draft.Text, draft.Bounds));
                }
                else if (current.Text != lastText)
                {
                    lastText = current.Text;
                    draft = SentenceSegmenter.IsDraftEligible(current.Text, MaxDraftLength) ? current with { Revision = ++revision } : null;
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

    private static DraftSnapshot? ReadDraft(IntPtr foreground)
    {
        if (foreground == IntPtr.Zero) return null;
        var focused = AutomationElement.FocusedElement;
        for (var depth = 0; focused is not null && depth < MaxAncestorDepth; depth++)
        {
            var type = focused.Current.ControlType;
            if ((type == ControlType.Edit || type == ControlType.Document ||
                 (type == ControlType.Custom && focused.Current.IsKeyboardFocusable)) &&
                focused.Current.IsEnabled && !focused.Current.IsPassword &&
                focused.TryGetCurrentPattern(TextPattern.Pattern, out var patternObject) &&
                patternObject is TextPattern pattern)
            {
                if (pattern.DocumentRange.GetAttributeValue(TextPattern.IsReadOnlyAttribute) is true) return null;
                var selections = pattern.GetSelection();
                if (selections.Length != 1 || !string.IsNullOrEmpty(selections[0].GetText(2))) return null;

                // Read the logical paragraph around the caret, then keep only its active sentence.
                // A visual UIA Line can contain several sentences or just part of one wrapped sentence.
                var paragraph = selections[0].Clone();
                paragraph.ExpandToEnclosingUnit(TextUnit.Paragraph);
                var paragraphText = paragraph.GetText(MaxTextLength + 1);
                if (paragraphText.Length > MaxTextLength) return null;
                var beforeCaret = paragraph.Clone();
                beforeCaret.MoveEndpointByRange(TextPatternRangeEndpoint.End,
                    selections[0], TextPatternRangeEndpoint.Start);
                var prefix = beforeCaret.GetText(MaxTextLength + 1);
                if (!paragraphText.StartsWith(prefix, StringComparison.Ordinal)) return null;
                var span = SentenceSegmenter.FindActiveSentence(paragraphText, prefix.Length);
                if (span is null || span.Value.Length > MaxDraftLength) return null;
                var text = paragraphText.Substring(span.Value.Start, span.Value.Length);
                if (text.Contains('\n') || text.Contains('\r')) return null;

                // Map the segment back to a provider range and verify it exactly before use.
                var exactRange = paragraph.Clone();
                exactRange.MoveEndpointByRange(TextPatternRangeEndpoint.End,
                    paragraph, TextPatternRangeEndpoint.Start);
                if (span.Value.Start > 0)
                    exactRange.MoveEndpointByUnit(TextPatternRangeEndpoint.Start,
                        TextUnit.Character, span.Value.Start);
                exactRange.MoveEndpointByUnit(TextPatternRangeEndpoint.End,
                    TextUnit.Character, span.Value.Length);
                if (exactRange.GetText(MaxDraftLength + 1) != text) return null;
                var rect = selections[0].GetBoundingRectangles().LastOrDefault(r => !r.IsEmpty && r.Height > 0);
                if (rect.IsEmpty || rect.Height <= 0)
                    rect = exactRange.GetBoundingRectangles().LastOrDefault(r => !r.IsEmpty && r.Width > 0 && r.Height > 0);
                if (rect.IsEmpty || rect.Height <= 0) return null;
                var paragraphRect = paragraph.GetBoundingRectangles().FirstOrDefault(r => !r.IsEmpty);
                var elementRect = focused.Current.BoundingRectangle;
                var key = $"{foreground}:{type.Id}:{elementRect.Left:0}:{paragraphRect.Top:0}:{span.Value.Start}";
                return new DraftSnapshot(0, key, text,
                    new Bounds(rect.Left, rect.Top, Math.Max(rect.Width, 1), rect.Height),
                    foreground, focused, exactRange, selections[0].Clone());
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
                mode is not ("replace" or "replaceTranslation") ||
                string.IsNullOrWhiteSpace(replacement) || replacement.Length > 500 ||
                !IsWindow(draft.Window) || draft.ExactRange.GetText(MaxDraftLength + 1) != draft.Text)
            {
                Emit(new ApplyEvent("applyResult", revision, false, "Văn bản đã thay đổi. Hãy thử lại."));
                return;
            }

            Console.Error.WriteLine("Writing apply phase: focus target");
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
            if (mode is "replace" or "replaceTranslation")
            {
                Console.Error.WriteLine("Writing apply phase: select text");
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
            Console.Error.WriteLine("Writing apply phase: type and verify");
            var applied = TypeAndVerify(draft, replacement, out var applyError);
            if (!applied)
            {
                try
                {
                    if (draft.ExactRange.GetText(MaxDraftLength + 1) == draft.Text)
                        draft.CaretRange.Select();
                }
                catch (Exception error) when (error is InvalidOperationException or COMException)
                { /* Keep the original content untouched if the editor changed. */ }
            }
            Emit(new ApplyEvent("applyResult", revision, applied,
                applied ? null : applyError ?? "Không xác nhận được câu sau khi thay. Hãy kiểm tra nội dung trong ô viết."));
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"Writing apply failed: {error.GetType().Name}: {error.Message}");
            Emit(new ApplyEvent("applyResult", draft?.Revision ?? 0, false, "Không áp dụng được bản sửa trong ô này."));
        }
    }

    private static bool TypeAndVerify(DraftSnapshot draft, string replacement, out string? failure)
    {
        failure = null;
        // Send Unicode keystrokes instead of replacing the user's clipboard.
        // This also works when the clipboard currently contains an image or file.
        for (var wait = 0; wait < 25 &&
            (GetAsyncKeyState(0x11) < 0 || GetAsyncKeyState(0x12) < 0 || GetAsyncKeyState(0x10) < 0); wait++)
            Thread.Sleep(20);
        if (GetAsyncKeyState(0x11) < 0 || GetAsyncKeyState(0x12) < 0 || GetAsyncKeyState(0x10) < 0)
        {
            failure = "Hãy nhả Ctrl, Alt và Shift rồi thử lại.";
            return false;
        }
        if (GetForegroundWindow() != draft.Window)
        {
            failure = "Ô viết mất focus trước khi thay câu. Hãy thử lại.";
            return false;
        }

        var inputs = new KeyboardInputEvent[replacement.Length * 2];
        for (var i = 0; i < replacement.Length; i++)
        {
            inputs[i * 2] = UnicodeKey(replacement[i], false);
            inputs[i * 2 + 1] = UnicodeKey(replacement[i], true);
        }
        if (SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<KeyboardInputEvent>()) != inputs.Length)
        {
            failure = "Windows không gửi được văn bản vào ô viết. Hãy thử lại.";
            return false;
        }

        for (var attempt = 0; attempt < 6; attempt++)
        {
            Thread.Sleep(100);
            var applied = ReadDraft(draft.Window);
            if (applied is not null && applied.Text == replacement)
            {
                Thread.Sleep(800);
                if (ReadDraft(draft.Window)?.Text == replacement) return true;
                break;
            }
        }
        failure = GetForegroundWindow() == draft.Window
            ? "Đã gửi câu sửa nhưng chưa xác nhận được nội dung trong ô viết. Hãy kiểm tra ô viết rồi thử lại."
            : "Ô viết mất focus trước khi xác nhận bản sửa. Hãy thử lại.";
        return false;
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
        // Focusing a web editor after the popup closes can move its caret. Ask the
        // provider to select the verified sentence range directly before using keys.
        try
        {
            draft.ExactRange.Select();
            Thread.Sleep(90);
            if (SelectionMatchesDraft(pattern, draft.Text)) return true;
        }
        catch (Exception error) when (error is InvalidOperationException or COMException)
        { /* Some editors do not implement range selection; use the guarded fallback. */ }

        for (var wait = 0; wait < 25 &&
            (GetAsyncKeyState(0x11) < 0 || GetAsyncKeyState(0x12) < 0 || GetAsyncKeyState(0x10) < 0); wait++)
            Thread.Sleep(20);
        if (GetAsyncKeyState(0x11) < 0 || GetAsyncKeyState(0x12) < 0 || GetAsyncKeyState(0x10) < 0)
            return false;

        // Ctrl+A is safe only if this text provider contains exactly the target sentence.
        if (pattern.DocumentRange.GetText(MaxDraftLength + 10).Trim() == draft.Text)
        {
            var selectAll = new[] { KeyDown(0x11), KeyDown(0x41), KeyUp(0x41), KeyUp(0x11) };
            if (SendInput((uint)selectAll.Length, selectAll, Marshal.SizeOf<KeyboardInputEvent>()) != selectAll.Length)
                return false;
            Thread.Sleep(90);
            return SelectionMatchesDraft(pattern, draft.Text);
        }

        // For one sentence within several, move from the saved caret to the exact
        // sentence start and extend the selection by its length. Never paste unless
        // UI Automation confirms that only the intended sentence is selected.
        var currentSelection = pattern.GetSelection();
        if (currentSelection.Length != 1 ||
            !currentSelection[0].Compare(draft.CaretRange) ||
            currentSelection[0].CompareEndpoints(TextPatternRangeEndpoint.Start,
                draft.ExactRange, TextPatternRangeEndpoint.Start) < 0 ||
            currentSelection[0].CompareEndpoints(TextPatternRangeEndpoint.Start,
                draft.ExactRange, TextPatternRangeEndpoint.End) > 0) return false;
        var beforeCaret = draft.ExactRange.Clone();
        beforeCaret.MoveEndpointByRange(TextPatternRangeEndpoint.End,
            currentSelection[0], TextPatternRangeEndpoint.Start);
        var distance = beforeCaret.GetText(MaxDraftLength + 1).Length;
        if (distance > draft.Text.Length) return false;
        if (!SendRepeatedKey(0x25, distance, false)) return false; // Left to sentence start.
        if (!SendRepeatedKey(0x27, draft.Text.Length, true)) return false; // Select right.
        Thread.Sleep(90);
        return SelectionMatchesDraft(pattern, draft.Text);
    }

    private static bool SendRepeatedKey(ushort key, int count, bool shift)
    {
        for (var sent = 0; sent < count; sent += 8)
        {
            var batch = new List<KeyboardInputEvent>();
            if (shift) batch.Add(KeyDown(0x10));
            for (var i = 0; i < Math.Min(8, count - sent); i++)
            {
                batch.Add(KeyDown(key));
                batch.Add(KeyUp(key));
            }
            if (shift) batch.Add(KeyUp(0x10));
            var inputs = batch.ToArray();
            if (SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<KeyboardInputEvent>()) != inputs.Length)
                return false;
            Thread.Sleep(15);
        }
        return true;
    }

    private static bool SelectionMatchesDraft(TextPattern pattern, string expected)
    {
        var selected = pattern.GetSelection();
        var actual = selected.Length == 1 ? selected[0].GetText(MaxDraftLength + 1).Trim() : string.Empty;
        if (actual == expected) return true;
        Console.Error.WriteLine($"Writing selection mismatch: ranges={selected.Length}, selectedLength={actual.Length}, expectedLength={expected.Length}");
        return false;
    }

    private static KeyboardInputEvent KeyDown(ushort key) => new()
    {
        Type = 1, Keyboard = new KeyboardData { VirtualKey = key }
    };

    private static KeyboardInputEvent KeyUp(ushort key) => new()
    {
        Type = 1, Keyboard = new KeyboardData { VirtualKey = key, Flags = 0x0002 }
    };

    private static KeyboardInputEvent UnicodeKey(char value, bool keyUp) => new()
    {
        Type = 1,
        Keyboard = new KeyboardData { Scan = value, Flags = keyUp ? 0x0006u : 0x0004u }
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
        catch (COMException)
        {
            // Third-party accessibility providers can disconnect while selection changes.
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

    private static uint CurrentInputTick()
    {
        var info = new LastInputInfo { Size = (uint)Marshal.SizeOf<LastInputInfo>() };
        return GetLastInputInfo(ref info) ? info.Time : 0;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct LastInputInfo { public uint Size; public uint Time; }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetLastInputInfo(ref LastInputInfo info);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern IntPtr WindowFromPoint(NativePoint point);

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int virtualKey);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetCursorPos(out NativePoint point);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint { public int X; public int Y; }

    private sealed record ClickEvent(string Type, int X, int Y, string? ForegroundProcess, string? TargetWindow);
    private sealed record Selection(string Text, Bounds Bounds);
    private sealed record Bounds(double X, double Y, double Width, double Height);
    private sealed record MonitorEvent(string Type, string? Text = null, Bounds? Bounds = null);
}
