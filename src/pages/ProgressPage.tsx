// src/pages/ProgressPage.tsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
import { LayoutDashboard, BookMarked, Gamepad2, CalendarDays, AlarmClock, Target, Flame } from 'lucide-react';
import { db, dbService } from '../services/database';
import './ProgressPage.css';
import './ProgressOrbit.css';

function ProgressPuzzle({ percent }: { percent: number }) {
  const total = 12;
  const complete = Math.round(total * percent / 100);
  const offsets = [0, 0, 0, 3, -4, 5, 2, -3, 4, -5, 3, -2];
  const point = (radius: number, angle: number) => {
    const radians = (angle - 90) * Math.PI / 180;
    return `${(80 + radius * Math.cos(radians)).toFixed(2)} ${(80 + radius * Math.sin(radians)).toFixed(2)}`;
  };
  return <svg className="lf-progress-puzzle" viewBox="0 0 160 160" role="img" aria-label={`Vòng ghép tiến độ: ${percent}% đã hoàn thiện`}>
    {Array.from({ length: total }, (_, index) => {
      const start = index * 30 + 2.2;
      const end = index * 30 + 27.8;
      const middle = (start + end) / 2;
      const finished = index < complete;
      const offset = finished ? 0 : offsets[index];
      const radians = (middle - 90) * Math.PI / 180;
      const transform = `translate(${(offset * Math.cos(radians)).toFixed(2)} ${(offset * Math.sin(radians)).toFixed(2)})`;
      return <g key={index} className={finished ? 'complete' : 'unfinished'} transform={transform}>
        <path className="piece" d={`M ${point(73, start)} A 73 73 0 0 1 ${point(73, end)} L ${point(48, end)} A 48 48 0 0 0 ${point(48, start)} Z`} />
        {!finished && percent > 0 && <path className="crack" d={`M ${point(49, middle - 5)} L ${point(56, middle + 3)} L ${point(63, middle - 4)} L ${point(71, middle + 4)}`} />}
      </g>;
    })}
    <circle cx="80" cy="80" r="42" className="core" />
    <text x="80" y="86" textAnchor="middle" className="number">{percent}%</text>
  </svg>;
}
import './ProgressApproved.css';
import { useApp } from '../App';

interface Stats {
  totalWords: number; masteredWords: number; dueWords: number;
  totalGroups: number; totalSessions: number; totalCorrect: number;
  bestTyping: number; bestMonster: number; bestZombie: number; bestSniper: number;
  streak: number; todayCorrect: number; avgAccuracy: number;
}

const LEVEL_COLORS = ['#475569','#f59e0b','#f97316','#10b981','#6366f1','#ec4899'];
const LEVEL_LABELS = ['Mới','Cơ bản','Đang học','Quen','Thuộc','Thành thạo'];

