// src/pages/games/TowerDefensePage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import multiplayerService from '../../services/multiplayer';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOWER_TYPES: Record<string, any> = {
  archer:    { name: 'Xạ Thủ',  icon: '🏹', cost: 30,  color: '#22c55e',  dmg: 20, range: 30, speed: 1.2 },
  cannon:    { name: 'Đại Bác', icon: '💣', cost: 60,  color: '#f97316',  dmg: 55, range: 25, speed: 0.7 },
  ice:       { name: 'Băng',    icon: '❄️', cost: 50,  color: '#60a5fa',  dmg: 15, range: 28, speed: 1.0 },
  lightning: { name: 'Sét',     icon: '⚡', cost: 80,  color: '#a855f7',  dmg: 40, range: 35, speed: 1.5 },
  poison:    { name: 'Độc',     icon: '☠️', cost: 45,  color: '#84cc16',  dmg: 10, range: 22, speed: 0.9 },
  sniper:    { name: 'Bắn Tỉa', icon: '🎯', cost: 90,  color: '#f59e0b',  dmg: 80, range: 50, speed: 0.5 },
};

const WEAPONS: Record<string, any> = {
  basic:   { name: 'Đạn Cơ Bản', icon: '🔵', price: 0,   dmgBonus: 1.0 },
  silver:  { name: 'Đạn Bạc',    icon: '⚪', price: 100, dmgBonus: 1.3 },
  fire:    { name: 'Đạn Lửa',    icon: '🔴', price: 250, dmgBonus: 1.6 },
  ice:     { name: 'Đạn Băng',   icon: '🔷', price: 200, dmgBonus: 1.2 },
  thunder: { name: 'Đạn Sét',    icon: '🟡', price: 400, dmgBonus: 2.0 },
  dark:    { name: 'Đạn Tối',    icon: '🟣', price: 600, dmgBonus: 2.5 },
};

// 3 đường quái đi — top / mid / bottom (% theo chiều cao field)
const PATHS = [
  { id: 'top', yPct: 18, label: 'Đường Bắc', color: 'rgba(99,102,241,0.25)' },
  { id: 'mid', yPct: 50, label: 'Đường Giữa', color: 'rgba(239,68,68,0.25)' },
  { id: 'bot', yPct: 82, label: 'Đường Nam', color: 'rgba(16,185,129,0.25)' },
];

// Loại quái với model SVG riêng + kháng tính
const ENEMY_TYPES: Record<string, any> = {
  goblin:  { label: 'Quỷ Lùn',   hp: 80,   speed: 1.6, reward: 8,  armor: 0,   resist: {},                  size: 28, color: '#22c55e' },
  orc:     { label: 'Thú Xanh',  hp: 220,  speed: 1.1, reward: 15, armor: 10,  resist: { poison: 0.5 },     size: 36, color: '#84cc16' },
  knight:  { label: 'Hiệp Sĩ',   hp: 400,  speed: 0.9, reward: 25, armor: 25,  resist: { arrow: 0.6 },      size: 38, color: '#94a3b8' },
  demon:   { label: 'Ác Quỷ',    hp: 320,  speed: 1.3, reward: 22, armor: 8,   resist: { fire: 0.7, ice: 0.6 }, size: 34, color: '#ef4444' },
  golem:   { label: 'Người Đá',  hp: 700,  speed: 0.6, reward: 40, armor: 40,  resist: { lightning: 0.5, ice: 0.4 }, size: 44, color: '#78716c' },
  dragon:  { label: 'Rồng Boss', hp: 1800, speed: 0.8, reward: 120, armor: 30, resist: { fire: 0.9, ice: 0.5, poison: 0.7 }, size: 54, color: '#f59e0b', isBoss: true },
};

// ─── SVG Enemy Models ─────────────────────────────────────────────────────────

