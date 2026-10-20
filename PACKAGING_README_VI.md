# Đóng gói Windows

Bản cài bao gồm Electron, bộ hỗ trợ dịch/viết Windows, runtime Python đã đóng thành EXE và hai model Whisper local. Người dùng không cần Node.js, Python hay terminal để mở app.

Chuẩn bị dependencies frontend và môi trường `.venv` theo hướng dẫn speech, tải sẵn `models/small` và `models/small.en`, rồi cài công cụ đóng gói:

```
.venv\Scripts\python.exe -m pip install pyinstaller==6.22.3
npm run dist:win
```

Kết quả trong `dist/`: bộ cài NSIS và thư mục `win-unpacked` chạy trực tiếp. Khi mở bản đóng gói, app tự bật backend nhận dạng ở `127.0.0.1:5000` nếu chưa có backend local sẵn sàng; không mở cửa sổ terminal. Khi thoát hoàn toàn, app chỉ dừng backend do chính nó khởi chạy.

Dữ liệu người dùng và API key vẫn ở userData của Electron; không được đưa vào bộ cài. Model đi kèm chạy offline, không tự tải lại lúc mở app. Bộ cài hỗ trợ chọn thư mục cài đặt và tạo shortcut Desktop/Start Menu.

Trước khi bàn giao bản đóng gói, chạy `npm run test:packaged-chat` để kiểm tra cầu nối chat và micro từ URL file (khác localhost). Đặt `LEXFORGE_TEST_APP_ROOT` tới `dist/win-unpacked/resources/app.asar` để kiểm tra đúng artifact đã đóng gói. Có thể bật `LEXFORGE_TEST_DICTATION=1` khi backend local đang chạy để kiểm tra VAD/ghi âm/nhận dạng bằng âm thanh giả lập; không thu micro thật.
