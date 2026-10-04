import React, { useEffect, useState } from 'react';
import { BookOpen, Layers, Clock3, Sparkles, Sun, Moon, ArrowUpRight, Minus, Plus, Eye, EyeOff, AlertTriangle, BookOpenCheck, Bot, Paintbrush, Database, HelpCircle, Settings2 } from 'lucide-react';
import { db, dbService } from '../services/database';
import ConfirmDialog from '../components/Feedback/ConfirmDialog';
import { notify } from '../components/Feedback/ToastHost';
import { useApp } from '../App';
import './SettingsApproved.css';

type Section = 'learning' | 'ai' | 'appearance' | 'data' | 'about';
const sections = [
  { id: 'learning' as Section, Icon: BookOpenCheck, title: 'Học tập' }, { id: 'ai' as Section, Icon: Bot, title: 'AI & từ mới' },
  { id: 'appearance' as Section, Icon: Paintbrush, title: 'Giao diện' }, { id: 'data' as Section, Icon: Database, title: 'Dữ liệu' }, { id: 'about' as Section, Icon: HelpCircle, title: 'Thông tin' },
];

export default function SettingsPage() {
  const { theme, setTheme } = useApp();
  const [dailyGoal, setDailyGoal] = useState('20');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [autoDailyVocab, setAutoDailyVocab] = useState(true);
  const [vocabCategory, setVocabCategory] = useState('toeic');
  const [active, setActive] = useState<Section>('learning');
  const [status, setStatus] = useState('');
  const [dbInfo, setDbInfo] = useState<{ WordCount: number; GroupCount: number; SessionCount: number; GameCount: number } | null>(null);
  const [dbPath, setDbPath] = useState('');
  const [pendingDelete, setPendingDelete] = useState<'history' | 'all' | null>(null);

  useEffect(() => {
    Promise.all([db.getSetting('daily_goal'), db.getSetting('auto_speak'), db.getSetting('groq_api_key'), db.getSetting('auto_daily_vocab'), db.getSetting('daily_vocab_category')]).then(([goal,speak,key,daily,category]) => {
      if (goal.success && goal.data?.[0]) setDailyGoal(goal.data[0].SettingValue);
      if (speak.success && speak.data?.[0]) setAutoSpeak(speak.data[0].SettingValue === 'true');
      if (key.success && key.data?.[0]) setApiKey(key.data[0].SettingValue);
      if (daily.success && daily.data?.[0]) setAutoDailyVocab(daily.data[0].SettingValue === 'true');
      if (category.success && category.data?.[0]) setVocabCategory(category.data[0].SettingValue);
    });
    refreshInfo();
    (window as any).electronAPI?.dbGetPath?.().then((path: string) => setDbPath(path));
  }, []);

  const refreshInfo = async () => {
    const result = await dbService.query(`SELECT (SELECT COUNT(*) FROM Words) AS WordCount,(SELECT COUNT(*) FROM WordGroups) AS GroupCount,(SELECT COUNT(*) FROM StudySessions) AS SessionCount,(SELECT COUNT(*) FROM GameScores) AS GameCount`);
    if (result.success && result.data?.[0]) setDbInfo(result.data[0]);
  };
  const announce = (message: string) => { setStatus(message); notify(message, message.startsWith('Không') ? 'error' : 'success'); window.setTimeout(() => setStatus(''), 3500); };
  const saveLearning = async () => {
    const goal = Math.max(5, Math.min(200, Number(dailyGoal) || 20));
    setDailyGoal(String(goal));
    const results = await Promise.all([db.setSetting('daily_goal', String(goal)), db.setSetting('auto_speak', String(autoSpeak))]);
    announce(results.every(item => item.success) ? 'Đã lưu mục học tập' : 'Không thể lưu mục học tập');
  };
  const saveAi = async () => {
    const results = await Promise.all([db.setSetting('groq_api_key', apiKey), db.setSetting('auto_daily_vocab', String(autoDailyVocab)), db.setSetting('daily_vocab_category', vocabCategory)]);
    announce(results.every(item => item.success) ? 'Đã lưu thiết lập AI' : 'Không thể lưu thiết lập AI');
  };
  const chooseTheme = (value: 'light' | 'dark') => setTheme(value);
  const clearData = async (all: boolean) => {
    setPendingDelete(null);
    if (all) { await dbService.query('DELETE FROM Words'); await dbService.query('DELETE FROM WordGroups'); }
    await dbService.query('DELETE FROM GameScores'); await dbService.query('DELETE FROM StudySessions');
    await refreshInfo(); announce(all ? 'Đã xóa toàn bộ dữ liệu' : 'Đã xóa lịch sử học');
  };
  const scrollTo = (id: Section) => { setActive(id); document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const toggle = (checked: boolean, onClick: () => void, label: string) => <button className={`lsa-switch${checked ? ' on' : ''}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onClick}><span /></button>;
  const dataCards = [
    { label: 'Từ vựng', value: dbInfo?.WordCount || 0, Icon: BookOpen, tone: 'word' },
    { label: 'Nhóm từ', value: dbInfo?.GroupCount || 0, Icon: Layers, tone: 'group' },
    { label: 'Phiên học', value: dbInfo?.SessionCount || 0, Icon: Clock3, tone: 'session' },
    { label: 'Điểm game', value: dbInfo?.GameCount || 0, Icon: Sparkles, tone: 'game' },
  ];

  return <div className="settings-approved"><div className="lsa-topbar"><strong>Cài đặt</strong><span>Điều chỉnh trải nghiệm của bạn</span></div><div className="lsa-content"><header className="lsa-hero"><div><span>TRUNG TÂM TÙY CHỈNH</span><h1>Học theo cách<br /><em>của riêng bạn.</em></h1><p>Mục tiêu. AI. Dữ liệu. Theo nhịp của bạn.</p></div><div className="lsa-hero-art" aria-hidden="true"><div className="lsa-wheel" /><div className="lsa-core"><Settings2 size={42}/></div><i className="lsa-chip a">{dailyGoal} <small>từ/ngày</small></i><i className="lsa-chip b">AI <small>Coach</small></i><i className="lsa-chip c">◷ <small>Ôn tập</small></i></div><div className="lsa-hero-note"><span>KHÔNG GIAN HỌC TẬP</span><b>Thiết lập trong tầm tay</b></div></header><div className="lsa-layout"><nav className="lsa-rail" aria-label="Các mục cài đặt"><span>ĐI ĐẾN MỤC</span>{sections.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => scrollTo(item.id)}><i><item.Icon size={20} strokeWidth={2.2}/></i>{item.title}</button>)}</nav><div className="lsa-main">
    <section id="settings-learning" className="lsa-section"><h2><span className="blue"><BookOpenCheck size={25}/></span>Học tập</h2><div className="lsa-card"><div className="lsa-row"><div><h3>Mục tiêu mỗi ngày</h3><p>Số từ muốn ôn mỗi ngày.</p></div><div className="lsa-goal"><button onClick={() => setDailyGoal(String(Math.max(5,(Number(dailyGoal)||20)-1)))} aria-label="Giảm mục tiêu"><Minus size={17}/></button><input type="number" min={5} max={200} value={dailyGoal} onChange={event => setDailyGoal(event.target.value)} aria-label="Mục tiêu từ mỗi ngày" /><button onClick={() => setDailyGoal(String(Math.min(200,(Number(dailyGoal)||20)+1)))} aria-label="Tăng mục tiêu"><Plus size={17}/></button><span>từ/ngày</span></div></div><div className="lsa-row"><div><h3>Tự động đọc từ</h3><p>Đọc từ khi lật Flashcard.</p></div>{toggle(autoSpeak, () => setAutoSpeak(!autoSpeak), 'Tự động đọc từ')}</div><div className="lsa-actions"><span>{status || 'Lưu để áp dụng thay đổi'}</span><button onClick={saveLearning}>Lưu mục học tập <ArrowUpRight size={17}/></button></div></div></section>
    <section id="settings-ai" className="lsa-section"><h2><span className="gold"><Bot size={25}/></span>AI & từ mới</h2><div className="lsa-card"><div className="lsa-row"><div><h3>Tạo từ mới mỗi ngày</h3><p>Tạo tối đa 10 từ khi mở ứng dụng.</p></div>{toggle(autoDailyVocab, () => setAutoDailyVocab(!autoDailyVocab), 'Tạo từ mới mỗi ngày')}</div>{autoDailyVocab && <div className="lsa-row"><div><h3>Lộ trình từ vựng</h3><p>Chủ đề của từ mới.</p></div><select value={vocabCategory} onChange={event => setVocabCategory(event.target.value)}><option value="toeic">TOEIC Vocabulary</option><option value="ielts">IELTS Academic</option><option value="communication">Giao tiếp thông dụng</option></select></div>}<div className="lsa-key"><div><h3>Groq API key</h3><p>Dùng cho AI Coach và từ mới AI.</p></div><span>{apiKey ? 'Đã nhập' : 'Chưa cấu hình'}</span><label><input type={showKey ? 'text' : 'password'} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Nhập Groq API key" autoComplete="off" aria-label="Groq API key" /><button onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Ẩn key' : 'Hiện key'}>{showKey ? <EyeOff size={18}/> : <Eye size={18}/>}</button></label><a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Lấy key từ Groq ↗</a></div><div className="lsa-actions"><span>{status || 'Lưu để áp dụng thay đổi'}</span><button onClick={saveAi}>Lưu thiết lập AI <ArrowUpRight size={17}/></button></div></div></section>
    <section id="settings-appearance" className="lsa-section"><h2><span className="green"><Paintbrush size={25}/></span>Giao diện</h2><div className="lsa-card lsa-theme-card"><h3>Chế độ hiển thị</h3><div className="lsa-theme"><button className={theme === 'light' ? 'active' : ''} onClick={() => chooseTheme('light')} aria-pressed={theme === 'light'}><Sun size={24}/> Sáng</button><span>✦</span><button className={theme === 'dark' ? 'active' : ''} onClick={() => chooseTheme('dark')} aria-pressed={theme === 'dark'}><Moon size={24}/> Tối</button></div></div></section>
    <section id="settings-data" className="lsa-section"><h2><span className="violet"><Database size={25}/></span>Dữ liệu</h2><div className="lsa-card"><div className="lsa-data-grid">{dataCards.map(({ label, value, Icon, tone }) => <div key={tone} className={`lsa-data ${tone}`}><span><Icon size={23}/></span><strong>{value}</strong><b>{label}</b><i><Icon size={74} strokeWidth={1}/></i></div>)}</div>{dbPath && <p className="lsa-db-path">SQLite trên máy của bạn: {dbPath}</p>}</div><div className="lsa-danger"><div><AlertTriangle size={24}/><span><h3>Xóa dữ liệu</h3><p>Các thao tác này không thể hoàn tác trong ứng dụng.</p></span></div><div><span><b>Xóa lịch sử học</b><small>Xóa phiên học và điểm game.</small></span><button onClick={() => setPendingDelete('history')}>Xóa lịch sử</button></div><div><span><b>Xóa toàn bộ</b><small>Xóa mọi dữ liệu học.</small></span><button onClick={() => setPendingDelete('all')}>Xóa tất cả</button></div></div></section>
    <section id="settings-about" className="lsa-section"><h2><span className="blue"><HelpCircle size={25}/></span>Về Lexforge</h2><div className="lsa-about"><span><BookOpenCheck size={35}/></span><div><h3>Lexforge</h3><p>Chắc từng từ. Chuẩn từng câu.</p><small>Ứng dụng học từ vựng trên máy của bạn</small></div></div></section>
  </div></div></div>{pendingDelete && <ConfirmDialog tone="danger" title={pendingDelete === 'all' ? 'Xóa toàn bộ dữ liệu?' : 'Xóa lịch sử học?'} description={pendingDelete === 'all' ? 'Từ vựng, nhóm từ, phiên học và điểm game sẽ bị xóa vĩnh viễn.' : 'Các phiên học và điểm game sẽ bị xóa vĩnh viễn. Từ vựng của bạn vẫn được giữ lại.'} confirmLabel={pendingDelete === 'all' ? 'Xóa toàn bộ' : 'Xóa lịch sử'} cancelLabel="Giữ lại" onCancel={() => setPendingDelete(null)} onConfirm={() => clearData(pendingDelete === 'all')} />}</div>;
}
