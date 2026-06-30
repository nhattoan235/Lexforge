// src/pages/SchedulePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/database';
import { lstmService, DailySchedule, ScheduledWord } from '../services/lstmScheduler';
import { WordGroup } from '../types';
import { useApp } from '../App';


type FilterType = 'all' | 'urgent' | 'high' | 'low';

const URGENCY_CONFIG = {
  urgent: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', label: '🔴 Cấp tốc', order: 0 },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', label: '🟠 Ưu tiên', order: 1 },
  low: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', label: '🟢 Ổn định', order: 2 },
};

function PForgetBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct > 70 ? '#ef4444' : pct > 40 ? '#f97316' : '#10b981';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 110 }}>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, fontFamily: 'JetBrains Mono,monospace', minWidth: 34 }}>{pct}%</span>
    </div>
  );
}

function StatCard({ icon, label, value, color, bg, border }: any) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 12,
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ position: 'absolute', bottom: -20, right: -20, width: 70, height: 70, borderRadius: '50%', background: color, filter: 'blur(28px)', opacity: 0.18 }} />
    </div>
  );
}

function WordCard({ word, onStudyNow }: { word: ScheduledWord; onStudyNow: (id: number) => void }) {
  const cfg = URGENCY_CONFIG[word.urgency as keyof typeof URGENCY_CONFIG] || URGENCY_CONFIG.low;
  const daysLabel = word.days_since_last >= 999
    ? 'Chưa ôn lần nào'
    : word.days_since_last < 1
      ? 'Vừa ôn'
      : `${Math.floor(word.days_since_last)} ngày trước`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
      background: 'var(--bg-card)', border: `1px solid var(--border)`,
      borderLeft: `4px solid ${cfg.color}`,
      borderRadius: 10, transition: 'border-color 0.2s, transform 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = cfg.color)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {/* Word info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{word.english}</span>
          {word.groupColor && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: `${word.groupColor}22`, color: word.groupColor, fontWeight: 600 }}>
              {word.groupName}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{word.vietnamese}</div>
      </div>

      {/* p_forget bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Nguy cơ quên</div>
        <PForgetBar value={word.p_forget} />
      </div>

      {/* Urgency badge */}
      <div style={{
        fontSize: 11, padding: '4px 10px', borderRadius: 20,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        fontWeight: 600, whiteSpace: 'nowrap',
      }}>{cfg.label}</div>

      {/* Schedule */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', minWidth: 70 }}>
        <div>📅 {word.schedule_days}d</div>
        <div style={{ marginTop: 2 }}>{daysLabel}</div>
      </div>

      {/* Study button */}
      <button
        onClick={() => onStudyNow(word.id)}
        style={{
          padding: '6px 12px', borderRadius: 7, border: `1px solid ${cfg.border}`,
          background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        Ôn ngay →
      </button>
    </div>
  );
}

export default function SchedulePage() {
  const { setPage, triggerRefresh } = useApp();
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<DailySchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingAiGroup, setIsCreatingAiGroup] = useState(false);
  const [lstmStatus, setLstmStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [filter, setFilter] = useState<FilterType>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    db.getGroups().then(res => {
      if (res.success && res.data) {
        setGroups(res.data);
        if (res.data.length > 0) setSelectedGroupId(res.data[0].Id);
      }
    });
    lstmService.isAvailable().then(ok => setLstmStatus(ok ? 'online' : 'offline'));
  }, []);

  const loadSchedule = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const result = await lstmService.getDailySchedule(selectedGroupId ?? undefined);
      setSchedule(result);
      setLastUpdated(new Date());
      setLstmStatus(result.source === 'lstm' ? 'online' : 'offline');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId !== null) loadSchedule();
  }, [selectedGroupId]); // eslint-disable-line

  const filteredWords = (() => {
    if (!schedule) return [];
    let words = filter === 'all' ? schedule.words_to_review : schedule.words_to_review.filter(w => w.urgency === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      words = words.filter(w => w.english.toLowerCase().includes(q) || w.vietnamese.toLowerCase().includes(q));
    }
    return words;
  })();

  const handleStudyNow = (wordId: number) => {
    // Navigate to flashcard — the flashcard page will pick it up via the due-words filter
    setPage('flashcard');
  };

  const handleStudyUrgent = () => {
    setPage('flashcard');
  };

  const urgentWords = schedule?.words_to_review.filter(w => w.urgency === 'urgent' || w.urgency === 'high') ?? [];

  const handleCreateAiGroup = async () => {
    if (!urgentWords.length) return;
    const confirmCreate = window.confirm(
      `Bạn có muốn tạo một nhóm mới và di chuyển ${urgentWords.length} từ vựng cần ôn tập (Urgent & High) vào nhóm này để tiện quản lý không?`
    );
    if (!confirmCreate) return;

    setIsCreatingAiGroup(true);
    try {
      const todayStr = new Date().toLocaleDateString('vi-VN');
      const groupName = `AI Review - ${todayStr}`;
      const groupDesc = `Nhóm ôn tập từ vựng khẩn cấp gợi ý bởi AI ngày ${todayStr}`;
      const groupColor = '#ef4444'; // Red color
      const groupIcon = '🧠';

      // 1. Tạo nhóm mới
      const createRes = await db.createGroup(groupName, groupDesc, groupColor, groupIcon);
      if (!createRes.success) {
        alert('Tạo nhóm thất bại: ' + createRes.error);
        return;
      }

      // 2. Lấy nhóm vừa tạo để có Id
      const groupsRes = await db.getGroups();
      if (!groupsRes.success || !groupsRes.data || groupsRes.data.length === 0) {
        alert('Không lấy được thông tin nhóm mới.');
        return;
      }

      const targetGroupId = groupsRes.data[0].Id;
      const wordIds = urgentWords.map(w => w.id);

      // 3. Di chuyển từ sang nhóm mới
      const moveRes = await (db as any).moveWordsToGroup(wordIds, targetGroupId);
      if (moveRes.success) {
        alert(`✅ Đã tạo thành công nhóm "${groupName}" và chuyển ${wordIds.length} từ vựng vào nhóm này!`);
        triggerRefresh();
        setPage('groups');
      } else {
        alert('Lỗi khi di chuyển từ vựng: ' + moveRes.error);
      }
    } catch (err: any) {
      console.error(err);
      alert('Đã xảy ra lỗi: ' + err.message);
    } finally {
      setIsCreatingAiGroup(false);
    }
  };

  const urgentCount = schedule?.urgent_count ?? 0;
  const highCount = schedule?.high_count ?? 0;
  const lowCount = schedule?.low_count ?? 0;
  const totalCount = schedule?.total_words ?? 0;

  const memoryHealth = totalCount === 0 ? 100 : Math.round(((lowCount + highCount * 0.5) / totalCount) * 100);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📅 Lịch Ôn Tập AI</h1>
          <p className="page-subtitle">
            Hệ thống lịch ôn cá nhân hóa — sử dụng{' '}
            {lstmStatus === 'online'
              ? <span style={{ color: '#10b981', fontWeight: 600 }}>🟢 LSTM Neural Network</span>
              : <span style={{ color: '#f97316', fontWeight: 600 }}>🟠 SM-2 Algorithm (offline)</span>
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {urgentWords.length > 0 && (
            <button className="btn btn-secondary" onClick={handleCreateAiGroup} disabled={isCreatingAiGroup}
              style={{ borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)' }}>
              🧠 {isCreatingAiGroup ? 'Đang tạo...' : `Tạo nhóm ôn tập AI (${urgentWords.length} từ)`}
            </button>
          )}
          {urgentCount > 0 && (
            <button className="btn btn-danger" onClick={handleStudyUrgent}>
              🔴 Ôn {urgentCount} từ cấp tốc
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => loadSchedule(true)}
            disabled={isRefreshing}
            style={{ minWidth: 110 }}
          >
            {isRefreshing ? '⏳ Đang tính...' : '🔄 Tính lại'}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── STATUS BAR ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '10px 16px', borderRadius: 10,
          background: lstmStatus === 'online' ? 'rgba(16,185,129,0.07)' : 'rgba(249,115,22,0.07)',
          border: `1px solid ${lstmStatus === 'online' ? 'rgba(16,185,129,0.25)' : 'rgba(249,115,22,0.25)'}`,
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <span style={{ fontWeight: 600, color: lstmStatus === 'online' ? '#10b981' : '#f97316' }}>
            {lstmStatus === 'checking' ? '⏳ Đang kiểm tra...'
              : lstmStatus === 'online' ? '✅ LSTM Server đang chạy'
                : '⚠️ LSTM Offline — đang dùng SM-2 cục bộ'}
          </span>
          {lstmStatus === 'offline' && (
            <span style={{ color: 'var(--text-muted)' }}>
              Để bật LSTM: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>python lstm_scheduler.py</code>
            </span>
          )}
          {lastUpdated && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
              Cập nhật: {lastUpdated.toLocaleTimeString('vi-VN')}
            </span>
          )}
        </div>

        {/* ── GROUP TABS ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedGroupId(null)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              border: `2px solid ${selectedGroupId === null ? 'var(--accent)' : 'var(--border)'}`,
              background: selectedGroupId === null ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
              color: selectedGroupId === null ? 'var(--accent-bright)' : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            🌐 Tất cả
          </button>
          {groups.map(g => (
            <button
              key={g.Id}
              onClick={() => setSelectedGroupId(g.Id)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                border: `2px solid ${selectedGroupId === g.Id ? g.Color : 'var(--border)'}`,
                background: selectedGroupId === g.Id ? `${g.Color}18` : 'var(--bg-secondary)',
                color: selectedGroupId === g.Id ? g.Color : 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
              }}
            >
              {g.Icon} {g.Name}
              <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 11 }}>{g.WordCount}</span>
            </button>
          ))}
        </div>

        {/* ── LOADING ─────────────────────────────────────────────────────── */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{
              width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <div>Đang tính toán lịch ôn tập...</div>
          </div>
        )}

        {!isLoading && schedule && (
          <>
            {/* ── STAT CARDS ─────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12 }}>
              <StatCard icon="📚" label="Tổng từ" value={totalCount}
                color="var(--accent-bright)" bg="rgba(99,102,241,0.1)" border="rgba(99,102,241,0.3)" />
              <StatCard icon="🔴" label="Cấp tốc (ôn ngay)" value={urgentCount}
                color="#ef4444" bg="rgba(239,68,68,0.1)" border="rgba(239,68,68,0.3)" />
              <StatCard icon="🟠" label="Ưu tiên" value={highCount}
                color="#f97316" bg="rgba(249,115,22,0.1)" border="rgba(249,115,22,0.3)" />
              <StatCard icon="🟢" label="Ổn định" value={lowCount}
                color="#10b981" bg="rgba(16,185,129,0.1)" border="rgba(16,185,129,0.3)" />
              <div style={{
                background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 22 }}>🧠</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sức khỏe trí nhớ</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${memoryHealth}%`, height: '100%', borderRadius: 4,
                      background: memoryHealth > 70 ? '#10b981' : memoryHealth > 40 ? '#f97316' : '#ef4444',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 16, fontWeight: 700,
                    color: memoryHealth > 70 ? '#10b981' : memoryHealth > 40 ? '#f97316' : '#ef4444',
                  }}>{memoryHealth}%</span>
                </div>
              </div>
            </div>

            {/* ── FILTER + SEARCH ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['all', 'urgent', 'high', 'low'] as const).map(f => {
                  const cfg = f === 'all'
                    ? { color: 'var(--accent-bright)', border: 'var(--border)', bg: 'rgba(99,102,241,0.15)' }
                    : URGENCY_CONFIG[f];
                  const cnt = f === 'all' ? totalCount : f === 'urgent' ? urgentCount : f === 'high' ? highCount : lowCount;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: filter === f ? 700 : 400,
                        border: `1px solid ${filter === f ? (cfg as any).color || cfg.border : 'var(--border)'}`,
                        background: filter === f ? (cfg as any).bg || 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
                        color: filter === f ? (cfg as any).color || 'var(--accent-bright)' : 'var(--text-muted)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                    >
                      {f === 'all' ? `Tất cả (${cnt})` : `${URGENCY_CONFIG[f].label} (${cnt})`}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="🔍 Tìm từ..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  marginLeft: 'auto', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13,
                  outline: 'none', width: 180,
                }}
              />
            </div>

            {/* ── WORD LIST ─────────────────────────────────────────────────── */}
            {filteredWords.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>
                  {filter === 'all' && searchQuery ? '🔍' : '✨'}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  {searchQuery ? 'Không tìm thấy từ phù hợp' : 'Không có từ nào trong danh mục này!'}
                </div>
                {!searchQuery && filter === 'all' && (
                  <div style={{ fontSize: 13 }}>Học Flashcard để tích lũy dữ liệu ôn tập.</div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {/* Header row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 120px 80px 90px',
                  padding: '4px 16px', fontSize: 10, fontWeight: 600, letterSpacing: 1,
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                }}>
                  <span>Từ vựng</span>
                  <span style={{ textAlign: 'right' }}>Nguy cơ quên</span>
                  <span style={{ textAlign: 'center' }}>Mức độ</span>
                  <span style={{ textAlign: 'center' }}>Lịch</span>
                  <span />
                </div>
                {filteredWords.map((word, idx) => (
                  <WordCard key={word.id} word={word} onStudyNow={handleStudyNow} />
                ))}
              </div>
            )}

            {/* ── FOOTER INFO ──────────────────────────────────────────────── */}
            <div style={{
              padding: '14px 18px', borderRadius: 10,
              background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
              fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7,
            }}>
              💡 <strong style={{ color: 'var(--text-secondary)' }}>Cách hoạt động:</strong>{' '}
              {schedule.source === 'lstm'
                ? 'LSTM Neural Network phân tích 7 phiên học gần nhất để dự đoán xác suất quên.'
                : 'SM-2 sử dụng công thức đường cong quên lãng (forgetting curve) dựa trên lịch sử câu trả lời.'}
              {' '}Ôn tập thường xuyên để thuật toán học được thói quen của bạn!
            </div>
          </>
        )}

        {!isLoading && !schedule && (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
            <div style={{ fontSize: 16, marginBottom: 8, color: 'var(--text-secondary)' }}>Chọn nhóm từ để xem lịch ôn tập</div>
            <div style={{ fontSize: 13 }}>Thêm từ vựng và học Flashcard để hệ thống tính lịch cho bạn.</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
