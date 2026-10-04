# Kế hoạch mở rộng dịch nhanh và viết nhanh sang nhiều ứng dụng Windows

**Ngày:** 04-10-2026  
**Phạm vi:** nhiều ứng dụng và kiểu ô nhập trên Windows. macOS/Linux cần bộ tích hợp hệ điều hành riêng.

## 1. Hiện trạng đã xác minh

- Lexforge đang dùng sidecar .NET với Windows UI Automation. Dịch nhanh đọc vùng chọn bằng `TextPattern`; viết nhanh đọc đoạn quanh con trỏ, tách câu, tạo gợi ý Groq, chọn đúng dải chữ rồi gửi Unicode qua `SendInput`.
- Nguyên mẫu cũ đã xác nhận **đọc vùng chọn và tọa độ** trên ChatGPT desktop và Notepad. Chưa có kết quả đầy đủ cho Chrome, Edge, Word, Zalo và các ô nhập tùy biến. Kết quả đọc vùng chọn không đồng nghĩa đã kiểm tra thành công thao tác **Áp dụng**.
- `ReadDraft` hiện chỉ nhận phần tử có `TextPattern`; `WatchWriting` bỏ qua nhiều ô nhập nếu provider không có con trỏ/range phù hợp. Kiểm tra sau thay hiện chủ yếu so sánh câu đang đọc, chưa đối chiếu toàn bộ trường/đoạn trước và sau. Nhánh khởi tạo nguồn mới cũng chỉ phát gợi ý sau khi văn bản thay đổi, nên click vào một câu đã có sẵn có thể chưa kích hoạt.
- Popup và Groq dùng chung cho mọi ứng dụng; phần phụ thuộc ứng dụng tập trung ở phát hiện ô nhập, đọc con trỏ, chọn chữ và thay chữ.

## 2. Cơ sở kỹ thuật

- Microsoft mô tả `TextPattern` là giao diện đọc/chọn văn bản; nó không cung cấp thao tác sửa trực tiếp. `ValuePattern` có thể đặt giá trị cho một số ô nhập, còn ô khác cần nhập bằng bàn phím. [TextPattern overview](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-textpattern-overview), [Text box automation sample](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/add-content-to-a-text-box-using-ui-automation).
- Provider có thể không hỗ trợ đúng `TextUnit.Paragraph` mà chuyển sang đơn vị lớn hơn; range đã lưu có thể mất hiệu lực sau khi nội dung đổi. Vì vậy phải kiểm tra lại văn bản, con trỏ và dải chọn ngay trước khi áp dụng. [TextPattern overview](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-textpattern-overview).
- `SendInput` không thể nhập vào ứng dụng có mức quyền cao hơn Lexforge do UIPI; mã lỗi Windows không luôn chỉ ra nguyên nhân này. [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput).
- Với client theo dõi toàn desktop, Microsoft khuyến nghị UI Automation chạy trên luồng riêng không sở hữu cửa sổ và dùng COM MTA cho event handler. Sidecar hiện là tiến trình riêng nhưng `Main` đánh dấu STA; cần đánh giá và chuyển các cuộc gọi UIA sang worker MTA khi tách lại kiến trúc. [UI Automation threading](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-threading).

## 3. Quyết định kiến trúc

Không tạo ngoại lệ theo tên ứng dụng ngay từ đầu. Chẩn đoán **khả năng của ô nhập đang focus** rồi chọn một adapter:

| Loại ô nhập | Đọc và chọn | Áp dụng | Mức hỗ trợ dự kiến |
|---|---|---|---|
| `TextPattern` có caret và range chọn chính xác | Đọc đoạn, ánh xạ câu, xác nhận selection | Gõ Unicode vào selection, kiểm tra lại toàn đoạn/trường | Tự động đầy đủ nếu qua kiểm thử |
| `ValuePattern` đơn giản, trường ngắn | Đọc toàn giá trị; chỉ xác định câu khi vị trí con trỏ đủ tin cậy | `SetValue` toàn trường chỉ khi xác minh duy nhất dải cần sửa và provider phản ánh thay đổi; nếu không, không tự áp dụng | Theo khả năng thực tế |
| Có selection nhưng thiếu caret ổn định | Người dùng bôi đen và gọi phím tắt thủ công | Chỉ thay selection sau khi kiểm tra đúng văn bản | Thủ công có áp dụng |
| Văn bản chỉ đọc (PDF, trang web) | Đọc vùng chọn | Không áp dụng | Dịch/giải thích |
| Không cung cấp đủ dữ liệu hoặc bị Windows chặn | Không tự đoán bằng tọa độ/phím | Bảng nhập/dán hiện có | Thủ công |

Mỗi snapshot cần chứa cửa sổ đích, phần tử đích, loại adapter, văn bản gốc của trường/đoạn, con trỏ, vị trí câu và phiên bản nội dung. Trước khi thay phải kiểm tra snapshot còn đúng; sau khi thay phải đối chiếu **toàn đoạn/trường** với kết quả mong đợi, không chỉ thấy câu sửa xuất hiện ở đâu đó. Nếu không xác nhận được thì hiển thị lỗi rõ ràng và không báo thành công.

## 4. Trình tự thực hiện và cổng kiểm thử

