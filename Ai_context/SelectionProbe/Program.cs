using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Automation;
using System.Windows.Forms;

namespace Lexforge.SelectionProbe;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new ProbeForm());
    }
}

internal sealed class ProbeForm : Form
{
    private const int HotkeyId = 0x4C58;
    private const int WmHotkey = 0x0312;
    private const uint ModControl = 0x0002;
    private const uint ModShift = 0x0004;
    private const uint ModNoRepeat = 0x4000;
    private const uint VkF8 = 0x77;

    private readonly Label statusLabel;
    private readonly Label detailsLabel;
    private readonly TextBox selectionBox;
    private bool hotkeyRegistered;
    private int requestNumber;

    public ProbeForm()
    {
        Text = "Lexforge — Selection Probe";
        Width = 760;
        Height = 520;
        MinimumSize = new Size(620, 400);
        StartPosition = FormStartPosition.CenterScreen;

        var heading = new Label
        {
            AutoSize = true,
            Font = new Font("Segoe UI", 15, FontStyle.Bold),
            Text = "Kiểm tra vùng văn bản được chọn",
            Location = new Point(22, 20)
        };

        statusLabel = new Label
        {
            AutoSize = false,
            Font = new Font("Segoe UI", 10),
            Text = "Đang khởi tạo phím chẩn đoán…",
            Location = new Point(24, 62),
            Size = new Size(690, 56)
        };

        detailsLabel = new Label
        {
            AutoSize = false,
            Font = new Font("Segoe UI", 9),
            ForeColor = Color.DimGray,
            Text = "Chưa có lần đọc nào.",
            Location = new Point(24, 125),
            Size = new Size(690, 94)
        };

        selectionBox = new TextBox
        {
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
            WordWrap = true,
            Font = new Font("Segoe UI", 10),
            Location = new Point(24, 228),
            Size = new Size(690, 190),
            Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right,
            Text = "Văn bản được chọn sẽ chỉ hiển thị ở đây trong phiên chẩn đoán hiện tại."
        };

        var privacyNote = new Label
        {
            AutoSize = false,
            Font = new Font("Segoe UI", 8),
            ForeColor = Color.DimGray,
            Text = "Công cụ thử nghiệm chỉ đọc khi bạn nhấn tổ hợp phím. Không dùng clipboard, không gửi dữ liệu qua mạng, không lưu lịch sử.",
            Location = new Point(24, 434),
            Size = new Size(690, 36),
            Anchor = AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right
        };

        Controls.AddRange([heading, statusLabel, detailsLabel, selectionBox, privacyNote]);
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        hotkeyRegistered = RegisterHotKey(Handle, HotkeyId, ModControl | ModShift | ModNoRepeat, VkF8);
        statusLabel.Text = hotkeyRegistered
            ? "Sẵn sàng — bôi đen câu mẫu trong ứng dụng cần thử rồi nhấn Ctrl+Shift+F8. Sau khi đọc, Probe sẽ tự hiện kết quả."
            : "LỖI: không đăng ký được Ctrl+Shift+F8. Hãy đóng/mở lại Probe hoặc chọn phím thử khác.";
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WmHotkey && m.WParam.ToInt32() == HotkeyId)
        {
            CaptureSelection();
            return;
        }

        base.WndProc(ref m);
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        if (hotkeyRegistered)
            UnregisterHotKey(Handle, HotkeyId);

        base.OnFormClosed(e);
    }

    private async void CaptureSelection()
    {
        var currentRequest = ++requestNumber;
        var stopwatch = Stopwatch.StartNew();
        statusLabel.Text = "Đang đọc vùng chọn qua Windows UI Automation…";

        SelectionSnapshot snapshot;
        try
        {
            snapshot = await Task.Run(SelectionReader.ReadForegroundSelection);
        }
        catch (Exception ex)
        {
            snapshot = SelectionSnapshot.Failure($"{ex.GetType().Name}: {ex.Message}");
        }
        stopwatch.Stop();

        if (IsDisposed || currentRequest != requestNumber)
            return;

        statusLabel.Text = snapshot.Found
            ? "Đã đọc được vùng chọn. Nội dung chỉ nằm trong cửa sổ chẩn đoán."
            : "Chưa đọc được vùng chọn trong ứng dụng đang hoạt động.";
        detailsLabel.Text = $"{snapshot.Details}\nThời gian truy vấn: {stopwatch.ElapsedMilliseconds} ms.";
        selectionBox.Text = snapshot.Found
            ? snapshot.Text
            : "Không tìm thấy vùng chọn có văn bản. Hãy thử chọn một câu thông thường, không chọn ảnh hoặc nội dung đặc biệt.";

        WindowState = FormWindowState.Normal;
        Show();
        Activate();
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}