function EnemyModel({ type, scale = 1, flash = false }: { type: string; scale?: number; flash?: boolean }) {
  const cfg = ENEMY_TYPES[type] || ENEMY_TYPES.orc;
  const s = cfg.size * scale;
  const c = cfg.color;
  const f = flash ? 'brightness(3)' : 'none';

  if (type === 'goblin') return (
    <svg width={s} height={s} viewBox="0 0 40 40" style={{ filter: f, overflow: 'visible' }}>
      <ellipse cx="20" cy="28" rx="10" ry="8" fill="#1a6b2a" />
      <circle cx="20" cy="16" r="9" fill="#2d9e3f" />
      <ellipse cx="14" cy="14" rx="3" ry="4" fill="#1a6b2a" />
      <ellipse cx="26" cy="14" rx="3" ry="4" fill="#1a6b2a" />
      <circle cx="17" cy="17" r="2" fill="#ff0" />
      <circle cx="23" cy="17" r="2" fill="#ff0" />
      <path d="M17 22 Q20 25 23 22" stroke="#ff6b6b" strokeWidth="1.5" fill="none" />
      <rect x="10" y="26" width="5" height="10" rx="2" fill="#1a5c2a" />
      <rect x="25" y="26" width="5" height="10" rx="2" fill="#1a5c2a" />
    </svg>
  );

  if (type === 'orc') return (
    <svg width={s} height={s} viewBox="0 0 48 48" style={{ filter: f, overflow: 'visible' }}>
      <rect x="12" y="26" width="24" height="18" rx="4" fill="#3a7a1a" />
      <circle cx="24" cy="18" r="12" fill="#5aaa2a" />
      <rect x="8" y="14" width="6" height="4" rx="2" fill="#3a7a1a" />
      <rect x="34" y="14" width="6" height="4" rx="2" fill="#3a7a1a" />
      <rect x="10" y="24" width="8" height="20" rx="3" fill="#3a7a1a" />
      <rect x="30" y="24" width="8" height="20" rx="3" fill="#3a7a1a" />
      {/* Giáp */}
      <rect x="14" y="26" width="20" height="14" rx="2" fill="#2d5a15" opacity="0.7" />
      <circle cx="19" cy="17" r="2.5" fill="#ffff00" />
      <circle cx="29" cy="17" r="2.5" fill="#ffff00" />
      <path d="M19 24 Q24 28 29 24" stroke="#ff4444" strokeWidth="2" fill="none" />
      <path d="M20 26 L18 30" stroke="#fff" strokeWidth="1" opacity="0.4" />
      <path d="M24 26 L24 30" stroke="#fff" strokeWidth="1" opacity="0.4" />
      <path d="M28 26 L30 30" stroke="#fff" strokeWidth="1" opacity="0.4" />
    </svg>
  );

  if (type === 'knight') return (
    <svg width={s} height={s} viewBox="0 0 48 48" style={{ filter: f, overflow: 'visible' }}>
      {/* Giáp toàn thân */}
      <rect x="14" y="24" width="20" height="20" rx="3" fill="#6b7280" />
      <rect x="10" y="24" width="8" height="18" rx="3" fill="#6b7280" />
      <rect x="30" y="24" width="8" height="18" rx="3" fill="#6b7280" />
      {/* Đầu */}
      <circle cx="24" cy="16" r="11" fill="#9ca3af" />
      <rect x="18" y="11" width="12" height="5" rx="1" fill="#6b7280" />
      <rect x="19" y="14" width="4" height="8" rx="1" fill="#4b5563" />
      {/* Khiên */}
      <ellipse cx="8" cy="34" rx="5" ry="7" fill="#3b82f6" />
      <line x1="8" y1="27" x2="8" y2="41" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
      {/* Kiếm */}
      <rect x="40" y="20" width="3" height="22" rx="1" fill="#e5e7eb" />
      <rect x="36" y="28" width="11" height="3" rx="1" fill="#f59e0b" />
      {/* Ánh thép */}
      <rect x="15" y="26" width="18" height="1" fill="#fff" opacity="0.3" />
    </svg>
  );

  if (type === 'demon') return (
    <svg width={s} height={s} viewBox="0 0 48 48" style={{ filter: f, overflow: 'visible' }}>
      <rect x="14" y="26" width="20" height="18" rx="3" fill="#7f1d1d" />
      <circle cx="24" cy="17" r="12" fill="#ef4444" />
      {/* Sừng */}
      <polygon points="14,8 10,0 18,6" fill="#dc2626" />
      <polygon points="34,8 38,0 30,6" fill="#dc2626" />
      {/* Mắt */}
      <circle cx="19" cy="16" r="3" fill="#ff0" />
      <circle cx="29" cy="16" r="3" fill="#ff0" />
      <circle cx="19" cy="16" r="1.5" fill="#000" />
      <circle cx="29" cy="16" r="1.5" fill="#000" />
      {/* Miệng */}
      <path d="M18 22 L20 25 L24 23 L28 25 L30 22" stroke="#ff6b6b" strokeWidth="1.5" fill="none" />
      {/* Cánh */}
      <path d="M14,28 Q4,20 6,34 Q12,30 14,34" fill="#b91c1c" opacity="0.8" />
      <path d="M34,28 Q44,20 42,34 Q36,30 34,34" fill="#b91c1c" opacity="0.8" />
      <rect x="12" y="26" width="8" height="18" rx="3" fill="#7f1d1d" />
      <rect x="28" y="26" width="8" height="18" rx="3" fill="#7f1d1d" />
      {/* Lửa */}
      <circle cx="24" cy="44" r="3" fill="#f97316" opacity="0.6" />
    </svg>
  );

  if (type === 'golem') return (
    <svg width={s} height={s} viewBox="0 0 56 56" style={{ filter: f, overflow: 'visible' }}>
      {/* Thân đá khổng lồ */}
      <rect x="12" y="26" width="32" height="26" rx="6" fill="#57534e" />
      <circle cx="28" cy="18" r="14" fill="#78716c" />
      {/* Khớp đá */}
      <circle cx="28" cy="18" r="8" fill="#6b7280" />
      <circle cx="10" cy="34" r="9" fill="#57534e" />
      <circle cx="46" cy="34" r="9" fill="#57534e" />
      {/* Mắt phát sáng */}
      <circle cx="23" cy="17" r="3.5" fill="#ff6b00" />
      <circle cx="33" cy="17" r="3.5" fill="#ff6b00" />
      <circle cx="23" cy="17" r="1.5" fill="#fff" opacity="0.9" />
      <circle cx="33" cy="17" r="1.5" fill="#fff" opacity="0.9" />
      {/* Vết nứt */}
      <path d="M24 24 L22 30 L26 34" stroke="#292524" strokeWidth="1.5" fill="none" opacity="0.7" />
      <path d="M32 24 L34 32" stroke="#292524" strokeWidth="1" fill="none" opacity="0.5" />
      {/* Tay đá */}
      <rect x="6" y="28" width="12" height="8" rx="4" fill="#44403c" />
      <rect x="38" y="28" width="12" height="8" rx="4" fill="#44403c" />
      {/* Rêu */}
      <rect x="14" y="34" width="28" height="4" rx="2" fill="#166534" opacity="0.4" />
    </svg>
  );

  if (type === 'dragon') return (
    <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: f, overflow: 'visible' }}>
      {/* Cánh */}
      <path d="M16,28 Q0,10 4,36 Q12,28 16,36" fill="#b45309" opacity="0.9" />
      <path d="M48,28 Q64,10 60,36 Q52,28 48,36" fill="#b45309" opacity="0.9" />
      {/* Đuôi */}
      <path d="M44,52 Q58,56 56,64 Q50,58 48,62 Q46,56 44,52" fill="#d97706" />
      {/* Thân */}
      <ellipse cx="32" cy="40" rx="16" ry="12" fill="#d97706" />
      {/* Vảy lưng */}
      <polygon points="20,32 24,24 28,32" fill="#b45309" />
      <polygon points="28,30 32,20 36,30" fill="#b45309" />
      <polygon points="36,32 40,24 44,32" fill="#b45309" />
      {/* Đầu */}
      <ellipse cx="32" cy="22" rx="14" ry="10" fill="#f59e0b" />
      {/* Sừng */}
      <polygon points="22,14 18,4 26,12" fill="#92400e" />
      <polygon points="42,14 46,4 38,12" fill="#92400e" />
      {/* Mắt */}
      <circle cx="26" cy="20" r="4" fill="#ff0" />
      <circle cx="38" cy="20" r="4" fill="#ff0" />
      <ellipse cx="26" cy="20" rx="1.5" ry="3" fill="#000" />
      <ellipse cx="38" cy="20" rx="1.5" ry="3" fill="#000" />
      {/* Lửa miệng */}
      <path d="M22 28 Q16 32 12 36 Q18 32 20 38 Q22 32 24 36 Q26 32 22 28" fill="#f97316" opacity="0.85" />
      {/* Chân */}
      <rect x="18" y="48" width="10" height="12" rx="3" fill="#d97706" />
      <rect x="36" y="48" width="10" height="12" rx="3" fill="#d97706" />
      {/* Móng */}
      <polygon points="18,60 16,64 20,64" fill="#78350f" />
      <polygon points="22,60 20,64 24,64" fill="#78350f" />
      <polygon points="36,60 34,64 38,64" fill="#78350f" />
      <polygon points="40,60 38,64 42,64" fill="#78350f" />
      {/* Aura boss */}
      <circle cx="32" cy="32" r="30" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.2" />
    </svg>
  );

  // fallback
  return <div style={{ fontSize: cfg.size * scale * 0.5 }}>👾</div>;
}

// ─── SVG Tower Models ─────────────────────────────────────────────────────────

