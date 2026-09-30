# Kế hoạch trợ lý tiếng Anh nổi trên desktop

**Trạng thái:** Cả 5 giai đoạn nền tảng đã được triển khai. Bản cài gần nhất có trước loạt chỉnh sửa UX; mã nguồn hiện đang được người dùng đánh giá, chưa đóng gói lại. Người dùng đã xác nhận dịch nhanh trên ChatGPT và đánh giá tốt luồng viết câu tiếng Anh.

**Ngày ghi nhận:** 30-09-2026

**Phạm vi:** Ứng dụng desktop Lexforge trên Windows, sử dụng Groq như luồng AI hiện có.

## 1. Mục tiêu

Tạo một trợ lý tiếng Anh có thể gọi nhanh khi người dùng đang làm việc trong ứng dụng khác. Trợ lý cần hỗ trợ tra từ/câu, dịch đoạn văn đang chọn, sửa và giải thích lỗi ngữ pháp, hoàn chỉnh câu, và diễn đạt ý tiếng Việt thành câu tiếng Anh đúng ngữ pháp. Thiết kế phải giúp người học hiểu cách dùng từ và cấu trúc, thay vì chỉ trả về bản dịch.

## 2. Trải nghiệm đã thống nhất

- Khi trợ lý được bật, người dùng bôi đen từ hoặc câu tiếng Anh trong ứng dụng đang dùng và giữ vùng chọn 0,5 giây; một nhãn dịch nhanh xuất hiện gần vùng chọn sau khi Groq phản hồi.
- Không yêu cầu người dùng nhấn `Ctrl+C` để kích hoạt tính năng. Nút **Dịch** riêng cạnh vùng chọn đã được bỏ theo phản hồi UX; bảng trợ lý vẫn có tác vụ dịch nhập/dán.
- Có biểu tượng nổi để mở bảng trợ lý. Trong bảng, người dùng có thể nhập hoặc dán từ, câu hay đoạn văn rồi chọn tác vụ.
- Có điều khiển bật/tắt trợ lý. Khi tắt, không theo dõi vùng chọn và không hiện nhãn dịch nhanh.
- Ứng dụng ChatGPT mà người dùng thường trao đổi là một mục tiêu kiểm tra ngay từ giai đoạn đầu, bên cạnh Chrome/Edge, Word, Notepad và trình đọc PDF.
- Nếu một ứng dụng không cung cấp vùng chọn cho Windows, người dùng vẫn có thể nhập hoặc dán nội dung vào bảng trợ lý để dùng các chức năng còn lại.

## 3. Chức năng dự kiến

### Dịch

- Dịch từ và câu Anh–Việt hoặc Việt–Anh, tự nhận diện chiều dịch.
- Dịch nhanh từ/câu tiếng Anh được chọn sau khi giữ nguyên 0,5 giây; dịch từ, câu hoặc đoạn văn nhập/dán trong bảng trợ lý.
- Hiển thị bản dịch cùng cách dùng/các nghĩa phù hợp theo ngữ cảnh; có thao tác sao chép kết quả.

### Hỗ trợ viết

- Kiểm tra lỗi ngữ pháp trong nội dung người dùng gửi.
- Đưa ra câu đã sửa và giải thích ngắn gọn các lỗi đáng chú ý.
- Đề xuất cách viết tự nhiên hơn hoặc hoàn chỉnh câu đang viết dở.
- Nhận ý bằng tiếng Việt và tạo câu tiếng Anh phù hợp, kèm giải thích cấu trúc khi hữu ích.
- Khi phù hợp, chỉ ra từ vựng/cụm từ mới để hỗ trợ ghi nhớ.

## 4. Các giai đoạn triển khai

### Giai đoạn 1 — Thử nghiệm lấy vùng văn bản được chọn

Làm một nguyên mẫu kỹ thuật nhỏ để kiểm tra khả năng nhận nội dung và vị trí vùng chọn qua cơ chế trợ năng/UI Automation của Windows. Ưu tiên kiểm tra các ứng dụng sau:

