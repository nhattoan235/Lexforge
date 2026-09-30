# Kết quả thử nguyên mẫu lấy vùng chọn

**Ngày ghi nhận:** 30-09-2026 · **Build:** thành công, 0 cảnh báo / 0 lỗi.

**Probe:** [Selection Probe](SelectionProbe/README.md) — .NET Windows, UI Automation `TextPattern.GetSelection()` và `GetBoundingRectangles()`.

## Tóm tắt

Nguyên mẫu đã được tạo và build thành công. Người dùng đã thử trực tiếp trong Notepad và ChatGPT. Cả hai ảnh đều xác nhận đọc được văn bản và một hình chữ nhật vùng chọn: Notepad mất 109 ms, ChatGPT mất 2 ms. ChatGPT trả về tọa độ X âm; khi triển khai overlay cần giữ nguyên hệ tọa độ desktop và xử lý màn hình lệch khỏi điểm gốc. Câu mẫu được chọn không được lưu lại trong tài liệu. Các ứng dụng còn lại vẫn cần thử.

## Ma trận tương thích

| Ứng dụng | Văn bản vùng chọn | Vị trí vùng chọn | Độ trễ | Trạng thái / ghi chú |
|---|---|---|---|---|
| Ứng dụng ChatGPT người dùng đang dùng | Đạt | Đạt — vùng chọn có tọa độ X âm, 1 hình chữ nhật | 2 ms | Đã xác nhận qua ảnh người dùng; phần tử UIA: `ControlType.Text`. X âm có thể do màn hình nằm bên trái điểm gốc desktop; cần giữ đúng tọa độ desktop khi đặt nút nổi. Nội dung câu mẫu không được lưu. |
| Chrome | Chưa thử | Chưa thử | Chưa đo | Chưa có cửa sổ trong phiên kiểm tra. |
| Edge | Chưa thử | Chưa thử | Chưa đo | Chưa có cửa sổ trong phiên kiểm tra. |
| Microsoft Word | Chưa thử | Chưa thử | Chưa đo | Chưa có cửa sổ trong phiên kiểm tra. |
| Notepad | Đạt | Đạt — 1 hình chữ nhật | 109 ms | Đã xác nhận qua ảnh người dùng; phần tử UIA: `ControlType.Document` / Text editor. Nội dung câu mẫu không được lưu. |
| Trình đọc PDF | Chưa thử | Chưa thử | Chưa đo | Cần chọn ứng dụng PDF cụ thể khi thử. |

## Cách hoàn tất lượt kiểm tra

Chạy probe theo hướng dẫn tại [SelectionProbe/README.md](SelectionProbe/README.md), dùng cùng một đoạn văn mẫu trong mỗi ứng dụng và nhấn tổ hợp chẩn đoán. Với từng ứng dụng, ghi nhận: có văn bản hay không; có tọa độ/hình chữ nhật hay không; cảm nhận độ trễ; lỗi UIA nếu xuất hiện. Không dùng đoạn văn nhạy cảm.

**Trạng thái giai đoạn 1:** Đã xác nhận đọc văn bản và hình chữ nhật vùng chọn trong Notepad và ChatGPT. Chrome, Edge, Word và trình đọc PDF chưa được thử; cần tiếp tục ma trận trước khi chốt phạm vi tương thích.
