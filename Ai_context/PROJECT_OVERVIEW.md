# Tổng quan dự án

## Sản phẩm

**TOEIC Vocab Master** là ứng dụng học từ vựng tiếng Anh cho người Việt, đóng gói desktop trên Windows bằng Electron. Trọng tâm là xây dựng bộ từ cá nhân theo nhóm, ôn lặp lại theo mức độ nhớ, thực hành qua game và dùng AI để bổ sung/luyện ngôn ngữ.

## Luồng sử dụng chính

1. Tạo nhóm từ theo chủ đề hoặc nhập danh sách từ bằng Excel.
2. Thêm/sửa từ thủ công; có thể nhờ Groq điền nghĩa, IPA, từ loại và ví dụ.
3. Ôn từ bằng Flashcard, hoặc luyện gõ/chơi game từ bộ từ đã chọn.
4. Xem thống kê tiến độ và danh sách từ được xếp mức độ ưu tiên ôn.
5. Tùy chọn luyện hội thoại, viết, nói hoặc tạo bài nghe từ file MP3.
6. Tùy chọn kết nối game server để tạo phòng và chơi cùng người khác.

## Năng lực sản phẩm hiện có

- **Từ vựng và nhóm**: CRUD từ/nhóm, tìm kiếm, lọc, sắp xếp nhóm, chọn nhiều từ và chuyển nhóm, tạo nhiều nhóm cùng lúc.
- **Trao đổi dữ liệu**: import `.xlsx`/`.csv` và export các từ đang hiển thị thành `.xlsx`.
- **AI từ vựng**: tra nghĩa một từ, sinh 10 từ theo chủ đề TOEIC/IELTS/giao tiếp, và tạo tự động một nhóm 10 từ mỗi ngày khi mở Dashboard nếu bật tùy chọn và đã có Groq key.
- **Ôn tập**: flashcard hai mặt, chọn nhóm hoặc toàn bộ từ, lọc từ đến hạn, tự đọc từ và cập nhật cấp SRS.
- **Thực hành**: Typing Race, Monster Game, Memory Flip; có AI Coach với ba chế độ và MP3 Listening.
- **Phân tích**: Dashboard, biểu đồ hoạt động 7 ngày, trang tiến độ nhiều tab và màn hình lịch ôn.
- **Chơi mạng**: phòng Socket.IO với Tower Defense, Whack-a-Mouse và Co-op Shooter.
- **Desktop**: Electron preload/IPC, file SQLite riêng theo user data của ứng dụng và cấu hình đóng gói NSIS trên Windows.

## Công nghệ đang dùng

| Phần | Công nghệ trong cấu hình/mã nguồn |
|---|---|
| Giao diện | React 18, TypeScript 4.9, Create React App (`react-scripts` 5) |
| Desktop | Electron 27, `contextIsolation`, preload và IPC |
| Dữ liệu desktop | `sql.js` 1.10 (SQLite chạy trong tiến trình Electron, lưu file `.db`) |
| Biểu đồ/hiệu ứng/UI | Recharts, Framer Motion, Lucide React, CSS tùy chỉnh |
| Excel | SheetJS (`xlsx`) |
| AI văn bản và sinh từ | Groq API, model `openai/gpt-oss-120b` được gọi từ client |
| Chép lời file nghe | Groq Audio Transcriptions, `whisper-large-v3-turbo` |
| Nhận dạng giọng nói microphone | Flask + Google Cloud Speech-to-Text |
| Lịch ôn tùy chọn | Flask/PyTorch LSTM; có fallback heuristic cục bộ |
| Multiplayer | Express + Socket.IO ở `game-server/`, client `socket.io-client` |

## Giao diện

Giao diện hiện theo dark theme, màu indigo/tím làm màu nhấn, font Space Grotesk và JetBrains Mono. Tokens nền tảng nằm ở `src/App.css`; nhiều trang có CSS riêng ngay trong component. Sidebar tự điều hướng bằng state trong `App.tsx`; đây không phải điều hướng React Router dù dependency có mặt trong `package.json`.

## Mốc thay đổi nhìn thấy trong Git

Nhánh hiện tại là `main`, ở commit `46669fe` (merge PR #1). Lịch sử gần cho thấy:

- `3231a96` — `update focus group when create word`: thêm luồng chọn/ghi nhớ nhóm khi thêm từ.
- `4ac24f6` — `Add MP3 listening lesson mode`: thêm chế độ tạo bài học nghe từ MP3.
- `46669fe` — merge thay đổi vào `main`.

Đây là các mốc commit, không thay cho kiểm thử chức năng trên máy chạy thực tế.