export default function ProgressPage() {
  const { setPage } = useApp();
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
        (SELECT COUNT(*) FROM Words WHERE NextReview <= datetime('now')) as DueWords,
        (SELECT COUNT(*) FROM WordGroups) as TotalGroups,
        (SELECT COUNT(*) FROM StudySessions) as TotalSessions,
        (SELECT COALESCE(SUM(CorrectWords),0) FROM StudySessions) as TotalCorrect,
        (SELECT COALESCE(MAX(Score),0) FROM GameScores WHERE GameType='typing') as BestTyping,
        (SELECT COALESCE(MAX(Score),0) FROM GameScores WHERE GameType='monster') as BestMonster,
        (SELECT COALESCE(MAX(Score),0) FROM GameScores WHERE GameType='zombie') as BestZombie,
        (SELECT COALESCE(MAX(Score),0) FROM GameScores WHERE GameType='sniper') as BestSniper,
        (SELECT COALESCE(SUM(CorrectWords),0) FROM StudySessions WHERE date(CreatedAt) = date('now')) as TodayCorrect,
        (SELECT COALESCE(AVG(CAST(CorrectWords AS REAL)/NULLIF(TotalWords,0)*100),0) FROM StudySessions WHERE TotalWords > 0) as AvgAccuracy
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
      SELECT date(CreatedAt) as D, SUM(CorrectWords) as Correct, SUM(TotalWords) as Total, COUNT(*) as Sessions
      FROM StudySessions WHERE CreatedAt >= datetime('now','-29 days')
      GROUP BY date(CreatedAt) ORDER BY D
    `);
    const days = ['CN','T2','T3','T4','T5','T6','T7'];
    const today = new Date();
    const data = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - 29 + i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
      SELECT Mode, Score, CorrectWords, TotalWords, DurationSeconds, CreatedAt
      FROM StudySessions ORDER BY CreatedAt DESC LIMIT 10
    `);
    if (res.success) setSessionData(res.data || []);
  };

  const masteryPct = stats ? Math.round((stats.masteredWords / Math.max(1, stats.totalWords)) * 100) : 0;
  const nextMilestone = stats?.totalWords ? Math.min(stats.totalWords, Math.max(4, Math.pow(2, Math.ceil(Math.log2(Math.max(4, (stats.masteredWords || 0) + 1)))))) : 4;
  const stageData = [
    { label: 'Mới gặp', symbol: '✧', tone: 'fresh', count: levelData[0]?.count || 0 },
    { label: 'Cơ bản', symbol: '◈', tone: 'basic', count: levelData[1]?.count || 0 },
    { label: 'Đang học', symbol: '↗', tone: 'learning', count: (levelData[2]?.count || 0) + (levelData[3]?.count || 0) },
    { label: 'Đã thuộc', symbol: '✦', tone: 'known', count: (levelData[4]?.count || 0) + (levelData[5]?.count || 0) },
  ];
  const recent14 = weeklyData.slice(-14);
  const recentCorrect = recent14.reduce((sum, day) => sum + (day.correct || 0), 0);
  const activeDays = weeklyData.filter(day => day.sessions > 0).length;
  const monthCorrect = weeklyData.reduce((sum, day) => sum + (day.correct || 0), 0);
  const monthTotal = weeklyData.reduce((sum, day) => sum + (day.total || 0), 0);
  const monthAccuracy = monthTotal ? Math.round(monthCorrect / monthTotal * 100) : 0;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 12, color: 'var(--text-secondary)' }}>
      <div className="spinner" /> Đang phân tích...
    </div>
  );

  return (
    <div className="progress-page">
      <div className="lf-progress-topbar"><strong>Tiến độ học</strong><span>Hành trình của bạn, từng ngày một</span></div>
      <header className="lf-progress-hero"><div className="lf-progress-hero-copy"><span className="lf-progress-eyebrow">● BẢN ĐỒ HÀNH TRÌNH</span><h1>Bạn đang <em>tiến lên.</em><br /><span>Từng từ một.</span></h1><p>{stats?.totalWords || 0} từ trong thư viện · {stats?.masteredWords || 0} từ đã thuộc · {stats?.dueWords || 0} từ chờ ôn hôm nay</p><div className="lf-progress-milestone"><span>✦</span><div><strong>Cột mốc tiếp theo: thuộc {nextMilestone} từ</strong><small>Còn {Math.max(0, nextMilestone - (stats?.masteredWords || 0))} từ nữa để chạm mốc.</small></div></div></div><div className="lf-progress-orbit"><div className="lf-progress-ring" style={{ background: `conic-gradient(#ffd16e ${masteryPct}%, #aebfc5 ${masteryPct}%, #aebfc5 100%)` }}><div><small>ĐÃ THUỘC</small><strong>{masteryPct}<em>%</em></strong><span>{stats?.masteredWords || 0} TRONG {stats?.totalWords || 0} TỪ</span></div></div><i className="star s1">✦</i><i className="star s2">✦</i><i className="star s3">✦</i><i className="star s4">✦</i><i className="star s5">✦</i><i className="star s6">✦</i></div><div className="lf-progress-today"><small>● TRỌNG TÂM HÔM NAY</small><div><strong>{stats?.dueWords || 0}</strong> <span>từ</span></div><b>đang đến lượt ôn</b><hr /><p>✦ &nbsp;Ôn xong hôm nay, bạn sẽ giữ vững nhịp học của mình.</p><button onClick={() => { sessionStorage.setItem('lexforge-flashcard-intent', 'due'); setPage('flashcard'); }}>Ôn bằng Flashcard ↗</button></div></header>
      <div className="lf-progress-journey"><div><span>◈</span><div><small>TIẾN ĐỘ TỪ VỰNG</small><strong>Hành trình ghi nhớ</strong></div><b>{stats?.masteredWords || 0} <small>/ {stats?.totalWords || 0} từ</small></b></div><div className="lf-progress-journey-track"><i style={{ width: `${Math.max(0, Math.min(100, masteryPct))}%` }} />{[['✓','Bắt đầu'],[String(stats?.masteredWords || 0),'Hôm nay'],[String(nextMilestone),'Mốc đầu'],[String(stats?.totalWords || 0),'Thuộc hết']].map(([number,label], index) => <span key={index} className={index < 2 ? 'done' : ''}><b>{number}</b><small>{label}</small></span>)}</div></div>
      {/* Tabs */}
      <div className="prog-tabs" role="tablist" aria-label="Các phần tiến độ học">
        {[
          { id: 'overview' as const, label: 'Tổng quan', detail: 'Bức tranh học tập', Icon: LayoutDashboard, number: '01' },
          { id: 'words' as const, label: 'Từ vựng', detail: 'Từng cấp độ ghi nhớ', Icon: BookMarked, number: '02' },
          { id: 'games' as const, label: 'Trò chơi', detail: 'Điểm và phiên luyện', Icon: Gamepad2, number: '03' },
          { id: 'habits' as const, label: 'Thói quen', detail: 'Nhịp học mỗi ngày', Icon: CalendarDays, number: '04' },
        ].map(({ id, label, detail, Icon, number }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`prog-tab prog-tab-${id} ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <span className="lf-prog-tab-icon"><Icon size={24} strokeWidth={2}/></span>
            <span className="lf-prog-tab-copy"><strong>{label}</strong><small>{detail}</small></span>
            <span className="lf-prog-tab-number" aria-hidden="true">{number}</span>
          </button>
        ))}
      </div>

      <div className="prog-content">
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <div className="lf-progress-overview"><div className="lf-progress-overview-heading"><div><span>TỔNG QUAN · 14 NGÀY</span><h2>Nhịp học của bạn</h2><p>Một cái nhìn rõ ràng vào nỗ lực và kết quả gần đây.</p></div><b>14 ngày gần đây</b></div><div className="lf-progress-insights">{[
              ['cyan','▤',stats?.totalWords || 0,'từ','Đang học',`trong ${stats?.totalGroups || 0} nhóm từ`],
              ['mint','✓',stats?.masteredWords || 0,'từ','Đã thuộc',`${masteryPct}% thư viện`],
              ['amber','◷',stats?.dueWords || 0,'từ','Cần ôn','đang đến lượt'],
              ['lilac','◎',stats?.avgAccuracy || 0,'%','Chính xác','trung bình phiên học'],
            ].map(([tone,icon,value,unit,label,note]) => <div key={String(tone)} className={`lf-progress-insight ${tone}`}><span>{icon}</span><strong>{String(value).padStart(2,'0')}<small>{unit}</small></strong><b>{label}</b><p>{note}</p></div>)}</div><div className="lf-progress-analytics"><article className="lf-progress-trend"><span>NHỊP HỌC</span><h3>Hôm nào bạn học tốt nhất?</h3><p>Mỗi điểm là số lượt trả lời đúng trong một ngày.</p><div className="lf-progress-trend-total"><b>{recentCorrect}</b><small>lượt đúng trong 14 ngày</small></div><ResponsiveContainer width="100%" height={235}><LineChart data={recent14} margin={{top:20,right:18,left:-20,bottom:0}}><XAxis dataKey="day" tick={{fill:'#7292a1',fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#7292a1',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#123c53',color:'#fff',border:'1px solid #4a8798',borderRadius:8}}/><Line type="monotone" dataKey="correct" stroke="#34c6cc" strokeWidth={3} dot={{r:4,fill:'#ffd16e'}}/></LineChart></ResponsiveContainer><small>● Lượt trả lời đúng</small></article><article className="lf-progress-stages"><span>BẢN ĐỒ GHI NHỚ</span><h3>{stats?.totalWords || 0} từ đang ở đâu?</h3><div className="lf-progress-mastery"><div><small>CHẶNG ĐÃ CHINH PHỤC</small><strong>{stats?.masteredWords || 0}<em> / {stats?.totalWords || 0} từ</em></strong><b>Đã thuộc · {masteryPct}%</b></div><ProgressPuzzle percent={masteryPct} /></div><div className="lf-progress-stage-tiles">{stageData.map(stage => <div className={`lf-progress-stage ${stage.tone}`} key={stage.tone}><span>{stage.symbol}<b>{String(stage.count).padStart(2,'0')}</b></span><strong>{stage.label}</strong><i><em style={{width:`${stats?.totalWords ? stage.count / stats.totalWords * 100 : 0}%`}}/></i></div>)}</div></article></div></div>
          </>
        )}

        {/* ── WORDS ── */}
        {tab === 'words' && (
          <>
            <div className="lf-progress-detail-head"><span>02 / TỪ VỰNG</span><h2>Từ đang tiến bộ ra sao?</h2><p>Theo dõi mức ghi nhớ của từng từ và từng nhóm.</p></div>
            {/* Level breakdown */}
            <div className="card lf-progress-level-card" style={{ marginBottom: 16 }}>
              <div className="lf-progress-panel-intro"><div><span>BẢN ĐỒ TỪ VỰNG</span><h3 className="card-title">Cấp độ ghi nhớ</h3><p>Mỗi thẻ cho biết số từ và tỷ lệ ở một cấp độ.</p></div><strong>{stats?.totalWords || 0}<small> từ trong thư viện</small></strong></div>
              <div className="lf-progress-level-grid">
                {levelData.map((d, index) => {
                  const pct = stats?.totalWords ? Math.round(d.count / stats.totalWords * 100) : 0;
                  const reviewDays = [1, 3, 7, 14, 30, 90][index];
                  return <article className={`lf-progress-level-tile level-${index}`} key={d.level}>
                    <div className="lf-progress-level-top"><span>{String(index + 1).padStart(2, '0')}</span><b>{pct}%</b></div>
                    <strong>{d.count}<small> từ</small></strong>
                    <h4>{d.label}</h4>
                    <div className="lf-progress-level-track" aria-label={`${pct}% số từ ở cấp ${d.label}`}><i style={{ width: `${pct}%` }} /></div>
                    <p>Ôn lại sau <b>{reviewDays} ngày</b></p>
                  </article>;
                })}
              </div>
            </div>

            {/* Groups */}
            <div className="card lf-progress-groups-card">
              <div className="lf-progress-panel-intro"><div><span>THEO CHỦ ĐỀ</span><h3 className="card-title">Tiến độ theo nhóm</h3><p>Nhóm nào đang gần hoàn thành nhất?</p></div><strong>{groupData.length}<small> nhóm từ</small></strong></div>
              <div className="lf-progress-group-grid">
                {groupData.length === 0 && <p className="lf-progress-empty">Chưa có nhóm từ nào. Tạo nhóm và thêm từ để theo dõi tiến độ tại đây.</p>}
                {groupData.map((g: any, i) => {
                  const pct = g.Total > 0 ? Math.round((g.Mastered / g.Total) * 100) : 0;
                  return (
                    <article key={i} className="lf-progress-group-tile" style={{ ['--group-tone' as any]: g.Color || '#0b8299' }}>
                      <div className="lf-progress-group-symbol" aria-hidden="true">{g.Icon || '✦'}</div>
                      <div className="lf-progress-group-copy"><h4>{g.Name}</h4><p><strong>{g.Mastered || 0}</strong> / {g.Total || 0} từ đã thuộc</p><div className="lf-progress-group-segments" aria-label={`${pct}% từ đã thuộc`}>{Array.from({ length: 10 }, (_, segment) => <i key={segment} className={(segment + 1) * 10 <= pct ? 'filled' : ''} />)}</div></div>
                      <div className="lf-progress-group-percent"><b>{pct}%</b><span>đã thuộc</span></div>
                    </article>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── GAMES ── */}
        {tab === 'games' && (
          <>
            <div className="lf-progress-detail-head"><span>03 / TRÒ CHƠI</span><h2>Thành tích qua từng trận</h2><p>Điểm cao nhất và những phiên học gần đây của bạn.</p></div>
            <div className="card lf-progress-games-card" style={{ marginBottom: 16 }}>
              <h3 className="card-title">Điểm cao nhất</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
                {[
                  { game: '⌨️ Typing Race', score: stats?.bestTyping || 0, color: '#6366f1' },
                  { game: '⚔️ Đánh Quái',   score: stats?.bestMonster || 0, color: '#10b981' },
                  { game: '🧟 Zombie',       score: stats?.bestZombie || 0, color: '#ef4444' },
                  { game: '🎯 Sniper',       score: stats?.bestSniper || 0, color: '#f59e0b' },
                ].map((g, i) => (
                  <div className="lf-progress-game-score" key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, textAlign: 'center', border: `1px solid ${g.color}33`, ['--score-tone' as any]: g.color }}>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>{g.game}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: g.color, fontFamily: 'monospace' }}>{g.score.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card lf-progress-sessions-card">
              <h3 className="card-title">Phiên học gần đây</h3>
              <div style={{ marginTop: 12 }}>
                {sessionData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Chưa có phiên học nào</div>
                ) : sessionData.map((s: any, i) => {
                  const acc = s.TotalWords > 0 ? Math.round((s.CorrectWords / s.TotalWords) * 100) : 0;
                  const modeIcon: any = { flashcard: '🃏', typing: '⌨️', monster: '⚔️', zombie: '🧟', sniper: '🎯' };
                  return (
                    <div className="lf-progress-session" key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
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
            <div className="lf-progress-detail-head"><span>04 / THÓI QUEN</span><h2>Nhịp học của bạn</h2><p>Nhìn lại những ngày đã luyện và giữ nhịp cho ngày tiếp theo.</p></div>
            <div className="card lf-progress-heatmap-card" style={{ marginBottom: 16 }}>
              <div className="lf-progress-panel-intro"><div><span>LỊCH HỌC 30 NGÀY</span><h3 className="card-title">Nhịp học của bạn</h3><p>Mỗi ô là một ngày. Màu đậm hơn khi bạn trả lời đúng nhiều hơn.</p></div></div>
              <div className="lf-progress-habit-stats"><div><strong>{activeDays}</strong><span>ngày có học</span></div><div><strong>{monthCorrect}</strong><span>lượt trả lời đúng</span></div><div><strong>{monthAccuracy}%</strong><span>chính xác</span></div></div>
              <div className="lf-progress-calendar" role="list" aria-label="Hoạt động học tập trong 30 ngày">
                {weeklyData.map((d, i) => {
                  const intensity = d.correct === 0 ? 0 : d.correct < 5 ? 1 : d.correct < 15 ? 2 : d.correct < 30 ? 3 : 4;
                  return (
                    <div className={`lf-progress-day intensity-${intensity}`} role="listitem" key={i} title={`${d.day}: ${d.correct} lượt đúng`}>
                      <span>{d.day}</span><b>{d.correct ? d.correct : '—'}</b><small>{d.correct ? 'lượt đúng' : 'chưa học'}</small>
                    </div>
                  );
                })}
              </div>
              <div className="lf-progress-calendar-key"><span>Ít hoạt động</span>{[0,1,2,3,4].map(level => <i className={`intensity-${level}`} key={level}/>)}<span>Nhiều hoạt động</span></div>
            </div>

            <div className="prog-row">
              <div className="card">
                <h3 className="card-title">Xu hướng chính xác</h3>
                {monthTotal === 0 ? <div className="lf-progress-chart-empty"><span>◌</span><strong>Chưa có dữ liệu để vẽ xu hướng</strong><p>Hoàn thành một phiên học, đường biểu diễn sẽ xuất hiện ở đây.</p></div> : <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={weeklyData.filter(d => d.total > 0)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#10445c', color: '#fff', border: '1px solid #72b9c7', borderRadius: 9, fontSize: 13 }}
                      formatter={(v: any) => [`${v}%`, 'Chính xác']} />
                    <Line type="monotone" dataKey="accuracy" stroke="#0b9f92" strokeWidth={3} dot={{ r: 4, fill: '#ffd16e', stroke: '#0b826e', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>}
              </div>

              <div className="card">
                <h3 className="card-title">Gợi ý học tập</h3>
                <div className="lf-progress-tips">
                  {[
                    stats?.dueWords && stats.dueWords > 0 ? { Icon: AlarmClock, title: 'Ôn từ đến hạn', text: `${stats.dueWords} từ đang chờ bạn ôn hôm nay.`, tone: 'amber' } : null,
                    masteryPct < 50 ? { Icon: BookMarked, title: 'Chạm mốc 50%', text: 'Tiếp tục đưa từ lên cấp Đã thuộc.', tone: 'blue' } : null,
                    stats?.avgAccuracy && stats.avgAccuracy < 70 ? { Icon: Target, title: 'Luyện lại từ khó', text: 'Ôn các từ chưa thuộc để tăng độ chính xác.', tone: 'coral' } : null,
                    { Icon: Flame, title: 'Giữ nhịp mỗi ngày', text: 'Một phiên ngắn đều đặn giúp nhớ lâu hơn.', tone: 'mint' },
                    { Icon: Gamepad2, title: 'Luyện qua trò chơi', text: 'Chơi sau Flashcard để gọi lại từ nhanh hơn.', tone: 'violet' },
                  ].filter(Boolean).map((tip: any, i) => (
                    <div className={`lf-progress-tip ${tip.tone}`} key={i}><span><tip.Icon size={22} strokeWidth={2.2}/></span><div><strong>{tip.title}</strong><p>{tip.text}</p></div></div>
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
