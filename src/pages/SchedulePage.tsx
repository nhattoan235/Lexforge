import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, Clock3, Search, Sparkles, X } from 'lucide-react';
import { db } from '../services/database';
import { DailySchedule, ScheduledWord, lstmService } from '../services/lstmScheduler';
import { WordGroup } from '../types';
import { useApp } from '../App';
import ConfirmDialog from '../components/Feedback/ConfirmDialog';
import { notify } from '../components/Feedback/ToastHost';
import './ScheduleApproved.css';

type Priority = 'all' | 'urgent' | 'high' | 'low';
const PAGE_SIZE = 10;
const labels: Record<Priority, string> = { all: 'Tất cả', urgent: 'Cấp tốc', high: 'Ưu tiên', low: 'Ổn định' };

export default function SchedulePage() {
  const { setPage, triggerRefresh } = useApp();
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<DailySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [priority, setPriority] = useState<Priority>('all');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPageNumber] = useState(1);
  const [openWord, setOpenWord] = useState<ScheduledWord | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [confirmGroup, setConfirmGroup] = useState(false);
  const [forceOffline, setForceOffline] = useState(false);

  useEffect(() => { db.getGroups().then(result => { if (result.success) setGroups(result.data || []); }); }, []);
  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try { setSchedule(forceOffline
      ? await lstmService.getOfflineSchedule(groupId ?? undefined)
      : await lstmService.getDailySchedule(groupId ?? undefined)); }
    catch (error) { console.error('Không tải được lịch ôn:', error); setSchedule(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [groupId, forceOffline]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPageNumber(1); }, [groupId, priority, appliedQuery]);
  useEffect(() => { if (!openWord) return; const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenWord(null); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [openWord]);

  const allWords = schedule?.words_to_review || [];
  const urgentCount = schedule?.urgent_count || 0;
  const highCount = schedule?.high_count || 0;
  const lowCount = schedule?.low_count || 0;
  const total = schedule?.total_words || 0;
  const urgentWords = allWords.filter(word => word.urgency === 'urgent' || word.urgency === 'high');
  const filtered = useMemo(() => allWords.filter(word => {
    const q = appliedQuery.trim().toLocaleLowerCase('vi');
    return (priority === 'all' || word.urgency === priority) && (!q || `${word.english} ${word.vietnamese}`.toLocaleLowerCase('vi').includes(q));
  }), [allWords, priority, appliedQuery]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showCard = (word: ScheduledWord) => { setOpenWord(word); setFlipped(false); };

  const createGroup = async () => {
    setConfirmGroup(false);
    if (!urgentWords.length) return;
    setCreating(true);
    try {
      const name = `Ôn tập ưu tiên ${new Date().toLocaleDateString('vi-VN')}`;
      const created = await db.createGroup(name, 'Từ cần ưu tiên theo lịch ôn', '#e8a844', '✦');
      if (!created.success) throw new Error(created.error || 'Không tạo được nhóm');
      const result = await db.getGroups();
      const group = result.data?.find(item => item.Name === name);
      if (!group) throw new Error('Không tìm thấy nhóm vừa tạo');
      const moved = await (db as any).moveWordsToGroup(urgentWords.map(word => word.id), group.Id);
      if (!moved.success) throw new Error(moved.error || 'Không chuyển được từ');
      triggerRefresh(); setPage('groups');
    } catch (error) { notify(error instanceof Error ? error.message : 'Không thể tạo nhóm', 'error', 8000); }
    finally { setCreating(false); }
  };

  return <div className="schedule-approved">
    <div className="sa-topbar"><strong>Lịch ôn tập AI</strong><span>Chọn đúng từ · Ôn đúng lúc</span></div>
    <div className="sa-content">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0' }}>
        <button type="button" onClick={() => setForceOffline(value => !value)} aria-pressed={forceOffline}>
          {forceOffline ? 'Đang dùng SM-2 cục bộ · Chuyển sang LSTM' : 'Đang dùng LSTM nếu có · Chuyển sang SM-2 cục bộ'}
        </button>
      </div>
      <section className="sa-hero"><div className="sa-hero-copy"><span className="sa-eyebrow"><i /> LỊCH ÔN HÔM NAY</span><h1>Giữ từ trong trí nhớ.<br /><em>Ôn đúng thời điểm.</em></h1><p>Từ nào dễ quên được đưa lên trước để bạn dành thời gian đúng chỗ.</p><div className="sa-hero-meta"><span><Clock3 size={16} /> Lịch được tính từ lịch sử học</span><span><ArrowUpRight size={16} /> Có thể tìm lại bất cứ lúc nào</span></div></div><div className="sa-hero-art" aria-hidden="true"><div className="sa-art-orbit one" /><div className="sa-art-orbit two" /><div className="sa-art-core"><span>HÔM NAY</span><strong>{String(urgentCount).padStart(2, '0')}</strong><small>TỪ CẤP TỐC</small></div><span className="sa-art-word a">deadline <b>!</b></span><span className="sa-art-word b">negotiate <b>↗</b></span><span className="sa-art-star">✦</span></div><div className="sa-hero-action"><small>NÊN BẮT ĐẦU TỪ ĐÂY</small><div className="sa-action-number">{urgentCount} <span>từ</span></div><strong>cần ôn cấp tốc</strong><i /><p>Ôn nhóm dễ quên trước, rồi tiếp tục các từ còn lại.</p><button onClick={() => { sessionStorage.setItem('lexforge-flashcard-intent', 'due'); setPage('flashcard'); }}>Bắt đầu ôn <ArrowUpRight size={17} /></button></div></section>
      <section className="sa-summary" aria-label="Tóm tắt lịch ôn">{[
        ['urgent', '01 · CẦN HÀNH ĐỘNG', urgentCount, '!', 'Cấp tốc', 'Ôn ngay hôm nay'],
        ['high', '02 · SẮP ĐẾN LƯỢT', highCount, '↗', 'Ưu tiên', 'Chuẩn bị ôn sớm'],
        ['low', '03 · ĐANG GHI NHỚ TỐT', lowCount, '✓', 'Ổn định', 'Chưa cần ôn ngay'],
        ['total', 'TOÀN BỘ LỊCH ÔN', total, '▤', 'Tổng từ', `Trong ${groups.length} nhóm từ`],
      ].map(([tone, eyebrow, value, symbol, title, detail]) => <button key={String(tone)} className={`sa-summary-card ${tone}`} onClick={() => setPriority(tone === 'total' ? 'all' : tone as Priority)}><small>{eyebrow}</small><div><b>{String(value).padStart(2, '0')}</b><span>{symbol}</span></div><strong>{title}</strong><p>{detail}</p><i><em style={{ width: `${total ? Number(value) / total * 100 : 0}%` }} /></i></button>)}</section>
      <section className="sa-planner"><div className="sa-planner-head"><span>BẢNG ƯU TIÊN</span><h2>Từ nào cần bạn hôm nay?</h2><p>Chọn một từ để mở flashcard và ôn ngay.</p></div><div className="sa-toolbar"><label>NHÓM TỪ<select value={groupId ?? ''} onChange={event => setGroupId(event.target.value ? Number(event.target.value) : null)}><option value="">Tất cả nhóm</option>{groups.map(group => <option key={group.Id} value={group.Id}>{group.Name}</option>)}</select></label><div className="sa-priorities"><span>MỨC ƯU TIÊN</span><div>{(['all', 'urgent', 'high', 'low'] as Priority[]).map(item => <button key={item} className={priority === item ? 'active' : ''} onClick={() => setPriority(item)}>{labels[item]}</button>)}</div></div><label className="sa-search">TÌM TỪ<div><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setAppliedQuery(query); }} placeholder="Tiếng Anh hoặc tiếng Việt" /></div></label><button className="sa-find" onClick={() => { setAppliedQuery(query); if (!query.trim()) load(true); }} disabled={refreshing}><Search size={18} /> {refreshing ? 'Đang tìm...' : 'Tìm'}</button></div><div className="sa-list-head"><span>TỪ CẦN ÔN</span><span>NGUY CƠ QUÊN</span><span>THỜI ĐIỂM</span></div><div className="sa-word-list">{loading ? <div className="sa-empty">Đang chuẩn bị lịch ôn...</div> : visible.length ? visible.map(word => <button key={word.id} className={`sa-word ${word.urgency}`} onClick={() => showCard(word)}><div className="sa-word-main"><strong>{word.english}</strong><b>{word.vietnamese}</b><div><span className={`sa-badge ${word.urgency}`}>{labels[word.urgency as Priority] || 'Ổn định'}</span>{word.groupName && <span className="sa-group">{word.groupName}</span>}</div></div><div className="sa-risk"><strong>{Math.round(word.p_forget * 100)}%</strong><small>Nguy cơ quên ước tính</small><i><em style={{ width: `${Math.round(word.p_forget * 100)}%` }} /></i></div><div className="sa-when"><strong>{word.schedule_days <= 0 ? 'Hôm nay' : `${word.schedule_days} ngày nữa`}</strong><small>{word.days_since_last >= 999 ? 'Chưa ôn lần nào' : word.days_since_last < 1 ? 'Vừa ôn' : `Quá ${Math.floor(word.days_since_last)} ngày`}</small></div></button>) : <div className="sa-empty">Không có từ phù hợp. Hãy đổi bộ lọc hoặc thử từ khóa khác.</div>}</div>{pages > 1 && <nav className="sa-pagination" aria-label="Phân trang từ cần ôn"><button disabled={page === 1} onClick={() => setPageNumber(page - 1)}>‹ Trước</button><span>Trang {page} / {pages}</span><button disabled={page === pages} onClick={() => setPageNumber(page + 1)}>Tiếp ›</button></nav>}<div className="sa-planner-foot"><div><BookOpen size={24} /><span><b>{filtered.length} từ</b><small>phù hợp với bộ lọc</small></span></div><button onClick={() => setConfirmGroup(true)} disabled={creating || !urgentWords.length}><Sparkles size={20} /> {creating ? 'Đang tạo...' : 'Tạo nhóm ôn tập từ cần ưu tiên'} <ArrowUpRight size={19} /></button></div></section>
    </div>
    {openWord && <div className="sa-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpenWord(null); }}><div className="sa-modal" role="dialog" aria-modal="true" aria-label={`Flashcard ${openWord.english}`}><div className="sa-modal-head"><div><span>FLASHCARD · ÔN NHANH</span><h2>Ôn từ vựng</h2></div><button aria-label="Đóng flashcard" onClick={() => setOpenWord(null)}><X size={22} /></button></div><button className={`sa-flip-card${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(!flipped)}><small>{flipped ? 'MẶT SAU · TIẾNG VIỆT' : 'MẶT TRƯỚC · TIẾNG ANH'}</small><strong>{flipped ? openWord.vietnamese : openWord.english}</strong><span>Chạm để {flipped ? 'xem từ' : 'xem nghĩa'} ↗</span></button><div className="sa-modal-foot"><span>{openWord.groupName || 'Từ vựng'}</span><button onClick={() => setFlipped(!flipped)}>{flipped ? 'Xem từ' : 'Lật thẻ'} <ArrowUpRight size={16} /></button></div></div></div>}
    {confirmGroup && <ConfirmDialog tone="info" title="Tạo nhóm ôn tập?" description={`Chuyển ${urgentWords.length} từ cần ưu tiên vào một nhóm mới để bạn ôn tập tập trung hơn.`} confirmLabel="Tạo nhóm" cancelLabel="Để sau" onCancel={() => setConfirmGroup(false)} onConfirm={createGroup} />}
  </div>;
}
