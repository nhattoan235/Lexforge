// src/pages/TypingGamePage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notify } from '../components/Feedback/ToastHost';
import { db } from '../services/database';
import { speechService } from '../services/speech';
import { Word, WordGroup } from '../types';
import './TypingApproved.css';

type GameState = 'select' | 'playing' | 'result';
type InputLang = 'en' | 'vi';

export default function TypingGamePage() {
  const [gameState, setGameState] = useState<GameState>('select');
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [inputLang, setInputLang] = useState<InputLang>('en');
  const [words, setWords] = useState<Word[]>([]);
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [totalTyped, setTotalTyped] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongAnim, setWrongAnim] = useState(false);
  const [correctAnim, setCorrectAnim] = useState(false);
  const [history, setHistory] = useState<{ word: string; answer: string; correct: boolean }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    db.getGroups().then(res => { if (res.success) setGroups(res.data || []); });
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startGame = async () => {
    const res = selectedGroups.length > 0
      ? await db.getWordsByGroups(selectedGroups)
      : await db.getWords();

    if (!res.success || !res.data?.length) { notify('Chưa có từ để bắt đầu. Hãy thêm từ vào thư viện trước nhé.', 'info'); return; }

    const shuffled = [...res.data].sort(() => Math.random() - 0.5);
    setWords(shuffled);
    setCurrent(0); setInput(''); setScore(0); setStreak(0);
    setMaxStreak(0); setTotalTyped(0); setCorrectCount(0);
    setHistory([]); setTimeLeft(60);
    setGameState('playing');

    // Speak first word
    speechService.speak(shuffled[0].English);

    // Timer
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          endGame(shuffled, score, correctCount, maxStreak);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const endGame = async (finalWords: Word[], finalScore: number, finalCorrect: number, finalStreak: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const accuracy = finalWords.length > 0 ? (finalCorrect / Math.max(1, finalCorrect + (finalWords.length - finalCorrect))) * 100 : 0;
    await db.saveGameScore({ gameType: 'typing', score: finalScore, level: 1, wordsTyped: finalCorrect, accuracy, duration: 60 });
    setGameState('result');
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      checkAnswer();
    }
  };

  const checkAnswer = useCallback(async () => {
    if (!words[current]) return;
    const word = words[current];
    const answer = input.trim().toLowerCase();
    const target = inputLang === 'en' ? word.English.toLowerCase() : word.Vietnamese.toLowerCase();
    const isCorrect = answer === target;

    setTotalTyped(t => t + 1);
    const newHistory = [...history, { word: inputLang === 'en' ? word.Vietnamese : word.English, answer: input.trim(), correct: isCorrect }];
    setHistory(newHistory);

    if (isCorrect) {
      const newStreak = streak + 1;
      const bonus = newStreak >= 5 ? 20 : newStreak >= 3 ? 15 : 10;
      setScore(s => s + bonus);
      setStreak(newStreak);
      setMaxStreak(m => Math.max(m, newStreak));
      setCorrectCount(c => c + 1);
      setCorrectAnim(true);
      setTimeout(() => setCorrectAnim(false), 400);
      speechService.speak(word.English);
    } else {
      setStreak(0);
      setWrongAnim(true);
      setTimeout(() => setWrongAnim(false), 500);
    }

    const viewedCount = (word.TotalReviews || 0) + 1;
    const correctCount = (word.CorrectReviews || 0) + (isCorrect ? 1 : 0);
    await db.logStudySession(word.Id, word.GroupId, isCorrect, viewedCount, correctCount, 'typing');

    setInput('');
    const next = current + 1;
    if (next >= words.length) {
      // Reshuffle and continue
      const reshuffled = [...words].sort(() => Math.random() - 0.5);
      setWords(reshuffled);
      setCurrent(0);
      speechService.speak(reshuffled[0].English);
    } else {
      setCurrent(next);
      if (inputLang === 'vi') speechService.speak(words[next].English);
    }
  }, [words, current, input, streak, history, inputLang]);

  const word = words[current];
  const prompt = word ? (inputLang === 'en' ? word.Vietnamese : word.English) : '';
  const timerPct = (timeLeft / 60) * 100;
  const timerColor = timeLeft > 30 ? '#10b981' : timeLeft > 10 ? '#f59e0b' : '#ef4444';

  const toggleGroup = (id: number) => setSelectedGroups(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  if (gameState === 'select') {
    return (
      <div className="tg-select lf-training-page lf-typing-page">
        <div className="page-header lf-training-hero">
          <div>
            <span className="lf-training-eyebrow">TYPING RACE · 60 GIÂY</span><h1 className="page-title">Gõ nhanh. <em>Nhớ sâu.</em></h1>
            <p className="page-subtitle">Nhìn nghĩa, gọi lại từ trong đầu và <strong>chạm tay vào phản xạ.</strong></p>
            <div className="lf-training-tags"><span>60 giây</span><span>Combo điểm</span><span>Hai chiều Anh – Việt</span></div>
          </div>
          <div className="lf-typing-keyboard" aria-hidden="true">{['A','S','D','F','J','K','L','↵'].map(key => <i key={key}>{key}</i>)}</div>
        </div>
        <div className="tg-select-content">
          <div className="card" style={{ maxWidth: 'none' }}>
            <h3 style={{ marginBottom: 6 }}>Chuẩn bị đường đua</h3><p className="lf-typing-intro">Chọn chiều gõ và những nhóm từ bạn muốn luyện.</p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label"><i>1</i> Bạn sẽ gõ ngôn ngữ nào?</label>
              <div className="lang-btns">
                <button className={`mode-btn ${inputLang === 'en' ? 'active' : ''}`} onClick={() => setInputLang('en')}><b>Gõ tiếng Anh</b><small>Nhìn nghĩa tiếng Việt</small></button>
                <button className={`mode-btn ${inputLang === 'vi' ? 'active' : ''}`} onClick={() => setInputLang('vi')}><b>Gõ tiếng Việt</b><small>Nhìn từ tiếng Anh</small></button>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label"><i>2</i> Chọn nhóm từ</label>
              <div className="group-select-grid">
                {groups.map(g => (
                  <button key={g.Id} className={`group-select-btn ${selectedGroups.includes(g.Id) ? 'active' : ''}`} style={{ '--group-color': g.Color } as any} onClick={() => toggleGroup(g.Id)}>
                    <span>{g.Icon}</span><span>{g.Name}</span>
                    <span className="group-count">{g.WordCount} từ</span>
                    {selectedGroups.includes(g.Id) && <span className="check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="lf-typing-launch"><div><strong>Sẵn sàng trong 60 giây?</strong><small>Đúng liên tiếp để tăng điểm combo.</small></div><button className="btn btn-primary btn-lg" onClick={startGame}>Bắt đầu chơi →</button></div>
          </div>
          <aside className="lf-typing-rules"><h2>Cách chơi cực nhanh</h2><div className="lf-typing-rule-hero"><strong>60</strong><span>GIÂY BỨT TỐC</span></div><div className="lf-typing-rule"><i>1</i><b>Nhìn từ hoặc nghĩa hiện trên thẻ</b></div><div className="lf-typing-rule"><i>2</i><b>Gõ đáp án và nhấn Enter</b></div><div className="lf-typing-rule"><i>3</i><b>Đúng liên tiếp để tăng combo</b></div><div className="lf-typing-score-rules"><span><b>+10</b><small>Mỗi đáp án đúng</small></span><span><b>+15</b><small>Combo từ 3</small></span><span><b>+20</b><small>Combo từ 5</small></span></div></aside>
        </div>
        <style>{`
          .tg-select { padding-bottom: 32px; }
          .tg-select-content { padding: 24px 32px; }
          .lang-btns { display: flex; gap: 8px; }
          .mode-btn { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-secondary); font-family: inherit; font-size: 14px; cursor: pointer; transition: all 0.2s; }
          .mode-btn.active { border-color: var(--accent); background: rgba(99,102,241,0.1); color: var(--accent-bright); }
          .group-select-grid { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; }
          .group-select-btn { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 13px; cursor: pointer; transition: all 0.2s; text-align: left; }
          .group-select-btn:hover { border-color: var(--group-color); }
          .group-select-btn.active { border-color: var(--group-color); background: color-mix(in srgb, var(--group-color) 10%, transparent); }
          .group-count { font-size: 11px; color: var(--text-muted); margin-left: auto; }
          .check { color: var(--green); }
          .rules-box { background: var(--bg-secondary); border-radius: 8px; padding: 14px; margin-bottom: 16px; }
          .rules-box h4 { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
          .rules-box ul { list-style: none; display: flex; flex-direction: column; gap: 4px; }
          .rules-box li { font-size: 13px; color: var(--text-secondary); padding-left: 4px; }
          .rules-box li::before { content: '• '; color: var(--accent); }
        `}</style>
      </div>
    );
  }

  if (gameState === 'result') {
    const acc = totalTyped > 0 ? Math.round((correctCount / totalTyped) * 100) : 0;
    return (
      <div className="lf-typing-result" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 32 }}>
        <div className="lf-typing-result-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 40, maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{score >= 200 ? '🏆' : score >= 100 ? '🥈' : '🥉'}</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Về đích!</h2><p>Mỗi từ bạn gọi lại được là một bước tiến.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 24 }}>
            {[['Điểm', score, '#6366f1'], ['Đúng', correctCount, '#10b981'], ['Streak Max', maxStreak, '#f59e0b'], ['Độ chính xác', `${acc}%`, '#ec4899']].map(([l, v, c]) => (
              <div key={l as string} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: c as string }}>{v}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24, textAlign: 'left' }}>
            {history.slice(-10).map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, alignItems: 'center' }}>
                <span>{h.correct ? '✅' : '❌'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{h.word}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600, color: h.correct ? 'var(--green)' : 'var(--red)' }}>{h.answer}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setGameState('select')}>← Về menu</button>
            <button className="btn btn-primary" onClick={() => { setGameState('select'); setTimeout(startGame, 100); }}>🔄 Chơi lại</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tg-playing">
      {/* Header */}
      <div className="tg-header">
        <div className="tg-score">
          <div className="tg-score-num">{score}</div>
          <div className="tg-score-label">Điểm</div>
        </div>
        <div className="tg-timer-wrap">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke={timerColor} strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - timerPct / 100)}`}
              transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }} />
            <text x="40" y="46" textAnchor="middle" fill={timerColor} fontSize="20" fontWeight="700" fontFamily="'JetBrains Mono', monospace">{timeLeft}</text>
          </svg>
        </div>
        <div className="tg-streak">
          <div className="tg-streak-num" style={{ color: streak >= 5 ? '#f59e0b' : streak >= 3 ? '#f97316' : 'var(--text-secondary)' }}>
            {streak >= 3 ? '🔥' : '⚡'} {streak}
          </div>
          <div className="tg-score-label">Streak</div>
        </div>
      </div>

      {/* Game area */}
      <div className="tg-game-area">
        <div className={`tg-prompt-card ${wrongAnim ? 'shake' : ''} ${correctAnim ? 'correct-flash' : ''}`}>
          <div className="tg-prompt-label">{inputLang === 'en' ? 'Gõ tiếng Anh của:' : 'Gõ nghĩa tiếng Việt của:'}</div>
          <div className="tg-prompt">{prompt}</div>
          {inputLang === 'vi' && word && (
            <button className="fc-speak" onClick={() => speechService.speak(word.English)} style={{ position: 'static', marginTop: 8, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>🔊</button>
          )}
        </div>

        <div className="tg-input-area">
          <input
            ref={inputRef}
            className="tg-input"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={inputLang === 'en' ? 'Gõ tiếng Anh...' : 'Gõ nghĩa tiếng Việt...'}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          <button className="btn btn-primary" onClick={checkAnswer}>Enter ↵</button>
        </div>

        <div className="tg-mini-stats">
          <span>✅ {correctCount} đúng</span>
          <span>📝 {totalTyped} lần</span>
          <span>🏆 Max streak: {maxStreak}</span>
        </div>
      </div>

      <style>{`
        .tg-playing { display: flex; flex-direction: column; align-items: center; padding: 32px; gap: 24px; min-height: 100vh; }
        .tg-header { display: flex; align-items: center; gap: 48px; }
        .tg-score { text-align: center; }
        .tg-score-num { font-size: 40px; font-weight: 700; color: var(--accent-bright); font-family: 'JetBrains Mono', monospace; }
        .tg-score-label { font-size: 12px; color: var(--text-muted); }
        .tg-timer-wrap { }
        .tg-streak { text-align: center; }
        .tg-streak-num { font-size: 28px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
        .tg-game-area { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 20px; }
        .tg-prompt-card {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 16px; padding: 32px; text-align: center;
          min-height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .tg-prompt-card.shake { animation: shake 0.4s ease; border-color: var(--red); }
        .tg-prompt-card.correct-flash { border-color: var(--green); background: rgba(16,185,129,0.05); }
        .tg-prompt-label { font-size: 13px; color: var(--text-muted); margin-bottom: 12px; }
        .tg-prompt { font-size: 32px; font-weight: 700; color: var(--text-primary); }
        .tg-input-area { display: flex; gap: 10px; }
        .tg-input { flex: 1; padding: 14px 18px; background: var(--bg-secondary); border: 2px solid var(--border); border-radius: 10px; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; font-size: 20px; outline: none; transition: border-color 0.2s; }
        .tg-input:focus { border-color: var(--accent); }
        .tg-mini-stats { display: flex; gap: 20px; justify-content: center; font-size: 13px; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