1. Ứng dụng ChatGPT người dùng đang dùng.
2. Chrome và Edge.
3. Microsoft Word và Notepad.
4. Một trình đọc PDF phổ biến.

Ghi lại theo từng ứng dụng: có lấy được văn bản đã chọn không, có lấy được vị trí vùng chọn không, độ trễ, và trường hợp thất bại. ChatGPT là trường hợp kiểm tra bắt buộc trong spike này vì đây là nơi người dùng thường xuyên trao đổi.

**Điều kiện qua giai đoạn:** xác nhận cách hoạt động trên các ứng dụng mục tiêu và quyết định rõ nơi nào có nút dịch cạnh vùng chọn, nơi nào cần dùng bảng nhập/dán. Không thiết kế toàn bộ overlay dựa trên giả định rằng mọi ứng dụng đều cung cấp dữ liệu giống nhau.

**Trạng thái hiện tại:** đã tạo nguyên mẫu đọc selection qua UI Automation trong [Selection Probe](SelectionProbe/README.md). Notepad (109 ms) và ChatGPT (2 ms) đều trả về văn bản cùng hình chữ nhật vùng chọn. Ảnh ChatGPT cho tọa độ X âm; phần overlay cần hỗ trợ hệ tọa độ desktop nhiều màn hình và kiểm tra DPI. Chrome, Edge, Word và trình đọc PDF vẫn cần kiểm tra. Ma trận kết quả nằm trong [kết quả nguyên mẫu](SELECTION_PROBE_RESULTS.md).

### Giai đoạn 2 — Biểu tượng nổi và bật/tắt

- Thêm biểu tượng nổi gọn nhẹ trên desktop để mở bảng trợ lý.
- Bổ sung điều khiển bật/tắt theo dõi vùng chọn; trạng thái thể hiện rõ trên biểu tượng/bảng.
- Tích hợp các thao tác cơ bản như mở trợ lý, mở ứng dụng chính và thoát.
- Chỉ đăng ký theo dõi vùng chọn khi người dùng bật tính năng.

**Trạng thái hiện tại:** đã thêm widget nổi, bảng bật/tắt, menu khay hệ thống, mở cửa sổ học chính và thoát ứng dụng. Trạng thái bật/tắt được lưu cục bộ; người dùng xác nhận đã thấy widget.

### Giai đoạn 3 — Nút dịch tại vùng chọn

- Khi phát hiện văn bản được chọn trong ứng dụng tương thích, hiện nút dịch nhỏ gần vùng chọn.
- Chỉ gọi Groq sau khi người dùng nhấn nút; sau đó hiển thị kết quả trong một bảng gọn, không làm mất nội dung gốc.
- Xử lý việc vùng chọn biến mất, đổi cửa sổ, thao tác liên tiếp và vị trí bảng vượt khỏi cạnh màn hình.
- Giữ đúng tọa độ desktop khi nhiều màn hình có điểm gốc âm; kiểm tra quy đổi DPI trước khi đặt nút nổi cạnh vùng chọn.
- Bảo đảm nút/bảng không tự ghi đè văn bản hoặc gây mất tiêu điểm ngoài ý muốn.

**Đã triển khai trong nguyên mẫu hiện tại:** tiến trình UI Automation riêng đọc vùng chọn mỗi 30 ms khi có thao tác chọn bằng chuột/Shift và mỗi 240 ms khi rảnh; không đọc clipboard, không gọi mạng trong lúc theo dõi. Nút **Dịch** không nhận focus và ưu tiên hiện bên dưới vùng chọn để tránh đè thanh công cụ của ứng dụng đang dùng. Bản chụp vùng chọn được giữ trong bộ nhớ tối đa 5 giây để hấp thụ race giữa sự kiện xóa selection và click. Khi bấm, app mở bảng tải ngay, sau đó đọc Groq API key trong SQLite và gửi đúng vùng chọn. Kết quả có thể sao chép. Tọa độ UI Automation được đổi sang DIP của Electron và giới hạn trong vùng làm việc màn hình gần nhất.

