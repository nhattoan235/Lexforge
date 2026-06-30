// src/pages/VocabularyPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../services/database';
import { speechService } from '../services/speech';
import { Word, WordGroup, PART_OF_SPEECH, GROUP_COLORS } from '../types';
import { useApp } from '../App';
import { aiVocabService, CATEGORIES, DEFAULT_TOPICS } from '../services/aiVocabService';

const EMOJI_ICONS_V = ['📖','⭐','⚡','🎯','🏆','🧠','💡','📈','🌍','💬','🔥','✨','🎓','📝','🌟'];

export default function VocabularyPage() {
  const { triggerRefresh } = useApp();
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
      if (!form.groupId && gRes.data?.length) setForm(f => ({ ...f, groupId: gRes.data![0].Id }));
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
    const defaultGid = filterGroup !== 'all' ? filterGroup : (groups[0]?.Id || 0);
    setForm({ groupId: defaultGid, english: '', vietnamese: '', pronunciation: '', partOfSpeech: 'noun', example: '', exampleVi: '' });
    setIsDirty(false);
    setShowModal(true);
    setTimeout(() => englishInputRef.current?.focus(), 80);
  };

  const tryCloseModal = () => {
    if (isDirty) {
      if (!window.confirm('Bạn có thay đổi chưa lưu. Hủy bỏ?')) return;
    }
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

  const handleSave = async (keepOpen = false) => {
    if (!form.english.trim() || !form.vietnamese.trim() || !form.groupId) return;
    setSaving(true);
    if (editWord) {
      await db.updateWord(editWord.Id, form);
      setSaving(false);
      setShowModal(false);
    } else {
      await db.createWord(form as any);
      setSaving(false);
      if (keepOpen) {
        // Quick-save: reset form keeping groupId, re-focus English
        const savedGid = form.groupId;
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
      if (form.english.trim() && form.vietnamese.trim() && form.groupId) handleSave(true);
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
    setSelectedWords(prev => prev.length === filteredWords.length ? [] : filteredWords.map(w => w.Id));

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
    alert(`✅ Import thành công ${count} từ vựng!`);
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
    <div className="vocab-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Từ Vựng 📖</h1>
          <p className="page-subtitle">{words.length} từ tổng cộng · {filteredWords.length} đang hiển thị</p>
        </div>
        <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>📥 Import Excel</button>
          <button className="btn btn-secondary" onClick={handleExport}>📤 Export</button>
          <button className="btn btn-secondary" style={{ borderColor: 'rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.06)', color: 'var(--accent-bright)' }} onClick={openAiGen}>🪄 Sinh Từ AI</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Thêm Từ</button>
        </div>
      </div>

      <div className="vocab-toolbar">
        <input className="input search-input" placeholder="🔍 Tìm kiếm từ vựng..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select group-filter" value={filterGroup} onChange={e => setFilterGroup(e.target.value === 'all' ? 'all' : +e.target.value)}>
          <option value="all">Tất cả nhóm</option>
          {groups.map(g => <option key={g.Id} value={g.Id}>{g.Icon} {g.Name}</option>)}
        </select>
      </div>
      {/* Selection action bar */}
      {selectedWords.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-card)', border: '1.5px solid var(--accent)', borderRadius: 12,
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 4px 24px rgba(99,102,241,0.2)', zIndex: 100,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>✅ Đã chọn {selectedWords.length} từ</span>
          <button className="btn btn-secondary" style={{ fontSize: 13 }}
            onClick={() => { setMoveTargetGroup(groups[0]?.Id || 0); setShowMoveModal(true); }}>
            📁 Chuyển nhóm
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 13 }}
            onClick={() => setSelectedWords([])}>
            ✕ Bỏ chọn
          </button>
        </div>
      )}


      <div className="import-hint">
        💡 File Excel cần có cột: <code>English</code>, <code>Vietnamese</code>, <code>Pronunciation</code>, <code>PartOfSpeech</code>, <code>Example</code>, <code>ExampleVi</code>
      </div>

      <div className="vocab-content">
        {loading ? <div className="loading-center">⏳ Đang tải...</div>
          : filteredWords.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 64 }}>📖</div>
              <p>Chưa có từ vựng nào{search ? ' phù hợp' : ''}</p>
              <button className="btn btn-primary" onClick={openCreate}>Thêm từ đầu tiên</button>
            </div>
          ) : (
            <div className="words-table-wrap">
              <table className="words-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox" style={{ cursor: 'pointer' }}
                        checked={selectedWords.length === filteredWords.length && filteredWords.length > 0}
                        onChange={toggleSelectAll} />
                    </th>
                    <th>Tiếng Anh</th><th>Phiên Âm</th><th>Nghĩa</th>
                    <th>Từ loại</th><th>Nhóm</th><th>Cấp độ</th><th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWords.map(w => (
                    <tr key={w.Id} className={`word-row${selectedWords.includes(w.Id) ? ' selected' : ''}`}>
                      <td style={{ width: 36, textAlign: 'center' }}>
                        <input type="checkbox" style={{ cursor: 'pointer' }}
                          checked={selectedWords.includes(w.Id)}
                          onChange={() => toggleSelectWord(w.Id)} />
                      </td>
                      <td>
                        <div className="english-cell">
                          <span className="english-word">{w.English}</span>
                          <button className="speak-btn" onClick={() => speechService.speak(w.English)} title="Nghe phát âm">🔊</button>
                        </div>
                      </td>
                      <td><span className="pronunciation">{w.Pronunciation}</span></td>
                      <td className="vietnamese">{w.Vietnamese}</td>
                      <td>{w.PartOfSpeech && <span className="pos-badge">{w.PartOfSpeech}</span>}</td>
                      <td>
                        <span className="group-tag" style={{ background: `${w.GroupColor}22`, color: w.GroupColor, border: `1px solid ${w.GroupColor}44` }}>
                          {w.GroupName}
                        </span>
                      </td>
                      <td>
                        <span className="level-badge" style={{ color: levelColor(w.Level) }}>
                          {'★'.repeat(Math.max(1, w.Level))} {levelLabel(w.Level)}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-icon btn-secondary btn-sm" onClick={() => openEdit(w)}>✏️</button>
                          <button className="btn btn-icon btn-danger btn-sm" onClick={() => setDeleteConfirm(w.Id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={tryCloseModal}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
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
                  <label className="form-label">Nghĩa Tiếng Việt *</label>
                  <input tabIndex={2} className="input" value={form.vietnamese}
                    onChange={e => { setForm({ ...form, vietnamese: e.target.value }); setIsDirty(true); }}
                    onKeyDown={e => handleInputKeyDown(e)}
                    placeholder="hoàn thành, đạt được" />
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
                  onChange={e => { setForm({ ...form, groupId: +e.target.value }); setIsDirty(true); }}
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
              {!editWord && form.english && form.vietnamese && form.groupId && (
                <div style={{ fontSize: 12, color: '#10b981', padding: '4px 0' }}>
                  ⏎ Enter để lưu nhanh và tiếp tục nhập từ mới
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button tabIndex={9} className="btn btn-secondary" onClick={tryCloseModal}>Hủy</button>
              <button tabIndex={8} className="btn btn-primary" onClick={() => handleSave()} disabled={saving || !form.english || !form.vietnamese || !form.groupId}>
                {saving ? '⏳ Đang lưu...' : editWord ? '💾 Cập Nhật' : '➕ Thêm Từ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: 'center', gap: 16 }}>
              <div style={{ fontSize: 48 }}>🗑️</div>
              <h3>Xóa từ này?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Hành động này không thể hoàn tác.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Hủy</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* Move Words Modal */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📁 Chuyển {selectedWords.length} Từ Sang Nhóm Khác</h2>
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
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📥 Tùy Chọn Nhập {importData.length} Từ</h2>
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