internal static class SelectionReader
{
    private const int MaxTextLength = 4000;
    private const int MaxAncestorDepth = 12;

    public static SelectionSnapshot ReadForegroundSelection()
    {
        var foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero)
            return SelectionSnapshot.Failure("Windows không trả về cửa sổ đang hoạt động.");

        GetWindowThreadProcessId(foreground, out var processId);
        var title = GetWindowTitle(foreground);
        var processName = GetProcessName(processId);
        var appDescription = string.IsNullOrWhiteSpace(title)
            ? processName
            : $"{processName} — {title}";

        try
        {
            var focused = AutomationElement.FocusedElement;
            var current = focused;

            for (var depth = 0; current is not null && depth < MaxAncestorDepth; depth++)
            {
                var result = TryReadTextSelection(current);
                if (result is not null)
                {
                    return SelectionSnapshot.Success(
                        appDescription,
                        result.ElementDescription,
                        result.Text,
                        result.Rectangles);
                }

                current = TreeWalker.ControlViewWalker.GetParent(current);
            }

            var focusedDescription = DescribeElement(focused);
            return SelectionSnapshot.Failure(
                $"Ứng dụng: {appDescription}\n" +
                $"Phần tử có focus: {focusedDescription}\n" +
                "Các phần tử được kiểm tra không cung cấp TextPattern.GetSelection() với văn bản đã chọn.");
        }
        catch (ElementNotAvailableException)
        {
            return SelectionSnapshot.Failure(
                $"Ứng dụng: {appDescription}\n" +
                "Phần tử giao diện đã thay đổi trong lúc truy vấn UI Automation. Hãy thử lại ngay sau khi bôi đen.");
        }
        catch (Exception ex)
        {
            return SelectionSnapshot.Failure(
                $"Ứng dụng: {appDescription}\n" +
                $"UI Automation trả về {ex.GetType().Name}: {ex.Message}");
        }
    }

    private static SelectionResult? TryReadTextSelection(AutomationElement element)
    {
        if (!element.TryGetCurrentPattern(TextPattern.Pattern, out var patternObject) ||
            patternObject is not TextPattern textPattern)
        {
            return null;
        }

        var ranges = textPattern.GetSelection();
        if (ranges.Length == 0)
            return null;

        var selectedParts = new List<string>();
        var rectangles = new List<System.Windows.Rect>();

        foreach (var range in ranges)
        {
            var part = range.GetText(MaxTextLength).Trim();
            if (!string.IsNullOrWhiteSpace(part))
                selectedParts.Add(part);

            var bounds = range.GetBoundingRectangles();
            rectangles.AddRange(bounds);
        }

        var text = string.Join(Environment.NewLine, selectedParts);
        if (string.IsNullOrWhiteSpace(text))
            return null;

        if (text.Length >= MaxTextLength)
            text += Environment.NewLine + "[Đã cắt bớt ở giới hạn chẩn đoán 4.000 ký tự.]";

        return new SelectionResult(DescribeElement(element), text, rectangles);
    }

    private static string DescribeElement(AutomationElement element)
    {
        try
        {
            var name = element.Current.Name;
            var controlType = element.Current.ControlType.ProgrammaticName;
            return string.IsNullOrWhiteSpace(name) ? controlType : $"{controlType} — {name}";
        }
        catch
        {
            return "Không đọc được tên phần tử";
        }
    }

    private static string GetWindowTitle(IntPtr handle)
    {
        var buffer = new StringBuilder(512);
        _ = GetWindowText(handle, buffer, buffer.Capacity);
        return buffer.ToString();
    }

    private static string GetProcessName(uint processId)
    {
        try
        {
            return Process.GetProcessById((int)processId).ProcessName;
        }
        catch
        {
            return $"PID {processId}";
        }
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}

internal sealed record SelectionResult(string ElementDescription, string Text, List<System.Windows.Rect> Rectangles);

internal sealed record SelectionSnapshot(bool Found, string Text, string Details)
{
    public static SelectionSnapshot Success(
        string appDescription,
        string elementDescription,
        string text,
        List<System.Windows.Rect> rectangles)
    {
        var first = rectangles.FirstOrDefault();
        var boundsText = rectangles.Count == 0
            ? "UIA không trả về hình chữ nhật vùng chọn."
            : $"Hình chữ nhật đầu tiên: X={first.Left:0}, Y={first.Top:0}, W={first.Width:0}, H={first.Height:0} px; tổng {rectangles.Count} hình.";

        return new SelectionSnapshot(
            true,
            text,
            $"Ứng dụng: {appDescription}\nPhần tử: {elementDescription}\n{boundsText}");
    }

    public static SelectionSnapshot Failure(string details) => new(false, "", details);
}
