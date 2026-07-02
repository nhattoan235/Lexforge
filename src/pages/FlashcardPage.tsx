// src/pages/FlashcardPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { db, calculateNextReview } from '../services/database';
import { speechService } from '../services/speech';
import { Word, WordGroup } from '../types';
import { lstmService } from '../services/lstmScheduler';

type StudyMode = 'select' | 'studying' | 'result';
type CardSide = 'front' | 'back';

export default function FlashcardPage() {
  const [mode, setMode] = useState<StudyMode>('select');
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [studyMode, setStudyMode] = useState<'all' | 'due'>('all');
  const [words, setWords] = useState<Word[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<{ word: Word; correct: boolean }[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(true);

  useEffect(() => {
    db.getGroups().then(res => { if (res.success) setGroups(res.data || []); });
  }, []);

  const startStudy = async () => {
    let res;
    if (studyMode === 'due') {
      res = await db.getDueWords(50);
    } else {
      res = selectedGroups.length > 0
        ? await db.getWordsByGroups(selectedGroups)
        : await db.getWords();
    }
    if (res.success && res.data?.length) {
      // Shuffle
      const shuffled = [...res.data].sort(() => Math.random() - 0.5);
      setWords(shuffled);
      setCurrent(0);
      setFlipped(false);
      setResults([]);
      setStartTime(Date.now());
      setMode('studying');
      if (autoSpeak) setTimeout(() => speechService.speak(shuffled[0].English), 300);
    } else {
      alert('Không có từ nào để ôn luyện!');
    }
  };

  const handleAnswer = async (correct: boolean) => {
    const word = words[current];
    const { newLevel, nextReview } = calculateNextReview(word.Level, correct);
    await db.updateWordSRS(word.Id, newLevel, nextReview, correct);

    // Log to StudySessionsLSTM for AI scheduling
    const viewedCount = (word.TotalReviews || 0) + 1;
    const correctCount = (word.CorrectReviews || 0) + (correct ? 1 : 0);
    await lstmService.logStudyResult(word.Id, word.GroupId, correct, viewedCount, correctCount, 'flashcard');

    const newResults = [...results, { word, correct }];
    setResults(newResults);

    if (current + 1 >= words.length) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      await db.saveSession({
        mode: 'flashcard',
        score: newResults.filter(r => r.correct).length * 10,
        totalWords: words.length,
        correctWords: newResults.filter(r => r.correct).length,
        duration,
        groupIds: selectedGroups.join(','),
      });
      setMode('result');
    } else {
      const nextWord = words[current + 1];
      setCurrent(c => c + 1);
      setFlipped(false);
      if (autoSpeak) setTimeout(() => speechService.speak(nextWord.English), 400);
    }
  };

  const toggleGroup = (id: number) => {
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const word = words[current];
  const progress = words.length > 0 ? ((current) / words.length) * 100 : 0;

  if (mode === 'select') {
    return (
      <div className="fc-select">
        <div className="page-header">
          <div>
            <h1 className="page-title">Flashcard 🃏</h1>
            <p className="page-subtitle">Ôn luyện từ vựng bằng thẻ ghi nhớ</p>
          </div>
        </div>

        <div className="fc-select-content">
          <div className="fc-config-card">
            <h3>⚙️ Cấu Hình Học</h3>

            <div className="config-section">
              <label className="form-label">Chế độ học</label>
              <div className="mode-btns">
                <button className={`mode-btn ${studyMode === 'all' ? 'active' : ''}`} onClick={() => setStudyMode('all')}>
                  📚 Tất cả từ
                </button>
                <button className={`mode-btn ${studyMode === 'due' ? 'active' : ''}`} onClick={() => setStudyMode('due')}>
                  ⏰ Từ cần ôn (SRS)
                </button>
              </div>
            </div>

            {studyMode === 'all' && (
              <div className="config-section">
                <label className="form-label">Chọn nhóm từ <span style={{ color: 'var(--text-muted)' }}>(để trống = tất cả)</span></label>
                <div className="group-select-grid">
                  {groups.map(g => (
                    <button
                      key={g.Id}
                      className={`group-select-btn ${selectedGroups.includes(g.Id) ? 'active' : ''}`}
                      style={{ '--group-color': g.Color } as any}
                      onClick={() => toggleGroup(g.Id)}
                    >
                      <span>{g.Icon}</span>
                      <span>{g.Name}</span>
                      <span className="group-count">{g.WordCount} từ</span>
                      {selectedGroups.includes(g.Id) && <span className="check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="config-section">
              <div className="toggle-row">
                <label className="form-label">🔊 Tự động đọc từ</label>
                <div className={`toggle ${autoSpeak ? 'on' : ''}`} onClick={() => setAutoSpeak(!autoSpeak)} />
              </div>
            </div>

            <button className="btn btn-primary btn-lg w-full" onClick={startStudy}>
              ▶ Bắt Đầu Học
            </button>
          </div>

          <div className="srs-info">
            <h4>📊 Hệ thống SRS (Spaced Repetition)</h4>
            <p>App sử dụng thuật toán Spaced Repetition để nhắc bạn ôn đúng lúc sắp quên:</p>
            <div className="srs-levels">
              {[['Mới', '1 ngày', '#475569'], ['Cơ bản', '3 ngày', '#f59e0b'], ['Đang học', '7 ngày', '#f97316'], ['Quen', '14 ngày', '#10b981'], ['Thuộc', '30 ngày', '#6366f1'], ['Thành thạo', '90 ngày', '#ec4899']].map(([label, day, color]) => (
                <div key={label} className="srs-level">
                  <div className="srs-dot" style={{ background: color as string }} />
                  <span className="srs-label">{label}</span>
                  <span className="srs-day">{day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <style>{`
          .fc-select { padding-bottom: 32px; }
          .fc-select-content { padding: 24px 32px; display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
          .fc-config-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; display: flex; flex-direction: column; gap: 20px; }
          .fc-config-card h3 { font-size: 16px; font-weight: 600; }
          .config-section { display: flex; flex-direction: column; gap: 10px; }
          .mode-btns { display: flex; gap: 8px; }
          .mode-btn { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-secondary); font-family: inherit; font-size: 14px; cursor: pointer; transition: all 0.2s; }
          .mode-btn.active { border-color: var(--accent); background: rgba(99,102,241,0.1); color: var(--accent-bright); }
          .group-select-grid { display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto; }
          .group-select-btn { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 14px; cursor: pointer; transition: all 0.2s; text-align: left; }
          .group-select-btn:hover { border-color: var(--group-color); }
          .group-select-btn.active { border-color: var(--group-color); background: color-mix(in srgb, var(--group-color) 10%, transparent); }
          .group-count { font-size: 12px; color: var(--text-muted); margin-left: auto; }
          .check { color: var(--green); font-weight: 700; }
          .toggle-row { display: flex; align-items: center; justify-content: space-between; }
          .toggle { width: 44px; height: 24px; border-radius: 12px; background: var(--bg-hover); position: relative; cursor: pointer; transition: background 0.2s; border: 1px solid var(--border); }
          .toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--text-muted); transition: all 0.2s; }
          .toggle.on { background: var(--accent); }
          .toggle.on::after { left: 22px; background: white; }
          .srs-info { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
          .srs-info h4 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
          .srs-info p { font-size: 12px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px; }
          .srs-levels { display: flex; flex-direction: column; gap: 8px; }
          .srs-level { display: flex; align-items: center; gap: 10px; }
          .srs-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
          .srs-label { font-size: 13px; flex: 1; }
          .srs-day { font-size: 12px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
        `}</style>
      </div>
    );
  }

  if (mode === 'result') {
    const correct = results.filter(r => r.correct).length;
    const accuracy = Math.round((correct / results.length) * 100);
    return (
      <div className="fc-result">
        <div className="result-card">
          <div className="result-emoji">{accuracy >= 80 ? '🏆' : accuracy >= 60 ? '👍' : '💪'}</div>
          <h2>Kết Quả Học</h2>
          <div className="result-stats">
            <div className="result-stat">
              <div className="result-num green">{correct}</div>
              <div>Đúng</div>
            </div>
            <div className="result-stat">
              <div className="result-num red">{results.length - correct}</div>
              <div>Sai</div>
            </div>
            <div className="result-stat">
              <div className="result-num accent">{accuracy}%</div>
              <div>Chính xác</div>
            </div>
          </div>
          <div className="result-list">
            {results.map((r, i) => (
              <div key={i} className={`result-item ${r.correct ? 'correct' : 'wrong'}`}>
                <span>{r.correct ? '✅' : '❌'}</span>
                <span className="result-word">{r.word.English}</span>
                <span className="result-vi">{r.word.Vietnamese}</span>
              </div>
            ))}
          </div>
          <div className="result-actions">
            <button className="btn btn-secondary" onClick={() => setMode('select')}>← Quay lại</button>
            <button className="btn btn-primary" onClick={() => { setResults([]); startStudy(); }}>🔄 Học lại</button>
          </div>
        </div>

        <style>{`
          .fc-result { display: flex; align-items: center; justify-content: center; min-height: 80vh; padding: 32px; }
          .result-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 40px; max-width: 500px; width: 100%; text-align: center; }
          .result-emoji { font-size: 64px; margin-bottom: 16px; }
          .result-card h2 { font-size: 24px; font-weight: 700; margin-bottom: 24px; }
          .result-stats { display: flex; justify-content: center; gap: 40px; margin-bottom: 24px; }
          .result-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 13px; color: var(--text-secondary); }
          .result-num { font-size: 36px; font-weight: 700; }
          .result-num.green { color: var(--green); }
          .result-num.red { color: var(--red); }
          .result-num.accent { color: var(--accent-bright); }
          .result-list { max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 24px; text-align: left; }
          .result-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
          .result-item:last-child { border-bottom: none; }
          .result-item.wrong { background: rgba(239,68,68,0.05); }
          .result-word { font-weight: 600; flex: 1; }
          .result-vi { color: var(--text-secondary); }
          .result-actions { display: flex; gap: 12px; justify-content: center; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fc-study">
      {/* Progress */}
      <div className="fc-progress-bar">
        <div className="fc-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="fc-counter">{current + 1} / {words.length}</div>

      {/* Card */}
      <div className="fc-area">
        <div className={`fc-card ${flipped ? 'flipped' : ''}`} onClick={() => { setFlipped(!flipped); if (!flipped && autoSpeak) speechService.speak(word.English); }}>
          <div className="fc-face fc-front">
            <div className="fc-pos">{word?.PartOfSpeech}</div>
            <div className="fc-word">{word?.English}</div>
            <div className="fc-pronunciation">{word?.Pronunciation}</div>
            <div className="fc-hint">Nhấn để xem nghĩa →</div>
            <div className="fc-group-tag" style={{ background: `${word?.GroupColor}22`, color: word?.GroupColor }}>
              {word?.GroupName}
            </div>
            <button className="fc-speak" onClick={e => { e.stopPropagation(); speechService.speak(word?.English); }}>🔊</button>
          </div>
          <div className="fc-face fc-back">
            <div className="fc-word-small">{word?.English}</div>
            <div className="fc-vi">{word?.Vietnamese}</div>
            {word?.Example && (
              <div className="fc-example">
                <div className="fc-example-en">"{word.Example}"</div>
                {word.ExampleVi && <div className="fc-example-vi">{word.ExampleVi}</div>}
              </div>
            )}
          </div>
        </div>

        {flipped && (
          <div className="fc-answer-btns">
            <button className="answer-btn wrong-btn" onClick={() => handleAnswer(false)}>
              <span>😞</span><span>Chưa thuộc</span>
            </button>
            <button className="answer-btn correct-btn" onClick={() => handleAnswer(true)}>
              <span>😊</span><span>Đã thuộc</span>
            </button>
          </div>
        )}
      </div>

      <button className="btn btn-secondary fc-quit" onClick={() => setMode('select')}>✕ Dừng học</button>

      <style>{`
        .fc-study { display: flex; flex-direction: column; align-items: center; padding: 20px; min-height: 100vh; }
        .fc-progress-bar { width: 100%; max-width: 600px; height: 4px; background: var(--border); border-radius: 2px; margin-bottom: 12px; }
        .fc-progress-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.4s ease; }
        .fc-counter { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; font-family: 'JetBrains Mono', monospace; }
        .fc-area { display: flex; flex-direction: column; align-items: center; gap: 24px; width: 100%; max-width: 600px; }
        .fc-card {
          width: 100%; height: 340px; position: relative;
          transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.4,0,0.2,1);
          cursor: pointer;
        }
        .fc-card.flipped { transform: rotateY(180deg); }
        .fc-face {
          position: absolute; inset: 0; border-radius: 20px;
          background: var(--bg-card); border: 1px solid var(--border);
          backface-visibility: hidden; display: flex; flex-direction: column;
          align-items: center; justify-content: center; padding: 32px;
        }
        .fc-face:hover { border-color: var(--border-bright); }
        .fc-back { transform: rotateY(180deg); }
        .fc-pos { font-size: 12px; color: var(--accent-bright); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
        .fc-word { font-size: 48px; font-weight: 700; text-align: center; margin-bottom: 8px; }
        .fc-pronunciation { font-size: 20px; color: var(--accent-bright); font-family: 'JetBrains Mono', monospace; margin-bottom: 16px; }
        .fc-hint { font-size: 13px; color: var(--text-muted); }
        .fc-group-tag { position: absolute; top: 16px; left: 16px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .fc-speak { position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 20px; cursor: pointer; }
        .fc-word-small { font-size: 18px; color: var(--text-muted); margin-bottom: 8px; }
        .fc-vi { font-size: 36px; font-weight: 700; color: var(--green); text-align: center; margin-bottom: 16px; }
        .fc-example { background: var(--bg-secondary); border-radius: 10px; padding: 14px; text-align: center; width: 100%; }
        .fc-example-en { font-size: 14px; font-style: italic; color: var(--text-secondary); margin-bottom: 6px; }
        .fc-example-vi { font-size: 13px; color: var(--text-muted); }
        .fc-answer-btns { display: flex; gap: 16px; width: 100%; }
        .answer-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px; border-radius: 12px; border: none; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .wrong-btn { background: rgba(239,68,68,0.1); color: var(--red); border: 1px solid rgba(239,68,68,0.3); }
        .wrong-btn:hover { background: rgba(239,68,68,0.2); transform: scale(1.02); }
        .wrong-btn span:first-child { font-size: 28px; }
        .correct-btn { background: rgba(16,185,129,0.1); color: var(--green); border: 1px solid rgba(16,185,129,0.3); }
        .correct-btn:hover { background: rgba(16,185,129,0.2); transform: scale(1.02); }
        .correct-btn span:first-child { font-size: 28px; }
        .fc-quit { margin-top: 8px; }
      `}</style>
    </div>
  );
}
