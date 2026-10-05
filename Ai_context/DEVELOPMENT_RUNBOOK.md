# Hướng dẫn phát triển và chạy

## Điều kiện theo cấu hình repo

- Windows 10/11 nếu cần đóng gói installer Windows.
- Node.js 18+ theo README gốc, npm.
- .NET 10 SDK trên máy phát triển để build bộ nhận diện vùng chọn. Bản đóng gói self-contained không yêu cầu người dùng cài riêng .NET Desktop Runtime.
- Python cho speech/LSTM sidecar; tài liệu hiện ghi Python 3.8+ cho speech.
- Kết nối Internet và khóa/dịch vụ tương ứng chỉ cần cho các tính năng AI hoặc multiplayer qua mạng.

## Chạy giao diện web

Tại thư mục gốc:

```powershell
npm install
npm start
```

Create React App chạy renderer ở `http://localhost:3000`. Một số phần gọi `window.electronAPI`, nên trải nghiệm đầy đủ cần chạy qua Electron.

## Chạy desktop Electron

```powershell
npm install
npm run electron-dev
```

Script sẽ build bộ nhận diện vùng chọn .NET trước, sau đó chạy CRA và Electron đồng thời; Electron chờ port 3000 rồi mở cửa sổ. Database được tạo tại user data của Electron, tên file `vocab.db`. Có thể xem đường dẫn hiện tại trong Cài Đặt. Không cần cài SQL Server LocalDB cho mã Electron hiện tại.

Electron mở biểu tượng trợ lý nổi và biểu tượng khay hệ thống. Nút đóng của cửa sổ học chính sẽ ẩn cửa sổ, giữ trợ lý chạy; chọn **Thoát Lexforge** từ panel hoặc menu khay để thoát hoàn toàn. Trạng thái bật/tắt trợ lý được lưu tại user data trong `assistant-widget.json`. Khi bật, sidecar dùng UI Automation để đọc vùng chọn và dòng đang gõ trong ô soạn thảo. Vùng chọn tiếng Anh ổn định 0,5 giây sẽ được gửi tới Groq để hiện nhãn dịch nhanh; dòng đang gõ ổn định khoảng 1,1 giây sẽ được kiểm tra ngữ pháp. Khi tắt trợ lý, cả hai luồng theo dõi đều dừng.

### Thử dịch vùng văn bản được chọn

1. Mở **Cài Đặt** và xác nhận Groq API key đã được lưu.
2. Chạy `npm run electron-dev` và chờ cửa sổ Lexforge mở. Các yêu cầu văn bản dùng model Groq `openai/gpt-oss-120b`; nếu Electron đã chạy từ trước khi cập nhật, hãy khởi động lại ứng dụng.
3. Trong ChatGPT hoặc Notepad, bôi đen một cụm từ/câu tiếng Anh mẫu không nhạy cảm rồi giữ vùng chọn. Sau khoảng 0,5 giây cộng thời gian phản hồi Groq, nhãn dịch nhanh sẽ hiện cạnh vùng chọn.
4. Bôi đen câu thứ hai; nhãn cũ biến mất và bản dịch mới xuất hiện. Chọn lại cùng một câu cũng phải hoạt động.
5. Tắt công tắc trợ lý rồi bôi đen một đoạn khác; nhãn dịch nhanh không được xuất hiện. Bật lại để tiếp tục.

Nếu không thấy nhãn, mở bảng trợ lý để đọc thông báo trạng thái nhận diện vùng chọn; nếu vừa build sidecar trong chế độ phát triển, hãy khởi động lại Electron. Nút **Dịch** cạnh vùng chọn đã được gỡ; tác vụ dịch nhập/dán vẫn nằm trong bảng trợ lý.

### Thử hỗ trợ viết nhanh