function TowerModel({ type, level = 1 }: { type: string; level?: number }) {
  const cfg = TOWER_TYPES[type];
  const c = cfg?.color || '#6366f1';

  if (type === 'archer') return (
    <svg width="44" height="56" viewBox="0 0 44 56" style={{ overflow: 'visible', filter: `drop-shadow(0 0 6px ${c})` }}>
      <rect x="14" y="36" width="16" height="18" rx="2" fill="#374151" />
      <rect x="10" y="28" width="24" height="12" rx="2" fill="#4b5563" />
      <rect x="8" y="18" width="28" height="14" rx="3" fill="#374151" />
      <rect x="16" y="8" width="12" height="14" rx="2" fill="#1f2937" />
      {/* Merlons (đỉnh tháp) */}
      <rect x="10" y="4" width="6" height="8" rx="1" fill={c} />
      <rect x="19" y="4" width="6" height="8" rx="1" fill={c} />
      <rect x="28" y="4" width="6" height="8" rx="1" fill={c} />
      {/* Cửa sổ bắn */}
      <rect x="18" y="20" width="8" height="5" rx="1" fill={c} opacity="0.6" />
      <line x1="22" y1="20" x2="22" y2="25" stroke="#fff" strokeWidth="0.8" opacity="0.5" />
      {/* Cờ */}
      <line x1="22" y1="0" x2="22" y2="8" stroke={c} strokeWidth="1.5" />
      <polygon points="22,0 30,3 22,6" fill={c} />
    </svg>
  );

  if (type === 'cannon') return (
    <svg width="44" height="56" viewBox="0 0 44 56" style={{ overflow: 'visible', filter: `drop-shadow(0 0 8px ${c})` }}>
      <rect x="12" y="34" width="20" height="20" rx="3" fill="#3f2918" />
      <rect x="8" y="24" width="28" height="14" rx="3" fill="#4a3020" />
      <rect x="10" y="14" width="24" height="14" rx="3" fill="#3f2918" />
      <circle cx="22" cy="20" r="6" fill="#1c0f0a" />
      <circle cx="22" cy="20" r="4" fill="#2d1810" />
      {/* Họng đại bác */}
      <rect x="28" y="16" width="14" height="8" rx="4" fill="#1c0f0a" />
      <circle cx="28" cy="20" r="4" fill="#111" />
      {/* Đinh tán */}
      <circle cx="14" cy="26" r="2" fill={c} opacity="0.8" />
      <circle cx="30" cy="26" r="2" fill={c} opacity="0.8" />
      <circle cx="22" cy="26" r="2" fill={c} opacity="0.8" />
      {/* Khói */}
      <circle cx="40" cy="14" r="3" fill="#6b7280" opacity="0.5" />
      <circle cx="44" cy="10" r="2" fill="#6b7280" opacity="0.3" />
    </svg>
  );

  if (type === 'ice') return (
    <svg width="44" height="56" viewBox="0 0 44 56" style={{ overflow: 'visible', filter: `drop-shadow(0 0 10px ${c})` }}>
      <rect x="14" y="36" width="16" height="18" rx="2" fill="#1e3a5f" />
      <rect x="10" y="26" width="24" height="14" rx="3" fill="#1d4ed8" opacity="0.8" />
      <rect x="12" y="14" width="20" height="16" rx="3" fill="#1e40af" />
      {/* Crystal đỉnh */}
      <polygon points="22,2 16,14 28,14" fill={c} />
      <polygon points="22,2 20,14 24,14" fill="#bfdbfe" />
      {/* Cửa sổ băng */}
      <polygon points="22,20 18,26 26,26" fill={c} opacity="0.7" />
      {/* Hiệu ứng lạnh */}
      <circle cx="22" cy="38" r="5" fill={c} opacity="0.15" />
      <circle cx="22" cy="38" r="3" fill={c} opacity="0.25" />
    </svg>
  );

  if (type === 'lightning') return (
    <svg width="44" height="56" viewBox="0 0 44 56" style={{ overflow: 'visible', filter: `drop-shadow(0 0 12px ${c})` }}>
      <rect x="14" y="36" width="16" height="18" rx="2" fill="#2e1065" />
      <rect x="10" y="26" width="24" height="14" rx="3" fill="#4c1d95" />
      <rect x="12" y="14" width="20" height="16" rx="3" fill="#5b21b6" />
      {/* Tia sét đỉnh */}
      <polygon points="22,2 18,12 21,12 17,22 27,10 23,10 28,2" fill={c} />
      {/* Cuộn dây */}
      <ellipse cx="22" cy="30" rx="7" ry="4" fill="none" stroke={c} strokeWidth="2" opacity="0.7" />
      <ellipse cx="22" cy="32" rx="5" ry="3" fill="none" stroke={c} strokeWidth="1.5" opacity="0.5" />
      {/* Tia điện nhỏ */}
      <path d="M15 20 L17 23 L14 26" stroke={c} strokeWidth="1" fill="none" opacity="0.6" />
      <path d="M29 20 L27 23 L30 26" stroke={c} strokeWidth="1" fill="none" opacity="0.6" />
    </svg>
  );

  if (type === 'poison') return (
    <svg width="44" height="56" viewBox="0 0 44 56" style={{ overflow: 'visible', filter: `drop-shadow(0 0 8px ${c})` }}>
      <rect x="14" y="36" width="16" height="18" rx="2" fill="#1a2e05" />
      <rect x="10" y="26" width="24" height="14" rx="3" fill="#365314" />
      <rect x="12" y="14" width="20" height="16" rx="3" fill="#1a4d00" />
      {/* Bình độc đỉnh */}
      <ellipse cx="22" cy="10" rx="8" ry="6" fill={c} opacity="0.8" />
      <rect x="20" y="4" width="4" height="6" rx="2" fill={c} />
      <circle cx="22" cy="4" r="3" fill="#4d7c0f" />
      {/* Bọt độc */}
      <circle cx="16" cy="22" r="2.5" fill={c} opacity="0.6" />
      <circle cx="28" cy="22" r="2" fill={c} opacity="0.5" />
      <circle cx="22" cy="20" r="3" fill={c} opacity="0.4" />
      {/* Rỉ chảy */}
      <path d="M14 26 Q12 30 14 34" stroke={c} strokeWidth="1.5" fill="none" opacity="0.5" />
      <path d="M30 26 Q32 30 30 34" stroke={c} strokeWidth="1.5" fill="none" opacity="0.5" />
    </svg>
  );

  if (type === 'sniper') return (
    <svg width="44" height="56" viewBox="0 0 44 56" style={{ overflow: 'visible', filter: `drop-shadow(0 0 10px ${c})` }}>
      <rect x="15" y="38" width="14" height="16" rx="2" fill="#1c1917" />
      <rect x="11" y="28" width="22" height="14" rx="2" fill="#292524" />
      <rect x="13" y="18" width="18" height="14" rx="2" fill="#1c1917" />
      <rect x="17" y="8" width="10" height="14" rx="1" fill="#111" />
      {/* Ống ngắm */}
      <rect x="34" y="14" width="14" height="5" rx="2.5" fill={c} />
      <circle cx="41" cy="16.5" r="3" fill={c} opacity="0.5" />
      <circle cx="41" cy="16.5" r="1.5" fill="#fff" opacity="0.8" />
      {/* Thước đo */}
      <line x1="22" y1="8" x2="22" y2="4" stroke={c} strokeWidth="1.5" />
      <line x1="18" y1="6" x2="26" y2="6" stroke={c} strokeWidth="1" />
      {/* Thanh laser */}
      <line x1="36" y1="16.5" x2="48" y2="16.5" stroke={c} strokeWidth="0.8" opacity="0.4" strokeDasharray="2,2" />
    </svg>
  );

  return <div style={{ fontSize: 24 }}>{cfg?.icon}</div>;
}