**Đã xác minh:** sidecar .NET build và publish self-contained cho Windows x64 thành công; JavaScript Electron/widget qua `node --check`. Người dùng xác nhận trên ChatGPT nút xuất hiện tại vùng chọn, Groq trả bản dịch và có thể dịch câu tiếp theo khi bảng kết quả vẫn mở. Chrome, Edge, Word, PDF và kiểm tra DPI/màn hình phụ vẫn còn mở. Máy phát triển cần .NET 10 SDK; người dùng bản cài không cần cài riêng .NET Desktop Runtime.

### Giai đoạn 4 — Bảng nhập và công cụ hỗ trợ viết

- Cho phép nhập/dán nội dung và chọn chiều dịch nếu nhận diện ngôn ngữ chưa chính xác.
- Bổ sung các thao tác: dịch, kiểm tra ngữ pháp, sửa lỗi, hoàn chỉnh câu, và viết câu tiếng Anh từ ý tiếng Việt.
- Trình bày theo cấu trúc dễ học: nội dung gốc, kết quả/đề xuất, giải thích ngắn, từ/cụm từ hữu ích và nút sao chép.
- Tận dụng cấu hình Groq hiện có; hiển thị hướng dẫn khi thiếu API key hoặc mất kết nối.

**Đã triển khai:** bảng nhập/dán có bộ đếm tối đa 5.000 ký tự, chọn tác vụ và chiều dịch; hỗ trợ dịch, kiểm tra/sửa ngữ pháp, hoàn chỉnh câu và tạo câu tiếng Anh từ ý tiếng Việt. Kết quả hiển thị cùng giải thích, cách diễn đạt khác và từ vựng liên quan khi phù hợp; có nút sao chép và `Ctrl+Enter` để chạy. Groq được gọi qua Electron main process bằng API key hiện có; nội dung chỉ gửi khi người dùng bấm thực hiện. JavaScript qua kiểm tra cú pháp và `npm run build` thành công. Người dùng đã thử luồng viết câu tiếng Anh và đánh giá kết quả khá tốt; chưa có xác nhận riêng cho từng tác vụ còn lại.

### Giai đoạn 5 — Tích hợp, hoàn thiện và đóng gói

- Đồng bộ hành vi, kiểu giao diện và cấu hình AI với ứng dụng hiện tại.
- Rà soát vòng đời cửa sổ nổi, quyền khởi động cùng Windows nếu có, trạng thái bật/tắt và xử lý lỗi.
- Hoàn thiện hướng dẫn cài/chạy và đánh giá trên các ứng dụng đã kiểm tra ở giai đoạn 1.

**Đã hoàn tất phần triển khai:** trạng thái trợ năng chỉ báo sẵn sàng sau khi sidecar gửi sự kiện `ready`; widget có thông báo khi đang khởi động, thiếu binary hoặc sidecar dừng. Việc dừng một tiến trình cũ không còn xóa nhầm trạng thái của tiến trình mới. Panel được giới hạn theo work area của màn hình và nội dung co/scroll theo kích thước cửa sổ. Không bật tự khởi động cùng Windows. Theo góp ý trải nghiệm, launcher dùng biểu tượng Lexforge dạng phẳng, bỏ viền/đổ bóng; kích thước mới là 60 px trong vùng thao tác 76 px, còn icon khay hệ thống giữ nguyên. Có thể giữ và kéo launcher để đổi vị trí; vị trí được lưu và giới hạn trong vùng làm việc màn hình. Nút dịch cạnh vùng bôi đen đã bỏ viền, bóng và chuyển động nhấc lên khi rê; sidecar poll 30 ms trong cử chỉ chọn bằng chuột/Shift và 240 ms khi rảnh để vị trí bám theo vùng chọn mượt hơn.

