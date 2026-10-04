# Đề xuất UX/UI toàn ứng dụng để duyệt

Ngày: 01-10-2026. Phạm vi: 15 trang đang có trong Sidebar của ứng dụng chính và các màn hình chơi trực tiếp liên quan. Đây là bản thiết kế trải nghiệm trước khi sửa mã. Màu xanh sáng trong `DASHBOARD_TEMPLATE_REVIEW.md` là hướng màu tham khảo, không quyết định bố cục.

## Căn cứ khảo sát

Đã đối chiếu `src/App.tsx`, `src/components/Layout/Sidebar.tsx`, `src/pages/*.tsx`, `src/App.css` và `FEATURE_CATALOG.md`. Luồng chính hiện có: tạo nhóm/từ → ôn Flashcard hoặc luyện qua game/AI → xem tiến độ/lịch ôn. Dashboard hiện trình bày bốn số liệu, biểu đồ 7 ngày, lối tắt, điểm cao và lịch ôn; đồng thời có thể sinh 10 từ AI khi mở trang nếu bật cấu hình và có Groq key. Trang Tiến độ đã dành cho phân tích sâu 30 ngày. Vì vậy Dashboard nên tập trung vào quyết định và hành động của **hôm nay**, tránh lặp lại toàn bộ trang Tiến độ.

## Nguyên tắc chung

- Mỗi trang trả lời ngay ba câu: đang ở đâu, có thể làm gì tiếp, kết quả của hành động nằm ở đâu.
- Mỗi màn hình chỉ có một hành động chính nổi bật; hành động phụ dùng kiểu nút nhẹ hơn. Màu đỏ dành cho nguy hiểm/lỗi, vàng cho việc cần chú ý, xanh lá cho thành công.
- Dùng cùng một hệ lưới, khoảng cách, độ rộng nội dung, chữ, thẻ, biểu mẫu và trạng thái focus cho các trang học. Game được phép có ngôn ngữ hình ảnh riêng khi vào trận nhưng màn chọn và kết quả vẫn cùng hệ thiết kế.
- Thông tin quan trọng dùng chữ và nhãn rõ, không chỉ dùng màu hoặc emoji. Icon nhất quán, có thể thay emoji bằng bộ icon đơn giản khi triển khai.
- Các trang phải có trạng thái đang tải, chưa có dữ liệu, lỗi, thành công, mất kết nối/thiếu API key, và thông điệp chỉ cách khắc phục. Không hiển thị chỉ số placeholder như thể là số liệu thật.
- Bố cục ưu tiên cửa sổ desktop thông thường, co lại được khi cửa sổ hẹp; phím Tab và Enter hoạt động trên mọi thao tác chính. Chuyển động nhẹ và có chế độ giảm chuyển động.

## Điều hướng chung

Sidebar hiện có 15 mục nên khá dài. Đề xuất giữ đủ trang nhưng chia thành: **Hôm nay** (Dashboard, Lịch ôn); **Từ vựng** (Từ vựng, Nhóm từ); **Luyện tập** (Flashcard, Học nghe MP3, AI Coach); **Trò chơi** (Gõ chữ, Đánh quái, Memory Flip, Zombie, Multiplayer); **Theo dõi** (Tiến độ); **Ứng dụng** (Cài đặt, Hướng dẫn). Nhóm có thể thu gọn; ghi nhớ trạng thái. Khi vào một trang, nhãn hiện rõ, có chỉ báo đang chọn và tiêu đề trang khớp tên Sidebar. Không đưa game chưa hoạt động ổn định lên khu vực đề xuất nổi bật.

## Dashboard — ưu tiên cao nhất

### Mục tiêu và thứ tự nhìn

Trong 5 giây đầu, người dùng cần thấy: **hôm nay cần ôn bao nhiêu từ**, **bấm đâu để bắt đầu**, **mình vừa tiến bộ thế nào**. Trên màn hình desktop thông thường, vùng đầu trang nên chứa trọn tiêu đề, khối hành động hôm nay và ít nhất hàng số liệu tóm tắt, không buộc cuộn mới thấy nút học.

