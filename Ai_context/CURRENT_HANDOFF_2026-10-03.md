# Bàn giao trạng thái hiện tại — 03-10-2026

Tài liệu này ghi lại công việc UI và trợ lý nổi trong chuỗi trao đổi gần đây. Khi tài liệu và mã khác nhau, **mã nguồn hiện tại là căn cứ cuối cùng**. Nhiều thay đổi trong repo vẫn chưa commit; không reset hoặc ghi đè chúng khi tiếp tục.

## Yêu cầu mới nhất của người dùng

Người dùng hiện yêu cầu **bong bóng bám viền trái hoặc phải ở mọi độ cao hợp lệ**, kể cả cấu hình hai màn hình, chuyển động mượt khi kéo và không lấn xuống taskbar. Yêu cầu này thay thế kiểu bốn góc trước đó.

Mã hiện tại trong `electron/main.js` đã được chỉnh theo yêu cầu này:

- `moveAssistantDrag()` lấy vị trí chuột toàn màn hình và nhận diện màn hình khi con trỏ đi vào `bounds` của màn hình đó, kể cả vùng taskbar. Bong bóng chọn viền trái/phải gần con trỏ, giữ độ cao kéo trong `workArea` và chuyển động bằng timer 16 ms với easing đến tọa độ mục tiêu.
- `finishAssistantDrag()` xác nhận vị trí mục tiêu trên cùng viền trước khi lưu. Viền ngang chừa 8 px; độ cao có thể ở bất kỳ vị trí nào trong `workArea`, kể cả ngay trên taskbar.
- Electron theo dõi `display-added`, `display-removed` và `display-metrics-changed` để đặt lại bong bóng/bảng vào vùng làm việc hợp lệ và cập nhật vị trí bong bóng đã lưu.
- `getInitialWidgetBounds()` nép tọa độ đã lưu vào viền nếu bong bóng còn nhìn thấy tối thiểu 32×32 px; nếu mất hoàn toàn, nó trở về vị trí mặc định sau khi khởi động lại.
- `resizeAssistantWindow(false)` nép bong bóng vào viền khi thu bảng. Nút **Hiện bong bóng** vẫn đưa icon về góc phải dưới màn hình chính.
- **Bảng trợ lý khi mở rộng** vẫn được giới hạn trong `workArea` để nội dung bảng hiển thị được. Logic kéo của cửa sổ gợi ý viết cũng dùng `clampBoundsToWorkArea()` riêng. Đừng nhầm hai trường hợp này với bong bóng.

Không có kiểm tra thao tác kéo trực tiếp trên phiên Electron đã nạp **mã mới nhất** sau lần thay đổi cuối. Main process của Electron cần được thoát hẳn từ khay hệ thống rồi mở lại; đóng cửa sổ học chính chỉ ẩn cửa sổ và không tải lại `electron/main.js`.

### Cập nhật dịch nhanh và gợi ý viết nhanh

Người dùng báo cả hai popup không hiện và bong bóng bị mất. Trong `electron/main.js`, hai luồng tự động từng bị bỏ qua khi `assistantExpanded` là `true`; chặn này đã được gỡ. Lỗi Groq của hai luồng trước đây chỉ được ghi vào console, giờ được đưa ra popup với thông báo cụ thể để phân biệt lỗi mạng, khóa và HTTP. Renderer liên quan: `electron/selection-preview.js`, `electron/writing-popup.js`, `electron/writing-popup.html`.

Tại thời điểm kiểm tra, ba tiến trình helper Windows của app đang chạy và Groq API key có mặt trong SQLite (chỉ kiểm tra độ dài, không đọc/ghi lại giá trị). Việc gửi yêu cầu thử bằng khóa đó tới Groq bị hệ thống auto-review từ chối vì coi là xuất secret thiếu ủy quyền cụ thể; không được lách chặn này. Một thử nghiệm helper bằng Notepad từ môi trường shell không cho ra sự kiện nhưng không đủ kết luận vì shell và UI automation có thể ở khác desktop/session. Tab thử đã được hoàn tác và đóng, không sửa các tab Notepad sẵn có. Cú pháp các file JS đã sửa qua `node --check`, nhưng **chưa xác minh popup trên app sau khi Electron tải mã mới**.

## Luồng kéo bong bóng hiện tại

1. `electron/assistant-widget.js`: `pointerdown` chuột trái trên `#launcher` gọi `assistantAPI.beginWidgetDrag()`. Renderer hiện không tự kéo bằng `pointermove` hoặc `setPointerCapture`; như vậy kéo ra ngoài cửa sổ 76×76 không phụ thuộc pointer capture của Chromium.
2. `electron/assistant-widget-preload.js`: cầu IPC `assistant:drag-start` và sự kiện `assistant:drag-finished`.
3. `electron/main.js`: khi trợ lý hiện, `startOutsideClickWatcher()` chạy tiến trình `Lexforge.SelectionMonitor.exe --watch-clicks`. Tiến trình này được giữ hoạt động để khỏi mất sự kiện khi bắt đầu kéo, và được lên lịch khởi động lại nếu thoát bất ngờ. `assistant:drag-start` ghi điểm bắt đầu và khoảng cách từ con trỏ tới góc bong bóng.
4. `electron/selection-monitor/Program.cs`: `WatchClicks()` đọc trạng thái nút chuột toàn Windows mỗi 12 ms và phát `mouseDown`, `mouseMove`, `mouseUp` qua stdout. `electron/main.js` nhận các dòng này; `mouseMove` di chuyển bong bóng, `mouseUp` cập nhật tọa độ lần cuối rồi kết thúc và lưu vị trí.
5. `electron/assistant-widget.js`: khi nhận `assistant:drag-finished`, chỉ chặn cú click mở bảng trong 350 ms sau một lần kéo thực sự. Click bình thường vẫn mở bảng.