Bản đóng gói gần nhất nằm tại `dist-stage5-smoother/TOEIC Vocab Master Setup 1.0.0.exe` (khoảng 123 MB). Người dùng yêu cầu gom các chỉnh sửa trải nghiệm rồi mới đóng gói thêm một lần. Các cập nhật panel/theme và độ ổn định launcher hiện đã được sửa ở mã nguồn, chưa được đưa vào bộ cài. Khi chốt giao diện, tạo một bản NSIS Windows x64; sidecar UI Automation được publish self-contained với .NET runtime 10.0.10, installer tạo shortcut Desktop/Start Menu và chưa ký số.

**Còn chờ người dùng đánh giá:** các chỉnh sửa panel/theme và launcher đã ở mã nguồn. Ảnh trước/sau của người dùng xác nhận lỗi chụp ảnh là panel bị thu thành icon ở lần đầu. Luồng `close` của cửa sổ widget hiện không được phép tự thu gọn; nút **−** mới thực hiện thao tác đó. Launcher chỉ mở panel để click lặp lại không thể thu bảng. Cần xác nhận trên bản xem trước sau cập nhật. Chỉ tạo bộ cài cuối sau khi chốt UX. Kiểm tra các ứng dụng ngoài ChatGPT/Notepad, DPI và màn hình phụ vẫn còn mở.

## 5. Nguyên tắc tài nguyên và quyền riêng tư

- Không chạy mô hình AI cục bộ; các tác vụ AI tiếp tục dùng Groq như ứng dụng hiện tại.
- Vùng chọn tiếng Anh ngắn được gửi tới Groq sau khi giữ nguyên 0,5 giây; thay đổi/bỏ vùng chọn trước hạn sẽ hủy yêu cầu. Dòng tiếng Anh đang được gõ trong ô soạn thảo hỗ trợ được gửi sau khi nội dung ngừng thay đổi khoảng 1,1 giây để kiểm tra ngữ pháp. Những tác vụ trong bảng chỉ gửi khi người dùng bấm thực hiện. Không gửi toàn bộ nội dung cửa sổ.
- Khi tắt trợ lý, dừng theo dõi vùng chọn và ô soạn thảo, đồng thời ẩn các điều khiển nổi.
- Không dùng giám sát clipboard thường trực hoặc yêu cầu `Ctrl+C` để phát hiện vùng chọn.
- Thử nghiệm ban đầu cần xác nhận nội dung nào được gửi tới Groq, cách dùng API key và cách tránh log lưu nội dung nhạy cảm.

## 6. Tiêu chí nghiệm thu dự kiến

- Có thể bật/tắt trợ lý và trạng thái tắt thực sự dừng theo dõi vùng chọn.
- Với ứng dụng hỗ trợ, chọn từ/câu tiếng Anh và giữ 0,5 giây → nhãn dịch nhanh xuất hiện ở vị trí phù hợp sau phản hồi từ Groq.
- Không cần `Ctrl+C` để gọi dịch vùng chọn.
- Trong bảng trợ lý, có thể nhập/dán văn bản và dùng đủ các tác vụ dịch, kiểm tra/sửa ngữ pháp, hoàn chỉnh câu và Việt→Anh.
- Kết quả sửa/viết có giải thích ngắn phục vụ học tập và có thể sao chép.
- ChatGPT được đưa vào bộ ứng dụng kiểm tra tương thích, và kết quả thực tế được ghi lại; nếu vùng chọn không truy cập được thì bảng nhập/dán vẫn dùng được.
- Không phát sinh yêu cầu suy luận AI trước khi vùng chọn ổn định đủ 0,5 giây, dòng đang gõ ổn định khoảng 1,1 giây, hoặc người dùng chủ động gửi tác vụ trong bảng.

## 7. Rủi ro và phương án xử lý

