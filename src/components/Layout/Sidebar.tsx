import React from 'react';
import { LayoutDashboard, CalendarDays, BookOpen, FolderOpen, Layers, Bot, Headphones, Keyboard, Swords, Skull, Grid2X2, Users, BarChart3, Settings, HelpCircle, Sparkles } from 'lucide-react';
import { useApp } from '../../App';
import { Page } from '../../types';
import { notify } from '../Feedback/ToastHost';

const sections: { title: string; items: { id: Page; label: string; icon: typeof LayoutDashboard }[] }[] = [
  { title: 'Hôm nay', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'schedule', label: 'Lịch ôn tập AI', icon: CalendarDays }] },
  { title: 'Từ vựng', items: [{ id: 'vocabulary', label: 'Từ vựng', icon: BookOpen }, { id: 'groups', label: 'Nhóm từ', icon: FolderOpen }] },
  { title: 'Luyện tập', items: [{ id: 'flashcard', label: 'Flashcard', icon: Layers }, { id: 'quiz', label: 'Trắc nghiệm', icon: BookOpen }, { id: 'ai-coach', label: 'AI Coach', icon: Bot }, { id: 'mp4-listening', label: 'Học nghe MP3', icon: Headphones }] },
  { title: 'Trò chơi', items: [{ id: 'typing-game', label: 'Gõ chữ tốc độ', icon: Keyboard }, { id: 'monster-game', label: 'Đánh quái', icon: Swords }, { id: 'zombie-game', label: 'Zombie Survival', icon: Skull }, { id: 'memory-flip', label: 'Memory Flip', icon: Grid2X2 }, { id: 'multiplayer', label: 'Multiplayer', icon: Users }] },
  { title: 'Theo dõi', items: [{ id: 'progress', label: 'Tiến độ học', icon: BarChart3 }] },
  { title: 'Ứng dụng', items: [{ id: 'settings', label: 'Cài đặt', icon: Settings }, { id: 'help', label: 'Hướng dẫn', icon: HelpCircle }] },
];

export default function Sidebar() {
  const { currentPage, setPage, isConnected } = useApp();
  const openAssistant = async () => {
    try {
      const open = (window as any).electronAPI?.openAssistant;
      if (!open) {
        notify((window as any).electronAPI ? 'Lexforge vẫn chạy bản cũ. Hãy chọn “Thoát Lexforge” ở khay hệ thống rồi mở lại.' : 'Bong bóng nổi chỉ hoạt động trong ứng dụng Lexforge trên máy tính.', 'error');
        return;
      }
      await open();
    } catch (_) { notify('Không hiện được bong bóng nổi. Hãy thử mở lại ứng dụng.', 'error'); }
  };
  return (
    <aside className="lf-sidebar" aria-label="Điều hướng chính">
      <div className="lf-brand">
        <div className="lf-brand-row"><span className="lf-brand-mark"><img src={`${process.env.PUBLIC_URL}/lexforge-mark.png`} alt="" /></span><strong>Lexforge</strong></div>
        <div className="lf-brand-tagline">✦ Hóa giải rào cản.</div>
      </div>
      <nav className="lf-sidebar-nav">
        {sections.map(section => <div className="lf-nav-group" key={section.title}>
          <div className="lf-nav-title">{section.title}</div>
          {section.items.map(item => <button type="button" key={item.id} className={`lf-nav-item${currentPage === item.id ? ' active' : ''}`} aria-current={currentPage === item.id ? 'page' : undefined} onClick={() => setPage(item.id)}>
            <item.icon size={18} strokeWidth={2} /><span>{item.label}</span>
          </button>)}
        </div>)}
      </nav>
      <button type="button" className="lf-assistant-open" onClick={openAssistant} aria-label="Hiện bong bóng trợ lý tiếng Anh" title="Hiện bong bóng trợ lý tiếng Anh"><span className="lf-assistant-open-icon"><Bot size={20} strokeWidth={2.2}/><Sparkles size={11} strokeWidth={2.5}/></span><span>Hiện bong bóng <small>Trợ lý tiếng Anh</small></span><span className="lf-assistant-open-arrow" aria-hidden="true">↗</span></button>
      <div className="lf-side-status"><span className={`lf-status-dot${isConnected ? '' : ' offline'}`} /><div><b>{isConnected ? 'Đã sẵn sàng' : 'Đang kết nối'}</b><small>{isConnected ? 'Dữ liệu lưu trên máy' : 'Kiểm tra dữ liệu cục bộ'}</small></div></div>
    </aside>
  );
}
