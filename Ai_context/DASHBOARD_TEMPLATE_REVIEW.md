# Đánh giá template Dashboard

Ngày ghi nhận: 01-10-2026. Nguồn tham khảo do người dùng cung cấp: `F:/tmp_lexforge/Dashboard.tsx`. Tài liệu này là định hướng thiết kế; chưa thay đổi giao diện ứng dụng.

## Nhận xét

Template giữ nguyên các khối chức năng đang có của Dashboard: thống kê, hoạt động 7 ngày, truy cập nhanh, điểm cao, lịch ôn và thông báo từ vựng AI. Điểm mạnh nhất là bảng màu sáng xanh nước biển: nền `#f1f8fc`, thẻ trắng, chữ `#0d2438`, nhấn xanh `#0a7ea4` và nút vàng `#ffb81f`. Các con số lớn, icon có nền màu riêng, đường viền thẻ rõ và khoảng cách đều giúp người dùng đọc nhanh hơn giao diện tím đậm hiện tại. Template cũng có bố cục co giãn, trạng thái focus và tùy chọn giảm chuyển động.

Không nên chép nguyên tệp vào dự án. Template đổi màu theo `prefers-color-scheme`, còn ứng dụng chính hiện dùng bộ biến màu tối cố định trong `src/App.css`; áp dụng riêng cho Dashboard sẽ khiến Sidebar và các màn hình khác lệch tông. Font `Bricolage Grotesque` được tải qua Google Fonts nên cần kiểm tra hiển thị tiếng Việt và khả năng dùng khi không có mạng. CSS của template có một số selector chung (`.banner`, `.stat-card`, `.schedule`) cần giới hạn trong Dashboard để không tác động sang màn hình khác. Nút nổi và hiệu ứng nâng thẻ liên tục cũng nên giảm để phù hợp ứng dụng học tập dùng lâu.

## Hướng cải tiến đề xuất

1. Lấy bảng màu xanh sáng của template làm nền tảng; xây bộ màu sáng/tối chung cho app, gồm nền, bề mặt, chữ, viền, màu hành động và màu trạng thái. Gắn chế độ tối với lựa chọn trong ứng dụng thay vì chỉ theo Windows.
2. Thiết kế lại Dashboard trước: hàng đầu là tiêu đề, lời dẫn ngắn và hành động **Ôn luyện ngay**; kế tiếp là bốn chỉ số; sau đó là biểu đồ và thao tác nhanh; điểm cao và lịch ôn ở dưới. Khi có từ cần ôn gấp, nhấn mạnh số **Cần ôn hôm nay** và liên kết đi thẳng đến bài ôn.
3. Tăng độ rõ của cấp bậc chữ: tiêu đề khoảng 30–32 px, số liệu 34–38 px, tiêu đề thẻ 17–18 px, nội dung 14–16 px; hạn chế chữ phụ nhỏ và màu quá nhạt. Dùng font có hỗ trợ tiếng Việt ổn định, kèm font hệ thống dự phòng hoặc đóng gói font nếu cần hoạt động offline.
4. Dùng một kiểu thẻ thống nhất với viền rõ, bán kính vừa phải và khoảng trắng đủ rộng. Chỉ dùng màu riêng cho icon/chỉ số/trạng thái; tránh nhiều mảng màu nổi cùng lúc. Nút chính màu vàng nên dành cho hành động quan trọng nhất của màn hình.
5. Giữ chuyển động ngắn, tinh tế; bỏ hiệu ứng nhảy khi hover trên các thẻ không bấm được. Với biểu đồ, phân biệt rõ “Đúng” và “Tổng” bằng màu/chú giải và hiển thị trạng thái khi chưa có dữ liệu.
6. Sau khi Dashboard được duyệt, áp dụng hệ màu, chữ, nút, thẻ và điều hướng cho Sidebar cùng các màn hình còn lại để giao diện nhất quán. Widget trợ lý nổi được xem xét riêng vì kích thước và ngữ cảnh sử dụng khác ứng dụng chính.

## Phạm vi hiện tại

Chỉ ghi nhận và đánh giá phương án theo yêu cầu người dùng. Chưa sửa `src/pages/Dashboard.tsx`, `src/App.css` hoặc hành vi ứng dụng; chưa chạy build hay kiểm tra trực quan.