// ─── Parallax Background ──────────────────────────────────────────────────────

function ParallaxBG({ wave }: { wave: number }) {
  return (
    <div className="td-parallax">
      {/* Sky gradient */}
      <div className="td-sky" />
      {/* Stars */}
      <div className="td-stars" />
      {/* Far mountains */}
      <div className="td-mountains-far" />
      {/* Near mountains */}
      <div className="td-mountains-near" />
      {/* Trees layer */}
      <div className="td-trees" />
      {/* Ground */}
      <div className="td-ground" />
      {/* Castle base */}
      <div className="td-castle-base">
        <svg width="80" height="100" viewBox="0 0 80 100" style={{ filter: 'drop-shadow(0 0 20px rgba(99,102,241,0.6))' }}>
          <rect x="15" y="30" width="50" height="70" fill="#1e1b4b" />
          <rect x="5" y="20" width="20" height="50" rx="2" fill="#312e81" />
          <rect x="55" y="20" width="20" height="50" rx="2" fill="#312e81" />
          <rect x="25" y="10" width="30" height="40" rx="2" fill="#3730a3" />
          <rect x="0" y="16" width="8" height="12" fill="#312e81" />
          <rect x="18" y="16" width="8" height="12" fill="#312e81" />
          <rect x="54" y="16" width="8" height="12" fill="#312e81" />
          <rect x="72" y="16" width="8" height="12" fill="#312e81" />
          <rect x="28" y="6" width="8" height="12" fill="#3730a3" />
          <rect x="44" y="6" width="8" height="12" fill="#3730a3" />
          <rect x="30" y="28" width="20" height="30" rx="10" fill="#1e1b4b" />
          <rect x="35" y="28" width="10" height="40" fill="#111827" />
          <polygon points="40,0 34,10 46,10" fill="#f59e0b" />
          <line x1="40" y1="0" x2="40" y2="10" stroke="#f59e0b" strokeWidth="1.5" />
          <circle cx="20" cy="40" r="4" fill="#6366f1" opacity="0.8" />
          <circle cx="60" cy="40" r="4" fill="#6366f1" opacity="0.8" />
        </svg>
      </div>
      <style>{`
        .td-parallax { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .td-sky {
          position: absolute; inset: 0;
          background: linear-gradient(180deg,
            #0a0020 0%, #0d0535 25%, #1a0a4f 50%, #2d1b69 70%, #1a3a1a 85%, #0d2610 100%
          );
        }
        .td-stars {
          position: absolute; inset: 0;
          background-image:
            radial-gradient(1px 1px at 10% 10%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 20% 5%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 35% 15%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 55% 8%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 70% 12%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 85% 6%, rgba(255,255,255,0.8), transparent),
            radial-gradient(2px 2px at 45% 3%, rgba(255,255,220,0.9), transparent),
            radial-gradient(1px 1px at 90% 18%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 15% 22%, rgba(255,255,255,0.4), transparent),
            radial-gradient(1px 1px at 60% 20%, rgba(255,255,255,0.7), transparent);
          animation: twinkle 4s ease-in-out infinite alternate;
        }
        @keyframes twinkle { 0%{opacity:0.7} 100%{opacity:1} }
        .td-mountains-far {
          position: absolute; bottom: 30%; left: 0; right: 0; height: 35%;
          background: linear-gradient(180deg, transparent 0%, #0d0535 40%, #1a0a4f 100%);
          clip-path: polygon(0 100%, 0 60%, 5% 50%, 10% 60%, 18% 35%, 25% 55%, 30% 40%, 38% 60%, 45% 30%, 52% 55%, 58% 40%, 65% 60%, 72% 38%, 78% 58%, 85% 42%, 92% 55%, 100% 45%, 100% 100%);
          animation: mountainDrift 80s linear infinite;
        }
        @keyframes mountainDrift { 0%{background-position:0 0} 100%{background-position:-200px 0} }
        .td-mountains-near {
          position: absolute; bottom: 20%; left: 0; right: 0; height: 28%;
          background: #0e1a08;
          clip-path: polygon(0 100%, 0 70%, 8% 55%, 15% 70%, 22% 45%, 30% 68%, 38% 50%, 45% 72%, 52% 48%, 60% 68%, 68% 52%, 75% 70%, 82% 48%, 90% 65%, 100% 55%, 100% 100%);
        }
        .td-trees {
          position: absolute; bottom: 15%; left: 0; right: 0; height: 20%;
          background: #0a160a;
          clip-path: polygon(0 100%, 0 80%, 3% 70%, 5% 80%, 7% 65%, 9% 78%, 11% 68%, 13% 80%, 15% 65%, 17% 78%, 19% 70%, 21% 80%, 23% 60%, 25% 78%, 27% 65%, 29% 80%, 31% 70%, 33% 80%, 35% 65%, 37% 78%, 39% 68%, 41% 80%, 43% 65%, 45% 78%, 47% 70%, 49% 80%, 51% 68%, 53% 80%, 55% 65%, 57% 78%, 59% 70%, 61% 80%, 63% 65%, 65% 78%, 67% 68%, 69% 80%, 71% 70%, 73% 80%, 75% 65%, 77% 78%, 79% 70%, 81% 80%, 83% 65%, 85% 78%, 87% 70%, 89% 80%, 91% 65%, 93% 78%, 95% 70%, 97% 80%, 100% 75%, 100% 100%);
          animation: treeSway 6s ease-in-out infinite alternate;
        }
        @keyframes treeSway { 0%{transform:skewX(0)} 100%{transform:skewX(-0.5deg)} }
        .td-ground {
          position: absolute; bottom: 0; left: 0; right: 0; height: 15%;
          background: linear-gradient(180deg, #1a2e0d 0%, #0d1a07 100%);
        }
        .td-castle-base {
          position: absolute; left: -8px; top: 50%; transform: translateY(-50%);
          z-index: 2;
        }
      `}</style>
    </div>
  );
}

