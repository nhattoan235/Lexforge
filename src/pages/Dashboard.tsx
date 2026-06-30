// src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../services/database';
import { getScheduleSummary } from '../services/database';
import { useApp } from '../App';
import { AppStats } from '../types';
import { aiVocabService, DEFAULT_TOPICS } from '../services/aiVocabService';

export default function Dashboard() {
  const { setPage, refreshTrigger } = useApp();
  const [stats, setStats] = useState<AppStats | null>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleSummary, setScheduleSummary] = useState<any>(null);
  const [dailyVocabBanner, setDailyVocabBanner] = useState<any>(null);

  useEffect(() => {
    loadStats();
    checkAndGenerateDailyVocab();
  }, [refreshTrigger]);

  const loadStats = async () => {
    setLoading(true);
    const [statsRes, weeklyRes] = await Promise.all([db.getStats(), db.getWeeklyStats()]);
    if (statsRes.success && statsRes.data?.[0]) setStats(statsRes.data[0]);
    if (weeklyRes.success) {
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const today = new Date();
      const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - 6 + i);
        const dateStr = d.toISOString().split('T')[0];
        const found = weeklyRes.data?.find(w => w.StudyDate?.split('T')[0] === dateStr);
        return { day: days[d.getDay()], correct: found?.Correct || 0, total: found?.Total || 0 };
      });
      setWeeklyData(week);
    }
    // Load schedule summary
    const summary = await getScheduleSummary();
    setScheduleSummary(summary);
    setLoading(false);
  };

  const checkAndGenerateDailyVocab = async () => {
    try {
      // 1. Check if auto daily vocab is enabled
      const autoRes = await db.getSetting('auto_daily_vocab');
      const isEnabled = autoRes.success && autoRes.data?.[0] ? autoRes.data[0].SettingValue === 'true' : true;
      if (!isEnabled) return;

      // 2. Check if already generated today
      const todayStr = new Date().toISOString().split('T')[0];
      const lastDateRes = await db.getSetting('last_daily_vocab_date');
      const lastDate = lastDateRes.success && lastDateRes.data?.[0]?.SettingValue;
      if (lastDate === todayStr) return;

      // 3. Check if API key is set
      const keyRes = await db.getSetting('groq_api_key');
      const apiKey = keyRes.success && keyRes.data?.[0]?.SettingValue;
      if (!apiKey || apiKey.trim() === '') {
        console.log('Auto daily vocab: Groq API Key is not configured.');
        return;
      }

      // 4. Get preferred category
      const catRes = await db.getSetting('daily_vocab_category');
      const category = catRes.success && catRes.data?.[0]?.SettingValue ? catRes.data[0].SettingValue : 'toeic';

      // 5. Pick a random topic
      const topics = DEFAULT_TOPICS[category] || DEFAULT_TOPICS.toeic;
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];

      console.log(`Auto generating daily vocab: Category = ${category}, Topic = ${randomTopic}`);
      setDailyVocabBanner({ status: 'generating', topic: randomTopic, category });

      // 6. Call API and save to DB
      const words = await aiVocabService.generateWords(category, randomTopic);
      const saveRes = await aiVocabService.saveGeneratedWordsToDb(category, randomTopic, words);

      if (saveRes.success && saveRes.groupId) {
        // 7. Update last_daily_vocab_date setting
        await db.setSetting('last_daily_vocab_date', todayStr);
        setDailyVocabBanner({
          status: 'success',
          topic: randomTopic,
          category,
          groupId: saveRes.groupId,
          words,
        });
        
        // Refresh stats so the new words show up in counters
        const statsRes = await db.getStats();
        if (statsRes.success && statsRes.data?.[0]) setStats(statsRes.data[0]);
      } else {
        setDailyVocabBanner(null);
      }
    } catch (err: any) {
      console.error('Lỗi sinh từ vựng tự động hàng ngày:', err);
      setDailyVocabBanner(null);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" />Đang tải...</div>;

  const accuracy = stats && stats.TotalWords > 0
    ? Math.round((stats.MasteredWords / stats.TotalWords) * 100) : 0;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard 📊</h1>
          <p className="page-subtitle">Tổng quan tiến độ học tập của bạn</p>
        </div>
        <button className="btn btn-primary" onClick={() => setPage('flashcard')}>
          ▶ Ôn Luyện Ngay
        </button>
      </div>

      <div className="dashboard-content">
        {/* Daily Vocab Banner */}
        {dailyVocabBanner && (
          <div style={{
            background: dailyVocabBanner.status === 'generating' ? 'rgba(99,102,241,0.06)' : 'rgba(16,185,129,0.06)',
            border: `1.5px solid ${dailyVocabBanner.status === 'generating' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)'}`,
            borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
            marginBottom: 10, position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ fontSize: 28 }}>{dailyVocabBanner.status === 'generating' ? '⏳' : '🪄'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {dailyVocabBanner.status === 'generating' 
                  ? `Đang chuẩn bị từ vựng hàng ngày bằng AI...` 
                  : `Hôm nay hệ thống đã tự động thêm 10 từ mới bằng AI!`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Chương trình: <strong style={{ color: 'var(--accent-bright)' }}>{dailyVocabBanner.category.toUpperCase()}</strong> · Chủ đề: <strong style={{ color: 'var(--text-primary)' }}>{dailyVocabBanner.topic}</strong>
              </div>
            </div>
            {dailyVocabBanner.status === 'success' && (
              <button 
                className="btn btn-primary" 
                onClick={() => setPage('flashcard')}
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                Học Ngay →
              </button>
            )}
            <div style={{
              position: 'absolute', bottom: -20, right: -20, width: 60, height: 60, borderRadius: '50%',
              background: dailyVocabBanner.status === 'generating' ? '#6366f1' : '#10b981',
              filter: 'blur(24px)', opacity: 0.12
            }} />
          </div>
        )}
        {/* Stats Grid */}
        <div className="stats-grid">
          {[
            { label: 'Tổng Từ Vựng', value: stats?.TotalWords || 0, icon: '📖', color: '#6366f1', sub: `${stats?.TotalGroups || 0} nhóm` },
            { label: 'Đã Thuộc', value: stats?.MasteredWords || 0, icon: '✅', color: '#10b981', sub: `${accuracy}% tổng số` },
            { label: 'Cần Ôn Hôm Nay', value: stats?.DueWords || 0, icon: '⏰', color: '#f59e0b', sub: 'từ SRS' },
            { label: 'Đúng Hôm Nay', value: stats?.TodayCorrect || 0, icon: '🎯', color: '#ec4899', sub: 'lần trả lời đúng' },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ '--accent-color': s.color } as any}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value.toLocaleString()}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-sub">{s.sub}</div>
              <div className="stat-glow" />
            </div>
          ))}
        </div>

        <div className="dashboard-row">
          {/* Weekly Chart */}
          <div className="card chart-card">
            <h3 className="card-title">📈 Hoạt Động 7 Ngày</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a35', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="correct" name="Đúng" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" name="Tổng" fill="rgba(99,102,241,0.2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Actions */}
          <div className="card quick-actions">
            <h3 className="card-title">⚡ Truy Cập Nhanh</h3>
            <div className="action-list">
              {[
                { page: 'flashcard', icon: '🃏', label: 'Flashcard', desc: 'Lật thẻ ôn từ' },
                { page: 'typing-game', icon: '⌨️', label: 'Typing Race', desc: 'Gõ chữ tích điểm' },
                { page: 'monster-game', icon: '⚔️', label: 'Đánh Quái', desc: 'Game từ vựng' },
                { page: 'vocabulary', icon: '➕', label: 'Thêm Từ', desc: 'Thêm từ mới' },
              ].map((a, i) => (
                <button key={i} className="action-item" onClick={() => setPage(a.page as any)}>
                  <div className="action-icon">{a.icon}</div>
                  <div>
                    <div className="action-label">{a.label}</div>
                    <div className="action-desc">{a.desc}</div>
                  </div>
                  <span className="action-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* High Scores */}
        <div className="card">
          <h3 className="card-title">🏆 Điểm Cao Nhất</h3>
          <div className="scores-row">
            <div className="score-item">
              <div className="score-icon">⌨️</div>
              <div className="score-label">Typing Race</div>
              <div className="score-value">{(stats?.BestTypingScore || 0).toLocaleString()}</div>
            </div>
            <div className="score-divider" />
            <div className="score-item">
              <div className="score-icon">⚔️</div>
              <div className="score-label">Đánh Quái</div>
              <div className="score-value">{(stats?.BestMonsterScore || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Schedule Widget */}
        {scheduleSummary && scheduleSummary.total > 0 && (
          <div
            onClick={() => setPage('schedule')}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '20px 24px',
              cursor: 'pointer', transition: 'border-color 0.2s',
              display: 'flex', alignItems: 'center', gap: 20,
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ fontSize: 36 }}>📅</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>🧠 Lịch Ôn Tập AI</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Hệ thống phát hiện{' '}
                {scheduleSummary.urgent > 0 && (
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>{scheduleSummary.urgent} từ cấp tốc</span>
                )}
                {scheduleSummary.urgent > 0 && scheduleSummary.high_count > 0 && ', '}
                {scheduleSummary.high_count > 0 && (
                  <span style={{ color: '#f97316', fontWeight: 700 }}>{scheduleSummary.high_count} từ ưu tiên</span>
                )}
                {scheduleSummary.urgent === 0 && scheduleSummary.high_count === 0 && (
                  <span style={{ color: '#10b981', fontWeight: 700 }}>trí nhớ đang tốt ✨</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              {scheduleSummary.urgent > 0 && (
                <span style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)',
                }}>🔴 {scheduleSummary.urgent} cấp tốc</span>
              )}
              {scheduleSummary.high_count > 0 && (
                <span style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)',
                }}>🟠 {scheduleSummary.high_count} ưu tiên</span>
              )}
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>→</span>
          </div>
        )}
      </div>

      <style>{`
        .dashboard { padding-bottom: 32px; }
        .dashboard-content { padding: 24px 32px; display: flex; flex-direction: column; gap: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .stat-card {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 20px; position: relative;
          overflow: hidden; cursor: default; transition: border-color 0.2s;
        }
        .stat-card:hover { border-color: var(--accent-color, var(--border-bright)); }
        .stat-icon { font-size: 28px; margin-bottom: 12px; }
        .stat-value { font-size: 32px; font-weight: 700; color: var(--accent-color); }
        .stat-label { font-size: 14px; font-weight: 500; margin-top: 4px; }
        .stat-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .stat-glow {
          position: absolute; bottom: -30px; right: -30px; width: 80px; height: 80px;
          background: var(--accent-color); border-radius: 50%; filter: blur(30px); opacity: 0.15;
        }
        .dashboard-row { display: grid; grid-template-columns: 1fr 340px; gap: 16px; }
        .chart-card { }
        .card-title { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
        .quick-actions { }
        .action-list { display: flex; flex-direction: column; gap: 4px; }
        .action-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px; border-radius: var(--radius-sm);
          background: none; border: none; width: 100%; text-align: left;
          cursor: pointer; transition: background 0.2s; color: var(--text-primary);
          font-family: inherit;
        }
        .action-item:hover { background: var(--bg-hover); }
        .action-icon { font-size: 20px; width: 32px; text-align: center; }
        .action-label { font-size: 14px; font-weight: 500; }
        .action-desc { font-size: 12px; color: var(--text-secondary); }
        .action-arrow { margin-left: auto; color: var(--text-muted); }
        .scores-row { display: flex; align-items: center; justify-content: center; gap: 40px; padding: 16px 0; }
        .score-item { text-align: center; }
        .score-icon { font-size: 32px; margin-bottom: 8px; }
        .score-label { font-size: 13px; color: var(--text-secondary); }
        .score-value { font-size: 28px; font-weight: 700; color: var(--accent-bright); font-family: 'JetBrains Mono', monospace; }
        .score-divider { width: 1px; height: 80px; background: var(--border); }
        .loading-screen { display: flex; align-items: center; justify-content: center; gap: 12px; height: 100vh; font-size: 16px; color: var(--text-secondary); }
        .spinner { width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
