# Danh mục tính năng

Trạng thái “đang truy cập được” nghĩa là component được nối vào `App.tsx` và có mục trong Sidebar. Các phụ thuộc bên ngoài và phần chưa nối được ghi riêng.

## Điều hướng chính

| Mục trên Sidebar | Component | Tình trạng |
|---|---|---|
| Dashboard | `Dashboard.tsx` | Đang truy cập được |
| Từ Vựng | `VocabularyPage.tsx` | Đang truy cập được |
| Nhóm Từ | `GroupsPage.tsx` | Đang truy cập được |
| Flashcard | `FlashcardPage.tsx` | Đang truy cập được |
| AI Coach | `AICoachPage.tsx` | Đang truy cập được; cần Groq key cho AI |
| Học Nghe Bằng MP3 | `MP4ListeningPage.tsx` | Đang truy cập được; cần Groq key và Internet |
| Gõ Chữ Tốc Độ | `TypingGamePage.tsx` | Đang truy cập được |
| Đánh Quái | `MonsterGamePage.tsx` | Đang truy cập được |
| Zombie Survival | `ZombieGamePage.tsx` | Có route/menu, nhưng luồng multiplayer chưa khớp server |
| Memory Flip | `MemoryFlipPage.tsx` | Đang truy cập được |
| Tiến Độ Học | `ProgressPage.tsx` | Đang truy cập được; một số chỉ số còn là placeholder |
| Lịch Ôn Tập AI | `SchedulePage.tsx` | Có fallback cục bộ; tích hợp LSTM cần xác minh |
| Multiplayer | `MultiplayerHub.tsx` | Đang truy cập được; cần game server |
| Cài Đặt | `SettingsPage.tsx` | Đang truy cập được |
| Hướng Dẫn | `HelpPage.tsx` | Đang truy cập được; vài chỉ dẫn chưa cập nhật |

## Quản lý từ vựng và nhóm

### Từ Vựng

- Tìm theo tiếng Anh/nghĩa Việt, lọc nhóm, thêm/sửa/xóa từ, chọn nhiều từ và chuyển nhóm.
- Trường dữ liệu: English, Vietnamese, Pronunciation, PartOfSpeech, Example, ExampleVi.
- Import đọc sheet đầu tiên. Mã nhận một số biến thể tên cột như `english`, `Từ tiếng Anh`, `IPA`, `POS`; các trường tiếng Anh và nghĩa Việt phải có.
- Khi import, người dùng chọn nhóm đã có hoặc tạo nhóm mới. Export tạo workbook từ **danh sách sau lọc hiện thời**, kèm nhóm và các trường review.
- Có nút tra cứu bằng AI; khi tạo từ mới mà bỏ trống nghĩa, app thử gọi AI để lấy 1–2 nghĩa phổ biến cùng IPA/từ loại/ví dụ. Nếu API thất bại và nghĩa vẫn trống, mã dừng lưu; hiện lỗi chỉ được ghi console trong nhánh này.
- Nhóm dùng khi thêm từ được lấy theo thứ tự: nhóm đang lọc, nhóm đã lưu gần nhất, rồi nhóm đầu tiên. Nhóm đã chọn được ghi vào `localStorage` key `latest_selected_group_id`; nút ➕ ở trang Nhóm truyền nhóm đích qua `default_add_word_group_id`.

### Nhóm Từ

- Tạo/sửa/xóa nhóm, đặt tên/mô tả/màu/icon, xem số từ.
- Tìm theo tên/mô tả; lọc ngày tạo; sắp xếp mới/cũ/nhiều từ/ít từ/tên A–Z.
- Tạo hàng loạt theo danh sách một tên mỗi dòng, màu và icon chọn theo vòng.
- Xóa nhóm kích hoạt `ON DELETE CASCADE` trong schema hiện tại nên xóa cả các từ thuộc nhóm.

## Học và phân tích

### Flashcard và SRS

- Chọn tất cả từ, nhóm từ hoặc chỉ từ đến hạn; xáo trộn thứ tự.
- Lật thẻ, nghe phát âm, đánh dấu đúng/sai và xem kết quả.
- Mức 0–5 có khoảng nhắc tương ứng 1, 3, 7, 14, 30, 90 ngày. Đúng tăng một mức (tối đa 5), sai giảm một mức (tối thiểu 0).
- Lưu kết quả phiên vào `StudySessions`; mỗi câu trả lời cũng thử ghi lịch sử mở rộng cho scheduler.

### Dashboard và Tiến Độ

- Dashboard: tổng số từ/nhóm, từ thành thạo, từ tới hạn, lượt đúng hôm nay, biểu đồ 7 ngày, quick links, điểm cao của Typing/Monster và tóm tắt lịch ôn.
- Sinh 10 từ AI tự động tối đa một lần mỗi ngày theo category đã chọn, nếu `auto_daily_vocab` bật (mặc định bật) và Groq key có trong cài đặt.
- Tiến Độ có các tab Tổng Quan, Từ Vựng, Game, Thói Quen; tổng hợp 30 ngày, phân bố level, tiến độ nhóm, tối đa 10 phiên gần nhất và điểm game.
- `streak` trong trang tiến độ đang gán cứng `0`; không xem là chuỗi ngày học đã được tính thật.