// ─── Road / Path renderer ─────────────────────────────────────────────────────

function PathRenderer() {
  return (
    <>
      {PATHS.map(p => (
        <div key={p.id} className={`td-road road-${p.id}`} style={{ top: `${p.yPct}%`, background: p.color }}>
          <div className="road-line" />
          <div className="road-label">{p.label}</div>
        </div>
      ))}
      <style>{`
        .td-road {
          position: absolute; left: 0; right: 0; height: 10%;
          transform: translateY(-50%);
          border-top: 1px dashed rgba(255,255,255,0.08);
          border-bottom: 1px dashed rgba(255,255,255,0.08);
          backdrop-filter: blur(0.5px);
        }
        .road-line {
          position: absolute; top: 50%; left: 0; right: 0; height: 2px;
          background: repeating-linear-gradient(90deg,
            rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 20px,
            transparent 20px, transparent 40px
          );
          animation: roadScroll 2s linear infinite;
        }
        @keyframes roadScroll { 0%{background-position:0 0} 100%{background-position:-40px 0} }
        .road-label {
          position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
          font-size: 9px; color: rgba(255,255,255,0.3); font-weight: 600;
          letter-spacing: 1px; text-transform: uppercase; pointer-events: none;
        }
      `}</style>
    </>
  );
}

// ─── Tower Destruction Effect ─────────────────────────────────────────────────

function TowerDestroyEffect({ x, y }: { x: number; y: number }) {
  return (
    <div className="tower-destroy" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className="destroy-ring" />
      <div className="destroy-particles">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="d-particle" style={{ '--angle': `${i * 45}deg` } as any} />
        ))}
      </div>
      <div className="destroy-text">💥 THÁP BỊ PHÁ!</div>
      <style>{`
        .tower-destroy { position: absolute; transform: translate(-50%, -50%); pointer-events: none; z-index: 50; }
        .destroy-ring {
          width: 80px; height: 80px; border-radius: 50%;
          border: 3px solid #ef4444;
          animation: ringExpand 0.6s ease-out forwards;
        }
        @keyframes ringExpand { 0%{transform:scale(0);opacity:1} 100%{transform:scale(3);opacity:0} }
        .destroy-particles { position: absolute; top: 50%; left: 50%; }
        .d-particle {
          position: absolute; width: 8px; height: 8px; border-radius: 50%;
          background: #ef4444; transform-origin: 0 0;
          animation: particleFly 0.8s ease-out forwards;
          transform: rotate(var(--angle)) translateX(40px);
        }
        @keyframes particleFly { 0%{opacity:1;transform:rotate(var(--angle)) translateX(0)} 100%{opacity:0;transform:rotate(var(--angle)) translateX(60px)} }
        .destroy-text {
          position: absolute; top: -30px; left: 50%; transform: translateX(-50%);
          font-size: 11px; font-weight: 700; color: #ef4444; white-space: nowrap;
          animation: floatUp 1s ease forwards;
        }
      `}</style>
    </div>
  );
}

// ─── Resist Badge ─────────────────────────────────────────────────────────────

