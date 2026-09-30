# Trạng thái, quyết định và điểm cần xác minh

**Mốc đọc mã:** 29-09-2026 · **Commit:** `46669fe` trên `main`. Nhận xét dưới đây là đọc tĩnh, trừ khi ghi rõ khác.

## Hai yêu cầu trong `note_to_update.txt`

| Yêu cầu cũ | Trạng thái trong mã hiện tại | Căn cứ |
|---|---|---|
| Khi thêm từ mà không nhập nghĩa, AI tự điền nghĩa phổ biến | **Đã có triển khai** cho từ mới. Prompt yêu cầu 1–2 nghĩa, IPA, từ loại, ví dụ và bản dịch ví dụ. Nếu gọi AI lỗi mà nghĩa vẫn trống, từ mới không được lưu; nhánh lỗi hiện chủ yếu log console. | `src/pages/VocabularyPage.tsx`, `src/services/aiVocabService.ts` |
| Chọn nhóm cố định khi thêm từ và nhớ nhóm vừa chọn | **Đã có triển khai** qua nhóm lọc/nhóm gần nhất và localStorage; nút ➕ từ trang nhóm mở form với đúng nhóm. | `src/pages/VocabularyPage.tsx`, `src/pages/GroupsPage.tsx`; commit `3231a96` |

## Mức hoàn thiện theo luồng

### Đã có luồng sản phẩm nhìn thấy được

- Quản lý từ/nhóm; Excel import/export; flashcard SRS cơ bản.
- Typing Race, Monster Game và Memory Flip.
- Dashboard, biểu đồ tiến độ, settings và AI Coach.
- Tạo bài nghe từ MP3, gồm transcript theo mốc thời gian và câu hỏi hai lượt.
- Hub multiplayer nối tới Tower Defense, Whack-a-Mouse, Co-op Shooter.

“Có luồng” chỉ nói về mã/UI được nối; chưa xác nhận chất lượng dữ liệu, quyền API, codec trên từng máy hoặc toàn bộ tình huống runtime.

### Phụ thuộc bên ngoài

- Groq key cần nhập trong Settings; các tính năng AI gọi thẳng Groq từ renderer.
- Microphone cần Google credential, Python packages và Flask server ở port 5000.
- Multiplayer cần game server chạy ở port 3001 và kết nối từ client.
- Scheduler cần server, DB đúng đường dẫn, schema mở rộng và model/scaler nếu muốn inference LSTM thật.

## Điểm không khớp hoặc chưa hoàn tất

### 1. Tài liệu gốc vẫn kể về SQL Server

`README.md` và phần hướng dẫn trong `HelpPage.tsx` còn yêu cầu SQL Server LocalDB, màn hình kết nối SQL Server và schema SQL Server. Luồng đang được `App.tsx` khởi động là SQLite `sql.js`; `ConnectPage.tsx` không được route. Dùng tài liệu trong `Ai_context/` và mã `electron/main.js` làm căn cứ cho luồng hiện tại.

README/Help cũng mô tả import vào nhóm đầu tiên; giao diện import hiện cho chọn nhóm có sẵn hoặc tạo nhóm mới. Trang nghe được đặt tên file MP4 ở code nhưng nội dung UI và bộ lọc file là MP3.

### 2. Lịch ôn cần hoàn thiện schema và đường dẫn DB

- `electron/main.js` hiện chỉ khởi tạo sáu bảng cốt lõi. Không thấy tạo `StudySessionsLSTM`, `WordSchedule` hoặc view `WordMetrics`, trong khi flashcard, offline scheduler và Python server truy vấn các tên này.
- File Electron hiện là `${app.getPath('userData')}/vocab.db`. `lstm_scheduler.py` tự dò các tên như `vocabapp.db`/`database.db`; biến `TOEIC_DB_PATH` chỉ được chấp nhận nếu đường dẫn đó đã tồn tại. Vì vậy sidecar có thể mở nhầm/không tìm thấy DB.
- Repo không có `duolingo_model_best.pt` hoặc `scaler_v2.pkl`; script sẽ chuyển sang fallback khi model/scaler không có. Cũng chưa có file requirements riêng cho scheduler.
- `/health` của Python luôn trả `status: 'ok'` khi Flask chạy, dù `model_ready` có thể false; client chỉ kiểm `status`, không kiểm `model_ready`.
- Endpoint `/daily-schedule` đọc các hàng `WordSchedule` hiện có và chưa tự gọi inference cho từng từ. Trên DB mới, các bảng thiếu có thể làm endpoint hoặc ghi lịch thất bại.

