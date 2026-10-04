import React, { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, CheckCircle2, Clock3, Target, BookMarked, BadgeCheck, CalendarClock, Crosshair, Layers, Keyboard, Swords, CalendarDays, ArrowRight, Sparkles, Moon, Sun, TrendingUp } from 'lucide-react';
import { db, getScheduleSummary } from '../services/database';
import { aiVocabService, DEFAULT_TOPICS } from '../services/aiVocabService';
import { useApp } from '../App';
import { AppStats, Page } from '../types';
import './Dashboard.css';
import './DashboardApproved.css';

type WeekDay = { day: string; correct: number; total: number };
type AiBanner = { status: 'generating' | 'success'; topic: string; category: string; count?: number };

export default function Dashboard({ onInitialLoad }: { onInitialLoad?: () => void }) {
  const { setPage, refreshTrigger, theme, setTheme } = useApp();
  const [stats, setStats] = useState<AppStats | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeekDay[]>([]);
  const [scheduleSummary, setScheduleSummary] = useState<any>(null);
  const [dailyVocabBanner, setDailyVocabBanner] = useState<AiBanner | null>(null);
  const [loading, setLoading] = useState(true);
  const dark = theme === 'dark';

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [statsRes, weeklyRes, summary] = await Promise.all([db.getStats(), db.getWeeklyStats(), getScheduleSummary()]);
        if (!active) return;
        if (statsRes.success && statsRes.data?.[0]) setStats(statsRes.data[0]);
        if (weeklyRes.success) {
          const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
          const now = new Date();
          setWeeklyData(Array.from({ length: 7 }, (_, index) => {
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const found = weeklyRes.data?.find(row => row.StudyDate?.slice(0, 10) === dateKey);
            return { day: labels[date.getDay()], correct: found?.Correct || 0, total: found?.Total || 0 };
          }));
        }
        setScheduleSummary(summary);
      } catch (error) {
        console.error('Không tải được dữ liệu Dashboard:', error);
      } finally {
        if (active) {
          setLoading(false);
          onInitialLoad?.();
        }
      }
    };
    load();
    return () => { active = false; };
  }, [refreshTrigger]);

  useEffect(() => {
    let active = true;
    const generate = async () => {
      try {
        const autoRes = await db.getSetting('auto_daily_vocab');
        const enabled = autoRes.success && autoRes.data?.[0] ? autoRes.data[0].SettingValue === 'true' : true;
        if (!enabled) return;
        const today = new Date().toISOString().slice(0, 10);
        const lastDateRes = await db.getSetting('last_daily_vocab_date');
        if (lastDateRes.data?.[0]?.SettingValue === today) return;
        const keyRes = await db.getSetting('groq_api_key');
        if (!keyRes.data?.[0]?.SettingValue?.trim()) return;
        const catRes = await db.getSetting('daily_vocab_category');
        const category = catRes.data?.[0]?.SettingValue || 'toeic';
        const topics = DEFAULT_TOPICS[category] || DEFAULT_TOPICS.toeic;
        const topic = topics[Math.floor(Math.random() * topics.length)];
        if (active) setDailyVocabBanner({ status: 'generating', topic, category });
        const words = await aiVocabService.generateWords(category, topic);
        const saved = await aiVocabService.saveGeneratedWordsToDb(category, topic, words);
        if (!active) return;
        if (saved.success) {
          await db.setSetting('last_daily_vocab_date', today);
          setDailyVocabBanner({ status: 'success', topic, category, count: words.length });
          const refreshed = await db.getStats();
          if (refreshed.success && refreshed.data?.[0] && active) setStats(refreshed.data[0]);
        } else setDailyVocabBanner(null);
      } catch (error) {
        console.error('Không tạo được từ vựng hằng ngày:', error);
        if (active) setDailyVocabBanner(null);
      }
    };
    generate();
    return () => { active = false; };
  }, []);

  const toggleTheme = () => setTheme(dark ? 'light' : 'dark');
  const goToDueReview = () => {
    sessionStorage.setItem('lexforge-flashcard-intent', 'due');
    setPage('flashcard');
  };
  const go = (page: Page) => setPage(page);
  const total = stats?.TotalWords || 0;
  const mastered = stats?.MasteredWords || 0;
  const due = stats?.DueWords || 0;
  const weeklyCorrect = weeklyData.reduce((sum, day) => sum + day.correct, 0);
  const hasActivity = weeklyData.some(day => day.total > 0);
  const bestDay = weeklyData.reduce<WeekDay | null>((best, day) => !best || day.correct > best.correct ? day : best, null);

  if (loading) return <div className="lf-dashboard-loading"><span />Đang tải dữ liệu học tập...</div>;

  return <div className={`lf-dashboard${dark ? ' dark' : ''}`}>
    <header className="lf-dash-topbar"><div><span>KHÔNG GIAN HỌC TẬP</span><b>Dashboard</b></div><button type="button" onClick={toggleTheme} aria-label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}>{dark ? <Sun size={18} /> : <Moon size={18} />}{dark ? 'Sáng' : 'Tối'}</button></header>
    <div className="lf-dash-content">
      <div className="lf-dash-heading"><div><span className="lf-dash-eyebrow">TỔNG QUAN HỌC TẬP</span><h1>Hôm nay mình học gì?</h1><p>Một bước nhỏ mỗi ngày giúp bạn nhớ từ lâu hơn.</p></div><button type="button" className="lf-dash-link" onClick={() => go('progress')}>Xem tiến độ chi tiết <ArrowRight size={16} /></button></div>

      <section className="lf-dash-today"><div><small>VIỆC CẦN LÀM HÔM NAY</small><h2>{total === 0 ? 'Bắt đầu thư viện từ của bạn' : due > 0 ? `Bạn có ${due} từ cần ôn` : 'Hôm nay bạn đã theo kịp lịch ôn'}</h2><p>{total === 0 ? 'Tạo nhóm và thêm những từ đầu tiên để bắt đầu hành trình ghi nhớ.' : due > 0 ? 'Bắt đầu với những từ đến hạn để giữ nhịp học. Bạn có thể xem danh sách trước khi ôn.' : 'Bạn có thể tiếp tục luyện tập hoặc thêm từ mới vào thư viện.'}</p></div><div className="lf-dash-today-actions"><button type="button" className="lf-dash-primary" onClick={total === 0 ? () => go('groups') : due > 0 ? goToDueReview : () => go('vocabulary')}>{total === 0 ? 'Tạo nhóm từ' : due > 0 ? 'Bắt đầu ôn' : 'Học từ mới'} <ArrowRight size={16} /></button><button type="button" className="lf-dash-ghost" onClick={() => go('schedule')}>Xem lịch ôn</button></div></section>

      {dailyVocabBanner && <section className={`lf-dash-ai ${dailyVocabBanner.status}`}><span className="lf-dash-ai-icon"><Sparkles size={23} /></span><div><b>{dailyVocabBanner.status === 'generating' ? 'AI đang chuẩn bị từ mới hôm nay' : 'AI đã thêm từ mới hôm nay'}</b><span>{dailyVocabBanner.category.toUpperCase()} · Chủ đề {dailyVocabBanner.topic}</span></div><strong className="lf-dash-ai-count">{dailyVocabBanner.status === 'success' ? `${dailyVocabBanner.count} từ mới` : 'Đang tạo'}</strong>{dailyVocabBanner.status === 'success' && <button type="button" className="lf-dash-link" onClick={() => go('groups')}>Xem nhóm <ArrowRight size={15} /></button>}</section>}

      <div className="lf-dash-section-head"><h2>Tổng quan của bạn</h2><span>Cập nhật từ dữ liệu học tập</span></div>
      <section className="lf-dash-stat-grid" aria-label="Các chỉ số học tập">
        {[
          { label: 'Tổng từ vựng', value: total, note: `Trong ${stats?.TotalGroups || 0} nhóm từ`, icon: BookMarked, tone: 'blue' },
          { label: 'Đã thuộc', value: mastered, note: `${total ? Math.round(mastered / total * 100) : 0}% tổng số từ`, icon: BadgeCheck, tone: 'green' },
          { label: 'Cần ôn hôm nay', value: due, note: 'Những từ đến lúc ôn lại', icon: CalendarClock, tone: 'amber' },
          { label: 'Đúng hôm nay', value: stats?.TodayCorrect || 0, note: 'Lần trả lời đúng', icon: Crosshair, tone: 'pink' }
        ].map(item => <div className={`lf-dash-stat ${item.tone}`} key={item.label}><div className="lf-dash-stat-top"><span className="lf-dash-stat-icon"><item.icon size={25} strokeWidth={2} /></span><span>{item.label}</span></div><strong>{item.value.toLocaleString('vi-VN')}</strong><small>{item.note}</small></div>)}
      </section>

      <div className="lf-dash-grid-main">
        <section className="lf-dash-panel"><div className="lf-dash-panel-head"><div><h2>Hoạt động 7 ngày</h2><p>Mỗi cột cho thấy tổng lượt luyện và số câu đúng</p></div><TrendingUp size={20} /></div><div className="lf-dash-chart-highlight"><strong>{weeklyCorrect}</strong><span>câu trả lời đúng trong 7 ngày{hasActivity && bestDay ? <><br/><b>Ngày học tốt nhất: {bestDay.day}</b></> : null}</span></div>{hasActivity ? <div className="lf-dash-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><XAxis dataKey="day" tick={{ fill: dark ? '#aec4cf' : '#5b7180', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: dark ? '#aec4cf' : '#5b7180', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: dark ? '#132a39' : '#fff', color: dark ? '#eaf5f8' : '#10293b', border: '1px solid #a8cbd6', borderRadius: 9 }} /><Bar dataKey="total" name="Tổng" fill={dark ? '#31596c' : '#b3d7e2'} radius={[4,4,0,0]} /><Bar dataKey="correct" name="Đúng" fill={dark ? '#65c9e8' : '#0b7898'} radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div> : <div className="lf-dash-chart-empty"><b>Chưa có hoạt động trong 7 ngày</b><span>Ôn vài từ để bắt đầu biểu đồ của bạn.</span><button type="button" onClick={() => go('flashcard')}>Mở Flashcard <ArrowRight size={14} /></button></div>}<button type="button" className="lf-dash-link" onClick={() => go('progress')}>Xem phân tích 30 ngày <ArrowRight size={15} /></button></section>
        <section className="lf-dash-panel"><div className="lf-dash-panel-head"><div><h2>Truy cập nhanh</h2><p>Chọn cách học bạn muốn bắt đầu</p></div></div><div className="lf-dash-actions">{[
          { page: 'flashcard' as Page, label: 'Flashcard', description: 'Lật thẻ ôn từ', icon: Layers },
          { page: 'typing-game' as Page, label: 'Gõ chữ tốc độ', description: 'Gõ chữ tích điểm', icon: Keyboard },
          { page: 'monster-game' as Page, label: 'Đánh quái', description: 'Game từ vựng', icon: Swords },
          { page: 'vocabulary' as Page, label: 'Thêm từ', description: 'Mở rộng bộ từ cá nhân', icon: BookOpen }
        ].map(action => <button type="button" key={action.page} onClick={() => go(action.page)}><span className="lf-dash-action-icon"><action.icon size={21} /></span><span><b>{action.label}</b><small>{action.description}</small></span><ArrowRight size={17} /></button>)}</div></section>
      </div>

      <div className="lf-dash-bottom-grid"><section className="lf-dash-panel"><div className="lf-dash-panel-head"><div><h2>Điểm cao nhất</h2><p>Thành tích trong các trò chơi từ vựng</p></div></div><div className="lf-dash-scores"><div><span><Keyboard size={21} /></span><small>Gõ chữ tốc độ</small><b>{(stats?.BestTypingScore || 0).toLocaleString('vi-VN')}</b></div><i /><div><span><Swords size={21} /></span><small>Đánh quái</small><b>{(stats?.BestMonsterScore || 0).toLocaleString('vi-VN')}</b></div></div></section><section className="lf-dash-panel"><div className="lf-dash-panel-head"><div><h2>Lịch ôn tập AI</h2><p>Ưu tiên những từ có nguy cơ quên</p></div><button type="button" className="lf-dash-link" onClick={() => go('schedule')}>Mở lịch <ArrowRight size={15} /></button></div><div className="lf-dash-schedule"><span><CalendarDays size={25} /></span><div><b>{scheduleSummary?.total > 0 ? `${scheduleSummary.total} từ trong lịch ôn` : 'Chưa có từ cần chú ý'}</b><small>{scheduleSummary?.total > 0 ? 'Xem danh sách và chọn phiên ôn phù hợp' : 'Tiếp tục học để xây dựng lịch ôn của bạn'}</small><div>{scheduleSummary?.urgent > 0 && <em>{scheduleSummary.urgent} cấp tốc</em>}{scheduleSummary?.high_count > 0 && <em>{scheduleSummary.high_count} ưu tiên</em>}</div></div></div></section></div>
    </div>
  </div>;
}
