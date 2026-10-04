# AI Context — TOEIC Vocab Master

> Bộ tài liệu bàn giao bối cảnh dự án cho người phát triển và trợ lý AI. Phần khảo sát dự án gốc được đối chiếu tại commit `46669fe` (`main`) ngày **29-09-2026**; các thay đổi mới nhất được ghi trong [bàn giao 03-10-2026](CURRENT_HANDOFF_2026-10-03.md).

## Mục đích

Thư mục này ghi lại sản phẩm hiện có, cách các phần nối với nhau, cách khởi chạy và những chỗ chưa đồng bộ. Hãy dùng nó để bắt đầu nhanh; khi cần sửa hành vi, mã nguồn vẫn là căn cứ cuối cùng.

## Đọc theo nhu cầu

| Tài liệu | Nội dung |
|---|---|
| [Bàn giao trạng thái hiện tại (03-10-2026)](CURRENT_HANDOFF_2026-10-03.md) | Các thay đổi UI/trợ lý nổi gần đây, yêu cầu kéo bong bóng mới nhất, file liên quan và phần chưa kiểm tra trực tiếp |
| [Tổng quan dự án](PROJECT_OVERVIEW.md) | Sản phẩm, công nghệ, luồng sử dụng và các mốc đã có |
| [Danh mục tính năng](FEATURE_CATALOG.md) | Từng màn hình, game, trạng thái truy cập và phạm vi thực tế |
| [Kiến trúc và dữ liệu](ARCHITECTURE_AND_DATA.md) | Electron, React, SQLite, dịch vụ AI/giọng nói/multiplayer và mô hình dữ liệu |
| [Hướng dẫn chạy](DEVELOPMENT_RUNBOOK.md) | Cài đặt, chạy desktop, game server, speech server và build Windows |
| [Trạng thái và việc cần xác minh](STATUS_AND_DECISIONS.md) | Yêu cầu đã giải quyết, khác biệt tài liệu–mã nguồn và rủi ro kỹ thuật đã thấy |
| [Kế hoạch trợ lý tiếng Anh desktop](DESKTOP_AI_ASSISTANT_PLAN.md) | Phạm vi, trải nghiệm, các giai đoạn, tiêu chí nghiệm thu và rủi ro của trợ lý nổi dùng Groq |
| [Kết quả nguyên mẫu vùng chọn](SELECTION_PROBE_RESULTS.md) | Nguyên mẫu giai đoạn 1 và ma trận kiểm tra tương thích theo ứng dụng |
| [Kế hoạch mở rộng nhiều ứng dụng](CROSS_APP_WRITING_PLAN.md) | Khảo sát năng lực ô nhập, adapter, kiểm thử và điều kiện nghiệm thu trước khi mở rộng dịch/viết nhanh |
| [Đánh giá template Dashboard](DASHBOARD_TEMPLATE_REVIEW.md) | Nhận xét về template người dùng cung cấp và hướng cải tiến giao diện để duyệt trước khi sửa code |
| [Đề xuất UX/UI toàn ứng dụng](UX_UI_BLUEPRINT.md) | Bố cục và tương tác dự kiến cho Dashboard và từng trang đang hoạt động, để duyệt trước khi triển khai |
| [Bản xem trước Dashboard](dashboard-preview.html) | HTML độc lập để xem bố cục Dashboard, đổi sáng/tối và xem một số trạng thái dữ liệu mẫu |
| [Bảng duyệt icon Dashboard](dashboard-icons-preview.html) | Bộ icon vector được thiết kế lại để người dùng duyệt trước khi thay vào Dashboard |
| [Bản xem trước Từ vựng](vocabulary-preview.html) | HTML độc lập cho trang quản lý từ, có tìm/lọc, chọn nhiều từ và các cửa sổ thao tác minh họa |
| [Bản xem trước Nhóm từ](groups-preview.html) | HTML độc lập cho trang quản lý nhóm từ, có tìm/lọc, tạo/sửa/xóa và tạo nhiều nhóm minh họa |
| [Bản xem trước Flashcard](flashcard-preview.html) | HTML độc lập cho bước chọn từ, lật thẻ, tự đánh giá và xem kết quả buổi học |
| [Bản xem trước AI Coach](ai-coach-preview.html) | HTML độc lập cho ba chế độ luyện, chọn nhóm từ và màn hình trò chuyện minh họa |
| [Bản xem trước Học nghe MP3](listening-preview.html) | HTML độc lập cho chọn file MP3, hai lượt nghe trắc nghiệm và xem kết quả minh họa |
| [Bản xem trước Gõ chữ tốc độ](typing-preview.html) | HTML độc lập cho chọn chiều gõ/nhóm từ, ván chơi 60 giây, combo và kết quả minh họa |
| [Bản xem trước Đánh quái](monster-preview.html) | HTML độc lập cho chọn từ, sáu quái minh họa, trận chiến với mạng/cấp/combo và kết quả |
| [Bản xem trước Zombie Survival](zombie-preview.html) | HTML độc lập cho màn giới thiệu, chiến trường mẫu, HUD, nhập từ và kết quả; ghi rõ trạng thái phụ thuộc server |
| [Bản xem trước Memory Flip](memory-preview.html) | HTML độc lập cho chọn độ khó/nhóm từ, lật thẻ ghép cặp Anh–Việt, đồng hồ và kết quả |
| [Bản xem trước Multiplayer](multiplayer-preview.html) | HTML độc lập cho kết nối mẫu, tạo/vào phòng, chọn game và sảnh chờ; không kết nối server thật |
| [Bản xem trước Tiến độ học](progress-preview.html) | HTML độc lập cho bốn mục Tổng quan, Từ vựng, Trò chơi và Thói quen với dữ liệu minh họa |
| [Bản xem trước Lịch ôn tập AI](schedule-preview.html) | HTML độc lập cho lịch ôn mẫu, mức ưu tiên, lọc theo nhóm, tìm từ, flashcard từng từ và phân trang 10 từ |
| [Bản xem trước Cài đặt](settings-preview.html) | HTML độc lập cho mục tiêu học, phát âm, từ mới AI, Groq key, giao diện, dữ liệu và thao tác xóa minh họa |
| [Bản xem trước Hướng dẫn](help-preview.html) | HTML độc lập cho bắt đầu trong ba bước, tìm kiếm và hướng dẫn theo tác vụ; nội dung đã bỏ hướng dẫn LocalDB cũ |