Trước khi gọi đây là “lịch LSTM hoạt động”, cần thống nhất schema/migration, truyền đúng đường dẫn DB, xử lý health/model readiness và quyết định lúc nào recompute lịch.

### 3. Hai game/module chưa có đường dùng hoàn chỉnh

- `WordSniperPage.tsx` có gameplay và lưu điểm `sniper`, nhưng chưa được import/đưa vào mapping `App.tsx` hay Sidebar. Trang tiến độ có mục điểm Sniper dù game chưa mở được từ UI chuẩn.
- `ZombieGamePage.tsx` được gắn vào Sidebar/App, nhưng phát `tower:attack` với `roomId: 'ROOM_ID'` cố định và đợi một số event như `enemy:spawn`/`game:sync_positions`. Server hiện chỉ có ba game `tower`, `mouse`, `shooter`; Tower Defense dùng `game:state` và `enemy:hit/remove`. Cần quyết định tích hợp lại đúng giao thức hay bỏ/ẩn route này.
- `ConnectPage.tsx` còn là UI cũ; gọi `dbService.connect()` không thực hiện kết nối SQL Server. Không đưa người dùng tới màn này từ app hiện tại.

### 4. Cài đặt và số liệu có trường chưa được dùng

- `daily_goal` và `auto_speak` được tải/lưu trong Settings, nhưng ngoài trang Settings không thấy code dùng các giá trị này; Flashcard có state auto-speak riêng mặc định bật.
- `DailyGoals` được tạo trong schema nhưng không thấy luồng ghi/đọc; tiến độ ngày chủ yếu lấy từ `StudySessions`.
- `ProgressPage` khai báo `streak` nhưng đặt hằng `0`.
- `MemoryFlipPage` không ghi kết quả vào bảng điểm/phiên học.

### 5. Hợp đồng âm thanh microphone nên kiểm tra trên runtime

Renderer dùng `MediaRecorder`, tạo Blob với nhãn `audio/wav`, còn Flask khai báo `LINEAR16` ở 48 kHz. Mã hiện không thấy bước chuyển codec/sample rate. Browser có thể cung cấp định dạng khác WAV; cần kiểm tra `MediaRecorder.mimeType`, sample rate và phản hồi Google Cloud trên Windows thực tế trước khi xem mic là đã xác minh.

### 6. Khởi động SQLite bất đồng bộ

`electron/main.js` gọi `initDatabase()` nhưng không `await` trước `createWindow()`. `db-connect` hiện luôn trả success, trong khi `db-query` có thể trả “Database not ready” nếu renderer query quá sớm. Đây là điểm cần kiểm tra khi gặp lỗi khởi động chập chờn.

### 7. Công cụ tìm kiếm và `.gitignore`

`.gitignore` có dòng `{src/` chưa đóng ngoặc brace. `rg` báo lỗi phân tích glob khi đọc repo. Có thể sửa riêng trong lần xử lý tooling; dòng này hiện không làm thay đổi mã tính năng.

## Gợi ý thứ tự xử lý kỹ thuật

1. Chốt yêu cầu có tiếp tục hỗ trợ Zombie và Word Sniper hay không; sau đó nối đúng route/giao thức hoặc gỡ tham chiếu cũ.
2. Nếu muốn dùng AI Schedule, thêm schema/version migration, thống nhất DB path giữa Electron và Python, đóng gói dependencies/model (hoặc xác nhận fallback là lựa chọn chính).
3. Cập nhật README/Help cho SQLite, MP3, cấu hình Groq và các server tùy chọn.
4. Đồng bộ Settings với hành vi thực; tính streak thật hoặc bỏ chỉ số placeholder.
5. Xác minh microphone codec và luồng Electron boot trên Windows.

Các mục trên là công việc tiềm năng rút ra từ repo, không phải thay đổi đã thực hiện trong lượt tạo bộ context.

## Kế hoạch mới: Trợ lý tiếng Anh nổi trên desktop

Ngày 30-09-2026, người dùng thống nhất hướng sản phẩm: trợ lý nổi trên desktop, dùng Groq hiện có, dịch vùng văn bản được chọn mà không yêu cầu `Ctrl+C`, đồng thời có bảng để nhập/dán nội dung và dùng công cụ dịch/viết. Ứng dụng ChatGPT người dùng thường dùng phải nằm trong danh sách kiểm tra tương thích ngay ở nguyên mẫu đầu tiên, cùng với Chrome/Edge, Word, Notepad và trình đọc PDF.

