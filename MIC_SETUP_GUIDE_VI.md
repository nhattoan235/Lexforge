# 🎤 Cách Sử Dụng Micro Cho AI Coach

## Setup Nhanh (Windows) - Google Cloud Speech-to-Text

**✅ Miễn phí: 60 phút/tháng**

### Bước 1: Tạo Google Cloud Project

1. Vào: https://console.cloud.google.com/
2. Đăng nhập hoặc tạo tài khoản Google (Gmail được)
3. Nhấn **"Create Project"**
4. Đặt tên (ví dụ: "TOEIC App")
5. Nhấn **"Create"**

### Bước 2: Enable Speech-to-Text API

1. Tìm kiếm: **"Speech-to-Text API"**
2. Chọn API đó
3. Nhấn **"Enable"**
4. Chờ 1-2 phút để kích hoạt

### Bước 3: Tạo Service Account & Download Credentials

1. Vào: **"Credentials"** (menu trái)
2. Nhấn **"Create Credentials"**
3. Chọn **"Service Account"**
4. Đặt tên (ví dụ: "toeic-app")
5. Nhấn **"Create and Continue"**
6. Nhấn **"Continue"** (bỏ qua các bước khác)
7. Nhấn **"Go to service account"** (hoặc vào Credentials → Service Accounts)
8. Chọn service account vừa tạo
9. Chọn tab **"Keys"**
10. Nhấn **"Add Key"** → **"Create new key"**
11. Chọn **"JSON"**
12. Nhấn **"Create"**
13. File JSON sẽ download tự động - **lưu vào thư mục `d:\testAppTC\test2\toeic-app\`**

### Bước 4: Đặt Biến Môi Trường (Windows)

Tạo hoặc chỉnh sửa file `.env` trong `d:\testAppTC\test2\toeic-app\`:

```
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\google-credentials.json
```

Thay `C:\path\to\google-credentials.json` bằng đường dẫn thực của file JSON vừa download.

**Ví dụ:**
```
GOOGLE_APPLICATION_CREDENTIALS=D:\testAppTC\test2\toeic-app\google-credentials.json
```

### Bước 5: Cài Python Dependencies

```bash
cd d:\testAppTC\test2\toeic-app
python -m pip install -r speech_requirements.txt
```

### Bước 6: Chạy 2 cái này (mỗi cái terminal riêng)

**Terminal 1 - Speech Backend:**
```bash
python speech_server.py
```

Chờ tới khi thấy:
```
✅ Google Cloud Speech API configured
```

**Terminal 2 - Electron App:**
```bash
npm run electron-dev
```

---

## Sử dụng Mic

1. Bắt đầu "Luyện Nói" trong AI Coach
2. Click nút 🎤
3. **Nói tiếng Anh** (tối đa 30 giây)
4. Dừng tự động hoặc click ⏹
5. Chờ 1-2 giây, text sẽ xuất hiện
6. Gửi và AI sẽ trả lời

---

## Lỗi Thường Gặp

### ❌ "Google Cloud Speech API not configured"
→ File `.env` chưa được tạo đúng
→ Làm theo **Bước 4** ở trên

### ❌ "Google Cloud credentials invalid"
→ Đường dẫn file JSON sai
→ Kiểm tra lại: `GOOGLE_APPLICATION_CREDENTIALS=...`

### ❌ "No module named 'google'"
→ Dependencies chưa cài
→ Chạy: `python -m pip install -r speech_requirements.txt`

### ❌ "Permission denied" (Microphone)
→ Windows: Settings → Privacy & Security → Microphone
→ Cho phép ứng dụng truy cập mic

### ❌ "Cannot connect to server"
→ Speech server chưa chạy
→ Kiểm tra: `python speech_server.py` có chạy?

### ❌ "No speech detected"
→ Nói to hơn hoặc rõ ràng hơn
→ Kiểm tra micro có chạy tốt?

---

## Chi Phí Google Cloud Speech-to-Text

- **Miễn phí**: 60 phút/tháng
- **Sau đó**: $0.024 per 15 seconds (~$0.10/phút)
- Ví dụ: 10 giây nói = ~$0.016

Đủ dùng cho mục đích học tập!

---

## Kiểm tra Setup

```bash
# Kiểm tra Python
python --version

# Kiểm tra google-cloud-speech installed
python -m pip list | findstr google

# Kiểm tra .env file tồn tại
# (mở File Explorer, chọn "Show hidden files", kiểm tra .env)

# Kiểm tra credentials.json tồn tại
# Trong thư mục d:\testAppTC\test2\toeic-app\
```

---

## Dừng Server

Trong terminal chạy speech server:
- Nhấn `Ctrl + C`

---

## Lưu ý

- Server phải chạy trước Electron App
- Nếu tắt server, mic sẽ không hoạt động
- Lần đầu transcribe 2-3 giây, sau đó 1-2 giây
- Cần internet để dùng Google Cloud
- **Miễn phí 60 phút/tháng** - đủ dùng!
