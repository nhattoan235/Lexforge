// src/pages/GroupsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/database';
import { WordGroup, GROUP_COLORS } from '../types';
import { useApp } from '../App';

type SortBy = 'newest' | 'oldest' | 'most_words' | 'least_words' | 'name_az';

export default function GroupsPage() {
  const { triggerRefresh, setPage } = useApp();
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState<WordGroup | null>(null);
  const [form, setForm] = useState({ name: '', description: '', color: GROUP_COLORS[0], icon: '📖' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Filter / Sort
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Bulk create
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const EMOJI_ICONS = ['📖', '⭐', '⚡', '🎯', '🏆', '🧠', '💡', '📈', '🌍', '💬', '🔥', '✨', '🎓', '📝', '🌟'];
  const RANDOM_ICONS = ['📖', '⭐', '⚡', '🎯', '🏆', '🧠', '💡', '📈', '🌍', '💬', '🔥', '✨', '🎓', '📝', '🌟'];

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    setLoading(true);
    const res = await db.getGroups();
    if (res.success) setGroups(res.data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditGroup(null);
    setForm({ name: '', description: '', color: GROUP_COLORS[0], icon: '📖' });
    setShowModal(true);
  };

  const openEdit = (g: WordGroup) => {
    setEditGroup(g);
    setForm({ name: g.Name, description: g.Description, color: g.Color, icon: g.Icon });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editGroup) {
      await db.updateGroup(editGroup.Id, form.name, form.description, form.color, form.icon);
    } else {
      await db.createGroup(form.name, form.description, form.color, form.icon);
    }
    setSaving(false);
    setShowModal(false);
    loadGroups();
    triggerRefresh();
  };

  const handleDelete = async (id: number) => {
    await db.deleteGroup(id);
    setDeleteConfirm(null);
    loadGroups();
    triggerRefresh();
  };

  const handleAddWordToGroup = (groupId: number) => {
    localStorage.setItem('default_add_word_group_id', String(groupId));
    localStorage.setItem('latest_selected_group_id', String(groupId));
    setPage('vocabulary');
  };

  const handleBulkCreate = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (!lines.length) return;
    setBulkSaving(true);
    for (let i = 0; i < lines.length; i++) {
      const color = GROUP_COLORS[i % GROUP_COLORS.length];
      const icon = RANDOM_ICONS[i % RANDOM_ICONS.length];
      await db.createGroup(lines[i], '', color, icon);
    }
    setBulkSaving(false);
    setShowBulkModal(false);
    setBulkText('');
    loadGroups();
    triggerRefresh();
  };

  const filteredGroups = useMemo(() => {
    let result = [...groups];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(g => g.Name.toLowerCase().includes(q) || g.Description?.toLowerCase().includes(q));
    }
    if (dateFrom) {
      result = result.filter(g => g.CreatedAt && new Date(g.CreatedAt) >= new Date(dateFrom));
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setDate(toDate.getDate() + 1);
      result = result.filter(g => g.CreatedAt && new Date(g.CreatedAt) < toDate);
    }
    switch (sortBy) {
      case 'oldest': result.sort((a, b) => new Date(a.CreatedAt).getTime() - new Date(b.CreatedAt).getTime()); break;
      case 'most_words': result.sort((a, b) => (b.WordCount || 0) - (a.WordCount || 0)); break;
      case 'least_words': result.sort((a, b) => (a.WordCount || 0) - (b.WordCount || 0)); break;
      case 'name_az': result.sort((a, b) => a.Name.localeCompare(b.Name, 'vi')); break;
      default: result.sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime());
    }
    return result;
  }, [groups, search, sortBy, dateFrom, dateTo]);

  const bulkLineCount = bulkText.split('\n').filter(l => l.trim()).length;
  const hasFilter = search || dateFrom || dateTo;

  return (
    <div className="groups-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhóm Từ Vựng 📁</h1>
          <p className="page-subtitle">
            Tổ chức từ vựng theo chủ đề · {filteredGroups.length}/{groups.length} nhóm
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
            📁+ Thêm Hàng Loạt
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ Tạo Nhóm Mới</button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 32px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 160, maxWidth: 260 }}
          placeholder="🔍 Tìm nhóm..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="select" value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
          style={{ width: 170 }}>
          <option value="newest">📅 Mới nhất</option>
          <option value="oldest">📅 Cũ nhất</option>
          <option value="most_words">📈 Nhiều từ nhất</option>
          <option value="least_words">📉 Ít từ nhất</option>
          <option value="name_az">🔤 Tên A-Z</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Từ:</span>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ width: 148, fontSize: 13, padding: '7px 10px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Đến:</span>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ width: 148, fontSize: 13, padding: '7px 10px' }} />
        </div>
        {hasFilter && (
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '7px 12px' }}
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}>
            ✕ Xóa bộ lọc
          </button>
        )}
      </div>

      <div className="groups-content">
        {loading ? (
          <div className="empty-state">⏳ Đang tải...</div>
        ) : filteredGroups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{groups.length === 0 ? '📁' : '🔍'}</div>
            <p>{groups.length === 0 ? 'Chưa có nhóm từ vựng nào' : 'Không tìm thấy nhóm phù hợp'}</p>
            {groups.length === 0 && (
              <button className="btn btn-primary" onClick={openCreate}>Tạo nhóm đầu tiên</button>
            )}
          </div>
        ) : (
          <div className="groups-grid">
            {filteredGroups.map(g => (
              <div key={g.Id} className="group-card" style={{ '--group-color': g.Color } as any}>
                <div className="group-top">
                  <div className="group-icon-wrap" style={{ background: `${g.Color}22`, border: `1px solid ${g.Color}44` }}>
                    <span className="group-icon">{g.Icon}</span>
                  </div>
                  <div className="group-actions">
                    <button className="btn btn-icon btn-secondary btn-sm"
                      onClick={() => handleAddWordToGroup(g.Id)} title="Thêm từ vào nhóm">➕</button>
                    <button className="btn btn-icon btn-secondary btn-sm"
                      onClick={() => openEdit(g)} title="Chỉnh sửa">✏️</button>
                    <button className="btn btn-icon btn-danger btn-sm"
                      onClick={() => setDeleteConfirm(g.Id)} title="Xóa">🗑️</button>
                  </div>
                </div>
                <h3 className="group-name">{g.Name}</h3>
                <p className="group-desc">{g.Description || 'Không có mô tả'}</p>
                <div className="group-footer">
                  <div className="word-count" style={{ color: g.Color }}>
                    <span className="word-count-num">{g.WordCount}</span>
                    <span> từ vựng</span>
                  </div>
                  {g.CreatedAt && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {new Date(g.CreatedAt).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>
                <div className="group-bar" style={{ background: g.Color }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ─────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editGroup ? 'Chỉnh Sửa Nhóm' : 'Tạo Nhóm Mới'}</h2>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Tên Nhóm *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Business English, TOEIC Part 5..."
                  onKeyDown={e => { if (e.key === 'Enter' && form.name.trim()) handleSave(); if (e.key === 'Escape') setShowModal(false); }}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mô Tả</label>
                <textarea className="textarea" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Mô tả nội dung nhóm từ vựng..." rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Icon</label>
                <div className="icon-grid">
                  {EMOJI_ICONS.map(icon => (
                    <button key={icon} className={`icon-btn ${form.icon === icon ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, icon })}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Màu Sắc</label>
                <div className="color-grid">
                  {GROUP_COLORS.map(color => (
                    <button key={color} className={`color-btn ${form.color === color ? 'active' : ''}`}
                      style={{ background: color }} onClick={() => setForm({ ...form, color })} />
                  ))}
                </div>
              </div>
              <div className="group-preview">
                <div className="preview-label">Xem trước</div>
                <div className="preview-card" style={{ '--group-color': form.color } as any}>
                  <span style={{ fontSize: 24 }}>{form.icon}</span>
                  <span style={{ fontWeight: 600, color: form.color }}>{form.name || 'Tên nhóm'}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? '⏳ Đang lưu...' : editGroup ? '💾 Cập Nhật' : '➕ Tạo Nhóm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Create Modal ─────────────────────────── */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => !bulkSaving && setShowBulkModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📁+ Thêm Hàng Loạt Nhóm</h2>
              <button className="btn btn-icon btn-secondary" disabled={bulkSaving}
                onClick={() => setShowBulkModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  Danh sách tên nhóm <span style={{ color: 'var(--text-muted)' }}>(mỗi dòng một nhóm)</span>
                </label>
                <textarea
                  className="textarea"
                  rows={10}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={"TOEIC Part 5 - Grammar\nTOEIC Part 6 - Reading\nBusiness Vocabulary\nAcademic Writing"}
                  autoFocus
                  style={{ fontFamily: 'inherit', fontSize: 14 }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  {bulkLineCount} nhóm sẽ được tạo · Màu sắc và icon gán tự động
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" disabled={bulkSaving}
                onClick={() => setShowBulkModal(false)}>Hủy</button>
              <button className="btn btn-primary" disabled={bulkSaving || bulkLineCount === 0}
                onClick={handleBulkCreate}>
                {bulkSaving ? '⏳ Đang tạo...' : `➕ Tạo ${bulkLineCount} Nhóm`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ────────────────────────────── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: 'center', gap: 20 }}>
              <div style={{ fontSize: 48 }}>⚠️</div>
              <div>
                <h3>Xóa Nhóm Từ?</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>
                  Tất cả từ vựng trong nhóm này sẽ bị xóa vĩnh viễn!
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Hủy</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                🗑️ Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .groups-page { padding-bottom: 32px; }
        .groups-content { padding: 16px 32px; }
        .groups-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .group-card {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 20px; position: relative;
          overflow: hidden; transition: all 0.2s; cursor: default;
        }
        .group-card:hover { border-color: var(--group-color); transform: translateY(-2px); }
        .group-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
        .group-icon-wrap { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .group-icon { font-size: 24px; }
        .group-actions { display: flex; gap: 6px; opacity: 0; transition: opacity 0.2s; }
        .group-card:hover .group-actions { opacity: 1; }
        .group-name { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
        .group-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; min-height: 36px; }
        .group-footer { display: flex; align-items: center; }
        .word-count { font-size: 13px; }
        .word-count-num { font-size: 20px; font-weight: 700; }
        .group-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; }
        .empty-state { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 20px; color: var(--text-secondary); }
        .empty-icon { font-size: 64px; }
        .icon-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .icon-btn { width: 40px; height: 40px; border-radius: 8px; border: 2px solid var(--border); background: var(--bg-secondary); font-size: 18px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
        .icon-btn:hover { border-color: var(--accent); }
        .icon-btn.active { border-color: var(--accent); background: var(--accent-glow); }
        .color-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .color-btn { width: 32px; height: 32px; border-radius: 50%; border: 3px solid transparent; cursor: pointer; transition: all 0.15s; }
        .color-btn:hover { transform: scale(1.1); }
        .color-btn.active { border-color: white; transform: scale(1.15); }
        .group-preview { padding: 12px; background: var(--bg-secondary); border-radius: 8px; }
        .preview-label { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; }
        .preview-card { display: flex; align-items: center; gap: 10px; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }
      `}</style>
    </div>
  );
}