function ResistBadges({ type }: { type: string }) {
  const cfg = ENEMY_TYPES[type];
  if (!cfg || !Object.keys(cfg.resist || {}).length) return null;
  const icons: Record<string, string> = { ice: '❄️', fire: '🔥', lightning: '⚡', poison: '☠️', arrow: '🏹' };
  return (
    <div style={{ display: 'flex', gap: 1, marginTop: 1 }}>
      {Object.keys(cfg.resist).map(r => (
        <span key={r} style={{ fontSize: 8, lineHeight: 1 }}>{icons[r] || '🛡️'}</span>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props { room: any; words: any[]; onLeave: () => void; }

export default function TowerDefensePage({ room, words, onLeave }: Props) {
  const [enemies, setEnemies] = useState<any[]>([]);
  const [towers, setTowers] = useState<any[]>([]);
  const [lives, setLives] = useState(20);
  const [gold, setGold] = useState(150);
  const [score, setScore] = useState(0);
  const [rage, setRage] = useState(0);
  const [wave, setWave] = useState(0);
  const [input, setInput] = useState('');
  const [selectedTower, setSelectedTower] = useState('archer');
  const [showStore, setShowStore] = useState(false);
  const [myWeapon, setMyWeapon] = useState('basic');
  const [playerGold, setPlayerGold] = useState(500);
  const [bossSkills, setBossSkills] = useState<any[]>([]);
  const [floats, setFloats] = useState<any[]>([]);
  const [waveMsg, setWaveMsg] = useState('');
  const [gameOver, setGameOver] = useState<any>(null);
  const [explosions, setExplosions] = useState<any[]>([]);
  const [destroyedTowers, setDestroyedTowers] = useState<any[]>([]);
  const [towerFlash, setTowerFlash] = useState<Record<string, boolean>>({});
  const [enemyFlash, setEnemyFlash] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const floatId = useRef(0);
  const expId = useRef(0);
  const myId = multiplayerService.getSocket()?.id;

  useEffect(() => {
    const s = multiplayerService;

    s.on('game:state', (data: any) => {
      setEnemies(data.enemies || []);
      setTowers(data.towers || []);
      setLives(data.lives);
      setGold(data.gold);
      setScore(data.score);
      setRage(data.rage);
      setWave(data.wave);
    });

    s.on('wave:start', ({ wave: w }: any) => {
      setWaveMsg(`🌊 WAVE ${w}!`);
      setTimeout(() => setWaveMsg(''), 2500);
    });

    s.on('tower:fire', ({ towerId, targetId, damage }: any) => {
      const id = ++expId.current;
      setExplosions(prev => [...prev, { id, targetId, damage }]);
      setEnemyFlash(prev => ({ ...prev, [targetId]: true }));
      setTimeout(() => {
        setExplosions(prev => prev.filter(e => e.id !== id));
        setEnemyFlash(prev => { const n = { ...prev }; delete n[targetId]; return n; });
      }, 300);
    });

    s.on('enemy:die', ({ id, isBoss, x, y }: any) => {
      const fid = ++floatId.current;
      setFloats(prev => [...prev, {
        id: fid,
        text: isBoss ? '👹 BOSS DEFEATED!' : '+Gold',
        color: isBoss ? '#f59e0b' : '#10b981',
        x: x || 50, y: y || 50,
      }]);
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 1500);
    });

    s.on('tower:destroyed', ({ towerId, x, y }: any) => {
      const did = ++expId.current;
      setDestroyedTowers(prev => [...prev, { id: did, x, y }]);
      setTimeout(() => setDestroyedTowers(prev => prev.filter(d => d.id !== did)), 1200);
    });

    s.on('boss:killed', ({ skill }: any) => setBossSkills(prev => [...prev, skill]));

    s.on('player:attacked', ({ damage }: any) => {
      const fid = ++floatId.current;
      setFloats(prev => [...prev, { id: fid, text: `⚔️ -${damage}`, color: '#ef4444', x: 5, y: 50 }]);
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 800);
    });

    s.on('ulti:activated', () => {
      const fid = ++floatId.current;
      setFloats(prev => [...prev, { id: fid, text: '🔥 ULTI!', color: '#f59e0b', x: 50, y: 40 }]);
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 1500);
    });

    s.on('game:end', (data: any) => setGameOver(data));

    return () => {
      ['game:state','wave:start','tower:fire','enemy:die','tower:destroyed',
       'boss:killed','player:attacked','ulti:activated','game:end'].forEach(e => s.off(e));
    };
  }, []);

  const handleInput = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !input.trim()) return;
    multiplayerService.emit('tower:attack', { roomId: room.id, answer: input.trim() });
    setInput('');
  };

  const buildTower = (x: number, y: number) => {
    multiplayerService.emit('tower:build', { roomId: room.id, type: selectedTower, x, y });
  };

  const buyWeapon = (weaponId: string) => {
    const w = WEAPONS[weaponId];
    if (!w || playerGold < w.price) return;
    setPlayerGold(pg => pg - w.price);
    setMyWeapon(weaponId);
    multiplayerService.emit('store:buy_weapon', { roomId: room.id, weaponId });
  };

  const useUlti = () => {
    if (rage < 100) return;
    multiplayerService.emit('tower:ulti', { roomId: room.id });
    setRage(0);
  };

  const useBossSkill = (skill: any) => {
    multiplayerService.emit('boss:skill', { roomId: room.id, skillId: skill.id });
    setBossSkills(prev => prev.filter(s => s.id !== skill.id));
  };

  const livesColor = lives > 10 ? '#10b981' : lives > 5 ? '#f59e0b' : '#ef4444';

  // ── Game Over Screen ──
  if (gameOver) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#050510' }}>
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b, #0f172a)',
        border: '1px solid rgba(99,102,241,0.4)', borderRadius: 24, padding: 48,
        textAlign: 'center', maxWidth: 440,
        boxShadow: '0 0 60px rgba(99,102,241,0.2)',
      }}>
        <div style={{ fontSize: 80, marginBottom: 16 }}>{gameOver.win ? '🏆' : '💀'}</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px', letterSpacing: 2, color: gameOver.win ? '#fbbf24' : '#ef4444' }}>
          {gameOver.win ? 'CHIẾN THẮNG!' : 'THẤT BẠI!'}
        </h2>
        <p style={{ color: '#94a3b8', marginBottom: 28, fontSize: 14 }}>
          {gameOver.win ? 'Vương quốc đã được bảo vệ!' : 'Thành trì đã thất thủ...'}
        </p>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 32 }}>
          {[
            { v: gameOver.score?.toLocaleString(), l: 'Điểm', c: '#6366f1' },
            { v: `W${gameOver.wave}`, l: 'Wave', c: '#f59e0b' },
            { v: gameOver.lives, l: 'Mạng còn', c: '#10b981' },
          ].map(({ v, l, c }) => (
            <div key={l} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 20px' }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: c, fontFamily: 'monospace' }}>{v}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={onLeave} style={{ width: '100%', padding: '14px', fontSize: 16, borderRadius: 12 }}>← Về Lobby</button>
      </div>
    </div>
  );

  // ── Main Render ──
  return (
    <div className="td-game">
      {/* ── HUD ── */}
      <div className="td-hud">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="hud-stat" style={{ color: '#f59e0b' }}>💰 {gold}</div>
          <div className="hud-stat" style={{ color: livesColor }}>❤️ {lives}</div>
          <div className="hud-stat" style={{ color: '#6366f1' }}>🌊 W{wave}</div>
          <div className="hud-stat" style={{ color: '#a855f7' }}>⭐ {score.toLocaleString()}</div>
        </div>

        {/* Rage bar */}
        <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, maxWidth: 300 }}>
          <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>⚡ RAGE</span>
          <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${rage}%`, background: 'linear-gradient(90deg,#f59e0b,#ef4444)', borderRadius: 5, transition: 'width 0.3s', boxShadow: rage > 80 ? '0 0 10px #ef4444' : 'none' }} />
          </div>
          <button
            onClick={useUlti}
            disabled={rage < 100}
            style={{
              padding: '4px 12px', borderRadius: 8,
              background: rage >= 100 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255,255,255,0.05)',
              border: 'none', color: rage >= 100 ? '#fff' : '#475569',
              fontWeight: 700, fontSize: 12, cursor: rage >= 100 ? 'pointer' : 'not-allowed',
              animation: rage >= 100 ? 'pulse 1s infinite' : 'none',
            }}
          >ULTI!</button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-sm" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12 }} onClick={() => setShowStore(true)}>🛒 Store</button>
          <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }} onClick={onLeave}>✕</button>
        </div>
      </div>

      {/* Wave message */}
      {waveMsg && <div className="wave-msg">{waveMsg}</div>}

      {/* Boss Skills */}
      {bossSkills.length > 0 && (
        <div className="boss-skills">
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>⚡ BOSS DROP</div>
          {bossSkills.map(s => (
            <button key={s.id} className="boss-skill-btn" onClick={() => useBossSkill(s)}>{s.name}</button>
          ))}
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="td-main">

        {/* Tower selector sidebar */}
        <div className="td-sidebar">
          <div className="sidebar-title">XÂY THÁP</div>
          {Object.entries(TOWER_TYPES).map(([type, info]) => (
            <button key={type}
              className={`tower-select-btn ${selectedTower === type ? 'active' : ''}`}
              onClick={() => setSelectedTower(type)}
              style={{ '--tc': info.color } as any}
            >
              <div className="tower-btn-model">
                <TowerModel type={type} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.name}</div>
                <div style={{ fontSize: 10, color: '#f59e0b' }}>💰 {info.cost}</div>
              </div>
            </button>
          ))}
          <div style={{ marginTop: 10, padding: '8px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>VŨ KHÍ</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{WEAPONS[myWeapon]?.icon} {WEAPONS[myWeapon]?.name}</div>
            <div style={{ fontSize: 9, color: '#10b981', marginTop: 2 }}>x{WEAPONS[myWeapon]?.dmgBonus} DMG</div>
          </div>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 6, lineHeight: 1.6, textAlign: 'center' }}>
            Click bản đồ<br/>để đặt tháp
          </div>
        </div>

        {/* ── Game Field ── */}
        <div className="td-field" onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          buildTower(x, y);
        }}>
          {/* Parallax background */}
          <ParallaxBG wave={wave} />

          {/* Paths */}
          <PathRenderer />

          {/* Towers */}
          {towers.map((t: any) => (
            <div key={t.id} className="td-tower" style={{ left: `${t.x}%`, top: `${t.y}%` }}>
              <TowerModel type={t.type} level={t.level || 1} />
              {/* Range ring on hover */}
              <div className="tower-range-ring" style={{ '--range': `${TOWER_TYPES[t.type]?.range || 30}px` } as any} />
            </div>
          ))}

          {/* Tower destruction effects */}
          {destroyedTowers.map(d => (
            <TowerDestroyEffect key={d.id} x={d.x} y={d.y} />
          ))}

          {/* Enemies */}
          {enemies.map((e: any) => {
            const etype = ENEMY_TYPES[e.type] || ENEMY_TYPES.orc;
            const hpPct = (e.hp / e.maxHp) * 100;
            const isFlashing = !!enemyFlash[e.id];
            const isSlowed = e.slowed;
            const isPoisoned = e.poisoned;
            const isBoss = etype.isBoss;

            return (
              <div key={e.id} className={`td-enemy ${isBoss ? 'enemy-boss' : ''} ${isSlowed ? 'enemy-slowed' : ''}`}
                style={{
                  left: `${e.x}%`,
                  top: `${e.y}%`,
                  zIndex: isBoss ? 20 : 10,
                  transition: `left ${isBoss ? 1.5 : 1}s linear, top ${isBoss ? 1.5 : 1}s linear`,
                }}
              >
                {/* Status icons */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 1, justifyContent: 'center' }}>
                  {isSlowed && <span style={{ fontSize: 8 }}>❄️</span>}
                  {isPoisoned && <span style={{ fontSize: 8 }}>☠️</span>}
                  {isBoss && <span style={{ fontSize: 8, animation: 'pulse 1s infinite' }}>⚡</span>}
                </div>

                {/* HP bar */}
                <div className="enemy-hpbar">
                  <div style={{
                    height: '100%',
                    background: hpPct > 60 ? '#10b981' : hpPct > 25 ? '#f59e0b' : '#ef4444',
                    width: `${hpPct}%`,
                    borderRadius: 2,
                    transition: 'width 0.2s',
                    boxShadow: isBoss ? '0 0 6px currentColor' : 'none',
                  }} />
                </div>

                {/* Enemy model */}
                <div style={{ position: 'relative' }}>
                  <EnemyModel type={e.type || 'orc'} scale={isBoss ? 1.2 : 1} flash={isFlashing} />
                  {/* Explosion overlay */}
                  {explosions.find(ex => ex.targetId === e.id) && (
                    <div className="hit-explosion">
                      <div className="explosion-ring" />
                      <div className="explosion-text">-{explosions.find(ex => ex.targetId === e.id)?.damage}</div>
                    </div>
                  )}
                </div>

                {/* Word label */}
                <div className={`enemy-word ${isBoss ? 'boss-word' : ''}`}>{e.word}</div>

                {/* Resist badges */}
                <ResistBadges type={e.type || 'orc'} />

                {/* Boss health text */}
                {isBoss && (
                  <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, textAlign: 'center' }}>
                    {e.hp}/{e.maxHp}
                  </div>
                )}
              </div>
            );
          })}

          {/* Float effects */}
          {floats.map(f => (
            <div key={f.id} className="td-float" style={{
              left: `${f.x || 50}%`, top: `${f.y || 50}%`,
              color: f.color,
            }}>{f.text}</div>
          ))}
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="td-input-area">
        <div style={{ fontSize: 12, color: '#64748b' }}>
          ⌨️ Gõ từ tiếng Anh để tấn công — quái trâu cần nhiều phát hơn:
        </div>
        <div style={{ display: 'flex', gap: 10, flex: 1 }}>
          <input
            ref={inputRef}
            className="td-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInput}
            placeholder="Gõ từ + Enter để bắn..."
            autoFocus spellCheck={false} autoComplete="off"
          />
          <button
            className="td-fire-btn"
            onClick={() => { multiplayerService.emit('tower:attack', { roomId: room.id, answer: input.trim() }); setInput(''); }}
          >
            ⚔️ BẮN
          </button>
        </div>
      </div>

      {/* ── Store Modal ── */}
      {showStore && (
        <div className="modal-overlay" onClick={() => setShowStore(false)}>
          <div className="td-store-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>🛒 Vũ Khí Store</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 14, color: '#f59e0b', fontWeight: 600 }}>💰 {playerGold}</span>
                <button onClick={() => setShowStore(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            {Object.entries(WEAPONS).map(([id, w]: any) => (
              <div key={id} className="store-item">
                <span style={{ fontSize: 28 }}>{w.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{w.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Damage nhân x{w.dmgBonus}</div>
                </div>
                <button
                  className={`store-buy-btn ${myWeapon === id ? 'owned' : ''}`}
                  onClick={() => buyWeapon(id)}
                  disabled={myWeapon === id || (w.price > 0 && playerGold < w.price)}
                >
                  {myWeapon === id ? '✅ Đang dùng' : w.price === 0 ? 'Miễn phí' : `💰 ${w.price}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Global Styles ── */}
      <style>{`
        /* Layout */
        .td-game { display:flex; flex-direction:column; height:100vh; overflow:hidden; background:#050510; font-family:'JetBrains Mono',monospace; }

        /* HUD */
        .td-hud {
          display:flex; align-items:center; justify-content:space-between; gap:16px;
          padding:8px 16px; flex-shrink:0;
          background:linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 100%);
          border-bottom:1px solid rgba(99,102,241,0.2);
          backdrop-filter:blur(8px);
        }
        .hud-stat {
          font-size:13px; font-weight:700; font-family:'JetBrains Mono',monospace;
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
          padding:4px 12px; border-radius:8px;
        }
        .wave-msg {
          position:fixed; top:52px; left:50%; transform:translateX(-50%);
          background:linear-gradient(135deg,rgba(239,68,68,0.9),rgba(220,38,38,0.9));
          color:white; padding:10px 32px; border-radius:24px;
          font-size:22px; font-weight:800; z-index:200;
          animation:waveIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
          letter-spacing:2px; text-shadow:0 0 20px rgba(239,68,68,0.8);
          border:1px solid rgba(255,255,255,0.2);
        }
        @keyframes waveIn { 0%{transform:translateX(-50%) scale(0.5);opacity:0} 100%{transform:translateX(-50%) scale(1);opacity:1} }

        .boss-skills { position:fixed; top:60px; right:16px; display:flex; flex-direction:column; gap:6px; z-index:100; }
        .boss-skill-btn {
          background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4);
          color:#f59e0b; padding:6px 14px; border-radius:10px;
          font-family:inherit; font-size:12px; font-weight:600; cursor:pointer;
          animation:pulse 1.5s infinite;
        }

        /* Main */
        .td-main { flex:1; display:flex; overflow:hidden; }

        /* Sidebar */
        .td-sidebar {
          width:120px; flex-shrink:0;
          background:rgba(0,0,0,0.75); border-right:1px solid rgba(99,102,241,0.15);
          padding:10px 6px; display:flex; flex-direction:column; gap:4px;
          overflow-y:auto; backdrop-filter:blur(8px);
        }
        .sidebar-title { font-size:9px; font-weight:700; letter-spacing:2px; color:#334155; padding:4px 4px 6px; }
        .tower-select-btn {
          display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:10px;
          border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.03);
          color:var(--text-primary); font-family:inherit; cursor:pointer;
          transition:all 0.2s; width:100%; text-align:left; overflow:hidden;
        }
        .tower-select-btn:hover { border-color:var(--tc); background:rgba(255,255,255,0.06); }
        .tower-select-btn.active { border-color:var(--tc); background:color-mix(in srgb, var(--tc) 12%, transparent); box-shadow:0 0 12px color-mix(in srgb, var(--tc) 30%, transparent); }
        .tower-btn-model { width:36px; display:flex; justify-content:center; align-items:flex-end; flex-shrink:0; }

        /* Field */
        .td-field {
          flex:1; position:relative; overflow:hidden; cursor:crosshair;
          background:#050510;
        }

        /* Tower on field */
        .td-tower {
          position:absolute; transform:translate(-50%,-50%);
          z-index:5; cursor:default;
          filter:drop-shadow(0 4px 8px rgba(0,0,0,0.8));
        }
        .td-tower:hover .tower-range-ring { opacity:1; }
        .tower-range-ring {
          position:absolute; top:50%; left:50%;
          width:calc(var(--range) * 2); height:calc(var(--range) * 2);
          transform:translate(-50%,-50%);
          border:1px dashed rgba(255,255,255,0.15); border-radius:50%;
          pointer-events:none; opacity:0; transition:opacity 0.2s;
        }

        /* Enemy */
        .td-enemy {
          position:absolute; transform:translate(-50%,-50%);
          display:flex; flex-direction:column; align-items:center; gap:1px;
        }
        .enemy-boss { filter:drop-shadow(0 0 12px #f59e0b); }
        .enemy-slowed { filter:hue-rotate(180deg) brightness(0.8); }
        .enemy-hpbar {
          width:44px; height:5px; background:rgba(255,255,255,0.15);
          border-radius:3px; overflow:hidden; margin-bottom:1px;
        }
        .enemy-word {
          background:rgba(0,0,0,0.85); border:1px solid rgba(99,102,241,0.35);
          border-radius:5px; padding:2px 7px; font-size:10px; font-weight:700;
          white-space:nowrap; backdrop-filter:blur(4px); color:#e2e8f0;
          letter-spacing:0.5px;
        }
        .boss-word {
          border-color:rgba(245,158,11,0.6); background:rgba(120,60,0,0.7);
          color:#fbbf24; font-size:11px;
          box-shadow:0 0 8px rgba(245,158,11,0.3);
        }

        /* Explosion */
        .hit-explosion { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); pointer-events:none; z-index:30; }
        .explosion-ring {
          width:50px; height:50px; border-radius:50%; border:2px solid #f97316;
          animation:explodeRing 0.3s ease-out forwards;
        }
        @keyframes explodeRing { 0%{transform:scale(0.3);opacity:1} 100%{transform:scale(2);opacity:0} }
        .explosion-text {
          position:absolute; top:-16px; left:50%; transform:translateX(-50%);
          font-size:11px; font-weight:700; color:#ef4444; white-space:nowrap;
          animation:floatUp 0.5s ease forwards;
        }

        /* Float */
        .td-float {
          position:absolute; transform:translateX(-50%);
          font-size:13px; font-weight:700; pointer-events:none; z-index:40;
          animation:floatUp 1.2s ease forwards; white-space:nowrap;
          text-shadow:0 0 8px currentColor;
        }
        @keyframes floatUp { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-50px)} }

        /* Input area */
        .td-input-area {
          display:flex; align-items:center; gap:12px; padding:10px 16px; flex-shrink:0;
          background:linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 100%);
          border-top:1px solid rgba(99,102,241,0.2); backdrop-filter:blur(8px);
        }
        .td-input {
          flex:1; padding:11px 16px;
          background:rgba(255,255,255,0.04); border:2px solid rgba(99,102,241,0.3);
          border-radius:10px; color:#f1f5f9;
          font-family:'JetBrains Mono',monospace; font-size:18px; outline:none;
          transition:border-color 0.2s;
        }
        .td-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .td-fire-btn {
          padding:11px 22px; border-radius:10px; border:none;
          background:linear-gradient(135deg,#6366f1,#7c3aed);
          color:white; font-family:inherit; font-size:14px; font-weight:700;
          cursor:pointer; transition:all 0.15s;
          box-shadow:0 4px 12px rgba(99,102,241,0.4);
        }
        .td-fire-btn:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(99,102,241,0.5); }
        .td-fire-btn:active { transform:translateY(0); }

        /* Store modal */
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:1000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); }
        .td-store-modal {
          background:linear-gradient(135deg, #0f172a, #1e1b4b);
          border:1px solid rgba(99,102,241,0.3); border-radius:20px;
          padding:28px; width:480px; max-height:80vh; overflow-y:auto;
          box-shadow:0 0 60px rgba(99,102,241,0.2);
        }
        .store-item {
          display:flex; align-items:center; gap:14px;
          padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.06);
        }
        .store-buy-btn {
          padding:7px 16px; border-radius:8px; border:none;
          background:linear-gradient(135deg,#6366f1,#7c3aed);
          color:white; font-family:inherit; font-size:12px; font-weight:600;
          cursor:pointer; white-space:nowrap; transition:all 0.15s;
        }
        .store-buy-btn:disabled { background:rgba(255,255,255,0.06); color:#475569; cursor:not-allowed; }
        .store-buy-btn.owned { background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.3); }

        /* Misc */
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes shake { 0%,100%{transform:translate(-50%,-50%) rotate(0deg)} 25%{transform:translate(-50%,-50%) rotate(-5deg)} 75%{transform:translate(-50%,-50%) rotate(5deg)} }

        /* Scrollbar */
        .td-sidebar::-webkit-scrollbar { width:3px; }
        .td-sidebar::-webkit-scrollbar-track { background:transparent; }
        .td-sidebar::-webkit-scrollbar-thumb { background:rgba(99,102,241,0.3); border-radius:3px; }
      `}</style>
    </div>
  );
}
