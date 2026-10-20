# Micro trong AI Coach

1. Chạy `start_speech_server.bat` trong thư mục dự án và đợi thông báo ready.
2. Mở AI Coach → Luyện Nói → Bắt đầu.
3. Bấm micro và nói tiếng Anh. App tự dừng sau khoảng 1,8 giây im lặng khi đã nói; có thể bấm dừng thủ công (tối đa 30 giây).
4. Đợi nhận dạng trên máy, xem lại văn bản rồi bấm gửi để Groq trả lời.

Âm thanh không được gửi tới Google hay Groq. Model small.en xử lý trên CPU,
không cần API key. Văn bản và lịch sử trò chuyện vẫn gửi tới Groq khi bấm gửi.
Trong Luyện Nói không tự động gửi nội dung ô nhập đi kiểm tra ngữ pháp.
Không lưu bản ghi âm ra file. Tải model một lần trước khi dùng, xem SPEECH_SERVER_README.md.

Silero VAD chạy trong app bằng model/WASM local. Im lặng ban đầu không kết thúc sớm bản ghi.