### A. Khảo sát trước khi sửa luồng chính

Tạo chế độ chẩn đoán chỉ đọc cho ô đang focus: process/loại control, `TextPattern`/`ValuePattern`, read-only/password, caret, selection, paragraph/value, bounds, mức quyền và độ trễ. Mặc định chỉ hiển thị số ký tự và trạng thái; không lưu nội dung người dùng vào log.

Thử trên cùng một bộ câu trong: ChatGPT desktop, Notepad, Chrome và Edge (ô một dòng, `textarea`, `contenteditable`), Zalo desktop hoặc web nếu có, Word nếu có, và một PDF chỉ đọc. Ghi riêng kết quả **đọc → gợi ý → chọn → thay → xác nhận**. Chốt adapter cần làm từ dữ liệu này; không suy từ tên ứng dụng.

**Qua cổng A khi:** biết kiểu ô nhập nào tương thích, kiểu nào thiếu dữ liệu, và có ảnh/log chẩn đoán cho từng ca mục tiêu. Các ứng dụng không có trên máy sẽ được ghi là chưa thử, không đánh dấu đạt.

### B. Củng cố lõi thay thế

Tách `ReadDraft`, chọn câu, chọn range, nhập và xác nhận thành giao diện adapter. Sửa nhánh nhận câu đã có sẵn khi người dùng đặt con trỏ vào; kiểm tra provider không hỗ trợ paragraph thật; quản lý range hết hiệu lực; tách UIA worker MTA và giới hạn thời gian gọi provider để sidecar không treo.

Giữ ba quy tắc: không động đến ô mật khẩu/chỉ đọc; không ghi nếu focus hoặc văn bản gốc đổi; không báo thành công nếu toàn đoạn/trường sau thao tác khác kết quả mong đợi. Không tự thử lần hai bằng thao tác ghi khi lần đầu đã sửa một phần.

**Qua cổng B khi:** các ca mô phỏng về tách câu, con trỏ, văn bản đổi giữa chừng, mất focus và xác nhận toàn đoạn đều đạt; không có trường hợp nối thêm hoặc thay nhầm câu.

### C. Mở rộng adapter theo kết quả khảo sát

1. Hoàn thiện `TextPattern` cho Notepad và ô web. Kiểm thử `textarea` và `contenteditable` riêng vì hai loại có hành vi chọn/nhập khác nhau.
2. Thêm `ValuePattern` cho trường đơn giản khi cổng A xác nhận được vị trí sửa hoặc việc thay toàn trường là đúng ý người dùng.
3. Thêm lệnh thủ công “Sửa đoạn đang chọn” cho editor tùy biến. Chỉ bật **Áp dụng** khi vùng chọn còn nguyên.
4. Xem xét tích hợp riêng như tiện ích trình duyệt hoặc add-in Word **chỉ nếu** khảo sát chứng minh UI Automation không đủ ổn định cho ứng dụng ưu tiên. Đây là nhánh tùy chọn, không phụ thuộc vào bản đầu.

### D. Nghiệm thu và phát hành

- Ma trận ứng dụng/loại ô nhập ghi rõ: đầy đủ, chỉ gợi ý, chỉ thủ công, chỉ đọc, không hỗ trợ.
- Ca bắt buộc: một câu; nhiều câu; con trỏ giữa câu/cuối câu; dấu chấm viết tắt và số thập phân; xuống dòng; tiếng Việt/IME; clipboard chứa ảnh; đổi focus trong lúc popup mở; người dùng sửa câu gốc trước khi bấm; nhiều màn hình/DPI; Ctrl+Z sau thay.
- Với mọi ca được ghi “hỗ trợ Áp dụng”: câu đích được thay đúng một lần, phần còn lại giữ nguyên, popup chỉ báo thành công sau khi đọc lại. Không có ca thay nhầm, nối thêm, xóa nhầm hoặc báo thành công giả.
- Chạy lại bộ ca ChatGPT/Notepad hiện có sau mỗi adapter. Chỉ đóng gói bản cài khi ma trận đã được thử trên máy thật và không còn lỗi mức dữ liệu bị sửa sai.

## 5. Cách bật tính năng trên nhiều ứng dụng

- Tự động gợi ý trong các loại ô đã đạt kiểm thử; người dùng có thể tắt theo ứng dụng hoặc tạm dừng trợ lý. Nơi chưa đạt thì dùng phím tắt chủ động và bảng nhập/dán.
- Bỏ qua password, ô chỉ đọc và nơi không xác định được tính nhạy cảm. Chỉ gửi đúng câu đang sửa tới Groq sau khi người dùng dừng gõ; không lưu câu gốc vào log chẩn đoán.
- Nếu ứng dụng đích chạy quyền Administrator cao hơn Lexforge, báo giới hạn quyền rõ ràng. Không âm thầm nâng quyền Lexforge toàn cục.

## 6. Việc chưa thể cam kết trước cổng A

Không thể bảo đảm mọi ô của Word, Zalo, Chrome/Edge hay editor vẽ tùy biến đều hỗ trợ tự động áp dụng chỉ từ tài liệu. Khả năng của **ô cụ thể** phải đo trên phiên bản ứng dụng đang dùng. macOS/Linux không nằm trong phạm vi sidecar Windows này.