Một nguyên nhân ngắt kéo đã được phát hiện trước đó: `clearWritingSuggestion()` từng dừng tiến trình theo dõi chuột ngay khi hỗ trợ viết cập nhật trong lúc kéo. Hiện tại hàm này không dừng watcher nữa; watcher chỉ bị dừng khi app thoát. Log chẩn đoán tạm cho thấy Electron đã khởi tạo bong bóng đúng ở mép màn hình phụ 125% (`x = -84`), nhưng ảnh người dùng và vị trí lưu trước đó vẫn ở `x = -243`. Mã hiện đặt mục tiêu ở viền ngay khi kéo, không đợi sự kiện thả, rồi đưa cửa sổ đến đó bằng easing. Chưa xác minh thao tác kéo trực tiếp trên UI vì Computer Use không kết nối được trong phiên hiện tại.

## Các file quan trọng để tiếp tục

| File | Vai trò hiện tại |
|---|---|
| `electron/main.js` | Vòng đời Electron, startup, vị trí và trạng thái bong bóng/bảng, watcher chuột, tray, popup dịch và hỗ trợ viết |
| `electron/assistant-widget.js` | Tương tác launcher, bảng trợ lý, form viết/dịch và giao diện sáng/tối của widget |
| `electron/assistant-widget-preload.js` | API IPC an toàn giữa renderer widget và main process |
| `electron/assistant-widget.html` | Cấu trúc bong bóng, bảng trợ lý và footer |
| `electron/assistant-widget.css` | Giao diện bong bóng và bảng trợ lý |
| `electron/selection-monitor/Program.cs` | Helper Windows cho vùng chọn, theo dõi viết và sự kiện chuột toàn màn hình |
| `electron/startup.html` | Màn hình khởi động, đã được làm lại để tránh chớp tắt trước khi cửa sổ chính sẵn sàng |
| `package.json` | Script build helper và đóng gói Electron; file helper đã publish được đưa vào `extraResources` |
| `public/lexforge-mark.png`, `public/icon.ico` | Logo chữ L màu ngọc lam người dùng đã chọn cho bong bóng/app |

Ở chế độ phát triển, `selectionMonitorExecutablePath()` trong `electron/main.js` chọn bản helper được build mới nhất trong `electron/selection-monitor/bin/Release/`, sao chép các file runtime sang thư mục temp rồi khởi chạy. Điều này tránh lỗi EXE đang chạy bị khóa lúc build lại. Bản đóng gói dùng `electron/selection-monitor/publish/`; khi phát hành cần build/publish helper phù hợp với mã C# hiện tại. `Program.cs` đã được build thành công ở một lượt trước, nhưng chưa xác nhận toàn bộ hành vi kéo của mã JS mới nhất trên UI.

## Công việc giao diện đã làm trong chuỗi trao đổi

- Thiết kế lại nội dung các trang Từ vựng, Nhóm từ, Flashcard, Tiến độ, Lịch ôn, Cài đặt, các game và một số màn hình khác. Các file trang chính ở `src/pages/`; nhiều lớp CSS mới như `*Approved.css`, `TrainingShell.css`, `ZombieShell.css`, `ProgressOrbit.css`, `Theme.css` đang được dùng. Xem diff hiện tại trước khi sửa tiếp vì có nhiều file mới chưa commit.
- Bổ sung/điều chỉnh các form thông báo và xác nhận ở `src/components/Feedback/`.
- Mở rộng giao diện tối và sửa nhiều chỗ chữ/nền thiếu tương phản. Các thay đổi trải trong `src/App.css`, `src/components/Layout/Shell.css`, `src/pages/*.css` và JSX tương ứng.
- Thiết kế lại bảng trợ lý nổi, footer với nút thoát, logic click bên ngoài để thu bảng nhưng giữ bong bóng, và splash khởi động.
- Người dùng đã chọn phương án icon chữ **L màu ngọc lam**; asset nằm ở `public/lexforge-mark.png` và `public/icon.ico`, được tham chiếu trong Electron, trang web và cấu hình đóng gói. Các bản nháp hình ở `Ai_context/icon-previews/`.

## Lưu ý cho AI tiếp theo

- Đọc trạng thái hiện tại trong các file nguồn trên trước khi thay đổi. Một số mô tả cũ trong `Ai_context/` phản ánh các bản thiết kế hoặc các lần thử đã bị thay thế.
- Giữ bong bóng hoàn toàn trong `workArea` theo yêu cầu mới nhất; nếu kiểm thử thấy bị bật ngược vị trí, kiểm tra vùng giới hạn được giữ trong `assistantDragState` và tọa độ thực tế trước khi đổi thuật toán.
- Nếu người dùng tiếp tục báo lỗi kéo, ưu tiên quan sát hành vi của **phiên app đã khởi động lại với mã mới** và log/sự kiện thực tế; đừng kết luận nguyên nhân chỉ từ suy đoán. Các lần sửa trước nhiều lần chưa được xác minh trực tiếp trên UI.
- Không xem các ảnh chụp trong thư mục temp từ các tin nhắn cũ là file bền vững. Các bản xem trước trong `Ai_context/` chủ yếu là nguyên mẫu, không phải UI production.
