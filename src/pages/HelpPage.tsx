// src/pages/HelpPage.tsx
import React, { useState } from 'react';

const sections = [
  {
    id: 'start', icon: '🚀', title: 'Bắt Đầu Nhanh',
    content: [
      { step: '1', title: 'Kết nối Database', desc: 'Mở app → Nhập server LocalDB → Nhấn "Kết nối & Khởi tạo DB". App sẽ tự tạo tất cả bảng cần thiết.' },
      { step: '2', title: 'Tạo nhóm từ', desc: 'Vào "Nhóm Từ" → Nhấn "+ Tạo Nhóm Mới" → Đặt tên, chọn màu, icon. Ví dụ: "TOEIC Part 5", "Business Email"...' },
      { step: '3', title: 'Thêm từ vựng', desc: 'Vào "Từ Vựng" → Thêm từng từ thủ công hoặc Import file Excel. Điền đủ: Tiếng Anh, Nghĩa, Phiên âm, Ví dụ.' },
      { step: '4', title: 'Bắt đầu ôn luyện', desc: 'Chọn Flashcard, Typing Race hoặc Đánh Quái để bắt đầu ôn. Xem tiến độ trên Dashboard.' },
    ]
  },
  {
    id: 'import', icon: '📥', title: 'Import Excel',
    content: [
      { step: '📋', title: 'Định dạng file Excel', desc: 'File .xlsx cần có các cột (tên cột phân biệt chữ hoa/thường):\n• English — Từ tiếng Anh (bắt buộc)\n• Vietnamese — Nghĩa tiếng Việt (bắt buộc)\n• Pronunciation — Phiên âm IPA (tùy chọn)\n• PartOfSpeech — Từ loại: noun, verb, adjective... (tùy chọn)\n• Example — Câu ví dụ tiếng Anh (tùy chọn)\n• ExampleVi — Câu ví dụ tiếng Việt (tùy chọn)' },
      { step: '⚠️', title: 'Lưu ý khi import', desc: 'Từ được import vào nhóm đầu tiên trong danh sách. Hãy tạo nhóm phù hợp trước khi import. Sau khi import có thể chỉnh sửa từng từ để đổi nhóm.' },
      { step: '📤', title: 'Export từ vựng', desc: 'Nhấn "Export" để tải toàn bộ từ vựng đang hiển thị ra file Excel. Có thể filter theo nhóm trước khi export.' },
    ]
  },
  {
    id: 'flashcard', icon: '🃏', title: 'Flashcard & SRS',
    content: [
      { step: '🔄', title: 'Cách dùng Flashcard', desc: 'Nhấn vào thẻ để lật xem nghĩa. Sau khi xem, chọn "Đã thuộc" hoặc "Chưa thuộc". App ghi nhớ đánh giá để tính lịch ôn tập.' },
      { step: '🧠', title: 'Hệ thống SRS (Spaced Repetition)', desc: 'App dùng thuật toán nhắc ôn đúng lúc sắp quên:\n• Mới (Lv.0): ôn lại sau 1 ngày\n• Cơ bản (Lv.1): ôn lại sau 3 ngày\n• Đang học (Lv.2): ôn lại sau 7 ngày\n• Quen (Lv.3): ôn lại sau 14 ngày\n• Thuộc (Lv.4): ôn lại sau 30 ngày\n• Thành thạo (Lv.5): ôn lại sau 90 ngày\nTrả lời sai: xuống 1 cấp. Trả lời đúng: lên 1 cấp.' },
      { step: '⏰', title: 'Chế độ "Từ cần ôn (SRS)"', desc: 'Chọn chế độ này để chỉ ôn những từ đến hạn — tiết kiệm thời gian, tối ưu hiệu quả nhớ.' },
    ]
  },
  {
    id: 'games', icon: '🎮', title: 'Trò Chơi',
    content: [
      { step: '⌨️', title: 'Typing Race — Cách chơi', desc: 'Thấy nghĩa tiếng Việt (hoặc từ tiếng Anh) → Gõ từ tương ứng → Nhấn Enter.\n• Đúng: +10 điểm\n• Combo 3 đúng liên tiếp: +15 điểm\n• Combo 5+ đúng liên tiếp: +20 điểm\n• Thời gian: 60 giây\nChọn gõ tiếng Anh (thấy nghĩa Việt) hoặc gõ tiếng Việt (thấy từ Anh).' },
      { step: '⚔️', title: 'Đánh Quái — Cách chơi', desc: 'Quái vật rơi từ trên xuống, mỗi con mang 1 từ vựng. Gõ đúng từ tương ứng + Enter để tiêu diệt.\n• Bạn có 3 mạng ❤️❤️❤️\n• Quái chạm đáy: mất 1 mạng\n• Mỗi 10 quái diệt: tăng cấp độ, quái nhanh hơn\n• Combo giết liên tiếp → điểm thưởng\nGame kết thúc khi hết mạng.' },
      { step: '💡', title: 'Mẹo chơi hiệu quả', desc: '• Tập trung ôn từ chưa thuộc trước khi chơi game\n• Chơi game sau khi đã flashcard 1-2 lần\n• Dùng chế độ "gõ tiếng Việt" để luyện nhớ từ tiếng Anh sâu hơn\n• Đặt mục tiêu: 20 từ/ngày là phù hợp cho người mới' },
    ]
  },
  {
    id: 'tips', icon: '💡', title: 'Mẹo Học TOEIC Hiệu Quả',
    content: [
      { step: '📅', title: 'Học đều đặn mỗi ngày', desc: 'Học 20-30 phút mỗi ngày hiệu quả hơn nhiều so với học dồn 3-4 giờ cuối tuần. Não bộ cần thời gian để củng cố ký ức.' },
      { step: '🎯', title: 'Ưu tiên từ theo chủ đề TOEIC', desc: 'Tạo nhóm từ theo các chủ đề hay gặp trong TOEIC: Business, Finance, HR, Marketing, Travel, Technology, Medical. Mỗi chủ đề học 50-100 từ.' },
      { step: '🔊', title: 'Luôn nghe phát âm', desc: 'Nhấn 🔊 để nghe phát âm mỗi khi gặp từ mới. Listening Part của TOEIC yêu cầu bạn nhận ra từ qua âm thanh, không phải chữ viết.' },
      { step: '📝', title: 'Thêm câu ví dụ thực tế', desc: 'Từ vựng nhớ lâu hơn khi học trong ngữ cảnh. Hãy thêm câu ví dụ từ đề TOEIC thật hoặc email công việc thực tế.' },
    ]
  },
];