Yêu cầu và thứ tự thực hiện được ghi trong [Kế hoạch trợ lý tiếng Anh desktop](DESKTOP_AI_ASSISTANT_PLAN.md). Người dùng xác nhận giai đoạn 3 dịch liên tiếp trên ChatGPT và đã đánh giá tốt kết quả tác vụ viết câu của giai đoạn 4. Giai đoạn 5 đã được triển khai, kiểm tra build và đóng gói Windows x64. Người dùng sẽ đánh giá trải nghiệm bản cài; khả năng đọc vùng chọn vẫn cần kiểm tra thêm theo ứng dụng, DPI và màn hình phụ. Bảng nhập/dán tiếp tục là phương án dự phòng.

### Tiến độ nguyên mẫu giai đoạn 1

- Đã tạo [Selection Probe](SelectionProbe/README.md), đọc `TextPattern.GetSelection()` và các hình chữ nhật từ `GetBoundingRectangles()` sau thao tác kích hoạt chẩn đoán của người dùng. Probe không dùng clipboard, không gọi mạng và không lưu nội dung.
- Build .NET Windows thành công với 0 cảnh báo / 0 lỗi.
- Người dùng xác nhận Notepad (109 ms) và ChatGPT (2 ms) đều đọc được văn bản cùng một hình chữ nhật vùng chọn. ChatGPT trả về X=-1316, vì vậy overlay cần xử lý màn hình có tọa độ desktop âm và DPI scaling. Không lưu văn bản mẫu đã chọn. Chrome, Edge, Word và PDF còn chờ kiểm tra.
- Xem ma trận và hướng dẫn tại [kết quả nguyên mẫu](SELECTION_PROBE_RESULTS.md).

### Tiến độ giai đoạn 2: widget và bật/tắt

- Đã thêm cửa sổ widget nổi có biểu tượng mở panel; panel có công tắc bật/tắt, mở cửa sổ học chính và thoát ứng dụng.
- Đã thêm menu khay hệ thống với các thao tác tương ứng. Đóng cửa sổ học chính sẽ ẩn nó để trợ lý tiếp tục chạy; thoát hoàn toàn qua menu **Thoát Lexforge**.
- Trạng thái bật/tắt lưu cục bộ trong `assistant-widget.json`; người dùng xác nhận đã thấy widget.

### Tiến độ giai đoạn 3: nút dịch tại vùng chọn

- Thêm sidecar .NET Windows UI Automation, chạy khi trợ lý bật và dừng khi tắt. Poll vùng chọn mỗi 30 ms trong thao tác giữ chuột trái/Shift, mỗi 240 ms khi rảnh; không dùng clipboard, không gọi AI và không ghi nội dung ra log/tệp.
- Khi UI Automation trả về vùng chọn có tọa độ, Electron quy đổi tọa độ desktop sang DIP, ưu tiên đặt nút **Dịch** phía dưới selection để tránh đè toolbar của ứng dụng khác, giới hạn nút trong work area của màn hình gần nhất và không nhận focus. Khi vùng chọn mất hoặc người dùng chuyển sang cửa sổ Lexforge, nút được ẩn; snapshot trong bộ nhớ được giữ tối đa 5 giây để tránh race lúc click.
- Chỉ khi người dùng bấm **Dịch**, Electron đọc Groq key trong SQLite và gọi model `openai/gpt-oss-120b` với mức suy luận `low`. Kết quả mở trong widget, kèm nút sao chép. Các luồng Groq văn bản còn lại trong AI Coach, từ vựng và MP3 Listening cũng dùng model này.
- Ngày 30/09/2026: xử lý lỗi nút còn hiện “Đang dịch…” bằng cách đặt lại nhãn sau khi Electron nhận thao tác và ẩn nút khi mở panel. Chỉ tạm ẩn đề xuất trong lúc Groq đang xử lý; khi đã có kết quả, có thể chọn câu tiếp theo ngay cả khi panel vẫn mở. Chuyển model Groq sau khi `llama-3.3-70b-versatile` bị ngừng phục vụ ngày 21/09/2026; yêu cầu dịch cũ đã lỗi trước khi có bản dịch để hiển thị.
- Sidecar publish self-contained Windows x64 thành công và đã nằm trong installer; người dùng không cần cài riêng .NET Desktop Runtime. Installer NSIS chưa ký số.
- React dev server đã compile, localhost trả HTTP 200 và tiến trình sidecar còn chạy sau khi khởi động Electron. Người dùng xác nhận trên ChatGPT: đề xuất xuất hiện tại vùng chọn, Groq trả bản dịch và có thể dịch câu tiếp theo khi bảng kết quả vẫn mở. Notepad, DPI/màn hình phụ và ứng dụng khác chưa được xác minh. Xem cách chạy/thử tại [hướng dẫn phát triển](DEVELOPMENT_RUNBOOK.md).

