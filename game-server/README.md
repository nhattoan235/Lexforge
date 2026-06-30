# 🎮 TOEIC Game Server - Hướng Dẫn Cài Đặt

## Yêu Cầu
- Node.js 18+
- npm

## Cài Đặt & Chạy

```bash
# Vào thư mục server
cd game-server

# Cài dependencies
npm install

# Chạy server
npm start
```

Server sẽ chạy tại: `http://localhost:3001`

---

## 🌐 Chơi Qua Internet (ngrok - Miễn Phí)

### Bước 1: Cài ngrok
- Tải tại: https://ngrok.com/download
- Đăng ký tài khoản miễn phí

### Bước 2: Chạy ngrok
```bash
ngrok http 3001
```

### Bước 3: Copy URL
Ngrok sẽ hiện URL dạng:
```
https://abc123.ngrok-free.app
```

### Bước 4: Chia sẻ
- Gửi URL này cho bạn bè
- Bạn bè nhập URL vào ô **Server URL** trong app

---

## 🏠 Chơi Trong Mạng LAN

Chỉ cần dùng IP local:
```
http://192.168.x.x:3001
```

Tìm IP local bằng lệnh:
```bash
# Windows
ipconfig

# Tìm dòng: IPv4 Address . . . : 192.168.x.x
```

---

## 📋 Yêu Cầu Từ Vựng Tối Thiểu

| Game | Từ tối thiểu |
|------|-------------|
| Tower Defense | 50 từ |
| Whack-a-Mouse | 20 từ |
| Co-op Shooter | 20 từ |

---

## ❓ Troubleshooting

**Lỗi "Cannot connect"**
- Kiểm tra server đang chạy
- Kiểm tra firewall: `netsh advfirewall firewall add rule name="TOEIC Server" dir=in action=allow protocol=TCP localport=3001`

**Lỗi ngrok**
- Đảm bảo đã đăng nhập: `ngrok config add-authtoken YOUR_TOKEN`
