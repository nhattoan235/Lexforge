import React, { useState, useEffect } from 'react';
import { db, dbService } from '../services/database';
import { useApp } from '../App';

export default function SettingsPage() {
  const [dailyGoal, setDailyGoal] = useState('20');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [autoDailyVocab, setAutoDailyVocab] = useState(true);
  const [vocabCategory, setVocabCategory] = useState('toeic');
  const [saved, setSaved] = useState(false);
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [dbPath, setDbPath] = useState('');

  useEffect(() => {
    loadSettings();
    loadDbInfo();
    (window as any).electronAPI?.dbGetPath?.().then((p: string) => setDbPath(p));
  }, []);

  const loadSettings = async () => {
    const [goalRes, speakRes, keyRes, dailyVocabRes, catRes] = await Promise.all([
      db.getSetting('daily_goal'),
      db.getSetting('auto_speak'),
      db.getSetting('groq_api_key'),
      db.getSetting('auto_daily_vocab'),
      db.getSetting('daily_vocab_category'),
    ]);
    if (goalRes.success && goalRes.data?.[0]) setDailyGoal(goalRes.data[0].SettingValue);
    if (speakRes.success && speakRes.data?.[0]) setAutoSpeak(speakRes.data[0].SettingValue === 'true');
    if (keyRes.success && keyRes.data?.[0]) setApiKey(keyRes.data[0].SettingValue);
    if (dailyVocabRes.success && dailyVocabRes.data?.[0]) {
      setAutoDailyVocab(dailyVocabRes.data[0].SettingValue === 'true');
    } else {
      // Default to true if not set
      setAutoDailyVocab(true);
    }
    if (catRes.success && catRes.data?.[0]) {
      setVocabCategory(catRes.data[0].SettingValue);
    } else {
      setVocabCategory('toeic');
    }
  };

  const loadDbInfo = async () => {
    const res = await dbService.query(`
      SELECT
        (SELECT COUNT(*) FROM Words) as WordCount,
        (SELECT COUNT(*) FROM WordGroups) as GroupCount,
        (SELECT COUNT(*) FROM StudySessions) as SessionCount,
        (SELECT COUNT(*) FROM GameScores) as GameCount
    `);
    if (res.success && res.data?.[0]) setDbInfo(res.data[0]);
  };

  const handleSave = async () => {
    // ĐỔI THÀNH: Lưu groq_api_key thay vì gemini_api_key
    await Promise.all([
      db.setSetting('daily_goal', dailyGoal), 
      db.setSetting('auto_speak', String(autoSpeak)), 
      db.setSetting('groq_api_key', apiKey),
      db.setSetting('auto_daily_vocab', String(autoDailyVocab)),
      db.setSetting('daily_vocab_category', vocabCategory),
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Xóa toàn bộ lịch sử học tập và điểm game?')) return;
    await dbService.query('DELETE FROM GameScores');
    await dbService.query('DELETE FROM StudySessions');
    alert('✅ Đã xóa lịch sử!');
    loadDbInfo();
  };

  const handleClearAll = async () => {
    if (!window.confirm('⚠️ XÓA TOÀN BỘ dữ liệu bao gồm từ vựng? KHÔNG THỂ HOÀN TÁC!')) return;
    await dbService.query('DELETE FROM Words');
    await dbService.query('DELETE FROM WordGroups');
    await dbService.query('DELETE FROM GameScores');
    await dbService.query('DELETE FROM StudySessions');
    alert('✅ Đã xóa toàn bộ!');
    loadDbInfo();
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cài Đặt ⚙️</h1>
          <p className="page-subtitle">Tuỳ chỉnh ứng dụng</p>
        </div>
      </div>

      <div className="settings-content">
        {/* Học tập */}
        <div className="card settings-card">
          <h3 className="settings-section-title">📚 Học Tập</h3>
          <div className="settings-row">
            <div className="settings-label">
              <div className="sl-title">Mục tiêu từ mỗi ngày</div>
              <div className="sl-desc">Số từ cần ôn để hoàn thành mục tiêu ngày</div>
            </div>
            <div className="settings-control">
              <input className="input" style={{ width: 80, textAlign: 'center' }} type="number" min={5} max={200} value={dailyGoal} onChange={e => setDailyGoal(e.target.value)} />
              <span className="settings-unit">từ/ngày</span>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-label">
              <div className="sl-title">🔊 Tự động đọc từ</div>
              <div className="sl-desc">Phát âm tự động khi lật flashcard</div>
            </div>
            <div className={`toggle ${autoSpeak ? 'on' : ''}`} onClick={() => setAutoSpeak(!autoSpeak)} />
          </div>
          <div className="settings-row">
            <div className="settings-label">
              <div className="sl-title">🪄 Tự động thêm từ vựng hàng ngày</div>
              <div className="sl-desc">Mỗi ngày tự sinh 10 từ theo chủ đề ngẫu nhiên bằng AI khi mở app</div>
            </div>
            <div className={`toggle ${autoDailyVocab ? 'on' : ''}`} onClick={() => setAutoDailyVocab(!autoDailyVocab)} />
          </div>
          {autoDailyVocab && (
            <div className="settings-row">
              <div className="settings-label">
                <div className="sl-title">🎯 Lộ trình từ vựng hàng ngày</div>
                <div className="sl-desc">Chọn lộ trình để AI sinh từ tương ứng</div>
              </div>
              <div className="settings-control">
                <select
                  value={vocabCategory}
                  onChange={e => setVocabCategory(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: 13,
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="toeic">TOEIC Vocabulary</option>
                  <option value="ielts">IELTS Academic</option>
                  <option value="communication">Giao tiếp thông dụng</option>
                </select>
              </div>
            </div>
          )}
          <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
            {saved ? '✅ Đã lưu!' : '💾 Lưu cài đặt'}
          </button>
        </div>


        {/* ĐỔI THÀNH: AI Coach Groq API Key */}
        <div className="card settings-card" style={{ borderColor: 'rgba(99,102,241,0.25)' }}>
          <h3 className="settings-section-title">🤖 AI Coach — Groq Cloud API Key</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Cần có Groq API key để dùng AI Coach tốc độ siêu nhanh. Lấy key tại{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-bright)', textDecoration: 'none', fontWeight: 600 }}>
              console.groq.com/keys
            </a>
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="gsk_..."
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13, outline: 'none',
              }}
            />
            <button onClick={() => setShowKey(s => !s)} style={{
              padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
            }}>
              {showKey ? '🙈 Ẩn' : '👁 Hiện'}
            </button>
          </div>
          {apiKey && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#22c55e' }}>
              ✓ API key đã nhập ({apiKey.length} ký tự) — nhấn Lưu để áp dụng
            </div>
          )}
        </div>

        {/* Database info */}
        <div className="card settings-card">
          <h3 className="settings-section-title">🗄️ Database (SQLite)</h3>
          {dbInfo && (
            <div className="db-info-grid">
              {[['Từ vựng', `${dbInfo.WordCount} từ`], ['Nhóm từ', `${dbInfo.GroupCount} nhóm`], ['Phiên học', `${dbInfo.SessionCount} lần`], ['Điểm game', `${dbInfo.GameCount} ván`]].map(([k, v]) => (
                <div key={k} className="db-info-item">
                  <span className="db-key">{k}</span>
                  <span className="db-val">{v}</span>
                </div>
              ))}
            </div>
          )}
          {dbPath && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
              📁 File DB: <span style={{ color: 'var(--accent-bright)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{dbPath}</span>
            </div>
          )}
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'rgba(16,185,129,0.08)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(16,185,129,0.2)' }}>
            ✅ SQLite — Không cần cài đặt gì thêm. Data lưu trực tiếp trên máy bạn, backup bằng cách copy file DB.
          </div>
        </div>

        {/* Danger zone */}
        <div className="card settings-card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
          <h3 className="settings-section-title" style={{ color: 'var(--red)' }}>⚠️ Vùng Nguy Hiểm</h3>
          <div className="settings-row">
            <div className="settings-label">
              <div className="sl-title">Xóa lịch sử học tập</div>
              <div className="sl-desc">Xóa phiên học và điểm game (giữ lại từ vựng)</div>
            </div>
            <button className="btn btn-danger" onClick={handleClearHistory}>🗑️ Xóa lịch sử</button>
          </div>
          <div className="settings-row">
            <div className="settings-label">
              <div className="sl-title">Xóa toàn bộ dữ liệu</div>
              <div className="sl-desc">Xóa tất cả từ vựng, nhóm, lịch sử</div>
            </div>
            <button className="btn btn-danger" onClick={handleClearAll}>💣 Xóa tất cả</button>
          </div>
        </div>

        {/* About */}
        <div className="card settings-card">
          <h3 className="settings-section-title">ℹ️ Về Ứng Dụng</h3>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 48 }}>📚</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>TOEIC Vocab Master</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Version 1.0.0 · SQLite Edition</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
                Ứng dụng ôn luyện từ vựng TOEIC với Flashcard SRS, các game từ vựng và chế độ Multiplayer.
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .settings-page { padding-bottom: 32px; }
        .settings-content { padding: 24px 32px; display: flex; flex-direction: column; gap: 16px; max-width: 700px; }
        .settings-card { display: flex; flex-direction: column; gap: 20px; }
        .settings-section-title { font-size: 15px; font-weight: 600; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
        .settings-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
        .settings-label { flex: 1; }
        .sl-title { font-size: 14px; font-weight: 500; }
        .sl-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .settings-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .settings-unit { font-size: 13px; color: var(--text-muted); }
        .toggle { width: 44px; height: 24px; border-radius: 12px; background: var(--bg-hover); position: relative; cursor: pointer; transition: background 0.2s; border: 1px solid var(--border); flex-shrink: 0; }
        .toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--text-muted); transition: all 0.2s; }
        .toggle.on { background: var(--accent); }
        .toggle.on::after { left: 22px; background: white; }
        .db-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: var(--bg-secondary); border-radius: 8px; padding: 16px; }
        .db-info-item { display: flex; justify-content: space-between; font-size: 13px; }
        .db-key { color: var(--text-muted); }
        .db-val { font-weight: 600; color: var(--accent-bright); font-family: 'JetBrains Mono', monospace; }
      `}</style>
    </div>
  );
}