```text
┌ Sidebar ─────┬──────────────────────────────────────────────────────────────┐
│ Hôm nay      │ Chào mừng trở lại                          [Xem tiến độ]   │
│ Từ vựng      │ Hôm nay, bạn muốn học gì?                                  │
│ Luyện tập    │ ┌ Việc cần làm hôm nay ──────────────────────────────────┐ │
│ Trò chơi     │ │ 12 từ cần ôn · ước tính ~8 phút                        │ │
│ Theo dõi     │ │ [Bắt đầu ôn]       Xem danh sách cần ôn                │ │
│ Ứng dụng     │ └────────────────────────────────────────────────────────┘ │
│              │ [Tổng từ] [Đã thuộc] [Đúng hôm nay] [Nhóm từ]             │
│              │ ┌ Hoạt động 7 ngày ───────┐ ┌ Tiếp tục học ───────────┐ │
│              │ │ biểu đồ / trạng thái rỗng│ │ Flashcard / AI / nghe  │ │
│              │ └─────────────────────────┘ └─────────────────────────┘ │
│              │ Từ mới AI hôm nay (nếu có) · Điểm game (gấp gọn)          │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

### Khối và hành vi chi tiết

1. **Khối việc cần làm hôm nay**: một con số đến hạn lớn, kèm ước lượng thời gian nếu có thể tính từ số từ; nếu chưa có cơ sở đo, bỏ ước lượng. Nút chính **Bắt đầu ôn** dẫn tới Flashcard theo tập từ đến hạn; lối phụ mở Lịch ôn. Điều này cần bảo đảm luồng truyền bộ lọc đến Flashcard trước khi triển khai, vì hiện `setPage('flashcard')` đơn thuần có thể không chọn đúng chế độ.
2. **Không có từ đến hạn**: khối đổi thành thông điệp tích cực nhưng hữu ích: “Hôm nay chưa có từ cần ôn”, nút **Học từ mới** hoặc **Luyện nhanh**. **Chưa có từ nào**: hướng dẫn hai bước tạo nhóm/thêm từ hoặc nhập Excel; không hiện biểu đồ trống lớn.
3. **Bốn chỉ số phụ**: Tổng từ, Đã thuộc, Đúng hôm nay, Nhóm từ. “Cần ôn hôm nay” đã ở khối chính nên không lặp làm thẻ ngang hàng. Mỗi thẻ có nhãn, giá trị, diễn giải rất ngắn và đường đi phù hợp. Không dùng hiệu ứng đếm từ 0 mỗi lần trang tải nếu gây cảm giác dữ liệu thay đổi.
4. **Biểu đồ 7 ngày**: đặt dưới hành động chính, trục và chú giải “Đúng/Tổng” dễ đọc, tooltip rõ ngày; trạng thái không có phiên học giải thích “Chưa có hoạt động trong 7 ngày” và dẫn tới ôn tập. Link **Xem phân tích** đến Tiến độ.
5. **Tiếp tục học**: tối đa 3 hành động phù hợp tình huống (ôn Flashcard, học từ mới, luyện AI/nghe). Tránh danh sách lối tắt cố định dài; khi chưa có từ, ưu tiên nhập/tạo nhóm. Trò chơi đi qua Sidebar hoặc khu vực gợi ý phụ.
6. **Từ mới AI hôm nay**: thông báo dạng trạng thái nhỏ, phân biệt đang tạo/đã tạo/thất bại/không bật. Không chặn toàn Dashboard khi Groq chậm. Nếu đã tạo, ghi rõ nhóm từ và cho mở nhóm đó; không khẳng định “đã thêm 10 từ” khi số thực tế khác.
7. **Điểm game và lịch ôn nâng cao**: để dưới phần cốt lõi hoặc gấp gọn. Lịch ôn chỉ hiển thị khẩn cấp khi có việc thật; tránh hai khối cùng báo một số từ đến hạn nhưng khác cách tính.

### Các trạng thái cần duyệt trực quan

- Người mới, chưa có nhóm/từ; người có từ nhưng chưa đến hạn; người có nhiều từ đến hạn; người vừa học xong; Groq chưa cấu hình; Groq đang tạo/tạo thất bại; màn hình hẹp; chế độ tối.
- Tải dữ liệu bằng khung giữ chỗ cùng kích thước, tránh toàn trang trắng hoặc chớp bố cục. Nếu một dịch vụ AI lỗi, số liệu học cục bộ vẫn hiển thị.

## Thiết kế từng trang

| Trang | Bố cục và hành động chính đề xuất | Trạng thái/điểm UX cần xử lý |
|---|---|---|
| **Từ vựng** | Tiêu đề + **Thêm từ**; thanh tìm kiếm và lọc nhóm cố định phía trên danh sách; bảng có English, nghĩa Việt, nhóm, mức nhớ và menu thao tác. Import/Export/AI tạo từ nằm trong menu hoặc hàng công cụ phụ. Chọn nhiều từ mới hiện thanh thao tác hàng loạt. | Rõ số kết quả sau lọc và phạm vi Export. Form thêm từ chia “bắt buộc” và “bổ sung”; AI điền trường có nhãn nguồn; lỗi API hiển thị ngay tại form. Chưa có từ thì dẫn tới nhập Excel/thêm từ. |
| **Nhóm từ** | Lưới nhóm có tên, số từ, mô tả ngắn; thanh tìm kiếm/sắp xếp; **Tạo nhóm** là nút chính, tạo hàng loạt là lựa chọn phụ. Mở nhóm dẫn tới danh sách từ đã lọc. | Xóa nhóm phải nói rõ sẽ xóa cả từ bên trong và cần xác nhận cụ thể. Trạng thái nhóm rỗng có nút thêm từ vào nhóm. |
| **Flashcard** | Bước chọn: “Ôn từ đến hạn” / “Tất cả” / “Theo nhóm”, hiển thị số thẻ trước khi bắt đầu. Khi học: thẻ lớn ở trung tâm, tiến độ X/Y, nghe, lật, rồi hai nút nhớ/chưa nhớ rõ nghĩa. Kết quả: đúng/sai, từ cần học lại, nút học tiếp. | Giữ bàn phím tập trung cho phiên học; không để Sidebar và chức năng phụ tranh chú ý. Khi không có thẻ đến hạn, hướng dẫn chọn chế độ khác. |
| **AI Coach** | Ba chế độ Hội thoại/Viết/Nói là tab lớn; trên đầu có ngữ cảnh nhóm từ; vùng trao đổi là trọng tâm, ô soạn luôn dễ thấy. Công cụ dịch, sửa ngữ pháp, giải thích câu đặt sát ô nhập/kết quả, không chồng nhiều popup. | Thiếu Groq key/mic hiển thị đường dẫn tới Cài đặt hoặc hướng dẫn quyền mic. Phản hồi AI có trạng thái gửi, thử lại, sao chép; lịch sử theo chế độ được báo rõ. |
| **Học nghe MP3** | Luồng từng bước: Chọn tệp → Đang tạo bài → Nghe và trả lời → Kết quả. Thanh tiến trình câu hỏi, điều khiển nghe lại và script ở cùng vị trí. | Nêu tệp chỉ hỗ trợ MP3, xử lý tại đâu; lỗi nhận diện có cách thử lại. Script chỉ mở khi người học muốn, tránh lộ đáp án sớm. |
| **Gõ chữ tốc độ** | Màn trước ván chọn nhóm và chiều nhập, hiển thị luật 60 giây. Trong ván, nghĩa/từ mục tiêu và ô gõ là lớn nhất; thời gian, điểm, combo ở hàng cố định. Kết quả có điểm, độ chính xác, những từ sai và chơi lại. | Không yêu cầu chuột trong lúc chơi; cảnh báo khi không đủ từ; phím Enter và focus ổn định. |
| **Đánh quái** | Trước ván chọn nhóm/ngôn ngữ và xem luật ngắn. Trong ván ưu tiên sân chơi, mục tiêu và ô nhập; mạng/điểm/level dễ đọc nhưng không đè gameplay. Kết quả có điểm, số quái, từ cần xem lại. | Hiệu ứng chuyển động/nhấp nháy vừa phải, có giảm chuyển động; màu nguy hiểm kèm nhãn. |
| **Zombie Survival** | Màn chọn nêu yêu cầu chơi và trạng thái hỗ trợ; trận có HUD gọn, ô nhập cố định, hướng dẫn phím ngắn; kết quả riêng. | Luồng hiện chưa khớp game server theo danh mục tính năng. Trước khi quảng bá hoặc đưa vào Dashboard cần làm rõ trạng thái khả dụng; UI không hứa chơi được khi backend chưa đáp ứng. |
| **Memory Flip** | Chọn mức độ và nhóm bằng lựa chọn ngắn; trong ván bảng thẻ chiếm trung tâm, đồng hồ/lượt/cặp đã ghép ở trên; kết quả nêu thời gian, lượt, điểm. | Thẻ EN và VI phân biệt bằng nhãn, không chỉ màu. Nếu nhóm không đủ cặp cho độ khó đã chọn, giải thích và gợi ý mức khác. |
| **Tiến độ học** | Bốn tab Tổng quan/Từ vựng/Game/Thói quen; hàng KPI nhỏ rồi biểu đồ/chi tiết theo tab. Có khoảng thời gian và giải thích cách tính ở các chỉ số khó hiểu. | Không hiển thị streak placeholder bằng `0` như dữ liệu thật; ẩn hoặc ghi “chưa có dữ liệu”. Biểu đồ rỗng có lời giải thích và đường quay lại học. |
| **Lịch ôn tập AI** | Đầu trang: tổng từ cần ôn theo mức ưu tiên, **Ôn từ khẩn cấp** là hành động chính. Bộ lọc nhóm/mức ưu tiên/tìm kiếm nằm cùng một hàng; danh sách từ có lý do ưu tiên và lần ôn kế tiếp. | Nguồn LSTM/SM-2 hiển thị như thông tin phương pháp thực tế; không khẳng định AI đang hoạt động nếu chỉ dùng fallback. Tạo nhóm ôn cần cho biết có thêm nhóm mới và số từ. |
| **Multiplayer** | Luồng 3 bước rõ: kết nối server → tạo/vào phòng → sảnh chờ/trận. Mã phòng nổi bật, có nút sao chép; trạng thái từng người chơi và điều kiện bắt đầu gần nút Start. | Server không sẵn sàng/thiếu từ phải được giải thích tại bước tương ứng. Không để biểu mẫu URL kỹ thuật chiếm màn hình nếu đã lưu cấu hình. |
| **Cài đặt** | Chia mục Học tập, AI, Dữ liệu, Trợ năng/Giao diện, Thông tin; điều hướng mục bên trái hoặc tab gọn. Lưu trạng thái ngay cạnh thay đổi; khu vực nguy hiểm ở cuối. | Groq key được che, chỉ báo đã cấu hình/chưa cấu hình; không hiển thị lại bí mật. Mỗi công tắc mô tả tác động cụ thể; việc xóa dữ liệu có xác nhận và hậu quả rõ. |
| **Hướng dẫn** | Đầu trang có tìm kiếm và “Bắt đầu trong 3 bước”; các mục hướng dẫn theo tác vụ: thêm từ, ôn, AI, nghe, game, dữ liệu, phím tắt. | Nội dung phải phản ánh hành vi hiện tại, đặc biệt SQLite, Groq và phím tắt; có link dẫn đúng trang liên quan. |

## Hệ giao diện dự kiến

- Bảng màu: giữ cảm giác xanh sáng dễ chịu của template; chuẩn bị chế độ tối tương đương theo lựa chọn trong ứng dụng. Màu sắc có vai trò cố định, không đổi ý nghĩa giữa các trang.
- Chữ: font giao diện tiếng Việt dễ đọc và có thể dùng offline; tiêu đề trang 28–32 px, tiêu đề khối 18–20 px, nội dung 14–16 px, chú thích không dưới 12 px. Dòng đủ thoáng cho tiếng Việt.
- Bố cục: nội dung rộng tối đa hợp lý (khoảng 1200–1280 px); lề 24–32 px desktop, giảm khi cửa sổ hẹp. Thẻ và form dùng khoảng cách 8/12/16/24/32 px nhất quán. Bảng dài được cuộn trong vùng phù hợp, không làm mất thanh tác vụ chính.
- Tương tác: nút chính cao ít nhất khoảng 40 px; focus rõ; trạng thái disabled có lý do; modal không che mất ngữ cảnh; thông báo thành công ngắn và gắn với tác vụ vừa xong.

## Thứ tự thiết kế để người dùng duyệt

1. Dashboard: wireframe cho trạng thái mới và có dữ liệu, cùng phiên bản sáng/tối; đây là mẫu chuẩn cho hệ thẻ, chữ, nút và Sidebar.
2. Từ vựng, Nhóm từ, Flashcard, Lịch ôn: chu trình học cốt lõi.
3. AI Coach, MP3, Tiến độ: tác vụ dài và dữ liệu phân tích.
4. Game đơn, Multiplayer, Cài đặt, Hướng dẫn: dùng chung quy tắc nhưng tối ưu theo ngữ cảnh.

Điểm cần quyết định trước khi hiện thực: mức độ thay đổi Sidebar, ưu tiên của khối “Việc cần làm hôm nay”, và việc chuyển toàn ứng dụng sang bộ màu sáng/tối thống nhất. Không sửa chức năng hoặc code giao diện trước khi người dùng đánh giá thiết kế này.

### Trạng thái duyệt bản xem trước

- Người dùng đánh giá bố cục Dashboard tốt và yêu cầu chốt bản này. Bản HTML tại `dashboard-preview.html` là mốc thiết kế đã chốt cho bố cục, màu và cỡ chữ.
- Bộ icon trong `dashboard-icons-preview.html` đã được người dùng duyệt và đưa vào `dashboard-preview.html`. Dashboard hiện đã chốt cả bố cục, màu, cỡ chữ và icon ở mức bản xem trước HTML; mã ứng dụng thực tế chưa thay đổi.
- Đã tạo `vocabulary-preview.html` để người dùng duyệt tiếp trang Từ vựng. Dữ liệu và thao tác trong file này chỉ là mô phỏng tại trình duyệt.
- Bản xem trước Từ vựng được chỉnh tiếp theo phản hồi: Sidebar chuyển sang nền xanh đậm, có icon vector cho mọi mục và chỉ báo trang đang mở; bảng có đường phân cách/tiêu đề rõ hơn; cuối danh sách có tổng số kết quả và lối sang Flashcard. Thiết kế Sidebar này vẫn chờ người dùng duyệt trước khi đồng bộ sang Dashboard và mã ứng dụng thật.
- Phản hồi tiếp theo cho Từ vựng: tiêu đề nhóm Sidebar cần xanh cyan sáng; thanh lọc và tiêu đề bảng cần màu riêng; các dòng từ không nên trông như một lưới kẻ liên tục. Bản HTML đã đổi thanh lọc sang xanh nhạt, tiêu đề bảng xanh đậm, các từ thành hàng tách nhẹ và cấp độ thành nhãn màu. Vẫn chờ người dùng duyệt.
- Người dùng thấy xanh cyan trên Sidebar xanh đậm bị lẫn và đầu bảng có quá nhiều lớp xanh nhạt/trắng/xanh đậm. Bản HTML tiếp tục đổi riêng tiêu đề nhóm Sidebar sang vàng kem, gom thanh lọc và dòng kết quả lên cùng nền trắng, giữ thanh tiêu đề bảng xanh đậm. Đây là quyết định màu mới nhất cho hai vùng đó.
- Tương tác danh sách Từ vựng được đổi trong bản xem trước: ô chọn bật/tắt qua mỗi lần bấm và chỉ phục vụ chọn nhiều từ; bấm vào phần còn lại của hàng mở sửa từ; cột “Thao tác” được thay bằng một nút thùng rác màu đỏ ở cuối hàng với xác nhận trước khi xóa. Chưa đưa thay đổi này vào mã ứng dụng thật.
- Người dùng muốn phần đầu trang Từ vựng nổi bật khác phần bảng bên dưới. Bản xem trước nay dùng một hero xanh đậm chứa tiêu đề, bốn hành động và ba chỉ số; bên phải có thẻ từ vựng minh họa chuyển động nhẹ, tự giảm khi màn hình hẹp hoặc người dùng bật giảm chuyển động. Phần bảng quản lý bên dưới giữ thiết kế đã duyệt trước đó.
- Phản hồi mới: cụm logo trong Sidebar Từ vựng bị lệch và câu dẫn hero thiếu cá tính. Bản xem trước xếp icon + Lexforge thành một hàng, khẩu hiệu riêng bên dưới **“Học đúng từ. Dùng đúng lúc.”**; hero đổi câu dẫn thành **“Từ mới hôm nay. Phản xạ ngày mai.”**. Cần người dùng duyệt lời và bố cục trước khi đồng bộ sang Sidebar của Dashboard.
- Người dùng thấy hai câu trên chưa đủ mạnh. Bản xem trước đổi khẩu hiệu Sidebar thành **“Nạp từ. Bật phản xạ.”** và câu dẫn hero thành **“Từ vựng lên cấp. Tiếng Anh lên trình.”** Đây là phương án copy mới nhất để duyệt.
- Người dùng chọn câu chữ cuối cho bản xem trước Từ vựng: khẩu hiệu Sidebar **“Hóa giải rào cản.”**, câu dẫn hero **“Chắc từng từ. Chuẩn từng câu.”** Hai câu này thay thế các phương án thử trước đó.
- Người dùng tạm duyệt trang Từ vựng ở mức bản xem trước. Trang tiếp theo là Nhóm từ; bản HTML `groups-preview.html` kế thừa Sidebar/khẩu hiệu, màu và cỡ chữ hiện tại, đồng thời minh họa tìm kiếm, sắp xếp, lọc ngày, tạo/sửa/xóa nhóm, chọn icon/màu, tạo nhiều nhóm và cảnh báo xóa cả từ trong nhóm. Vẫn chờ người dùng đánh giá trước khi sửa mã ứng dụng.
