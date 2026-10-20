# Ghi chú & trợ lý — file TXT local

## Tạo và lưu nhiều ghi chú

- **Ghi chú mới** tạo một note riêng.
- **Lưu / Ctrl+S** cập nhật note đang mở.
- **Lưu thành ghi chú mới** tạo bản mới từ nội dung đang sửa, giữ nguyên note cũ.
- Thư viện mặc định hiển thị 15 note mới cập nhật gần nhất. Bấm **Xem thêm 15 ghi chú**
  để mở note cũ; tìm kiếm áp dụng trên toàn bộ thư viện.

## File lưu trên máy

Mỗi note là một file UTF-8 `.txt` riêng trong thư mục đã chọn. Tên gồm tiêu đề và
mã định danh để hai note trùng tên không ghi đè nhau. Có thể mở và sửa bằng Notepad;
app đọc lại nội dung file và từ chối ghi đè nếu bản đang sửa đã cũ. File TXT mới được
thêm vào thư mục cũng được đưa vào thư viện.

Lịch sử hoàn tác, thông tin quản lý và hội thoại nằm trong `.lexforge-notes`.
Không xóa thư mục phụ này nếu muốn giữ lịch sử và hội thoại. Thùng rác của app cũng
nằm trong thư mục phụ; hãy dùng Khôi phục trong app để đưa note trở lại.

Kho `notes.sqlite` từ bản thử cũ được chuyển sang TXT khi mở app. File SQLite cũ
được giữ nguyên làm bản sao, không tiếp tục được dùng để lưu note mới. App vẫn dùng
SQLite cho dữ liệu từ vựng và cài đặt, độc lập với các file TXT ghi chú.

## Chọn thư mục

Bấm **Tùy chọn** ở đầu trang để mở phần thư mục lưu. Thư mục phải tồn tại trước.
Bấm **Áp dụng thư mục** để chép toàn bộ TXT, lịch sử và hội thoại sang thư mục trống
mới; bản cũ được giữ lại. App không ghi đè kho hoặc file TXT đã có tại đích.
Khi thư mục/ổ đĩa mất kết nối, app hiện cảnh báo và không tự tạo lại thư mục hay
âm thầm đổi nơi lưu. Kiểm tra lại khi mở trang, lấy focus và định kỳ 5 giây.

## Giọng nói và AI

Micro trong trình sửa chỉ điền nội dung local. Micro ở ô yêu cầu (Ctrl+Shift+M)
chỉ điền yêu cầu, không tự gửi. Silero tự dừng sau khoảng 1,8 giây im lặng và Whisper
nhận dạng trên máy. Bấm **Gửi AI** mới gửi yêu cầu, note đang chọn và tối đa 20 tin
gần đây của note đó tới Groq, dùng API key trong Cài đặt.

AI có thể tạo, thêm hoặc viết lại; không được xóa note. Bản sửa được lưu để Hoàn tác.
Dữ liệu và bản nháp là văn bản local, không phải kho mã hóa hay đồng bộ cloud.

## Chạy và kiểm tra

Chạy start_speech_server.bat và npm run electron-dev trong hai terminal.
Sau thay đổi IPC/preload phải thoát hẳn app rồi mở lại; Ctrl+R chỉ tải lại giao diện.

```bat
npm test -- --watchAll=false --runInBand
npx tsc --noEmit
node --test electron/tests/*.test.cjs
.venv\Scripts\python.exe -m unittest discover -v
npm run build
```

Tên TXT dùng tối đa 8 từ đầu của nội dung (tối đa 60 ký tự), kèm ngày tạo DD-MM-YYYY. Tên trùng thêm số; xử lý trên máy. Khi tạo hoặc cập nhật qua trợ lý, chat lưu cả tiêu đề và toàn bộ nội dung đã lưu.

## Trợ lý AI hội thoại

- Hiểu tiếng Việt, English hoặc câu xen kẽ; mặc định trả lời theo ngôn ngữ yêu cầu.
- Tóm tắt văn bản paste vào hoặc cho lời khuyên ngay trong chat. Chỉ tạo/sửa note khi yêu cầu lưu rõ ràng; paste không có chỉ dẫn thì hỏi lại.
- Có thể nói “Lưu phần tóm tắt vừa rồi thành note” trong cùng hội thoại.
- Chat độc lập với lựa chọn note. Bật **Đính kèm note đang chọn** khi cần AI đọc/sửa note đó. Nội dung đã gửi vẫn có thể xuất hiện trong ngữ cảnh chat sau khi bỏ đính kèm.
- Chat lưu tối đa 40 tin gần nhất trong localStorage của ứng dụng; gửi tối đa 12 tin gần nhất, mỗi tin tối đa 12.000 ký tự, làm ngữ cảnh. Ô yêu cầu nhận tối đa 40.000 ký tự. Nút **Hội thoại mới** xóa chat hiện tại, không xóa note.
- Giọng nói nhận dạng local; văn bản yêu cầu, ngữ cảnh chat và note đính kèm được gửi tới Groq khi bấm Gửi AI. Cần mạng và API key; giới hạn Groq vẫn áp dụng.
- Chat không phụ thuộc thư mục TXT đang kết nối; thao tác lưu note vẫn yêu cầu thư mục hợp lệ.

Trợ lý mặc định trả lời bằng văn xuôi ngắn, tự nhiên, không tiêu đề Markdown, dấu in đậm, emoji hoặc danh sách theo khuôn. Vẫn dùng checklist, mã nguồn hay định dạng khác nếu người dùng yêu cầu rõ; không tự lọc ký hiệu khỏi văn bản gốc.

Giao diện chat mở rộng vùng đọc; thông tin xử lý dữ liệu nằm trong Tùy chọn. Ô nhập trống: Enter gửi, Shift+Enter xuống dòng; Enter trong lúc IME đang ghép chữ không gửi. Giữ nút micro và nút gửi để thao tác bằng chuột.