### Tiến độ giai đoạn 4: nhập/dán và hỗ trợ viết

- Bảng trợ lý có ô nhập/dán tối đa 5.000 ký tự, chọn chiều dịch tự động/Anh–Việt/Việt–Anh và bốn tác vụ: dịch, kiểm tra/sửa ngữ pháp, hoàn chỉnh câu, viết câu tiếng Anh từ ý tiếng Việt.
- Kết quả tách nội dung đề xuất, giải thích, cách diễn đạt khác và từ vựng hữu ích; có sao chép riêng kết quả. `Ctrl+Enter` gửi tác vụ.
- IPC giới hạn dữ liệu và tác vụ hợp lệ; Electron đọc Groq key trong SQLite và gửi văn bản chỉ sau thao tác người dùng. Không ghi nội dung nhập vào log.
- `node --check` qua cho main/preload/widget và `npm run build` thành công. Người dùng đã thử luồng viết câu tiếng Anh từ ý tiếng Việt, xác nhận kết quả khá tốt; các tác vụ nhập/dán còn lại chưa có xác nhận riêng.

### Tiến độ giai đoạn 5: tích hợp và đóng gói

- Widget chỉ báo nhận diện vùng chọn sẵn sàng sau sự kiện `ready`; thông báo trạng thái nêu rõ lúc khởi động, thiếu sidecar hoặc dừng bất ngờ. Event từ tiến trình cũ không thể đặt lại trạng thái tiến trình mới.
- Panel được giới hạn trong vùng làm việc hiện tại và CSS lấp đầy kích thước cửa sổ để nội dung tiếp tục cuộn trên màn hình thấp. Trợ lý không tự khởi động cùng Windows.
- Theo góp ý trải nghiệm, launcher dùng biểu tượng Lexforge dạng phẳng mới, không viền/đổ bóng. Kích thước hiện tại là 60 px cho hình biểu tượng trong vùng thao tác 76 px; icon khay hệ thống không đổi. Kéo giữ để di chuyển, lưu tọa độ qua lần mở sau và giới hạn vị trí theo vùng làm việc của màn hình.
- Nút **Dịch** cạnh vùng chọn đã bỏ CSS border, shadow và transform khi hover. Sidecar poll UI Automation 30 ms trong lúc giữ chuột trái/Shift để chọn, và 240 ms khi rảnh; trước đây poll cố định mỗi 300 ms gây chuyển vị trí khựng.
- Bộ cài gần nhất là `dist-stage5-smoother/TOEIC Vocab Master Setup 1.0.0.exe` (khoảng 123 MB), trước đợt cập nhật panel/theme mới. Theo yêu cầu, chưa tạo bộ cài mới; chỉ đóng gói lại một lần sau khi chốt toàn bộ UX.
- Mã nguồn hiện bỏ viền/bóng panel, dùng nền đặc; tăng độ dễ đọc cho chữ/điều khiển; thêm nút sáng/tối lưu lựa chọn; cải thiện bắt pointer khi kéo, khôi phục tọa độ khi thu gọn, đưa icon lên trên cùng và tránh nút dịch đè lên launcher. `npm run build`, kiểm tra cú pháp JS và parse CSS đã thành công. Cần người dùng trải nghiệm thay đổi này trước khi đóng gói cuối.
- Phản hồi UX tiếp theo: mở bảng bị chậm/giống treo, thanh cuộn khựng, bảng biến mất sau thao tác chụp màn hình và launcher nổi nhỏ. Mã nguồn hiện mở cửa sổ trước khi đổi kích thước, bỏ thao tác tự thu gọn bằng Escape (để phím Escape của chế độ chụp không thu widget), gộp kết quả vào một vùng cuộn chính, và tăng riêng biểu tượng nổi. Chưa xác nhận trên máy người dùng; chưa đóng gói.
- Build React đã thành công; JavaScript Electron và CSS widget đã qua kiểm tra cú pháp. Phiên xem trước Electron đã khởi chạy lại để người dùng thử, không tạo installer. Log phiên khởi động vẫn có GPU process exit `-1073740791` và truy vấn thiếu bảng `WordSchedule`; hiện chưa kết luận chúng gây ra độ trễ của widget.
- Hai ảnh người dùng cung cấp sau đó cho thấy panel thực sự thu thành launcher sau lần chụp đầu; kết luận trước về việc mất thứ tự nổi là sai. Mã cũ gọi `collapseAssistantPanel()` khi cửa sổ widget nhận sự kiện `close` từ hệ thống. Nay sự kiện `close` ngoài lúc thoát app chỉ bị bỏ qua; nút **−** là thao tác thu gọn tường minh. IPC từ launcher chỉ mở panel, không còn tự đảo trạng thái thành thu gọn nếu nhận thêm click. Đã bỏ các timer blur và tín hiệu đổi cửa sổ foreground được thêm theo chẩn đoán cũ. Chờ người dùng xác nhận lại bằng cách chụp ngay lần đầu.
- Người dùng xác nhận icon/kéo thả của bản trước tốt. ChatGPT là ứng dụng duy nhất có xác nhận tích hợp trực tiếp; Chrome, Edge, Word, PDF, DPI và màn hình phụ còn chờ kiểm tra.
- Người dùng xác nhận sự cố panel thu gọn sau khi chụp màn hình đã ổn. Theo góp ý tiếp theo, giao diện trợ lý được thiết kế lại cho cả sáng và tối: gộp trạng thái với công tắc thành một thẻ, tăng độ tương phản viền/nền giữa các nhóm, tăng cỡ chữ và vùng bấm, làm ô nhập và kết quả nổi bật hơn. Khung ngoài tiếp tục phẳng, không đổ bóng. Cửa sổ panel tăng từ 380×640 lên 410×690 DIP và vẫn giới hạn theo vùng làm việc màn hình. Chưa tạo bộ cài mới; chờ người dùng đánh giá UX.
- Góp ý tiếp theo: hai danh sách chọn tác vụ/chiều dịch khiến thao tác cồng kềnh. Bốn tác vụ nay là các nút chọn trực tiếp; dịch mặc định tự nhận diện Anh–Việt/Việt–Anh. Người dùng chỉ mở mục **Chiều dịch** khi cần ép hướng cụ thể. Vẫn giữ nguyên bốn tác vụ và ba hướng dịch trong IPC. Chưa đóng gói lại.
- Người dùng muốn bấm ngoài bảng để thu về icon. Thêm chế độ `--watch-clicks` cho sidecar Windows, chỉ chạy khi panel mở. Nó phát vị trí cú nhấn chuột thực sự; Electron thu panel nếu điểm nằm ngoài bounds. Không dùng sự kiện mất focus nên đổi cửa sổ bằng phím tắt không tự thu; bỏ qua cú nhấn trong lớp `ScreenClippingHost`/`SnippingTool` để giữ trải nghiệm chụp màn hình trước đó. Nút **−** vẫn hoạt động. Build sidecar dev thành công với 0 cảnh báo/0 lỗi; chưa đóng gói installer.
- Yêu cầu mới: sau khi giữ vùng chọn tiếng Anh 1,5 giây, hiển thị nhãn dịch nhanh gần vùng chọn. Mã nguồn hiện lên lịch chờ 1.500 ms từ sự kiện vùng chọn ổn định, giới hạn từ/câu ngắn, gọi Groq để lấy riêng bản dịch tiếng Việt, hiển thị bằng cửa sổ nhỏ không nhận focus và cho chuột xuyên qua. Khi vùng chọn đổi/mất, trợ lý tắt hoặc mở bảng đầy đủ, nhãn và yêu cầu cũ bị hủy; có cache nhỏ trong bộ nhớ để tránh gọi lại cùng nội dung. Nút **Dịch** mở kết quả đầy đủ vẫn giữ nguyên. Các tệp nhãn mới đã được thêm vào danh sách đóng gói nhưng chưa tạo installer.
- Sau khi dùng nhãn dịch nhanh, người dùng muốn bỏ nút **Dịch** riêng cạnh vùng chọn. Mã nguồn đã gỡ cửa sổ, tệp UI, IPC và luồng gọi Groq của nút này; nhãn dịch nhanh được đặt gần vùng chọn hơn. Tác vụ **Dịch** trong bảng trợ lý vẫn giữ nguyên và hỗ trợ nhập/dán Anh–Việt/Việt–Anh. Phần lịch sử giai đoạn 3 trong tài liệu mô tả nguyên mẫu cũ; quyết định UX mới nhất này thay thế nút dịch tại vùng chọn. Chưa đóng gói lại.
- Người dùng báo nhãn dịch nhanh chỉ hoạt động ở lần chọn đầu sau khi mở app. Sửa vòng đời nhãn: hủy cửa sổ preview cũ khi vùng chọn đổi/mất và tạo renderer mới cho kết quả tiếp theo, tránh tái sử dụng một cửa sổ ẩn có thể không cập nhật. Sidecar nay phát `clear` khi bắt đầu một thao tác chọn mới và đọc vùng chọn sau khi thả chuột, nên chọn lại cùng nội dung cũng tạo sự kiện mới. Build sidecar dev thành công (0 cảnh báo/0 lỗi); cần xác nhận lại thực tế trên ChatGPT/Notepad.
- Người dùng xác nhận dịch nhanh lặp lại đã hoạt động, nhưng muốn giảm độ trễ chờ. Đổi thời gian giữ vùng chọn ổn định từ 1.500 ms xuống 800 ms; thời gian Groq phản hồi vẫn cộng thêm sau khoảng chờ này. Chưa đóng gói lại installer.
- Người dùng tiếp tục chọn thời gian chờ 500 ms cho nhãn dịch nhanh. Đây là thời gian trước khi gửi yêu cầu Groq, không bao gồm độ trễ mạng và suy luận. Chưa đóng gói lại installer.
- Mở rộng hỗ trợ viết nhanh: sidecar `--watch-writing` quan sát dòng đang gõ trong ô soạn thảo có focus, loại trừ ô mật khẩu/chỉ đọc, và phát sự kiện khi nội dung đổi. Electron đợi khoảng 1,1 giây, hỏi Groq chỉ khi nội dung đủ dài và có vẻ là tiếng Anh; nếu thật sự cần sửa thì hiện bảng nhỏ với câu đề xuất, ✓ áp dụng, × bỏ qua, và mục Việt → Anh có ô nhập/kết quả/chèn. Khi áp dụng, sidecar đối chiếu revision, cửa sổ, nội dung dòng và vị trí con trỏ (đối với chèn) trước khi chọn dải văn bản và gửi ký tự Unicode. Đã thêm tệp popup vào danh sách đóng gói nhưng chưa tạo installer. Cần người dùng kiểm tra khả năng áp dụng thực tế trên ChatGPT/Notepad và các trình soạn thảo khác.
- Sửa lỗi gợi ý viết chỉ xuất hiện một lần: thao tác ×/✓ giờ chỉ bỏ qua đúng revision đang hiển thị, không chặn vĩnh viễn cùng nội dung câu. Sidecar nhận diện ổn định ô soạn thảo khi vị trí dọc thay đổi và vẫn phát revision mới nếu văn bản thay đổi trong cùng cửa sổ. Đã build sidecar dev; cần kiểm tra lặp lại thực tế trên ChatGPT. Chưa đóng gói installer.
- Sau khi người dùng vẫn thấy chậm và bảng chỉ hiện một lần, phát hiện renderer dùng `requestAnimationFrame` khi cửa sổ popup đang ẩn để báo chiều cao; callback có thể bị hoãn và không gọi `showInactive` ở lần kế tiếp. Đổi sang báo chiều cao trực tiếp sau khi cập nhật nội dung, giảm thời gian đợi ngừng gõ từ 1.100 xuống 600 ms, và dùng watcher cú nhấn để đóng popup khi click ngoài bảng. Độ trễ Groq vẫn phụ thuộc mạng và phản hồi dịch vụ. Chưa đóng gói installer.
- Người dùng xác nhận bảng gợi ý lặp lại đã khá tốt nhưng nút **Áp dụng** chưa sửa được câu. Sidecar nay chủ động kích hoạt lại cửa sổ đích bằng cách tạm gắn input thread với cửa sổ đang foreground trước khi chọn đúng dải văn bản và gửi bản sửa; lỗi UI Automation được ghi ra stderr chỉ với loại/thông báo lỗi, không có văn bản người dùng. Đã build sidecar dev. Phạm vi hiện tại là dòng chứa con trỏ, từng dòng một; chưa có chế độ tự sửa cả nhiều đoạn. Cần người dùng xác nhận thực tế trên ChatGPT. Chưa đóng gói installer.
- Người dùng báo nút **Áp dụng** vẫn chưa sửa được câu và yêu cầu ghi chú để xử lý sau. Ưu tiên UX bảng viết nhanh: trên Windows không mở app chính khi kích hoạt popup lần đầu; kéo bảng qua phần tiêu đề; giữ vị trí người dùng kéo khi bảng đổi chiều cao; sau khi dịch Việt → Anh tự cuộn tới kết quả. Phím tắt khi bảng có focus: Alt+A áp dụng câu đề xuất, Esc bỏ qua, Alt+V mở/đóng Việt → Anh, Ctrl+Enter dịch nội dung tiếng Việt, Alt+I chèn câu tiếng Anh. Nút **Áp dụng/Chèn** vẫn là lỗi đã ghi nhận, phím tắt tương ứng chưa thể hoàn thành thao tác thay/chèn cho tới khi sửa luồng này. Chưa đóng gói installer.
- Log sau khi dừng phiên app cũ chỉ ra `EntryPointNotFoundException` khi gọi `GetCurrentThreadId` từ `user32.dll` trong luồng Áp dụng. Đã sửa khai báo sang `kernel32.dll` và build sidecar dev thành công (0 cảnh báo/0 lỗi). Chưa xác nhận áp dụng thực tế sau sửa; nếu vẫn lỗi sẽ xử lý ở lượt sửa chức năng theo yêu cầu người dùng.
- Người dùng xác nhận vẫn không kéo được bảng và chưa áp dụng được câu, phản hồi chậm. Đổi kéo bảng sang pointer events + IPC định vị cửa sổ (giống launcher) thay vì `-webkit-app-region`; chỉ kéo từ hàng tiêu đề và giữ vị trí kéo khi bảng đổi chiều cao. Luồng áp dụng giờ thử chọn đúng văn bản qua UIA, kiểm tra selection, rồi dùng Home/Shift+End làm phương án dự phòng nếu trình soạn thảo không chọn được bằng UIA; không nhập nếu selection không khớp câu nguồn. Riêng gợi ý ngữ pháp dùng `openai/gpt-oss-20b` và chờ ngừng gõ 400 ms để giảm trễ. Model này được Groq ghi nhận là phương án thay thế `llama-3.1-8b-instant` sau deprecation; tác vụ khác giữ model hiện tại. Đã build sidecar dev; cần xác nhận thao tác kéo/áp dụng trực tiếp trên ChatGPT. Chưa đóng gói installer.
- Người dùng báo **Áp dụng** lúc được lúc không, phải bấm nhiều lần; phím tắt Alt/Enter xung đột và lần đầu đi vào ứng dụng đang viết. Sidecar nay đợi ô đích ổn định sau khi chuyển focus và thử lại bước chuẩn bị/chọn câu tối đa 3 lần trước khi nhập đúng một lần; vẫn xác nhận selection trùng câu gốc. Bỏ các phím tắt chỉ hoạt động khi popup có focus, thay bằng phím toàn hệ thống `Ctrl+Alt+1` đến `Ctrl+Alt+5` tương ứng áp dụng, bỏ qua, Việt → Anh, dịch, chèn; chỉ đăng ký trong lúc popup hiện rồi hủy khi đóng. Chưa có xác nhận trực tiếp từ người dùng; build sidecar dev thành công. Chưa đóng gói installer.
- Người dùng cung cấp ảnh cho thấy thay `what are you doing` bị rớt ký tự thành `wht re yo doig?`; nguyên nhân là gửi cả chuỗi ký tự Unicode trong một lệnh `SendInput` vào ô ChatGPT. Đổi sang gửi từng ký tự với nhịp 16 ms và đọc lại dòng sau khi thay để chỉ báo thành công khi nội dung khớp. Tăng timeout IPC áp dụng lên 15 giây cho câu dài. Người dùng cũng báo phím tắt toàn hệ thống tác động cả ứng dụng đang viết; đã bỏ `globalShortcut`, quay về phím `Ctrl+Alt+1` đến `5` chỉ khi bảng hỗ trợ viết nhanh có focus (người dùng bấm vào bảng trước). Sidecar dev build thành công; cần xác nhận trực tiếp. Chưa đóng gói installer.
- Người dùng muốn toàn bộ phím bấm đi vào bảng ngay khi gợi ý hiện và `Esc` trả về ô đang viết. Popup nay hiện với focus; `Esc` đóng bảng, sidecar kích hoạt/focus lại đúng editor gốc theo revision, sau đó Electron ẩn popup. Cú nhấn ngoài bảng tiếp tục đóng theo ứng dụng mà người dùng chọn. Log phiên trước cho thấy gợi ý ngữ pháp dùng `openai/gpt-oss-20b` bị HTTP 400; đã thêm `reasoning_format: hidden` theo tài liệu Groq và fallback sang `openai/gpt-oss-120b` khi 20b trả 400. Chưa xác nhận thao tác thực tế; chưa đóng gói installer.
- Người dùng xác nhận `show()`/`focus()` của Electron chưa đưa bàn phím sang popup; phải click bảng lần đầu. Khi bảng hiện, Electron giờ gửi HWND của popup cho sidecar và sidecar thử kích hoạt cửa sổ Windows bằng `SetForegroundWindow` cùng `AttachThreadInput`; chỉ nhận HWND thuộc tiến trình Electron đã đăng ký. Poll lệnh giảm từ 180 xuống 100 ms để rút khoảng chờ focus. Sidecar báo `popupFocusResult` và ghi cảnh báo nếu không thể foreground. Phím tắt vẫn chỉ ở renderer popup, không đăng ký toàn hệ thống. Cần xác nhận trên máy người dùng. Chưa đóng gói installer.
- Người dùng tiếp tục xác nhận popup chưa tự nhận phím; log thực tế có `Writing popup did not become foreground`, không có lỗi HWND/process mismatch. Windows từ chối chuyển foreground dù đã gắn input thread. Thêm fallback gửi một nhịp Alt qua `SendInput` rồi thử `SetForegroundWindow` lại; tài liệu Microsoft nêu thao tác Alt có thể mở quyền foreground. Chỉ thực hiện khi kích hoạt thông thường thất bại. Sidecar dev build thành công, chờ người dùng xác nhận. Chưa đóng gói installer.
- Người dùng xác nhận phím tắt đã vào popup nhưng câu áp dụng vẫn mất ký tự (`Wht re yo doing?`). Nhịp Unicode 16 ms không đủ tin cậy với ô ChatGPT. Thay đường nhập bằng dán nguyên câu qua clipboard: lấy tham chiếu OLE của clipboard hiện tại, tạm đặt văn bản đề xuất, gửi Ctrl+V một lần, đọc lại dòng để xác nhận đúng kết quả, sau đó khôi phục clipboard cũ nếu không có ứng dụng khác thay clipboard trong lúc thao tác. Không đọc/ghi nội dung clipboard vào log. Sidecar dev build thành công; cần xác nhận thực tế. Chưa đóng gói installer.
- Người dùng xác nhận các phần trợ lý đã ổn và muốn mở app mượt hơn, không tự hiện bảng F12/DevTools. Cửa sổ chính nay phóng to khi còn ẩn, đợi tải trang và khung hình đầu rồi mới hiện; thêm splash Lexforge dạng phẳng với thanh tải, giữ tối thiểu khoảng 800 ms, đóng khi cửa sổ chính sẵn sàng. Bỏ `openDevTools()` mặc định; chỉ mở khi người phát triển đặt `LEXFORGE_DEVTOOLS=1`. Ẩn thanh menu mặc định để giao diện gọn hơn. Đã thêm `electron/startup.html` vào danh sách đóng gói; chưa tạo installer theo quyết định đóng gói một lần sau UX.
- Người dùng muốn hỗ trợ thêm Zalo/các ứng dụng khác; Notepad đã áp dụng bằng nút được nhưng phím tắt chưa hoạt động. Popup nay bắt phím trong `webContents.before-input-event` của chính cửa sổ (thay vì chỉ DOM keydown), và sau khi sidecar báo đã đưa HWND của popup lên foreground, Electron focus thêm `webContents`; vẫn không dùng hotkey toàn hệ thống. Bộ nhận diện vùng gõ cho phép thêm control UIA `Custom` có thể nhận bàn phím và có `TextPattern`, ngoài `Edit`/`Document`, để tăng khả năng tương thích trình soạn thảo nhúng. Đã build sidecar dev; Zalo và Notepad cần xác nhận thực tế. Chưa đóng gói installer.
- Người dùng quyết định **tạm dừng hỗ trợ Zalo** để giữ sự ổn định hiện tại. Đã hoàn nguyên toàn bộ thay đổi trong lượt Zalo ở mã chạy: bỏ `ControlType.Custom`, bỏ các chế độ/Win32 API dò chẩn đoán Zalo, bỏ `before-input-event` và bước focus thêm cho popup; phím tắt trở lại cách bắt DOM đang hoạt động trước lượt này. Đã xóa thư mục build chẩn đoán `probe-bin`. Dòng trạng thái ngay phía trên chỉ ghi lịch sử thử nghiệm, không còn mô tả mã hiện tại. Notepad cũng tạm để sau theo yêu cầu người dùng.