### Lịch Ôn

- Chọn nhóm hoặc toàn bộ, lọc urgent/high/low, tìm từ, tính lại lịch và tạo nhóm review chứa các từ urgent/high.
- Trang hiển thị nguồn `LSTM` hoặc `SM-2`; trạng thái này cần đối chiếu với các thiếu hụt schema/model/path trong [Trạng thái](STATUS_AND_DECISIONS.md), không nên mặc định hiểu là model đã suy luận thành công.

## Game đơn

### Typing Race

- Ván 60 giây; gõ tiếng Anh dựa trên nghĩa Việt hoặc gõ nghĩa Việt dựa trên từ Anh; Enter để chấm.
- Điểm cơ bản 10, combo từ 3 và 5 tăng thưởng; có lịch sử câu trả lời trong màn hình kết quả.
- Lưu điểm vào `GameScores` với `GameType='typing'`.

### Monster Game

- Từ rơi xuống; gõ tiếng Anh hoặc nghĩa Việt để xử lý mục tiêu, game kết thúc khi hết mạng.
- Có 6 dạng quái tự vẽ bằng Canvas, ba tier thường/Elite/Boss, level làm tăng tốc độ sinh và áp lực; có hiệu ứng, điểm/combo và bảng kết quả.
- Lưu `GameType='monster'`. Đây là game đơn, không cần game server.

### Memory Flip

- Ghép cặp thẻ English ↔ Vietnamese theo các mức Easy (6 cặp/90 giây), Medium (10/120), Hard (18/150).
- Có tính điểm, combo, số lượt, thời gian và đọc từ tiếng Anh.
- Component hiện không ghi kết quả vào `StudySessions` hoặc `GameScores`.

## AI Coach và âm thanh

### AI Coach

- Ba chế độ Hội Thoại, Luyện Viết, Luyện Nói; chọn nhóm từ làm ngữ cảnh, yêu cầu phản hồi ngắn và có tự đọc bằng Web Speech API.
- Gọi Groq Chat Completions; 10 tin nhắn trước được đưa vào lịch sử prompt. Lịch sử chat riêng theo mode lưu ở `localStorage`.
- Kiểm tra ngữ pháp có debounce; hỗ trợ dịch Anh–Việt/Việt–Anh, dịch toàn câu hoặc câu được chọn, tra IPA cho từ đơn bằng Dictionary API.
- Thu âm mic tối đa khoảng 30 giây rồi gửi tới Flask `/transcribe-blob`; luồng này phụ thuộc cấu hình Google Cloud.

### Học nghe bằng MP3

- Chọn file `.mp3`, tạo transcript có mốc thời gian và câu hỏi trắc nghiệm; học hai lượt: chọn script tiếng Anh, rồi chọn nghĩa tiếng Việt.
- Audio phát cục bộ theo đoạn đang học; lesson được giữ trong state component, không thấy lưu bài nghe vào SQLite.
- Tên file component/service có `MP4`, nhưng trang thực tế ghi “MP3” và input chỉ chấp nhận `.mp3`.

### Phát âm

`speechService` dùng Web Speech API để đọc tiếng Anh/Mỹ và tiếng Việt nếu máy có voice tương ứng. Đây là text-to-speech trong trình duyệt/Electron; khác với speech server nhận dạng mic.

## Multiplayer

Hub tạo/vào phòng theo mã, lưu tên người chơi và URL server trong `localStorage`, gửi tối đa 200 từ từ máy host tới game server.

| Game | Tối thiểu | Luật chính trong mã |
|---|---:|---|
| Tower Defense | 50 từ | Xây tháp, gõ từ tấn công, wave/quái/boss, kỹ năng và cửa hàng vũ khí |
| Whack-a-Mouse | 20 từ | Nhập từ trên đối thủ để gây sát thương; búa/nâng cấp, xếp hạng người chơi |
| Co-op Shooter | 20 từ | Cùng bắn quái bằng cách nhập từ; súng, ulti, power-up và bảng xếp hạng |

Game server giữ phòng/trạng thái trong RAM; chưa thấy lưu ván multiplayer vào SQLite. Muốn chơi qua LAN/Internet cần host server, và Internet cần đường dẫn mạng công khai phù hợp.

## Mã có trong repo nhưng chưa nối hoàn chỉnh

- `WordSniperPage.tsx`: game đơn nhiều mode (Normal/Sudden Death/Hardcore; nhập EN/VI/audio), có ghi điểm `sniper`, nhưng chưa được import/đăng ký trong `App.tsx` hoặc Sidebar. Vì vậy không mở được từ UI chuẩn; Progress vẫn có ô điểm Sniper.
- `ConnectPage.tsx`: giao diện cấu hình SQL Server cũ, không được route vào app. `dbService.connect()` hiện chỉ báo kết nối SQLite thành công, không dùng cấu hình SQL Server trong trang này.
- `ZombieGamePage.tsx`: route/menu tồn tại, nhưng component phát/đợi một số event và room ID không trùng với game server hiện tại. Xem trạng thái kỹ thuật trước khi mở rộng.
