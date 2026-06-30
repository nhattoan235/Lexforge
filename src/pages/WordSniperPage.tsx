// src/pages/WordSniperPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/database';
import { speechService } from '../services/speech';
import { Word, WordGroup } from '../types';

type GameState = 'select' | 'countdown' | 'playing' | 'result';
type GameMode = 'normal' | 'sudden_death' | 'hardcore';
type InputLang = 'en' | 'vi' | 'audio';

interface SniperTarget {
  word: Word;
  showTime: number;     // ms word was shown
  deadline: number;     // timestamp must answer before
  answered: boolean;
  correct: boolean;
  reactionMs: number;
}

interface FloatEffect {
  id: number;
  text: string;
  color: string;
  x: number;
}

const MODE_CONFIG = {
  normal:       { label: '🎯 Normal',       desc: 'Trả lời đúng càng nhanh càng nhiều điểm', timePerWord: 4000, lives: 3,   rounds: 20 },
  sudden_death: { label: '💀 Sudden Death', desc: 'Sai 1 lần là thua ngay!',                 timePerWord: 3500, lives: 1,   rounds: 999 },
  hardcore:     { label: '😈 Hardcore',     desc: 'Thời gian cực ít, không có cơ hội thứ 2', timePerWord: 2000, lives: 1,   rounds: 999 },
};