## Tóm tắt nhanh

TOEIC Vocab Master là ứng dụng desktop Electron/React để quản lý từ vựng Anh–Việt, học bằng flashcard SRS, chơi game, xem tiến độ và luyện với AI. Dữ liệu chính lưu cục bộ bằng SQLite qua `sql.js`; một số tính năng cần Internet và dịch vụ/khóa API riêng.

Các luồng đã có trong ứng dụng gồm quản lý từ và nhóm, nhập/xuất Excel, tra cứu/sinh từ bằng Groq, AI Coach, bài luyện nghe từ MP3, phát âm trình duyệt, lịch ôn, game đơn và ba game multiplayer.

> Trợ lý desktop đã tích hợp widget bật/tắt, dịch vùng chọn và bảng dịch/hỗ trợ viết. Launcher mới có thể kéo thả; nút **Dịch** bám vùng chọn mượt hơn. Mã nguồn hiện cũng có panel nền đặc không bóng, bố cục chữ dễ đọc hơn và công tắc sáng/tối ghi nhớ lựa chọn. Người dùng muốn chốt các chỉnh sửa trải nghiệm trước khi tạo bộ cài cuối một lần. Xem [kế hoạch trợ lý desktop](DESKTOP_AI_ASSISTANT_PLAN.md) và [hướng dẫn chạy/thử](DEVELOPMENT_RUNBOOK.md).

## Quy ước đọc trạng thái

- **Đang truy cập được**: được đăng ký trong `src/App.tsx` và xuất hiện trong `src/components/Layout/Sidebar.tsx`.
- **Có mã nhưng chưa nối luồng**: component hoặc logic có trong repo nhưng không có điều hướng phù hợp hoặc chưa được server hỗ trợ.
- **Phụ thuộc/chưa xác minh**: cần khóa, dịch vụ ngoài, dữ liệu hoặc artifact chưa có trong repo. Có mã nguồn không đồng nghĩa đã chạy thành công trên máy sạch.
- Các nhận xét về lỗi tiềm ẩn trong bộ tài liệu này đến từ **đọc tĩnh mã nguồn**, chưa phải kết quả chạy app.

## Căn cứ và cập nhật

Tài liệu được tạo từ mã trong `src/`, `electron/`, `game-server/`, script Python, cấu hình và README hiện có. README gốc còn mô tả SQL Server trong khi luồng Electron hiện dùng SQLite; xem [Trạng thái](STATUS_AND_DECISIONS.md) trước khi dựa vào tài liệu cũ. Khi tính năng đổi, cập nhật tài liệu tương ứng và ghi rõ điều gì đã được chạy xác minh.