Phím tắt toàn hệ thống **Ctrl+Alt+W** mở popup hỗ trợ viết tại ô đang soạn. Trong popup, nhập ý tiếng Việt rồi bấm **Dịch sang tiếng Anh**. Nếu có câu hiện tại, dùng **Thay câu đang viết**; nếu ô soạn trống và được nhận diện, dùng **Chèn vào ô đang viết**. Ứng dụng xác nhận lại ô đích trước khi ghi và báo lỗi nếu không nhận diện được ô.

1. Trong Notepad hoặc ô soạn thảo ChatGPT, gõ `I went home. She go to school every day.` và để con trỏ ở cuối. Sau khi ngừng gõ, bảng **Gợi ý viết** phải hiển thị **Câu sẽ thay** là `She go to school every day.` và chỉ đề xuất sửa câu đó. Thử đặt con trỏ trong câu đầu rồi chỉnh một ký tự để xác nhận trợ lý chuyển sang câu chứa con trỏ.
2. Bấm **× Bỏ qua**; bảng đóng. Sửa câu một chút rồi ngừng gõ để xem gợi ý mới. Bấm **✓ Áp dụng** và xác nhận đúng dòng gốc được thay thế trong ứng dụng đang viết.
3. Khi bảng gợi ý hiện, bấm **Việt → Anh**, nhập một ý tiếng Việt và bấm **Dịch sang tiếng Anh**. Kết quả hiện bên dưới. Bấm **Thay câu đang viết** và kiểm tra dòng gốc được thay hoàn toàn, không nối thêm.
4. Đổi nội dung dòng gốc trước khi bấm áp dụng: ứng dụng phải từ chối bản đề xuất cũ. Đổi nội dung dòng gốc trước khi bấm thay câu: ứng dụng phải từ chối bản dịch cũ. Thử cả trường hợp trợ lý tắt.

Luồng viết nhanh chỉ gửi dòng tiếng Anh đang gõ sau khoảng 1,1 giây ổn định; ô nhập Việt → Anh chỉ gửi khi bấm dịch. Việc áp dụng qua UI Automation và `SendInput` cần xác nhận riêng trên từng ứng dụng. Nếu ứng dụng không hỗ trợ, bảng nhập/dán của trợ lý vẫn dùng được.

### Thử nhập/dán và công cụ hỗ trợ viết

1. Mở bảng trợ lý, xác nhận Groq API key đã được lưu trong **Cài Đặt** của app chính.
2. Chọn tác vụ **Dịch từ hoặc câu**, **Kiểm tra & sửa ngữ pháp**, **Hoàn chỉnh câu**, hoặc **Viết câu tiếng Anh từ ý tiếng Việt**.
3. Với tác vụ dịch, chọn tự nhận diện hoặc chiều Anh → Việt / Việt → Anh. Nhập hoặc dán nội dung (tối đa 5.000 ký tự), rồi bấm nút tác vụ; có thể dùng `Ctrl+Enter`.
4. Xem kết quả, giải thích, gợi ý cách diễn đạt và từ vựng hữu ích nếu có. **Sao chép kết quả** chỉ sao chép câu/kết quả chính. Bấm **Quay lại công cụ** để nhập tác vụ tiếp theo.
5. Chỉ bấm nút mới gửi nội dung tới Groq; việc nhập/chỉnh sửa trong ô không tự gọi AI.

## Build Windows

```powershell
npm run dist:win
```

Theo `package.json`, build frontend trước rồi Electron Builder tạo NSIS installer dưới `dist/`. Có thêm `npm run build`, `npm run pack` và `npm run dist`.

Bản đóng gói gần nhất nằm ở `dist-stage5-smoother/TOEIC Vocab Master Setup 1.0.0.exe` (Windows x64, khoảng 123 MB). Sau bản này, mã nguồn đã được cập nhật giao diện panel, theme sáng/tối và xử lý launcher; theo yêu cầu, bộ cài cuối sẽ được tạo một lần sau khi chốt trải nghiệm. Chạy `npm run electron-dev` để xem các thay đổi trong lúc phát triển. Sidecar vùng chọn đóng gói kèm .NET runtime 10.0.10, không cần cài thêm .NET Desktop Runtime. Installer hiện chưa ký số và app không tự khởi động cùng Windows.

