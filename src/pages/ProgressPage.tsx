// src/pages/ProgressPage.tsx
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
import { db, dbService } from '../services/database';

interface Stats {
  totalWords: number; masteredWords: number; dueWords: number;
  totalGroups: number; totalSessions: number; totalCorrect: number;
  bestTyping: number; bestMonster: number; bestZombie: number; bestSniper: number;
  streak: number; todayCorrect: number; avgAccuracy: number;
}

const LEVEL_COLORS = ['#475569','#f59e0b','#f97316','#10b981','#6366f1','#ec4899'];
const LEVEL_LABELS = ['Mới','Cơ bản','Đang học','Quen','Thuộc','Thành thạo'];

export default function ProgressPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [levelData, setLevelData] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any[]>([]);
  const [sessionData, setSessionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview'|'words'|'games'|'habits'>('overview');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadWeekly(), loadLevels(), loadGroups(), loadSessions()]);
    setLoading(false);
  };

  const loadStats = async () => {
    const res = await dbService.query(`
      SELECT
        (SELECT COUNT(*) FROM Words) as TotalWords,
        (SELECT COUNT(*) FROM Words WHERE Level >= 4) as MasteredWords,
        (SELECT COUNT(*) FROM Words WHERE NextReview <= GETDATE()) as DueWords,
        (SELECT COUNT(*) FROM WordGroups) as TotalGroups,
        (SELECT COUNT(*) FROM StudySessions) as TotalSessions,
        (SELECT ISNULL(SUM(CorrectWords),0) FROM StudySessions) as TotalCorrect,
        (SELECT ISNULL(MAX(Score),0) FROM GameScores WHERE GameType='typing') as BestTyping,
        (SELECT ISNULL(MAX(Score),0) FROM GameScores WHERE GameType='monster') as BestMonster,
        (SELECT ISNULL(MAX(Score),0) FROM GameScores WHERE GameType='zombie') as BestZombie,
        (SELECT ISNULL(MAX(Score),0) FROM GameScores WHERE GameType='sniper') as BestSniper,
        (SELECT ISNULL(SUM(CorrectWords),0) FROM StudySessions WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)) as TodayCorrect,
        (SELECT ISNULL(AVG(CAST(CorrectWords AS FLOAT)/NULLIF(TotalWords,0)*100),0) FROM StudySessions WHERE TotalWords > 0) as AvgAccuracy
    `);
    if (res.success && res.data?.[0]) {
      const d = res.data[0];
      setStats({
        totalWords: d.TotalWords, masteredWords: d.MasteredWords, dueWords: d.DueWords,
        totalGroups: d.TotalGroups, totalSessions: d.TotalSessions, totalCorrect: d.TotalCorrect,
        bestTyping: d.BestTyping, bestMonster: d.BestMonster, bestZombie: d.BestZombie, bestSniper: d.BestSniper,
        streak: 0, todayCorrect: d.TodayCorrect, avgAccuracy: Math.round(d.AvgAccuracy || 0),
      });
    }
  };

  const loadWeekly = async () => {
    const res = await dbService.query(`
      SELECT CAST(CreatedAt AS DATE) as D, SUM(CorrectWords) as Correct, SUM(TotalWords) as Total, COUNT(*) as Sessions
      FROM StudySessions WHERE CreatedAt >= DATEADD(day,-29,GETDATE())
      GROUP BY CAST(CreatedAt AS DATE) ORDER BY D
    `);
    const days = ['CN','T2','T3','T4','T5','T6','T7'];
    const today = new Date();
    const data = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - 29 + i);
      const ds = d.toISOString().split('T')[0];
      const found = res.data?.find((r: any) => r.D?.split('T')[0] === ds);
      return {
        day: `${d.getDate()}/${d.getMonth()+1}`,
        dayLabel: days[d.getDay()],
        correct: found?.Correct || 0,
        total: found?.Total || 0,
        sessions: found?.Sessions || 0,
        accuracy: found?.Total > 0 ? Math.round((found.Correct / found.Total) * 100) : 0,
      };
    });
    setWeeklyData(data);
  };

  const loadLevels = async () => {
    const res = await dbService.query(`
      SELECT Level, COUNT(*) as Count FROM Words GROUP BY Level ORDER BY Level
    `);
    if (res.success) {
      const data = Array.from({ length: 6 }, (_, i) => {
        const found = res.data?.find((r: any) => r.Level === i);
        return { level: i, label: LEVEL_LABELS[i], count: found?.Count || 0, color: LEVEL_COLORS[i] };
      });
      setLevelData(data);
    }
  };

  const loadGroups = async () => {
    const res = await dbService.query(`
      SELECT g.Name, g.Color, g.Icon,
        COUNT(w.Id) as Total,
        SUM(CASE WHEN w.Level >= 4 THEN 1 ELSE 0 END) as Mastered,
        AVG(CAST(w.Level AS FLOAT)) as AvgLevel
      FROM WordGroups g LEFT JOIN Words w ON w.GroupId = g.Id
      GROUP BY g.Id, g.Name, g.Color, g.Icon ORDER BY Total DESC
    `);
    if (res.success) setGroupData(res.data || []);
  };

  const loadSessions = async () => {
    const res = await dbService.query(`
      SELECT TOP 10 Mode, Score, CorrectWords, TotalWords, DurationSeconds, CreatedAt
      FROM StudySessions ORDER BY CreatedAt DESC
    `);
    if (res.success) setSessionData(res.data || []);
  };

  const masteryPct = stats ? Math.round((stats.masteredWords / Math.max(1, stats.totalWords)) * 100) : 0;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 12, color: 'var(--text-secondary)' }}>
      <div className="spinner" /> Đang phân tích...
    </div>
  );

  return (
    <div className="progress-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tiến Độ Học Tập 📈</h1>
          <p className="page-subtitle">Phân tích chi tiết hành trình học TOEIC của bạn</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadAll}>🔄 Cập nhật</button>
      </div>

      {/* Tabs */}
      <div className="prog-tabs">
        {[['overview','📊 Tổng Quan'],['words','📖 Từ Vựng'],['games','🎮 Game'],['habits','📅 Thói Quen']].map(([t, l]) => (
          <button key={t} className={`prog-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t as any)}>{l}</button>
        ))}
      </div>

      <div className="prog-content">
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            {/* Key metrics */}
            <div className="metrics-grid">
              {[
                { label: 'Tổng Từ Vựng', value: stats?.totalWords || 0, icon: '📖', color: '#6366f1', sub: `${stats?.totalGroups} nhóm` },
                { label: 'Đã Thành Thạo', value: `${masteryPct}%`, icon: '✅', color: '#10b981', sub: `${stats?.masteredWords}/${stats?.totalWords} từ` },
                { label: 'Cần Ôn Hôm Nay', value: stats?.dueWords || 0, icon: '⏰', color: '#f59e0b', sub: 'từ SRS' },
                { label: 'Đúng Hôm Nay', value: stats?.todayCorrect || 0, icon: '🎯', color: '#ec4899', sub: 'lần' },
                { label: 'Tổng Phiên Học', value: stats?.totalSessions || 0, icon: '📝', color: '#a855f7', sub: 'phiên' },
                { label: 'Độ Chính Xác TB', value: `${stats?.avgAccuracy || 0}%`, icon: '🎯', color: '#14b8a6', sub: 'trung bình' },
              ].map((m, i) => (
                <div key={i} className="metric-card" style={{ '--mc': m.color } as any}>
                  <div className="metric-icon">{m.icon}</div>
                  <div className="metric-value" style={{ color: m.color }}>{m.value.toLocaleString()}</div>
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-sub">{m.sub}</div>
                  <div className="metric-glow" />
                </div>
              ))}
            </div>

            {/* Mastery ring + Weekly */}
            <div className="prog-row">
              <div className="card">
                <h3 className="card-title">📊 Hoạt Động 30 Ngày</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyData.slice(-14)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1a1a35', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="correct" name="Đúng" fill="#6366f1" radius={[3,3,0,0]} />
                    <Bar dataKey="total" name="Tổng" fill="rgba(99,102,241,0.2)" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h3 className="card-title">🎯 Phân Bổ Cấp Độ</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={levelData.filter(d => d.count > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="count" nameKey="label">
                      {levelData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1a1a35', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: 12 }} formatter={(v: any, n: any, p: any) => [v + ' từ', p.payload.label]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {levelData.map(d => d.count > 0 && (
                    <div key={d.level} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{d.label}: {d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── WORDS ── */}
        {tab === 'words' && (
          <>
            {/* Level breakdown */}
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 className="card-title">📚 Chi Tiết Cấp Độ Từ Vựng (SRS)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {levelData.map(d => (
                  <div key={d.level} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 80, fontSize: 12, color: d.color, fontWeight: 600 }}>{d.label}</div>
                    <div style={{ flex: 1, height: 20, background: 'var(--bg-secondary)', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', background: d.color, width: `${stats?.totalWords ? (d.count / stats.totalWords) * 100 : 0}%`, borderRadius: 10, transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ width: 60, fontSize: 12, textAlign: 'right', color: 'var(--text-secondary)' }}>{d.count} từ</div>
                    <div style={{ width: 40, fontSize: 11, color: 'var(--text-muted)' }}>{stats?.totalWords ? Math.round((d.count / stats.totalWords) * 100) : 0}%</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: 14, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📅 Lịch ôn SRS</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 2 }}>
                  {['Mới → 1 ngày', 'Cơ bản → 3 ngày', 'Đang học → 7 ngày', 'Quen → 14 ngày', 'Thuộc → 30 ngày', 'Thành thạo → 90 ngày'].map(t => (
                    <div key={t}>• {t}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Groups */}
            <div className="card">
              <h3 className="card-title">📁 Tiến Độ Theo Nhóm</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                {groupData.map((g: any, i) => {
                  const pct = g.Total > 0 ? Math.round((g.Mastered / g.Total) * 100) : 0;
                  return (
                    <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 10, border: `1px solid ${g.Color}33` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>{g.Icon}</span>
                        <span style={{ fontWeight: 600, flex: 1 }}>{g.Name}</span>
                        <span style={{ fontSize: 13, color: g.Color, fontWeight: 700 }}>{pct}% thuộc</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.Mastered}/{g.Total} từ</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: g.Color, width: `${pct}%`, borderRadius: 4, transition: 'width 0.8s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── GAMES ── */}
        {tab === 'games' && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 className="card-title">🏆 Điểm Cao Nhất</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
                {[
                  { game: '⌨️ Typing Race', score: stats?.bestTyping || 0, color: '#6366f1' },
                  { game: '⚔️ Đánh Quái',   score: stats?.bestMonster || 0, color: '#10b981' },
                  { game: '🧟 Zombie',       score: stats?.bestZombie || 0, color: '#ef4444' },
                  { game: '🎯 Sniper',       score: stats?.bestSniper || 0, color: '#f59e0b' },
                ].map((g, i) => (
                  <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, textAlign: 'center', border: `1px solid ${g.color}33` }}>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>{g.game}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: g.color, fontFamily: 'monospace' }}>{g.score.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">📋 Lịch Sử Phiên Học Gần Đây</h3>
              <div style={{ marginTop: 12 }}>
                {sessionData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Chưa có phiên học nào</div>
                ) : sessionData.map((s: any, i) => {
                  const acc = s.TotalWords > 0 ? Math.round((s.CorrectWords / s.TotalWords) * 100) : 0;
                  const modeIcon: any = { flashcard: '🃏', typing: '⌨️', monster: '⚔️', zombie: '🧟', sniper: '🎯' };
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ fontSize: 18 }}>{modeIcon[s.Mode] || '📖'}</span>
                      <span style={{ textTransform: 'capitalize', flex: 1, fontWeight: 500 }}>{s.Mode}</span>
                      <span style={{ color: '#10b981' }}>✅ {s.CorrectWords}/{s.TotalWords}</span>
                      <span style={{ color: acc >= 80 ? '#10b981' : acc >= 60 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>{acc}%</span>
                      <span style={{ color: '#6366f1', fontFamily: 'monospace' }}>+{s.Score}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(s.CreatedAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── HABITS ── */}
        {tab === 'habits' && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 className="card-title">📅 Heatmap Hoạt Động 30 Ngày</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
                {weeklyData.map((d, i) => {
                  const intensity = d.correct === 0 ? 0 : d.correct < 5 ? 1 : d.correct < 15 ? 2 : d.correct < 30 ? 3 : 4;
                  const colors = ['#1a1a35', '#312e81', '#4338ca', '#6366f1', '#818cf8'];
                  return (
                    <div key={i} title={`${d.day}: ${d.correct} từ đúng`} style={{ width: 24, height: 24, borderRadius: 4, background: colors[intensity], cursor: 'default', transition: 'transform 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>Ít hơn</span>
                {['#1a1a35','#312e81','#4338ca','#6366f1','#818cf8'].map(c => <div key={c} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />)}
                <span>Nhiều hơn</span>
              </div>
            </div>

            <div className="prog-row">
              <div className="card">
                <h3 className="card-title">📈 Xu Hướng Chính Xác</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={weeklyData.filter(d => d.total > 0)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1a1a35', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => [`${v}%`, 'Chính xác']} />
                    <Line type="monotone" dataKey="accuracy" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h3 className="card-title">💡 Gợi Ý Học Tập</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {[
                    stats?.dueWords && stats.dueWords > 0 ? { icon: '⏰', text: `Có ${stats.dueWords} từ cần ôn hôm nay theo SRS`, color: '#f59e0b' } : null,
                    masteryPct < 50 ? { icon: '📚', text: 'Mục tiêu: Đạt 50% từ vựng ở cấp "Thuộc" trở lên', color: '#6366f1' } : null,
                    stats?.avgAccuracy && stats.avgAccuracy < 70 ? { icon: '🎯', text: 'Độ chính xác thấp — hãy ôn lại từ chưa thuộc', color: '#ef4444' } : null,
                    { icon: '🔥', text: 'Học đều đặn mỗi ngày hiệu quả hơn học dồn', color: '#10b981' },
                    { icon: '🎮', text: 'Chơi game sau flashcard để ghi nhớ sâu hơn', color: '#a855f7' },
                  ].filter(Boolean).map((tip: any, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: `${tip.color}15`, borderRadius: 8, border: `1px solid ${tip.color}30` }}>
                      <span style={{ fontSize: 18 }}>{tip.icon}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{tip.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .progress-page { padding-bottom: 32px; }
        .prog-tabs { display: flex; gap: 4; padding: 16px 32px 0; border-bottom: 1px solid var(--border); }
        .prog-tab { padding: 10px 20px; border: none; background: none; color: var(--text-secondary); font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.2s; }
        .prog-tab:hover { color: var(--text-primary); }
        .prog-tab.active { color: var(--accent-bright); border-bottom-color: var(--accent); }
        .prog-content { padding: 24px 32px; display: flex; flex-direction: column; gap: 16px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
        .metric-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 12px; position: relative; overflow: hidden; text-align: center; transition: border-color 0.2s; }
        .metric-card:hover { border-color: var(--mc); }
        .metric-icon { font-size: 24px; margin-bottom: 8px; }
        .metric-value { font-size: 24px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
        .metric-label { font-size: 12px; font-weight: 500; margin-top: 4px; }
        .metric-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .metric-glow { position: absolute; bottom: -20px; right: -20px; width: 60px; height: 60px; background: var(--mc); border-radius: 50%; filter: blur(20px); opacity: 0.15; }
        .prog-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .card-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .spinner { width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