export default function WordSniperPage() {
  const [gameState, setGameState] = useState<GameState>('select');
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [mode, setMode] = useState<GameMode>('normal');
  const [inputLang, setInputLang] = useState<InputLang>('en');

  // Game state
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [input, setInput] = useState('');
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(100); // percent
  const [history, setHistory] = useState<SniperTarget[]>([]);
  const [floats, setFloats] = useState<FloatEffect[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [totalReaction, setTotalReaction] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [scopeActive, setScopeActive] = useState(false);
  const [muzzleFlash, setMuzzleFlash] = useState(false);
  const [screenFlash, setScreenFlash] = useState<'red' | 'green' | null>(null);

  const wordRef = useRef<Word | null>(null);
  const wordsPool = useRef<Word[]>([]);
  const wordStartTime = useRef(0);
  const timerRef = useRef<any>(null);
  const deadlineRef = useRef<any>(null);
  const floatId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const roundRef = useRef(0);
  const correctRef = useRef(0);
  const reactionRef = useRef(0);
  const isEndingRef = useRef(false);

  useEffect(() => {
    db.getGroups().then(res => { if (res.success) setGroups(res.data || []); });
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (deadlineRef.current) clearTimeout(deadlineRef.current);
  };

  const addFloat = (text: string, color: string, x = 50) => {
    const id = ++floatId.current;
    setFloats(prev => [...prev, { id, text, color, x }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1000);
  };

  const triggerMuzzle = () => {
    setMuzzleFlash(true);
    setTimeout(() => setMuzzleFlash(false), 150);
  };

  const showNextWord = useCallback((pool: Word[], currentRound: number) => {
    if (isEndingRef.current) return;
    cleanup();

    const cfg = MODE_CONFIG[mode];
    if (currentRound >= cfg.rounds) {
      endGame();
      return;
    }

    const word = pool[Math.floor(Math.random() * pool.length)];
    wordRef.current = word;
    wordStartTime.current = Date.now();
    setCurrentWord(word);
    setInput('');
    setLastResult(null);
    roundRef.current = currentRound + 1;
    setRound(currentRound + 1);

    if (inputLang === 'audio') speechService.speak(word.English);

    // Scope animation
    setScopeActive(false);
    setTimeout(() => setScopeActive(true), 50);

    // Timer countdown
    const totalTime = cfg.timePerWord;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - wordStartTime.current;
      const pct = Math.max(0, 100 - (elapsed / totalTime) * 100);
      setTimeLeft(pct);
    }, 50);

    // Timeout = wrong
    deadlineRef.current = setTimeout(() => {
      handleTimeout(word, pool, currentRound + 1);
    }, totalTime);

    setTimeout(() => inputRef.current?.focus(), 50);
  }, [mode, inputLang]);

  const handleTimeout = useCallback((word: Word, pool: Word[], currentRound: number) => {
    if (isEndingRef.current) return;
    cleanup();
    comboRef.current = 0;
    setCombo(0);
    setLastResult('timeout');
    setScreenFlash('red');
    setTimeout(() => setScreenFlash(null), 300);
    addFloat('⏱️ HẾT GIỜ!', '#ef4444', 50);

    setHistory(prev => [...prev, {
      word, showTime: MODE_CONFIG[mode].timePerWord, deadline: 0,
      answered: false, correct: false, reactionMs: 0
    }]);

    const newLives = livesRef.current - 1;
    livesRef.current = newLives;
    setLives(newLives);

    if (newLives <= 0) { endGame(); return; }
    setTimeout(() => showNextWord(pool, currentRound), 800);
  }, [mode, showNextWord]);

  const endGame = useCallback(() => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    cleanup();
    setCurrentWord(null);
    db.saveGameScore({
      gameType: 'sniper', score: scoreRef.current, level: 1,
      wordsTyped: correctRef.current, accuracy: roundRef.current > 0 ? (correctRef.current / roundRef.current) * 100 : 0,
      duration: 0
    });
    setTimeout(() => setGameState('result'), 300);
  }, []);

  const startCountdown = async () => {
    const res = selectedGroups.length > 0
      ? await db.getWordsByGroups(selectedGroups)
      : await db.getWords();
    if (!res.success || !res.data?.length) { alert('Không có từ!'); return; }

    wordsPool.current = res.data;
    setGameState('countdown');
    setCountdown(3);
    isEndingRef.current = false;
    livesRef.current = MODE_CONFIG[mode].lives;
    scoreRef.current = 0; comboRef.current = 0; roundRef.current = 0;
    correctRef.current = 0; reactionRef.current = 0;
    setLives(MODE_CONFIG[mode].lives); setScore(0); setCombo(0);
    setRound(0); setHistory([]); setFloats([]); setMaxCombo(0);
    setCorrectCount(0); setTotalReaction(0);

    let c = 3;
    const cdTimer = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(cdTimer);
        setGameState('playing');
        showNextWord(wordsPool.current, 0);
      }
    }, 1000);
  };

  const checkAnswer = useCallback(() => {
    if (!wordRef.current || isEndingRef.current) return;
    const word = wordRef.current;
    const ans = input.trim().toLowerCase();
    const target = inputLang === 'en' ? word.English.toLowerCase()
      : inputLang === 'vi' ? word.Vietnamese.toLowerCase()
      : word.English.toLowerCase();

    const reactionMs = Date.now() - wordStartTime.current;
    const isCorrect = ans === target;

    cleanup();
    triggerMuzzle();

    if (isCorrect) {
      const cfg = MODE_CONFIG[mode];
      const timeBonus = Math.max(0, cfg.timePerWord - reactionMs);
      const newCombo = comboRef.current + 1;
      comboRef.current = newCombo;
      setCombo(newCombo);
      setMaxCombo(m => Math.max(m, newCombo));

      const speedPts = Math.round(timeBonus / 50);
      const comboPts = newCombo >= 10 ? 50 : newCombo >= 5 ? 30 : newCombo >= 3 ? 20 : 10;
      const totalPts = speedPts + comboPts;
      scoreRef.current += totalPts;
      correctRef.current += 1;
      reactionRef.current += reactionMs;
      setScore(scoreRef.current);
      setCorrectCount(correctRef.current);
      setTotalReaction(reactionRef.current);

      setLastResult('correct');
      setScreenFlash('green');
      setTimeout(() => setScreenFlash(null), 200);

      if (newCombo >= 5) addFloat(`🔥 COMBO x${newCombo}!`, '#f59e0b', 50);
      if (reactionMs < 800) addFloat('⚡ LIGHTNING!', '#60a5fa', 30);
      else if (reactionMs < 1500) addFloat('🎯 FAST!', '#a78bfa', 70);
      addFloat(`+${totalPts}`, '#4ade80', 50);

      setHistory(prev => [...prev, { word, showTime: reactionMs, deadline: 0, answered: true, correct: true, reactionMs }]);
      setTimeout(() => showNextWord(wordsPool.current, roundRef.current), 400);
    } else {
      comboRef.current = 0;
      setCombo(0);
      setLastResult('wrong');
      setScreenFlash('red');
      setTimeout(() => setScreenFlash(null), 300);
      addFloat('❌ SAI!', '#ef4444', 50);

      const newLives = livesRef.current - 1;
      livesRef.current = newLives;
      setLives(newLives);
      setHistory(prev => [...prev, { word, showTime: reactionMs, deadline: 0, answered: true, correct: false, reactionMs }]);

      if (newLives <= 0) { endGame(); return; }
      setInput('');
      setTimeout(() => showNextWord(wordsPool.current, roundRef.current), 600);
    }
  }, [input, inputLang, mode, showNextWord, endGame]);

  const toggleGroup = (id: number) => setSelectedGroups(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const cfg = MODE_CONFIG[mode];
  const avgReaction = correctCount > 0 ? Math.round(totalReaction / correctCount) : 0;
  const accuracy = round > 0 ? Math.round((correctCount / round) * 100) : 0;
  const timerColor = timeLeft > 50 ? '#10b981' : timeLeft > 25 ? '#f59e0b' : '#ef4444';

  // SELECT screen
  if (gameState === 'select') return (
    <div className="ws-select">
      <div className="page-header">
        <div>
          <h1 className="page-title">Word Sniper 🎯</h1>
          <p className="page-subtitle">Từ hiện cực nhanh — phản xạ ngay hoặc thua!</p>
        </div>
      </div>
      <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h3>⚙️ Cài Đặt</h3>

          <div className="form-group">
            <label className="form-label">Chế độ chơi</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Object.entries(MODE_CONFIG) as [GameMode, typeof MODE_CONFIG.normal][]).map(([m, c]) => (
                <button key={m} className={`ws-mode-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
                  <div style={{ fontSize: 18 }}>{m === 'normal' ? '🎯' : m === 'sudden_death' ? '💀' : '😈'}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.desc}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                    <div>⏱️ {c.timePerWord / 1000}s/từ</div>
                    <div>❤️ {c.lives === 999 ? '∞' : c.lives} mạng</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ngôn ngữ nhập</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['en','🇺🇸 Gõ Tiếng Anh'],['vi','🇻🇳 Gõ Tiếng Việt'],['audio','🔊 Nghe & Gõ']].map(([v,l]) => (
                <button key={v} className={`mode-btn ${inputLang === v ? 'active' : ''}`}
                  onClick={() => setInputLang(v as InputLang)} style={{ flex: 1, padding: '8px 6px', fontSize: 12 }}>{l}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nhóm từ (để trống = tất cả)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
              {groups.map(g => (
                <button key={g.Id} className={`group-select-btn ${selectedGroups.includes(g.Id) ? 'active' : ''}`}
                  style={{ '--group-color': g.Color } as any} onClick={() => toggleGroup(g.Id)}>
                  <span>{g.Icon}</span><span>{g.Name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{g.WordCount} từ</span>
                  {selectedGroups.includes(g.Id) && <span style={{ color: 'var(--green)' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary btn-lg" onClick={startCountdown}>🎯 Vào Vị Trí!</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <h4 style={{ marginBottom: 12, fontSize: 14 }}>📖 Cách chơi</h4>
            {[
              ['👁️', 'Quan sát từ/nghĩa hiện ra'],
              ['⚡', 'Gõ đúng càng nhanh càng tốt'],
              ['🎯', 'Enter để bắn — chính xác 100%'],
              ['🔥', 'Combo liên tiếp → điểm x3'],
              ['⚡', 'Phản xạ < 0.8s → LIGHTNING bonus'],
              ['💀', 'Sudden Death: sai 1 lần = thua'],
            ].map(([i, t]) => (
              <div key={t as string} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span>{i}</span><span>{t}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h4 style={{ marginBottom: 10, fontSize: 14 }}>🏆 Ranking</h4>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 2 }}>
              ⚡ &lt; 0.8s → Lightning<br/>
              🎯 &lt; 1.5s → Fast<br/>
              ✅ &lt; 3s → Good<br/>
              🐢 &gt; 3s → Slow
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .ws-select { padding-bottom: 32px; }
        .ws-mode-btn { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; border: 2px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit; cursor: pointer; transition: all 0.2s; }
        .ws-mode-btn:hover { border-color: var(--accent); }
        .ws-mode-btn.active { border-color: var(--accent); background: rgba(99,102,241,0.1); }
        .mode-btn { padding: 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-secondary); font-family: inherit; cursor: pointer; transition: all 0.2s; }
        .mode-btn.active { border-color: var(--accent); background: rgba(99,102,241,0.1); color: var(--accent-bright); }
        .group-select-btn { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 13px; cursor: pointer; transition: all 0.2s; text-align: left; }
        .group-select-btn:hover { border-color: var(--group-color); }
        .group-select-btn.active { border-color: var(--group-color); background: color-mix(in srgb, var(--group-color) 10%, transparent); }
      `}</style>
    </div>
  );

  // COUNTDOWN screen
  if (gameState === 'countdown') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 20, background: 'var(--bg-primary)' }}>
      <div style={{ fontSize: 20, color: 'var(--text-secondary)' }}>Chuẩn bị...</div>
      <div style={{ fontSize: 100, fontWeight: 900, color: 'var(--accent-bright)', fontFamily: 'monospace', animation: 'pulse 0.9s ease infinite', lineHeight: 1 }}>
        {countdown > 0 ? countdown : '🎯'}
      </div>
      <div style={{ fontSize: 16, color: 'var(--text-muted)' }}>
        {MODE_CONFIG[mode].label} · {MODE_CONFIG[mode].desc}
      </div>
    </div>
  );

  // RESULT screen
  if (gameState === 'result') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, background: 'var(--bg-primary)' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 36, maxWidth: 520, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>
            {accuracy >= 90 ? '🏆' : accuracy >= 70 ? '🥈' : accuracy >= 50 ? '🥉' : '💀'}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Kết quả Sniper</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            ['🎯 Điểm', score, '#6366f1'],
            ['✅ Chính xác', `${accuracy}%`, '#10b981'],
            ['🔥 Max Combo', maxCombo, '#f59e0b'],
            ['⚡ Avg Phản xạ', avgReaction > 0 ? `${avgReaction}ms` : 'N/A', '#60a5fa'],
            ['📝 Số từ', `${correctCount}/${round}`, '#a78bfa'],
            ['❤️ Mạng còn', lives, '#ef4444'],
          ].map(([l, v, c]) => (
            <div key={l as string} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{l}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: c as string, fontFamily: 'monospace' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* History */}
        <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20 }}>
          {history.slice(-15).reverse().map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <span>{h.correct ? '✅' : h.answered ? '❌' : '⏱️'}</span>
              <span style={{ fontWeight: 600, flex: 1 }}>{h.word.English}</span>
              <span style={{ color: 'var(--text-muted)' }}>{h.word.Vietnamese}</span>
              {h.reactionMs > 0 && <span style={{ color: h.reactionMs < 800 ? '#f59e0b' : h.reactionMs < 1500 ? '#60a5fa' : 'var(--text-muted)', fontFamily: 'monospace', minWidth: 55, textAlign: 'right' }}>{h.reactionMs}ms</span>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setGameState('select')}>← Menu</button>
          <button className="btn btn-primary" onClick={startCountdown}>🔄 Chơi lại</button>
        </div>
      </div>
    </div>
  );

  // PLAYING screen
  return (
    <div className={`ws-game ${screenFlash === 'red' ? 'flash-red' : screenFlash === 'green' ? 'flash-green' : ''}`}>
      {/* HUD */}
      <div className="ws-hud">
        <div className="hud-lives">
          {Array.from({ length: Math.min(cfg.lives, 5) }, (_, i) => (
            <span key={i} style={{ fontSize: 16, opacity: i < lives ? 1 : 0.2 }}>
              {cfg.lives === 1 ? '💀' : '❤️'}
            </span>
          ))}
          {cfg.lives === 999 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>∞ mạng</span>}
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-bright)', fontFamily: 'monospace' }}>{score.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ĐIỂM</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace' }}>#{round}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ROUND</div>
          </div>
          {combo >= 2 && (
            <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
              🔥 x{combo}
            </div>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{MODE_CONFIG[mode].label}</div>
      </div>

      {/* Timer bar */}
      <div style={{ height: 5, background: 'var(--border)', position: 'relative' }}>
        <div style={{ height: '100%', background: timerColor, width: `${timeLeft}%`, transition: 'width 0.05s linear, background 0.3s', boxShadow: `0 0 8px ${timerColor}` }} />
      </div>

      {/* Float effects */}
      {floats.map(f => (
        <div key={f.id} className="ws-float" style={{ color: f.color, left: `${f.x}%` }}>{f.text}</div>
      ))}

      {/* Muzzle flash */}
      {muzzleFlash && <div className="muzzle-flash" />}

      {/* Main game area */}
      <div className="ws-arena">
        {/* Scope crosshair */}
        <div className={`scope ${scopeActive ? 'scope-active' : ''} ${lastResult === 'correct' ? 'scope-hit' : lastResult === 'wrong' ? 'scope-miss' : ''}`}>
          <div className="scope-ring outer" />
          <div className="scope-ring inner" />
          <div className="crosshair h" />
          <div className="crosshair v" />
          <div className="scope-dot" />
        </div>

        {/* Word display */}
        {currentWord && (
          <div className={`ws-target ${lastResult === 'correct' ? 'target-hit' : lastResult === 'wrong' ? 'target-miss' : ''}`}>
            {/* Label */}
            <div className="ws-target-label">
              {inputLang === 'audio' ? '🔊 NGHE VÀ GÕ' : inputLang === 'en' ? '🇻🇳 Nghĩa là:' : '🇺🇸 Từ tiếng Anh:'}
            </div>

            {/* Prompt */}
            <div className="ws-word">
              {inputLang === 'audio'
                ? <button className="audio-btn" onClick={() => speechService.speak(currentWord.English)}>🔊 Phát âm lại</button>
                : inputLang === 'en'
                  ? currentWord.Vietnamese
                  : currentWord.English
              }
            </div>

            {/* Pronunciation hint for EN mode */}
            {inputLang === 'en' && currentWord.Pronunciation && (
              <div style={{ fontSize: 14, color: 'var(--accent-bright)', fontFamily: 'monospace', marginTop: 4 }}>{currentWord.Pronunciation}</div>
            )}

            {/* Reaction hint */}
            <div className="ws-hint">
              ⌨️ Gõ {inputLang === 'en' ? 'tiếng Anh' : inputLang === 'vi' ? 'tiếng Việt' : 'tiếng Anh'} rồi nhấn Enter
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="ws-input-area">
        <div className="ws-input-wrap">
          <span className="ws-gun">🔫</span>
          <input
            ref={inputRef}
            className="ws-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && checkAnswer()}
            placeholder="Gõ và nhấn Enter để bắn..."
            autoFocus spellCheck={false} autoComplete="off"
          />
          <button className="btn btn-primary" onClick={checkAnswer} style={{ borderRadius: '0 8px 8px 0', padding: '0 20px' }}>
            🎯 BẮN
          </button>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { cleanup(); isEndingRef.current = true; setGameState('select'); }}>✕ Dừng</button>
      </div>

      <style>{`
        .ws-game { display: flex; flex-direction: column; height: 100vh; overflow: hidden; position: relative; background: #080810; transition: background 0.15s; }
        .ws-game.flash-red { background: rgba(239,68,68,0.15); }
        .ws-game.flash-green { background: rgba(16,185,129,0.1); }
        .ws-hud { display: flex; align-items: center; justify-content: space-between; padding: 10px 24px; background: rgba(0,0,0,0.6); border-bottom: 1px solid var(--border); backdrop-filter: blur(8px); flex-shrink: 0; }
        .hud-lives { display: flex; gap: 4px; align-items: center; }
        .ws-float { position: absolute; top: 80px; font-size: 16px; font-weight: 700; pointer-events: none; transform: translateX(-50%); animation: floatUp 1s ease forwards; z-index: 50; text-shadow: 0 2px 8px rgba(0,0,0,0.8); white-space: nowrap; }
        @keyframes floatUp { 0% { opacity: 1; transform: translateX(-50%) translateY(0); } 100% { opacity: 0; transform: translateX(-50%) translateY(-40px); } }
        .muzzle-flash { position: fixed; inset: 0; background: rgba(255,200,50,0.08); pointer-events: none; z-index: 99; }

        /* Arena */
        .ws-arena { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }

        /* Scope */
        .scope { position: absolute; width: 300px; height: 300px; display: flex; align-items: center; justify-content: center; transition: all 0.3s; opacity: 0; transform: scale(1.3); }
        .scope.scope-active { opacity: 0.25; transform: scale(1); }
        .scope.scope-hit { opacity: 0.5; }
        .scope.scope-miss { opacity: 0.4; }
        .scope-ring { position: absolute; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); }
        .scope-ring.outer { width: 280px; height: 280px; }
        .scope-ring.inner { width: 140px; height: 140px; }
        .crosshair { position: absolute; background: rgba(255,255,255,0.5); }
        .crosshair.h { width: 280px; height: 1px; }
        .crosshair.v { width: 1px; height: 280px; }
        .scope-dot { width: 6px; height: 6px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 6px #ef4444; }

        /* Target word */
        .ws-target { position: relative; z-index: 10; text-align: center; padding: 40px 60px; background: rgba(0,0,0,0.7); border: 2px solid rgba(99,102,241,0.3); border-radius: 16px; backdrop-filter: blur(12px); transition: all 0.2s; max-width: 600px; }
        .ws-target.target-hit { border-color: #10b981; box-shadow: 0 0 30px rgba(16,185,129,0.3); }
        .ws-target.target-miss { border-color: #ef4444; box-shadow: 0 0 30px rgba(239,68,68,0.3); animation: shake 0.4s ease; }
        .ws-target-label { font-size: 12px; color: var(--text-muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 16px; }
        .ws-word { font-size: clamp(28px, 4vw, 52px); font-weight: 800; color: white; text-shadow: 0 0 20px rgba(99,102,241,0.5); line-height: 1.2; margin-bottom: 8px; }
        .ws-hint { font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 16px; }
        .audio-btn { background: rgba(99,102,241,0.2); border: 1px solid var(--accent); color: var(--accent-bright); padding: 12px 24px; border-radius: 8px; font-family: inherit; font-size: 16px; cursor: pointer; transition: all 0.2s; }
        .audio-btn:hover { background: rgba(99,102,241,0.3); }

        /* Input */
        .ws-input-area { display: flex; gap: 10px; padding: 14px 24px; background: rgba(0,0,0,0.7); border-top: 1px solid var(--border); backdrop-filter: blur(8px); align-items: center; flex-shrink: 0; }
        .ws-input-wrap { flex: 1; display: flex; border-radius: 8px; overflow: hidden; border: 2px solid var(--border); transition: border-color 0.2s; }
        .ws-input-wrap:focus-within { border-color: var(--accent); }
        .ws-gun { display: flex; align-items: center; padding: 0 12px; background: var(--bg-secondary); font-size: 20px; }
        .ws-input { flex: 1; padding: 12px 16px; background: var(--bg-secondary); border: none; color: white; font-family: 'JetBrains Mono', monospace; font-size: 20px; outline: none; }
      `}</style>
    </div>
  );
}
