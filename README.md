# 📚 TOEIC Vocab Master

Ứng dụng ôn luyện từ vựng TOEIC với Flashcard SRS, Typing Race và Monster Game. Chạy trên Windows dưới dạng file `.exe`.

---

## 🚀 Cài Đặt & Chạy

### Yêu Cầu Hệ Thống
- **Windows 10/11** (64-bit)
- **Node.js 18+** — tải tại https://nodejs.org
- **SQL Server LocalDB** — có sẵn khi cài Visual Studio hoặc SQL Server Express
  - Nếu chưa có, tải tại: https://go.microsoft.com/fwlink/?linkid=866658
- **Git** (tùy chọn)

---

### Bước 1 — Cài dependencies

Mở Command Prompt hoặc PowerShell trong thư mục này:

```bash
npm install
```

### Bước 2 — Chạy ở chế độ Development (xem thử)

```bash
npm run electron-dev
```

App sẽ tự mở. Lần đầu kết nối:
- **Server**: `(localdb)\MSSQLLocalDB`
- **Database**: `TOEICVocab` (app tự tạo)
- **Auth**: Windows Authentication (mặc định, không cần password)

### Bước 3 — Build thành file `.exe`

```bash
npm run dist:win
```

File `.exe` sẽ xuất hiện trong thư mục `dist/`. 
Cài đặt bằng cách chạy file `TOEIC Vocab Master Setup X.X.X.exe`.

---

## 📁 Cấu Trúc Project

```
toeic-app/
├── electron/
│   ├── main.js          # Electron main process + SQL Server connection
│   └── preload.js       # Bridge renderer ↔ main
├── src/
│   ├── pages/
│   │   ├── ConnectPage.tsx      # Kết nối SQL Server
│   │   ├── Dashboard.tsx        # Thống kê tổng quan
│   │   ├── FlashcardPage.tsx    # Học flashcard + SRS
│   │   ├── TypingGamePage.tsx   # Game gõ chữ tốc độ
│   │   ├── MonsterGamePage.tsx  # Game đánh quái
│   │   ├── GroupsPage.tsx       # Quản lý nhóm từ
│   │   ├── VocabularyPage.tsx   # Quản lý từ vựng
│   │   ├── SettingsPage.tsx     # Cài đặt
│   │   └── HelpPage.tsx         # Hướng dẫn
│   ├── services/
│   │   ├── database.ts          # SQL Server queries + SRS logic
│   │   └── speech.ts            # Text-to-speech
│   ├── types/index.ts           # TypeScript types
│   ├── App.tsx                  # Root component + routing
│   └── App.css                  # Global styles (dark theme)
└── public/
    └── index.html
```

---

## 🗄️ Database Schema (tự động tạo)

| Bảng | Mô tả |
|------|-------|
| `WordGroups` | Nhóm từ vựng do người dùng tạo |
| `Words` | Từ vựng với SRS level và lịch ôn |
| `StudySessions` | Lịch sử các phiên học Flashcard |
| `GameScores` | Điểm cao của Typing Race và Monster Game |
| `UserSettings` | Cài đặt người dùng |
| `DailyGoals` | Mục tiêu học tập hàng ngày |

---

## 📥 Import từ vựng từ Excel

File `.xlsx` cần có các cột:

| Cột | Bắt buộc | Mô tả |
|-----|----------|-------|
| `English` | ✅ | Từ tiếng Anh |
| `Vietnamese` | ✅ | Nghĩa tiếng Việt |
| `Pronunciation` | ❌ | Phiên âm IPA |
| `PartOfSpeech` | ❌ | Từ loại (noun, verb...) |
| `Example` | ❌ | Câu ví dụ tiếng Anh |
| `ExampleVi` | ❌ | Câu ví dụ tiếng Việt |

---

## 🎮 Tính Năng

| Tính năng | Mô tả |
|-----------|-------|
| 🃏 **Flashcard SRS** | Thẻ lật với thuật toán nhắc ôn thông minh (6 cấp độ) |
| ⌨️ **Typing Race** | Gõ từ vựng trong 60 giây, hệ thống combo điểm |
| ⚔️ **Monster Game** | Tiêu diệt quái bằng cách gõ đúng từ trước khi chạm đáy |
| 📁 **Nhóm Từ** | Tổ chức từ theo chủ đề, chọn nhóm khi ôn luyện |
| 📊 **Dashboard** | Biểu đồ hoạt động 7 ngày, điểm cao, thống kê |
| 📥 **Import/Export** | Import Excel, Export kết quả |
| 🔊 **Text-to-Speech** | Phát âm tự động qua Web Speech API |

---

## 🔧 Lỗi Thường Gặp

**"Cannot connect to LocalDB"**
- Chạy lệnh: `sqllocaldb start MSSQLLocalDB`
- Nếu vẫn lỗi: `sqllocaldb delete MSSQLLocalDB` rồi `sqllocaldb create MSSQLLocalDB`

**App không mở sau build**
- Kiểm tra `dist/` có file `.exe` chưa
- Chạy installer (không chạy file `.exe` trong thư mục giải nén trực tiếp)

**Import Excel không hoạt động**
- Đảm bảo tên cột đúng chính xác (phân biệt hoa thường)
- Đã tạo ít nhất 1 nhóm từ trước khi import
