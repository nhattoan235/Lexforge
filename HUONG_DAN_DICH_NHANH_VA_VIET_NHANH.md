# Hướng dẫn dịch nhanh và hỗ trợ viết nhanh

Hai tính năng này hoạt động qua **trợ lý tiếng Anh** của Lexforge trên Windows. Bạn có thể dùng trong ô soạn của những ứng dụng tương thích, không cần chuyển sang cửa sổ học từ vựng.

## Chuẩn bị

1. Mở Lexforge. Nếu không thấy bong bóng trợ lý, bấm **Hiện bong bóng** ở thanh bên của ứng dụng.
2. Bấm bong bóng, kiểm tra công tắc đang ở trạng thái **Trợ lý đang bật**.
3. Vào **Cài đặt → AI & từ mới**, nhập **Groq API key** và bấm **Lưu thiết lập AI**. Máy cần có kết nối Internet để tạo bản dịch và gợi ý.

Bạn có thể đổi sáng/tối ở bảng trợ lý hoặc popup viết. Popup dịch nhanh dùng cùng màu đã chọn.

## Dịch nhanh đoạn tiếng Anh đang chọn

1. Trong ứng dụng đang đọc hoặc viết, bôi đen một từ, cụm từ hoặc câu tiếng Anh.
2. Giữ nguyên vùng chọn và chờ khoảng **0,5 giây**. Popup **DỊCH NHANH** hiện gần vùng chọn với trạng thái **Đang dịch…**, sau đó cập nhật khi Groq trả lời.
3. Nếu popup che chữ, giữ chuột trên dòng **DỊCH NHANH · Kéo để di chuyển**, kéo đến vị trí khác rồi thả.
4. Bấm **🔊 Đọc tiếng Anh** để nghe đúng câu đã bôi đen. Bấm lại để dừng. Nút này dùng được cả khi đang chờ dịch hoặc dịch gặp lỗi.
5. Khi đã có bản dịch, có thể bấm **🔊 Tiếng Việt** để nghe bản dịch. Chọn đoạn khác hoặc đóng popup sẽ dừng giọng đọc cũ.

Phần đọc sử dụng giọng có sẵn qua hệ thống phát âm của ứng dụng, ưu tiên giọng cục bộ; không gọi API Groq để tạo âm thanh. Giọng tiếng Việt phụ thuộc giọng được hỗ trợ trên máy.

Khi chọn đoạn khác, popup cũ được thay bằng bản dịch mới. Dịch nhanh chỉ đọc và hiển thị bản dịch; nó không sửa văn bản gốc.

## Nhận gợi ý sửa câu khi đang viết

1. Gõ một câu tiếng Anh trong ô soạn tương thích và dừng gõ khoảng **0,7–0,8 giây**. Sau thời gian chờ này và thời gian Groq trả lời, popup **GỢI Ý VIẾT** sẽ hiện nếu câu có lỗi phù hợp để sửa.
2. Xem **Câu sẽ thay** và **Câu đề xuất**. Với đoạn có nhiều câu, trợ lý chọn câu chứa con trỏ; hãy kiểm tra lại câu đích trước khi áp dụng.
3. Bấm **Áp dụng** để thay đúng câu đó, hoặc **Bỏ qua** nếu không muốn sửa. Bạn có thể kéo popup bằng dòng tiêu đề.

Trợ lý không nhất thiết hiện popup cho câu đã đúng hoặc đoạn quá ngắn. Khi cần mở chủ động, dùng phím tắt ở phần tiếp theo.

## Mở popup viết ngay bằng phím tắt

1. Đặt con trỏ trong ô soạn của ứng dụng bạn đang dùng.
2. Bấm **Ctrl+Alt+W**. Popup hỗ trợ viết mở và hiện sẵn ô **Nhập ý bằng tiếng Việt**.
3. Nhập ý của bạn, bấm **Dịch sang tiếng Anh**, rồi xem câu được tạo.
4. Nếu ô soạn đã có câu, bấm **Thay câu đang viết** để thay câu ở con trỏ. Nếu ô soạn trống, bấm **Chèn vào ô đang viết** để đưa câu vào nháp.

Ví dụ: Trong Zalo > **Cloud của tôi**, đặt con trỏ vào ô soạn trống, bấm **Ctrl+Alt+W**, nhập `Tôi muốn nhờ bạn giúp một việc`, bấm **Dịch sang tiếng Anh** rồi **Chèn vào ô đang viết**. Câu chỉ được đưa vào ô nháp; bạn tự quyết định có gửi tin hay không.

Nếu popup gợi ý tự hiện trước, bạn cũng có thể bấm **Việt → Anh** để mở ô nhập ý tiếng Việt.

## Phím tắt trong popup viết

| Phím | Tác dụng |
| --- | --- |
| **Ctrl+Alt+W** | Mở nhanh popup từ ứng dụng đang viết |
| **Esc** | Đóng popup |
| **Ctrl+Alt+1** | Áp dụng câu đề xuất, khi có gợi ý |
| **Ctrl+Alt+2** | Bỏ qua gợi ý |
| **Ctrl+Alt+3** | Mở/đóng phần Việt → Anh trong popup gợi ý tự động |
| **Ctrl+Alt+4** | Dịch ý tiếng Việt đã nhập |
| **Ctrl+Alt+5** | Thay hoặc chèn câu tiếng Anh đã tạo |

Các phím **1–5** được popup nhận khi popup đang có focus. Nếu phím không phản hồi, hãy bấm trực tiếp nút tương ứng.

## Khi không hoạt động như mong đợi

| Hiện tượng | Cách kiểm tra |
| --- | --- |
| Không thấy popup dịch nhanh | Kiểm tra trợ lý đã bật, đã bôi đen tiếng Anh và bảng trợ lý báo bộ nhận diện vùng chọn đã sẵn sàng. |
| Không thấy gợi ý khi gõ | Dừng gõ một lúc; thử câu tiếng Anh có lỗi rõ ràng hoặc dùng **Ctrl+Alt+W** để mở chủ động. |
| Báo thiếu Groq API key hoặc HTTP 401/403 | Vào **Cài đặt → AI & từ mới** kiểm tra key, lưu lại; HTTP 403 còn có thể do quyền dùng mô hình. |
| Báo lỗi mạng, quá thời gian hoặc giới hạn yêu cầu | Kiểm tra Internet, chờ một lúc rồi thử lại. |
| Nút thay/chèn báo không nhận được ô đang viết | Đóng popup, bấm vào đúng ô soạn rồi nhấn lại **Ctrl+Alt+W**. Một số ô nhập đặc biệt chưa cung cấp đủ thông tin để chèn an toàn. |
| Báo văn bản đã thay đổi hoặc không chuyển được về ô viết | Trở lại ô soạn, đặt con trỏ đúng câu và mở gợi ý mới; tránh sửa nội dung gốc trong lúc popup đang mở. |

Trợ lý chỉ báo áp dụng thành công khi đọc lại được kết quả trong ô viết. Nếu một ứng dụng không hỗ trợ thao tác thay/chèn trực tiếp, bạn vẫn có thể dùng công cụ nhập hoặc dán trong **bảng trợ lý tiếng Anh** để tạo câu và tự đưa kết quả vào ứng dụng đó.

**Lưu ý về phiên bản:** Hướng dẫn này mô tả mã nguồn và bản chạy thử hiện tại. Nếu bạn đang mở bản Lexforge đã cài từ shortcut Desktop cũ, các thay đổi mới có thể chưa có trong bản đó cho tới khi cài bản cập nhật.
