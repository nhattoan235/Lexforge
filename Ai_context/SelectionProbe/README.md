# Selection Probe

> Công cụ chẩn đoán giai đoạn 1; chưa phải tính năng của sản phẩm.

## Chạy

Trong File Explorer, có thể chạy `Ai_context\RUN_SELECTION_PROBE.bat` để mở probe trên desktop.

Vì probe đã được build trong workspace này, có thể mở trực tiếp bằng:

```powershell
Start-Process .\Ai_context\SelectionProbe\bin\Debug\net10.0-windows\Lexforge.SelectionProbe.exe
```

Để build/chạy lại từ mã nguồn:

Trong PowerShell tại thư mục gốc repo:

```powershell
dotnet run --project .\Ai_context\SelectionProbe\SelectionProbe.csproj
```

Nếu môi trường yêu cầu restore tường minh, chạy `dotnet restore` cho project trước; project không có gói NuGet bên thứ ba.

## Thử một ứng dụng

1. Mở Selection Probe.
2. Quay lại ứng dụng cần kiểm tra và bôi đen một đoạn văn mẫu, không nhạy cảm.
3. Nhấn `Ctrl+Shift+F8`. Probe sẽ tự đưa cửa sổ kết quả lên trước sau khi đọc xong.
4. Đọc tên ứng dụng/phần tử, văn bản UI Automation lấy được, thời gian truy vấn và các hình chữ nhật vùng chọn.
5. Lặp lại với cùng một câu mẫu trên ứng dụng khác; ghi kết quả vào [kết quả thử nghiệm](../SELECTION_PROBE_RESULTS.md).

> Tổ hợp `Ctrl+Shift+F8` chỉ là nút kích hoạt cho nguyên mẫu chẩn đoán này; nó không phải yêu cầu UX của sản phẩm. Tính năng sản phẩm vẫn phải phát hiện vùng chọn mà không cần `Ctrl+C`.

## Giới hạn và xử lý dữ liệu

- Chỉ truy vấn khi người dùng nhấn tổ hợp phím. Công cụ không giám sát clipboard, không polling nền và không gửi dữ liệu ra mạng.
- Văn bản chỉ hiển thị trong cửa sổ công cụ đang chạy; đóng công cụ sẽ xóa nội dung khỏi phiên đó. Không tạo tệp log.
- Thử bằng nội dung mẫu, không nhạy cảm. Một số ứng dụng có thể không công khai `TextPattern.GetSelection()` hoặc hình chữ nhật qua UI Automation; khi đó cần ghi nhận là không tương thích/không đủ thông tin và tiếp tục dùng bảng nhập/dán.
- Kết quả thành công trên một ứng dụng không chứng minh ứng dụng khác hoặc mọi phiên bản của nó hoạt động tương tự.
