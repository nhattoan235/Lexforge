// src/pages/VocabularyPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../services/database';
import { speechService } from '../services/speech';
import { Word, WordGroup, PART_OF_SPEECH, GROUP_COLORS } from '../types';
import { useApp } from '../App';
import { aiVocabService, CATEGORIES, DEFAULT_TOPICS } from '../services/aiVocabService';
import { BookOpen, FolderOpen, CheckCircle2, Search, Download, Upload, Sparkles, Plus, Volume2, Trash2, ArrowRight, Moon, Sun, Layers } from 'lucide-react';
import ConfirmDialog from '../components/Feedback/ConfirmDialog';
import { notify } from '../components/Feedback/ToastHost';
import './VocabularyPage.css';
import './VocabularyApproved.css';

const EMOJI_ICONS_V = ['📖','⭐','⚡','🎯','🏆','🧠','💡','📈','🌍','💬','🔥','✨','🎓','📝','🌟'];

export default function VocabularyPage() {
  const { triggerRefresh, setPage } = useApp();
  const { theme, setTheme } = useApp();
  const dark = theme === 'dark';
  const [words, setWords] = useState<Word[]>([]);
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [filterGroup, setFilterGroup] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editWord, setEditWord] = useState<Word | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const englishInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ groupId: 0, english: '', vietnamese: '', pronunciation: '', partOfSpeech: '', example: '', exampleVi: '' });
  const [isDirty, setIsDirty] = useState(false);
  const [aiLookupLoading, setAiLookupLoading] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Selection & move
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetGroup, setMoveTargetGroup] = useState(0);

  // Import dialog
  const [importData, setImportData] = useState<any[] | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState<'existing' | 'new'>('existing');
  const [importGroupId, setImportGroupId] = useState(0);
  const [importNewName, setImportNewName] = useState('');
  const [importNewColor, setImportNewColor] = useState(GROUP_COLORS[0]);
  const [importNewIcon, setImportNewIcon] = useState('📖');
  const [importSaving, setImportSaving] = useState(false);

  // AI Vocabulary Generation state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiCategory, setAiCategory] = useState('toeic');
  const [aiTopic, setAiTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadData().then(() => {
      const filterGroupId = localStorage.getItem('default_filter_group_id');
      if (filterGroupId) {
        localStorage.removeItem('default_filter_group_id');
        setFilterGroup(Number(filterGroupId));
      }
      // Check if navigated here from GroupsPage via "Add Word" button
      const defaultGroupId = localStorage.getItem('default_add_word_group_id');
      if (defaultGroupId) {
        localStorage.removeItem('default_add_word_group_id');
        const gid = parseInt(defaultGroupId);
        setFilterGroup(gid);
        setForm(f => ({ ...f, groupId: gid }));
        setEditWord(null);
        setIsDirty(false);
        setShowModal(true);
        setTimeout(() => englishInputRef.current?.focus(), 100);
      }
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [wRes, gRes] = await Promise.all([db.getWords(), db.getGroups()]);
    if (wRes.success) setWords(wRes.data || []);
    if (gRes.success) {
      setGroups(gRes.data || []);
      if (!form.groupId && gRes.data?.length) {
        const savedGid = localStorage.getItem('latest_selected_group_id');
        const validSavedGid = savedGid ? parseInt(savedGid) : 0;
        const exists = gRes.data!.some(g => g.Id === validSavedGid);
        setForm(f => ({ ...f, groupId: exists ? validSavedGid : gRes.data![0].Id }));
      }
    }
    setLoading(false);
    return true;
  };

  const filteredWords = words.filter(w => {
    const matchGroup = filterGroup === 'all' || w.GroupId === filterGroup;
    const matchSearch = !search || w.English.toLowerCase().includes(search.toLowerCase()) || w.Vietnamese.toLowerCase().includes(search.toLowerCase());
    return matchGroup && matchSearch;
  });

  const openCreate = () => {
    setEditWord(null);
    let defaultGid: number;
    if (filterGroup !== 'all') {
      defaultGid = filterGroup;
    } else {
      const savedGid = localStorage.getItem('latest_selected_group_id');
      const validSavedGid = savedGid ? parseInt(savedGid) : 0;
      const exists = groups.some(g => g.Id === validSavedGid);
      defaultGid = exists ? validSavedGid : (groups[0]?.Id || 0);
    }
    setForm({ groupId: defaultGid, english: '', vietnamese: '', pronunciation: '', partOfSpeech: 'noun', example: '', exampleVi: '' });
    setIsDirty(false);
    setShowModal(true);
    setTimeout(() => englishInputRef.current?.focus(), 80);
  };

  const tryCloseModal = () => {
    if (isDirty) {
      setShowCloseConfirm(true);
      return;
    }
    setShowModal(false);
    setIsDirty(false);
  };

  const confirmCloseModal = () => {
    setShowCloseConfirm(false);
    setShowModal(false);
    setIsDirty(false);
  };

  const openEdit = (w: Word) => {
    setEditWord(w);
    setForm({ groupId: w.GroupId, english: w.English, vietnamese: w.Vietnamese, pronunciation: w.Pronunciation, partOfSpeech: w.PartOfSpeech, example: w.Example, exampleVi: w.ExampleVi });
    setIsDirty(false);
    setShowModal(true);
    setTimeout(() => englishInputRef.current?.focus(), 80);
  };

  const handleAiLookup = async () => {
    if (!form.english.trim()) return;
    setAiLookupLoading(true);
    try {
      const result = await aiVocabService.lookupWord(form.english.trim());
      setForm(f => ({
        ...f,
        vietnamese: result.vietnamese || f.vietnamese,
        pronunciation: result.pronunciation || f.pronunciation,
        partOfSpeech: result.partOfSpeech || f.partOfSpeech,
        example: result.example || f.example,
        exampleVi: result.exampleVi || f.exampleVi,
      }));
      setIsDirty(true);
    } catch (err: any) {
      console.error('AI lookup failed:', err);
    } finally {
      setAiLookupLoading(false);
    }
  };

  const handleSave = async (keepOpen = false) => {
    if (!form.english.trim() || !form.groupId) return;
    setSaving(true);

    // Lưu nhóm được chọn gần nhất
    localStorage.setItem('latest_selected_group_id', String(form.groupId));

    let finalForm = { ...form };

    // Nếu nghĩa tiếng Việt trống, tự động gọi AI tra cứu
    if (!finalForm.vietnamese.trim() && !editWord) {
      try {
        const result = await aiVocabService.lookupWord(finalForm.english.trim());
        finalForm.vietnamese = result.vietnamese || '';
        if (!finalForm.pronunciation) finalForm.pronunciation = result.pronunciation || '';
        if (!finalForm.partOfSpeech) finalForm.partOfSpeech = result.partOfSpeech || '';
        if (!finalForm.example) finalForm.example = result.example || '';
        if (!finalForm.exampleVi) finalForm.exampleVi = result.exampleVi || '';
      } catch (err) {
        console.error('AI auto-lookup failed, saving without meaning:', err);
      }
    }

    // Nếu vẫn không có nghĩa thì không lưu (trừ khi đang edit)
    if (!finalForm.vietnamese.trim() && !editWord) {
      setSaving(false);
      return;
    }

    if (editWord) {
      await db.updateWord(editWord.Id, finalForm);
      setSaving(false);
      setShowModal(false);
    } else {
      await db.createWord(finalForm as any);
      setSaving(false);
      if (keepOpen) {
        const savedGid = finalForm.groupId;
        setForm({ groupId: savedGid, english: '', vietnamese: '', pronunciation: '', partOfSpeech: 'noun', example: '', exampleVi: '' });
        setIsDirty(false);
        setTimeout(() => englishInputRef.current?.focus(), 50);
      } else {
        setShowModal(false);
      }
    }
    setIsDirty(false);
    loadData();
    triggerRefresh();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, isTextarea = false) => {
    if (e.key === 'Escape') { e.preventDefault(); tryCloseModal(); return; }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); speechService.speak(form.english); return; }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSave(true); return; }
    if (e.key === 'Enter' && !isTextarea) {
      e.preventDefault();
      if (form.english.trim() && form.groupId) handleSave(true);
    }
  };

  const handleMoveWords = async () => {
    if (!moveTargetGroup || !selectedWords.length) return;
    await (db as any).moveWordsToGroup(selectedWords, moveTargetGroup);
    setSelectedWords([]);
    setShowMoveModal(false);
    loadData();
    triggerRefresh();
  };

  const toggleSelectWord = (id: number) =>
    setSelectedWords(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleSelectAll = () =>
    setSelectedWords(prev => filteredWords.every(w => prev.includes(w.Id)) ? prev.filter(id => !filteredWords.some(w => w.Id === id)) : [...new Set([...prev, ...filteredWords.map(w => w.Id)])]);

  const handleDelete = async (id: number) => {
    await db.deleteWord(id);
    setDeleteConfirm(null);
    loadData();
    triggerRefresh();
  };

  const openAiGen = () => {
    setAiCategory('toeic');
    const defaultTopics = DEFAULT_TOPICS['toeic'];
    setAiTopic(defaultTopics ? defaultTopics[0] : '');
    setCustomTopic('');
    setAiError(null);
    setAiSuccess(false);
    setAiLoading(false);
    setShowAiModal(true);
  };

  const handleGenerateAiVocab = async () => {
    const finalTopic = customTopic.trim() !== '' ? customTopic.trim() : aiTopic;
    if (!finalTopic) {
      setAiError('Vui lòng chọn hoặc nhập chủ đề từ vựng.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiSuccess(false);
    try {
      const words = await aiVocabService.generateWords(aiCategory, finalTopic);
      const saveRes = await aiVocabService.saveGeneratedWordsToDb(aiCategory, finalTopic, words);
      if (saveRes.success) {
        setAiSuccess(true);
        loadData();
        triggerRefresh();
      } else {
        setAiError(saveRes.error || 'Có lỗi xảy ra khi lưu từ vựng.');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      const errMsg = msg === 'NO_KEY'
        ? '⚠️ Bạn chưa cấu hình Groq API key. Vui lòng vào Cài Đặt → nhập Groq Cloud API Key → nhấn Lưu.'
        : msg.includes('401') || msg.includes('403')
        ? '❌ Groq API key không hợp lệ hoặc hết hạn. Vui lòng kiểm tra lại trong Cài Đặt.'
        : msg.includes('429')
        ? '⏳ Đạt giới hạn Rate Limit của Groq. Vui lòng chờ vài giây rồi thử lại.'
        : '❌ Lỗi kết nối (' + msg + '). Vui lòng kiểm tra lại mạng Internet và API Key.';
      setAiError(errMsg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groups.length) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any>(ws);
      const valid = data.filter(row => {
        const en = row['English'] || row['english'] || row['Từ tiếng Anh'];
        const vi = row['Vietnamese'] || row['vietnamese'] || row['Nghĩa tiếng Việt'];
        return en && vi;
      });
      setImportData(valid);
      setImportGroupId(groups[0].Id);
      setImportMode('existing');
      setImportNewName('');
      setImportNewColor(GROUP_COLORS[0]);
      setImportNewIcon('📖');
      setShowImportDialog(true);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importData) return;
    setImportSaving(true);
    let targetGroupId = importGroupId;
    if (importMode === 'new') {
      if (!importNewName.trim()) return;
      const res = await db.createGroup(importNewName.trim(), '', importNewColor, importNewIcon);
      const gRes = await db.getGroups();
      if (gRes.success && gRes.data?.length) {
        targetGroupId = gRes.data[0].Id; // newest group
      }
    }
    let count = 0;
    for (const row of importData) {
      const english = row['English'] || row['english'] || row['Từ tiếng Anh'];
      const vietnamese = row['Vietnamese'] || row['vietnamese'] || row['Nghĩa tiếng Việt'];
      await db.createWord({
        groupId: targetGroupId,
        english: String(english).trim(),
        vietnamese: String(vietnamese).trim(),
        pronunciation: String(row['Pronunciation'] || row['IPA'] || '').trim(),
        partOfSpeech: String(row['POS'] || row['PartOfSpeech'] || '').trim(),
        example: String(row['Example'] || '').trim(),
        exampleVi: String(row['ExampleVi'] || '').trim(),
      });
      count++;
    }
    setImportSaving(false);
    setShowImportDialog(false);
    setImportData(null);
    notify(`Đã nhập thành công ${count} từ vựng.`, 'success');
    loadData();
    triggerRefresh();
  };

  const handleExport = () => {
    const exportData = filteredWords.map(w => ({
      'English': w.English, 'Vietnamese': w.Vietnamese,
      'Pronunciation': w.Pronunciation, 'PartOfSpeech': w.PartOfSpeech,
      'Example': w.Example, 'ExampleVi': w.ExampleVi, 'Group': w.GroupName,
      'Level': w.Level, 'TotalReviews': w.TotalReviews, 'CorrectReviews': w.CorrectReviews,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vocabulary');
    XLSX.writeFile(wb, 'toeic_vocabulary.xlsx');
  };

  const levelColor = (level: number) => ['#475569', '#f59e0b', '#f97316', '#10b981', '#6366f1', '#ec4899'][level] || '#475569';
  const levelLabel = (level: number) => ['Mới', 'Cơ bản', 'Đang học', 'Quen', 'Thuộc', 'Thành thạo'][level] || 'Mới';

  return (
    <div className={`vocab-page lf-vocab${dark ? ' dark' : ''}`}>
      <header className="lf-vocab-topbar"><div><span>BỘ TỪ CÁ NHÂN</span><b>Từ vựng</b></div><button type="button" onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? <Sun size={17} /> : <Moon size={17} />}{dark ? 'Sáng' : 'Tối'}</button></header>
      <div className="lf-vocab-body">
      <section className="lf-vocab-hero">
        <div className="lf-vocab-hero-art" aria-hidden="true"><div className="lf-vocab-art-halo" /><div className="lf-vocab-word-card back"><small>LEXFORGE / WORDBOOK</small><b>learn</b><span>học mỗi ngày</span></div><div className="lf-vocab-word-card front"><small>WORD OF THE DAY</small><b>accomplish</b><span>/əˈkʌmplɪʃ/ · hoàn thành</span></div><i>✦</i></div>
        <div className="lf-vocab-hero-main"><div><span className="lf-vocab-eyebrow">THƯ VIỆN TỪ VỰNG</span><h1><em>Từ vựng</em> của bạn</h1><p>Chắc từng từ. <strong>Chuẩn từng câu.</strong></p></div><div className="lf-vocab-hero-actions">
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button type="button" onClick={() => fileRef.current?.click()}><Upload size={16} /> Nhập Excel</button>
          <button type="button" onClick={handleExport}><Download size={16} /> Xuất danh sách</button>
          <button type="button" onClick={openAiGen}><Sparkles size={16} /> Tạo từ bằng AI</button>
          <button type="button" className="primary" onClick={openCreate}><Plus size={17} /> Thêm từ</button>
        </div></div>
        <div className="lf-vocab-summary"><div><span><BookOpen size={22}/></span><strong>{words.length}</strong><small>Từ trong thư viện</small></div><div><span><FolderOpen size={22}/></span><strong>{groups.length}</strong><small>Nhóm từ đang dùng</small></div><div><span><CheckCircle2 size={22}/></span><strong>{words.filter(w => w.Level >= 4).length}</strong><small>Từ đã thuộc</small></div></div>
      </section>

      <section className="lf-vocab-workspace" aria-label="Danh sách từ vựng"><div className="vocab-toolbar">
        <label className="lf-vocab-search"><Search size={18}/><input className="input search-input" placeholder="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <select className="select group-filter" aria-label="Lọc nhóm từ" value={filterGroup} onChange={e => {
          const val = e.target.value;
          if (val === 'all') {
            setFilterGroup('all');
          } else {
            const gid = +val;
            setFilterGroup(gid);
            localStorage.setItem('latest_selected_group_id', String(gid));
          }
        }}>
          <option value="all">Tất cả nhóm</option>
          {groups.map(g => <option key={g.Id} value={g.Id}>{g.Icon} {g.Name}</option>)}
        </select>
      </div><div className="lf-vocab-results"><span><strong>{filteredWords.length} từ</strong> đang hiển thị</span><span>Bấm vào một hàng để sửa từ</span><details><summary>Định dạng file nhập <ArrowRight size={14}/></summary><p>File Excel cần có cột English và Vietnamese. Có thể thêm Pronunciation, PartOfSpeech, Example, ExampleVi.</p></details></div>
      {/* Selection action bar */}
      {selectedWords.length > 0 && (
        <div className="lf-vocab-bulk">
          <span>Đã chọn <strong>{selectedWords.length} từ</strong></span>
          <button type="button"
            onClick={() => { setMoveTargetGroup(groups[0]?.Id || 0); setShowMoveModal(true); }}>
            Chuyển nhóm
          </button>
          <button type="button"
            onClick={() => setSelectedWords([])}>
            Bỏ chọn
          </button>
        </div>
      )}
      <div className="vocab-content">
        {loading ? <div className="loading-center">⏳ Đang tải...</div>
          : filteredWords.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={49}/>
              <h2>{search || filterGroup !== 'all' ? 'Không tìm thấy từ phù hợp' : 'Chưa có từ nào'}</h2>
              <p>{search || filterGroup !== 'all' ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Thêm từ đầu tiên hoặc nhập danh sách Excel để bắt đầu.'}</p>
              <button className="btn btn-primary" onClick={openCreate}>Thêm từ đầu tiên</button>
            </div>
          ) : (
            <div className="words-table-wrap">
              <table className="words-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox" style={{ cursor: 'pointer' }}
                        checked={filteredWords.length > 0 && filteredWords.every(w => selectedWords.includes(w.Id))}
                        onChange={toggleSelectAll} />
                    </th>
                    <th>Tiếng Anh</th><th>Phiên âm</th><th>Nghĩa tiếng Việt</th>
                    <th>Từ loại</th><th>Nhóm</th><th>Cấp độ</th><th>Xóa</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWords.map(w => (
                    <tr key={w.Id} className={`word-row${selectedWords.includes(w.Id) ? ' selected' : ''}`} tabIndex={0} onClick={() => openEdit(w)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openEdit(w); } }}>
                      <td style={{ width: 36, textAlign: 'center' }}>
                        <input type="checkbox" style={{ cursor: 'pointer' }}
                          checked={selectedWords.includes(w.Id)}
                          onClick={e => e.stopPropagation()} onChange={() => toggleSelectWord(w.Id)} aria-label={`Chọn từ ${w.English}`} />
                      </td>
                      <td>
                        <div className="english-cell">
                          <span className="english-word">{w.English}</span>
                          <button className="speak-btn" onClick={e => { e.stopPropagation(); speechService.speak(w.English); }} title="Nghe phát âm" aria-label={`Nghe phát âm ${w.English}`}><Volume2 size={17}/></button>
                        </div>
                        {w.Example && <span className="lf-vocab-example" title={w.Example}>{w.Example}</span>}
                      </td>
                      <td><span className="pronunciation">{w.Pronunciation}</span></td>
                      <td className="vietnamese"><strong>{w.Vietnamese}</strong></td>
                      <td>{w.PartOfSpeech && <span className="pos-badge">{w.PartOfSpeech}</span>}</td>
                      <td>
                        <span className="group-tag" style={{ background: `${w.GroupColor}22`, color: w.GroupColor, border: `1px solid ${w.GroupColor}44` }}>
                          {w.GroupName}
                        </span>
                      </td>
                      <td>
                        <span className="level-badge" style={{ color: levelColor(w.Level) }}>
                          {levelLabel(w.Level)}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="lf-vocab-delete" aria-label={`Xóa từ ${w.English}`} onClick={e => { e.stopPropagation(); setDeleteConfirm(w.Id); }}><Trash2 size={17}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div><div className="lf-vocab-list-footer"><strong>{filteredWords.length} từ</strong> trong danh sách hiện tại<button type="button" onClick={() => document.querySelector('.lf-vocab-workspace')?.scrollIntoView({ behavior: 'smooth' })}>↑ Về đầu danh sách</button></div></section>
      <section className="lf-vocab-next"><span><Layers size={26}/></span><div><h2>Lưu từ rồi, giờ luyện nhớ nhé</h2><p>Ôn nhanh bằng Flashcard hoặc mở nhóm từ để sắp xếp lại bộ từ của bạn.</p></div><button type="button" onClick={() => setPage('flashcard')}>Mở Flashcard <ArrowRight size={16}/></button></section>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={tryCloseModal}>
          <div className="modal lf-vocab-form-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editWord ? '✏️ Chỉnh Sửa Từ' : '➕ Thêm Từ Mới'}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tab → | Ctrl+Enter: Lưu | Ctrl+S: Phát âm</span>
                <button className="btn btn-icon btn-secondary" onClick={tryCloseModal}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tiếng Anh *</label>
                  <div style={{ position: 'relative' }}>
                    <input ref={englishInputRef} tabIndex={1} className="input" value={form.english}
                      onChange={e => { setForm({ ...form, english: e.target.value }); setIsDirty(true); }}
                      onKeyDown={e => handleInputKeyDown(e)}
                      placeholder="accomplish" />
                    {form.english && <button style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }} onClick={() => speechService.speak(form.english)}>🔊</button>}
                  </div>
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="form-label" style={{ margin: 0 }}>Nghĩa Tiếng Việt</label>
                    {!editWord && form.english.trim() && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                        disabled={aiLookupLoading}
                        onClick={handleAiLookup}
                      >
                        {aiLookupLoading ? '⏳ Đang tra...' : '🪄 Điền nhanh AI'}
                      </button>
                    )}
                  </div>
                  <input tabIndex={2} className="input" value={form.vietnamese}
                    onChange={e => { setForm({ ...form, vietnamese: e.target.value }); setIsDirty(true); }}
                    onKeyDown={e => handleInputKeyDown(e)}
                    placeholder="hoàn thành, đạt được (để trống → AI tự điền)" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phiên Âm (IPA)</label>
                  <input tabIndex={3} className="input font-mono" value={form.pronunciation}
                    onChange={e => { setForm({ ...form, pronunciation: e.target.value }); setIsDirty(true); }}
                    onKeyDown={e => handleInputKeyDown(e)}
                    placeholder="/əˈkɒmplɪʃ/" />
                </div>
                <div className="form-group">
                  <label className="form-label">Từ Loại</label>
                  <select tabIndex={4} className="select" value={form.partOfSpeech}
                    onChange={e => { setForm({ ...form, partOfSpeech: e.target.value }); setIsDirty(true); }}
                    onKeyDown={e => handleInputKeyDown(e)}>
                    <option value="">-- Chọn --</option>
                    {PART_OF_SPEECH.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nhóm Từ *</label>
                <select tabIndex={5} className="select" value={form.groupId}
                  onChange={e => {
                    const gid = +e.target.value;
                    setForm({ ...form, groupId: gid });
                    setIsDirty(true);
                    localStorage.setItem('latest_selected_group_id', String(gid));
                  }}
                  onKeyDown={e => handleInputKeyDown(e)}>
                  {groups.map(g => <option key={g.Id} value={g.Id}>{g.Icon} {g.Name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ví Dụ Tiếng Anh</label>
                <textarea tabIndex={6} className="textarea" value={form.example}
                  onChange={e => { setForm({ ...form, example: e.target.value }); setIsDirty(true); }}
                  onKeyDown={e => handleInputKeyDown(e, true)}
                  placeholder="She accomplished all her goals this year." rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Ví Dụ Tiếng Việt</label>
                <textarea tabIndex={7} className="textarea" value={form.exampleVi}
                  onChange={e => { setForm({ ...form, exampleVi: e.target.value }); setIsDirty(true); }}
                  onKeyDown={e => handleInputKeyDown(e, true)}
                  placeholder="Cô ấy đã hoàn thành tất cả mục tiêu năm nay." rows={2} />
              </div>
              {!editWord && form.english && form.groupId && (
                <div style={{ fontSize: 12, color: '#10b981', padding: '4px 0' }}>
                  {form.vietnamese
                    ? '⏎ Enter để lưu nhanh và tiếp tục nhập từ mới'
                    : '⏎ Enter để lưu — AI sẽ tự điền nghĩa cho bạn'}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button tabIndex={9} className="btn btn-secondary" onClick={tryCloseModal}>Hủy</button>
              <button tabIndex={8} className="btn btn-primary" onClick={() => handleSave()} disabled={saving || !form.english || !form.groupId}>
                {saving ? '🪄 AI đang tra từ...' : editWord ? '💾 Cập Nhật' : <><Plus className="lf-vocab-save-plus" size={21} strokeWidth={3} /> Thêm Từ</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm !== null && <ConfirmDialog tone="danger" title="Xóa từ này?" description="Từ sẽ được xóa khỏi thư viện và lịch ôn. Bạn không thể hoàn tác thao tác này." confirmLabel="Xóa từ" cancelLabel="Giữ lại" onCancel={() => setDeleteConfirm(null)} onConfirm={() => handleDelete(deleteConfirm)} />}

      {/* Close confirm dialog (replaces window.confirm to avoid Electron focus bug) */}
      {showCloseConfirm && <ConfirmDialog title="Bỏ các thay đổi?" description="Những thông tin bạn vừa nhập chưa được lưu. Nếu rời đi, bạn sẽ cần nhập lại." confirmLabel="Bỏ thay đổi" cancelLabel="Tiếp tục chỉnh sửa" onCancel={() => setShowCloseConfirm(false)} onConfirm={confirmCloseModal} />}

      {/* Move Words Modal */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal lf-action-form" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chuyển {selectedWords.length} từ sang nhóm khác</h2>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowMoveModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Chọn nhóm đích</label>
                <select className="select" value={moveTargetGroup} onChange={e => setMoveTargetGroup(+e.target.value)}>
                  {groups.map(g => <option key={g.Id} value={g.Id}>{g.Icon} {g.Name} ({g.WordCount} từ)</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMoveModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleMoveWords} disabled={!moveTargetGroup}>✅ Xác nhận chuyển</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {showImportDialog && importData && (
        <div className="modal-overlay" onClick={() => !importSaving && setShowImportDialog(false)}>
          <div className="modal lf-action-form" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nhập {importData.length} từ vào thư viện</h2>
              <button className="btn btn-icon btn-secondary" disabled={importSaving} onClick={() => setShowImportDialog(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['existing', 'new'] as const).map(m => (
                  <button key={m} onClick={() => setImportMode(m)} style={{
                    flex: 1, padding: '10px', borderRadius: 8, fontFamily: 'inherit', cursor: 'pointer', fontSize: 13,
                    border: `2px solid ${importMode === m ? 'var(--accent)' : 'var(--border)'}`,
                    background: importMode === m ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                    color: importMode === m ? 'var(--accent-bright)' : 'var(--text-secondary)',
                  }}>{m === 'existing' ? '📂 Nhóm có sẵn' : '✨ Tạo nhóm mới'}</button>
                ))}
              </div>
              {importMode === 'existing' ? (
                <div className="form-group">
                  <label className="form-label">Chọn nhóm</label>
                  <select className="select" value={importGroupId} onChange={e => setImportGroupId(+e.target.value)}>
                    {groups.map(g => <option key={g.Id} value={g.Id}>{g.Icon} {g.Name}</option>)}
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Tên nhóm mới *</label>
                    <input className="input" value={importNewName} onChange={e => setImportNewName(e.target.value)} placeholder="VD: TOEIC Batch 1" autoFocus />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Icon nhóm</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {EMOJI_ICONS_V.map(icon => (
                        <button key={icon} onClick={() => setImportNewIcon(icon)} style={{ width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 15, border: `2px solid ${importNewIcon === icon ? 'var(--accent)' : 'var(--border)'}`, background: importNewIcon === icon ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)' }}>{icon}</button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Màu sắc</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {GROUP_COLORS.map(c => (
                        <button key={c} onClick={() => setImportNewColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: `3px solid ${importNewColor === c ? 'white' : 'transparent'}` }} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" disabled={importSaving} onClick={() => setShowImportDialog(false)}>Hủy</button>
              <button className="btn btn-primary" disabled={importSaving || (importMode === 'new' && !importNewName.trim())} onClick={handleConfirmImport}>
                {importSaving ? '⏳ Đang nhập...' : `📥 Nhập ${importData.length} từ`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAiModal && (
        <div className="modal-overlay" onClick={() => !aiLoading && setShowAiModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🪄 Sinh Từ Vựng Bằng AI</h2>
              <button className="btn btn-icon btn-secondary" disabled={aiLoading} onClick={() => setShowAiModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {aiSuccess ? (
                <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 48 }}>🎉</div>
                  <h3 style={{ color: '#10b981', margin: 0 }}>Sinh từ vựng thành công!</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Hệ thống đã tự động tạo nhóm mới và thêm thành công 10 từ vựng. Bạn đã có thể đóng cửa sổ này và bắt đầu ôn luyện.
                  </p>
                  <button className="btn btn-primary" style={{ marginTop: 12, alignSelf: 'center' }} onClick={() => setShowAiModal(false)}>
                    Xem Từ Vựng
                  </button>
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="form-label" style={{ fontWeight: 500, fontSize: 13 }}>Chọn Lộ Trình Học</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {CATEGORIES.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setAiCategory(c.id);
                            const topics = DEFAULT_TOPICS[c.id];
                            setAiTopic(topics ? topics[0] : '');
                          }}
                          style={{
                            padding: '10px 8px',
                            borderRadius: 8,
                            border: `1.5px solid ${aiCategory === c.id ? c.color : 'var(--border)'}`,
                            background: aiCategory === c.id ? `${c.color}15` : 'var(--bg-secondary)',
                            color: aiCategory === c.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: aiCategory === c.id ? 600 : 400,
                            fontFamily: 'inherit',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{c.icon}</span>
                          <span>{c.label.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="form-label" style={{ fontWeight: 500, fontSize: 13 }}>Gợi Ý Chủ Đề Phổ Biến</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 110, overflowY: 'auto', padding: '8px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      {(DEFAULT_TOPICS[aiCategory] || []).map(topic => (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => {
                            setAiTopic(topic);
                            setCustomTopic('');
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: `1px solid ${aiTopic === topic && customTopic === '' ? 'var(--accent)' : 'transparent'}`,
                            background: aiTopic === topic && customTopic === '' ? 'rgba(99,102,241,0.15)' : 'var(--bg-primary)',
                            color: aiTopic === topic && customTopic === '' ? 'var(--accent-bright)' : 'var(--text-secondary)',
                            fontSize: 11,
                            cursor: 'pointer',
                            fontFamily: 'inherit'
                          }}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="form-label" style={{ fontWeight: 500, fontSize: 13 }}>Hoặc Tự Nhập Chủ Đề Khác</label>
                    <input
                      className="input"
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      placeholder="Ví dụ: Coffee shop, Airport, Presentation..."
                    />
                  </div>

                  {aiError && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      fontSize: 12,
                      color: '#ef4444',
                      lineHeight: 1.5
                    }}>
                      {aiError}
                    </div>
                  )}

                  {aiLoading && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      padding: '8px 0'
                    }}>
                      <div className="spinner" style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Đang sinh 10 từ vựng chất lượng cao bằng AI...
                    </div>
                  )}
                </>
              )}
            </div>
            {!aiSuccess && (
              <div className="modal-footer">
                <button className="btn btn-secondary" disabled={aiLoading} onClick={() => setShowAiModal(false)}>Hủy</button>
                <button
                  className="btn btn-primary"
                  disabled={aiLoading || (!customTopic.trim() && !aiTopic)}
                  onClick={handleGenerateAiVocab}
                >
                  {aiLoading ? '⏳ Đang sinh từ...' : '🤖 Bắt Đầu Sinh Từ'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .vocab-page { padding-bottom: 32px; }
        .vocab-toolbar { display: flex; gap: 12px; padding: 16px 32px 0; }
        .search-input { flex: 1; max-width: 400px; }
        .group-filter { width: 200px; }
        .import-hint { padding: 8px 32px; font-size: 12px; color: var(--text-muted); }
        .import-hint code { background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; color: var(--accent-bright); font-family: 'JetBrains Mono', monospace; }
        .vocab-content { padding: 16px 32px; }
        .words-table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); }
        .words-table { width: 100%; border-collapse: collapse; }
        .words-table th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text-muted); letter-spacing: 0.5px; text-transform: uppercase; background: var(--bg-secondary); border-bottom: 1px solid var(--border); }
        .word-row { transition: background 0.15s; }
        .word-row:hover { background: var(--bg-hover); }
        .word-row.selected { background: rgba(99,102,241,0.08); }
        .word-row.selected:hover { background: rgba(99,102,241,0.12); }
        .word-row td { padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 14px; }
        .word-row:last-child td { border-bottom: none; }
        .english-cell { display: flex; align-items: center; gap: 8px; }
        .english-word { font-weight: 600; color: var(--text-primary); }
        .speak-btn { background: none; border: none; cursor: pointer; font-size: 14px; opacity: 0; transition: opacity 0.15s; }
        .word-row:hover .speak-btn { opacity: 1; }
        .pronunciation { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--accent-bright); }
        .vietnamese { color: var(--text-secondary); }
        .pos-badge { background: rgba(99,102,241,0.15); color: var(--accent-bright); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .group-tag { padding: 3px 8px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .level-badge { font-size: 12px; font-weight: 600; }
        .row-actions { display: flex; gap: 6px; opacity: 0; transition: opacity 0.15s; }
        .word-row:hover .row-actions { opacity: 1; }
        .loading-center { display: flex; align-items: center; justify-content: center; padding: 60px; color: var(--text-secondary); }
        .empty-state { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 20px; color: var(--text-secondary); }
      `}</style>
    </div>
  );
}