| Rủi ro | Cách xử lý |
|---|---|
| Một số ứng dụng không cung cấp văn bản/vị trí vùng chọn qua Windows Accessibility | Kiểm tra sớm trong giai đoạn 1; dùng bảng nhập/dán làm phương án sẵn có, không hứa tương thích đồng đều trước khi đo thực tế. |
| Nút nổi làm mất tiêu điểm hoặc che nội dung | Thử nghiệm vị trí/luồng tiêu điểm trên từng ứng dụng; chỉ mở bảng kết quả sau thao tác rõ ràng. |
| API key Groq hoặc mạng không khả dụng | Tái sử dụng trạng thái cấu hình hiện có và thông báo lỗi có hướng dẫn. |
| Phản hồi AI dài hoặc khó học | Dùng cấu trúc đầu ra ngắn, phân tách bản sửa và giải thích; cho phép sao chép riêng kết quả. |

## 8. Mở rộng đang thử: hỗ trợ viết nhanh trong ô soạn thảo

- Theo dõi ô nhập có thể chỉnh sửa đang được focus qua Windows UI Automation. Bỏ qua ô mật khẩu, nội dung chỉ đọc, văn bản quá dài và vùng văn bản đang bôi đen.
- Khi một dòng tiếng Anh đang gõ thay đổi rồi ổn định khoảng 1,1 giây, gửi đúng dòng đó tới Groq để kiểm tra lỗi ngữ pháp. Chỉ hiện bảng nhỏ nếu có lỗi/câu cần hoàn chỉnh. Bảng có câu đề xuất, **✓ Áp dụng**, **× Bỏ qua** và **Việt → Anh**.
- Mở **Việt → Anh** sẽ cho nhập ý tiếng Việt, dịch thành một câu tiếng Anh ở bên dưới và có nút chèn tại vị trí con trỏ đang viết.
- Trước khi áp dụng, sidecar xác nhận cửa sổ và nội dung gốc còn nguyên; chèn tiếng Anh còn kiểm tra vị trí con trỏ chưa đổi. Nếu không thể chuyển focus hoặc ứng dụng đích không nhận nhập liệu, trả lỗi thay vì ghi vào một nơi khác. Việc thay thế dùng UIA để chọn đúng dải văn bản và Windows `SendInput` để gõ Unicode; khả năng tương thích cần thử trên ChatGPT, Notepad và các ứng dụng khác.
- Thay đổi này đang ở bản xem trước mã nguồn; chưa đóng gói lại. Kiểm tra thực tế nút ✓/chèn trên từng ứng dụng là điều kiện trước khi gọi là hoàn tất.

## 9. Các quyết định đã chốt và phần chưa chốt

**Đã chốt:** triển khai trong ứng dụng desktop hiện có theo hướng biểu tượng/bảng nổi; dùng Groq; dịch văn bản bôi đen không cần `Ctrl+C`; có bảng nhập/dán cho dịch và hỗ trợ viết; kiểm tra tương thích với ứng dụng ChatGPT người dùng đang dùng ngay từ đầu.

**Đã chọn cho nguyên mẫu:** Windows UI Automation đọc selection; Electron đặt nhãn dịch nhanh gần hình chữ nhật vùng chọn; widget giữ các tác vụ nhập/dán. Nút **Dịch** cạnh vùng chọn là thiết kế lịch sử đã bỏ.

**Chưa chốt:** phím tắt tùy chọn, lưu lịch sử/tra cứu từ mới, hỗ trợ chính thức từng ứng dụng ngoài ChatGPT/Notepad, và quy trình ký số installer. Bản Windows hiện đã tự chứa runtime .NET; tự khởi động cùng Windows tiếp tục tắt để người dùng chủ động bật/tắt trợ lý.

## 10. Trạng thái thực hiện

> Giai đoạn 5 đã có một bộ cài Windows x64 ở vòng trước. Các chỉnh sửa UX mới nhất chưa được đóng gói; theo yêu cầu, chỉ tạo bộ cài tiếp theo sau khi người dùng trải nghiệm và chốt các thay đổi. Bản xem trước hiện được chạy từ mã nguồn. Một số kiểm tra tương thích từ giai đoạn 1 và 3 vẫn còn mở. Xem [kết quả nguyên mẫu](SELECTION_PROBE_RESULTS.md) và [hướng dẫn phát triển](DEVELOPMENT_RUNBOOK.md).