## Cấu hình Groq

1. Mở app → **Cài Đặt** → nhập Groq API key → lưu.
2. Key được lưu ở `UserSettings` với `SettingKey='groq_api_key'`.
3. Key cần thiết cho AI Coach, tra cứu nghĩa, sinh từ và MP3 Listening.

`.env.example` không cấu hình Groq; file đó dành cho Google Speech credentials.

## Chạy Multiplayer server

```powershell
cd game-server
npm install
npm start
```

Server mặc định dùng port `3001` (`PORT` có thể ghi đè). Trong app nhập `http://localhost:3001` cho máy local. Để chơi trong LAN, host dùng địa chỉ IP LAN; để chơi qua Internet cần tunnel/hosting có thể truy cập được và nhập URL đó ở client. Game server không cần Groq key.

## Chạy Speech Recognition cho microphone AI Coach

1. Tạo credential Google Cloud Speech-to-Text và thiết lập biến `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới JSON credential.
2. Có thể sao chép `.env.example` thành `.env` ở root rồi thay giá trị đường dẫn.
3. Cài dependency và chạy:

```powershell
python -m pip install -r speech_requirements.txt
python speech_server.py
```

Server Flask bind `127.0.0.1:5000`. Trang AI Coach gửi multipart field `audioBlob` tới `/transcribe-blob`.

## Chạy scheduler Python (tùy chọn)

```powershell
python lstm_scheduler.py
```

Script dùng port `5001`. Cần các gói Flask, flask-cors, PyTorch, NumPy, pandas, scikit-learn và joblib; repo không có `lstm_requirements.txt`. Model `duolingo_model_best.pt` và scaler `scaler_v2.pkl` được tìm cạnh script nhưng không thấy trong snapshot hiện tại. Trước khi dựa vào scheduler, xem mục scheduler trong [Trạng thái](STATUS_AND_DECISIONS.md) để cấu hình đúng DB và bảng.

## Tệp và thư mục cần biết

| Đường dẫn | Vai trò |
|---|---|
| `src/App.tsx` | Trạng thái trang và mapping component |
| `src/components/Layout/Sidebar.tsx` | Mục điều hướng |
| `src/pages/` | Các màn hình sản phẩm và game |
| `src/services/database.ts` | Query SQLite, CRUD và thuật toán SRS/fallback |
| `electron/main.js` | SQLite schema, persistence, IPC handlers |
| `electron/preload.js` | API an toàn renderer–main |
| `electron/assistant-widget.html` / `.css` / `.js` | Giao diện biểu tượng nổi và panel bật/tắt |
| `electron/assistant-widget-preload.js` | IPC giới hạn cho widget trợ lý |
| `src/services/aiVocabService.ts` | Tra nghĩa/sinh nhóm từ Groq |
| `src/services/mp4ListeningService.ts` | Chép lời, lọc nội dung, chia đoạn và tạo câu hỏi MP3 |
| `speech_server.py` | Google Cloud Speech-to-Text Flask API |
| `lstm_scheduler.py` | Scheduler LSTM/SM-2 Flask API |
| `game-server/server.js` | Phòng, luật và state multiplayer |
| `note_to_update.txt` | Ghi chú hai yêu cầu cũ; trạng thái đối chiếu ở tài liệu Status |

## Kiểm tra và xác minh

Repo chưa có cấu hình test. Giai đoạn 5 đã xác minh production build, self-contained publish, NSIS installer, cú pháp JavaScript Electron và sự hiện diện của tài nguyên trợ lý trong gói. Người dùng đã xác nhận luồng overlay/Groq trên ChatGPT và đánh giá tốt tác vụ viết câu; chưa xác minh bản installer được cài trên máy hoặc các ứng dụng/DPI khác.