export default function HelpPage() {
  const [active, setActive] = useState('start');

  const section = sections.find(s => s.id === active);

  return (
    <div className="help-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hướng Dẫn Sử Dụng ❓</h1>
          <p className="page-subtitle">Tất cả những gì bạn cần biết để sử dụng app hiệu quả</p>
        </div>
      </div>

      <div className="help-content">
        {/* Sidebar nav */}
        <div className="help-nav">
          {sections.map(s => (
            <button
              key={s.id}
              className={`help-nav-item ${active === s.id ? 'active' : ''}`}
              onClick={() => setActive(s.id)}
            >
              <span>{s.icon}</span>
              <span>{s.title}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="help-body">
          {section && (
            <>
              <h2 className="help-title">{section.icon} {section.title}</h2>
              <div className="help-steps">
                {section.content.map((item, i) => (
                  <div key={i} className="help-step">
                    <div className="step-badge">{item.step}</div>
                    <div className="step-content">
                      <div className="step-title">{item.title}</div>
                      <div className="step-desc">
                        {item.desc.split('\n').map((line, j) => (
                          <p key={j}>{line}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Keyboard shortcuts */}
          <div className="shortcuts-box">
            <h3>⌨️ Phím Tắt</h3>
            <div className="shortcuts-grid">
              {[
                ['Enter', 'Xác nhận trong game/typing'],
                ['Space', 'Lật flashcard'],
                ['→ / ←', 'Chuyển thẻ flashcard'],
                ['Ctrl+N', 'Thêm từ mới (ở trang Từ Vựng)'],
              ].map(([key, desc]) => (
                <div key={key} className="shortcut-item">
                  <kbd className="kbd">{key}</kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .help-page { padding-bottom: 32px; }
        .help-content { padding: 24px 32px; display: grid; grid-template-columns: 220px 1fr; gap: 20px; align-items: start; }
        .help-nav { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px; display: flex; flex-direction: column; gap: 2px; position: sticky; top: 20px; }
        .help-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); background: none; border: none; color: var(--text-secondary); font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; text-align: left; }
        .help-nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .help-nav-item.active { background: rgba(99,102,241,0.15); color: var(--accent-bright); }
        .help-body { display: flex; flex-direction: column; gap: 20px; }
        .help-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
        .help-steps { display: flex; flex-direction: column; gap: 12px; }
        .help-step { display: flex; gap: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; transition: border-color 0.2s; }
        .help-step:hover { border-color: var(--border-bright); }
        .step-badge { width: 40px; height: 40px; border-radius: 10px; background: rgba(99,102,241,0.15); color: var(--accent-bright); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; flex-shrink: 0; }
        .step-content { flex: 1; }
        .step-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
        .step-desc p { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 2px; }
        .shortcuts-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
        .shortcuts-box h3 { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
        .shortcuts-grid { display: flex; flex-direction: column; gap: 10px; }
        .shortcut-item { display: flex; align-items: center; gap: 16px; font-size: 13px; color: var(--text-secondary); }
        .kbd { background: var(--bg-secondary); border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 6px; padding: 3px 10px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-primary); white-space: nowrap; min-width: 60px; text-align: center; }
      `}</style>
    </div>
  );
}
