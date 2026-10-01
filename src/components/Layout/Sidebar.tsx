// src/components/Layout/Sidebar.tsx
import React, { useState } from 'react';
import { useApp } from '../../App';
import { Page } from '../../types';

const navItems: { id: Page; label: string; icon: string; section?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', section: 'MAIN' },
  { id: 'vocabulary', label: 'Từ Vựng', icon: '📖' },
  { id: 'groups', label: 'Nhóm Từ', icon: '📁' },
  { id: 'flashcard', label: 'Flashcard', icon: '🃏', section: 'ÔN LUYỆN' },
  { id: 'quiz', label: 'Trắc Nghiệm', icon: '📝' },
  { id: 'ai-coach', label: 'AI Coach', icon: '🤖' },
  { id: 'mp4-listening', label: 'Học MP3', icon: '🎧' },
  { id: 'typing-game', label: 'Gõ Chữ Tốc Độ', icon: '⌨️' },
  { id: 'monster-game', label: 'Đánh Quái', icon: '⚔️' },
  { id: 'zombie-game', label: 'Zombie Survival', icon: '🧟' },
  { id: 'memory-flip', label: 'Memory Flip', icon: '🃏' },
  { id: 'progress', label: 'Tiến Độ Học', icon: '📈', section: 'PHÂN TÍCH' },
  { id: 'schedule', label: 'Lịch Ôn Tập AI', icon: '📅' },
  { id: 'multiplayer', label: 'Multiplayer', icon: '🌐', section: 'ONLINE' },
  { id: 'settings', label: 'Cài Đặt', icon: '⚙️', section: 'HỆ THỐNG' },
  { id: 'help', label: 'Hướng Dẫn', icon: '❓' },
];

export default function Sidebar() {
  const { currentPage, setPage } = useApp();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">📚</div>
        <div>
          <div className="logo-title">TOEIC Master</div>
          <div className="logo-sub">Vocabulary Builder</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <React.Fragment key={item.id}>
            {item.section && <div className="nav-section">{item.section}</div>}
            <button
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {currentPage === item.id && <div className="nav-indicator" />}
            </button>
          </React.Fragment>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="version-badge">v1.0.0</div>
      </div>

      <style>{`
        .sidebar {
          width: 240px; height: 100vh; flex-shrink: 0;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .sidebar-logo {
          display: flex; align-items: center; gap: 12px;
          padding: 20px 16px; border-bottom: 1px solid var(--border);
        }
        .logo-icon { font-size: 28px; }
        .logo-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
        .logo-sub { font-size: 11px; color: var(--text-muted); }
        .sidebar-nav { flex: 1; padding: 12px 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
        .nav-section { font-size: 10px; font-weight: 600; letter-spacing: 1.5px; color: var(--text-muted); padding: 12px 8px 4px; }
        .nav-item {
          display: flex; align-items: center; gap: 10px; position: relative;
          width: 100%; padding: 10px 12px; border-radius: var(--radius-sm);
          background: none; border: none; color: var(--text-secondary);
          font-family: inherit; font-size: 14px; font-weight: 500;
          cursor: pointer; transition: all 0.2s; text-align: left;
        }
        .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .nav-item.active { background: rgba(99,102,241,0.15); color: var(--accent-bright); }
        .nav-icon { font-size: 18px; width: 24px; text-align: center; }
        .nav-label { flex: 1; }
        .nav-indicator {
          position: absolute; right: 0; top: 50%; transform: translateY(-50%);
          width: 3px; height: 60%; background: var(--accent); border-radius: 3px 0 0 3px;
        }
        .sidebar-footer { padding: 12px 16px; border-top: 1px solid var(--border); }
        .version-badge { font-size: 11px; color: var(--text-muted); }
      `}</style>
    </aside>
  );
}
