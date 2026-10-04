import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notify } from '../components/Feedback/ToastHost';
import { db } from '../services/database';
import { speechService } from '../services/speech';
import './MemoryApproved.css';

type GameState = 'select' | 'playing' | 'result';
type Difficulty = 'easy' | 'medium' | 'hard';
type CardType = 'en' | 'vi';

interface Card {
  id: number; wordId: number; type: CardType;
  text: string; pronunciation?: string;
  flipped: boolean; matched: boolean; wrong: boolean;
}

interface WordGroup { Id: number; Name: string; Color: string; Icon: string; WordCount: number; }

const DIFFICULTY_CONFIG = {
  easy:   { pairs: 6,  time: 90,  label: '😊 Easy',  desc: '6 cặp · 90 giây' },
  medium: { pairs: 10, time: 120, label: '😤 Medium', desc: '10 cặp · 120 giây' },
  hard:   { pairs: 18, time: 150, label: '😈 Hard',   desc: '18 cặp · 150 giây' },
};

export default function MemoryFlipPage() {
  const [gameState, setGameState] = useState<GameState>('select');
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [moves, setMoves] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [canFlip, setCanFlip] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [floats, setFloats] = useState<{ id: number; text: string; color: string }[]>([]);
  const timerRef = useRef<any>(null);
  const floatId = useRef(0);
  const cardsRef = useRef<Card[]>([]);
  const totalPairs = DIFFICULTY_CONFIG[difficulty].pairs;

  useEffect(() => {
    db.getGroups().then(res => { if (res.success) setGroups(res.data || []); });
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const addFloat = (text: string, color: string) => {
    const id = ++floatId.current;
    setFloats(prev => [...prev, { id, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1200);
  };

  const startGame = async () => {
    const res = selectedGroups.length > 0 ? await db.getWordsByGroups(selectedGroups) : await db.getWords();
    if (!res.success || !res.data?.length) { notify('Chưa có từ để chơi. Hãy thêm từ vào thư viện trước nhé.', 'info'); return; }
    const cfg = DIFFICULTY_CONFIG[difficulty];
    const pool = [...res.data].sort(() => Math.random() - 0.5).slice(0, cfg.pairs);
    if (pool.length < cfg.pairs) { notify(`Cần ít nhất ${cfg.pairs} từ để chơi. Hiện có ${pool.length} từ.`, 'info'); return; }

    const newCards: Card[] = [];
    pool.forEach((word: any, i: number) => {
      newCards.push({ id: i * 2,     wordId: word.Id, type: 'en', text: word.English, pronunciation: word.Pronunciation, flipped: false, matched: false, wrong: false });
      newCards.push({ id: i * 2 + 1, wordId: word.Id, type: 'vi', text: word.Vietnamese, flipped: false, matched: false, wrong: false });
    });
    const shuffled = newCards.sort(() => Math.random() - 0.5);
    setCards(shuffled);
    cardsRef.current = shuffled;
    setFlippedIds([]); setMatchedPairs(0); setMoves(0); setCombo(0);
    setScore(0); setCanFlip(true); setShowSuccess(false); setFloats([]);
    setTimeLeft(cfg.time); setGameState('playing');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setGameState('result'); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleCardClick = useCallback((card: Card) => {
    if (!canFlip || card.flipped || card.matched) return;
    const newFlipped = [...flippedIds, card.id];
    const updatedCards = cardsRef.current.map(c => c.id === card.id ? { ...c, flipped: true } : c);
    setCards(updatedCards); cardsRef.current = updatedCards;
    setFlippedIds(newFlipped);
    if (card.type === 'en') speechService.speak(card.text);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      setCanFlip(false);
      const [id1, id2] = newFlipped;
      const c1 = cardsRef.current.find(c => c.id === id1)!;
      const c2 = cardsRef.current.find(c => c.id === id2)!;
      const isMatch = c1 && c2 && c1.wordId === c2.wordId && c1.type !== c2.type;

      if (isMatch) {
        const newCombo = combo + 1;
        setCombo(newCombo);
        const pts = (newCombo >= 5 ? 30 : newCombo >= 3 ? 20 : 10) + Math.max(0, timeLeft - 10);
        setScore(s => s + pts);
        if (newCombo >= 3) addFloat(`🔥 COMBO x${newCombo}!`, '#f59e0b');
        else addFloat(`✅ +${pts}`, '#10b981');
        setMatchedPairs(m => {
          const next = m + 1;
          if (next >= totalPairs) { clearInterval(timerRef.current); setShowSuccess(true); setTimeout(() => setGameState('result'), 1500); }
          return next;
        });
        setTimeout(() => {
          const matched = cardsRef.current.map(c => c.id === id1 || c.id === id2 ? { ...c, matched: true } : c);
          setCards(matched); cardsRef.current = matched;
          setFlippedIds([]); setCanFlip(true);
        }, 400);
      } else {
        setCombo(0);
        addFloat('❌ Sai!', '#ef4444');
        setTimeout(() => {
          const reset = cardsRef.current.map(c => c.id === id1 || c.id === id2 ? { ...c, flipped: false, wrong: false } : c);
          setCards(reset); cardsRef.current = reset;
          setFlippedIds([]); setCanFlip(true);
        }, 900);
      }
    }
  }, [canFlip, flippedIds, combo, timeLeft, totalPairs]);

  const toggleGroup = (id: number) => setSelectedGroups(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const timerPct = (timeLeft / cfg.time) * 100;
  const timerColor = timeLeft > cfg.time * 0.5 ? '#10b981' : timeLeft > cfg.time * 0.25 ? '#f59e0b' : '#ef4444';
  const cols = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
  const accuracy = moves > 0 ? Math.round((matchedPairs / moves) * 100) : 100;

  if (gameState === 'select') return (
    <div className="mf-select lf-training-page lf-memory-page">
      <div className="page-header lf-training-hero">
        <div><span className="lf-training-eyebrow">LẬT THẺ · GHÉP NGHĨA · NHỚ LÂU</span><h1 className="page-title">Nhớ vị trí. <em>Nối đúng nghĩa.</em></h1><p className="page-subtitle">Tìm cặp tiếng Anh và tiếng Việt tương ứng <strong>trước khi hết giờ.</strong></p><div className="lf-training-tags"><span>3 mức độ</span><span>Combo thưởng</span><span>Ghép cặp Anh ↔ Việt</span></div></div><div className="lf-memory-hero-cards" aria-hidden="true"><span>EN</span><span>VI</span></div>
      </div>
      <div className="lf-memory-setup-grid" style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h3>Chuẩn bị ván chơi</h3><p className="lf-memory-intro">Chọn mức độ và nhóm từ để bắt đầu.</p>
          <div className="form-group">
            <label className="form-label">1 · Chọn độ khó</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG.easy][]).map(([d, c]) => (
                <button key={d} className={`diff-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                  <div className="lf-memory-difficulty-name">{d === 'easy' ? 'Dễ' : d === 'medium' ? 'Vừa' : 'Khó'}</div>
                  <strong>{d === 'easy' ? 6 : d === 'medium' ? 10 : 18} cặp</strong>
                  <div className="lf-memory-difficulty-time">{d === 'easy' ? 90 : d === 'medium' ? 120 : 150} giây</div>
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">2 · Chọn nhóm từ</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
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
          <div className="lf-memory-launch"><div><strong>Sẵn sàng ghép {difficulty === 'easy' ? 6 : difficulty === 'medium' ? 10 : 18} cặp?</strong><small>Nhớ vị trí thẻ và ghép thật nhanh.</small></div><button className="btn btn-primary btn-lg" onClick={startGame}>Bắt đầu chơi →</button></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card lf-memory-guide"><h4>Cách chơi</h4><div className="lf-memory-example"><span><small>EN</small><b>deadline</b></span><i>↔</i><span><small>VI</small><b>hạn chót</b></span></div>{['Lật hai thẻ để xem nội dung','Ghép từ Anh với nghĩa Việt','Đúng liên tiếp để tăng điểm combo'].map((step,index) => <div className="lf-memory-how" key={step}><i>{index + 1}</i><b>{step}</b></div>)}<div className="lf-memory-note">Thẻ ghép đúng được giữ mở. Ghép sai sẽ úp lại sau một nhịp.</div></div>
        </div>
      </div>
      <style>{`.mf-select{padding-bottom:32px}.diff-btn{flex:1;padding:14px 10px;border-radius:10px;border:2px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-family:inherit;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:4px}.diff-btn:hover{border-color:var(--accent)}.diff-btn.active{border-color:var(--accent);background:rgba(99,102,241,.12)}.group-select-btn{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-family:inherit;font-size:13px;cursor:pointer;transition:all .2s;text-align:left}.group-select-btn:hover{border-color:var(--group-color)}.group-select-btn.active{border-color:var(--group-color);background:color-mix(in srgb,var(--group-color) 10%,transparent)}`}</style>
    </div>
  );

  if (gameState === 'result') return (
    <div className="lf-memory-result" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 32 }}>
      <div className="lf-memory-result-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 40, maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>{matchedPairs >= totalPairs ? '🏆' : '😅'}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{matchedPairs >= totalPairs ? 'Hoàn thành!' : 'Hết giờ!'}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Đã ghép {matchedPairs}/{totalPairs} cặp</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 28 }}>
          {[['Điểm', score, '#6366f1'], ['Cặp Đúng', `${matchedPairs}/${totalPairs}`, '#10b981'], ['Chính Xác', `${accuracy}%`, '#f59e0b'], ['Số Lượt', moves, '#ec4899']].map(([l, v, c]) => (
            <div key={String(l)}><div style={{ fontSize: 26, fontWeight: 700, color: String(c) }}>{String(v)}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{String(l)}</div></div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setGameState('select')}>← Menu</button>
          <button className="btn btn-primary" onClick={startGame}>🔄 Chơi lại</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mf-game">
      <div className="mf-hud">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--border)" strokeWidth="4" />
            <circle cx="26" cy="26" r="22" fill="none" stroke={timerColor} strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 22}`} strokeDashoffset={`${2 * Math.PI * 22 * (1 - timerPct / 100)}`}
              transform="rotate(-90 26 26)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
            <text x="26" y="31" textAnchor="middle" fill={timerColor} fontSize="14" fontWeight="700" fontFamily="monospace">{timeLeft}</text>
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {[['Điểm', score, '#6366f1'], ['Cặp', `${matchedPairs}/${totalPairs}`, '#10b981'], ['Lượt', moves, '#94a3b8']].map(([l, v, c]) => (
            <div key={String(l)} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: String(c), fontFamily: 'monospace' }}>{String(v)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{String(l)}</div>
            </div>
          ))}
          {combo >= 2 && <div className="mf-combo">🔥 x{combo}</div>}
        </div>
        <div style={{ width: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'right' }}>{Math.round((matchedPairs / totalPairs) * 100)}%</div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--green)', borderRadius: 4, width: `${(matchedPairs / totalPairs) * 100}%`, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>
      {floats.map(f => <div key={f.id} className="mf-float" style={{ color: f.color }}>{f.text}</div>)}
      {showSuccess && <div className="mf-success">🏆 HOÀN THÀNH!</div>}
      <div className="mf-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cards.map(card => (
          <div key={card.id} className={`mf-card-wrap ${card.flipped || card.matched ? 'flipped' : ''}`} onClick={() => handleCardClick(card)}>
            <div className={`mf-card-inner ${card.wrong ? 'wrong' : ''} ${card.matched ? 'matched' : ''}`}>
              <div className="mf-face mf-back"><div className="card-back-icon">🃏</div></div>
              <div className={`mf-face mf-front ${card.type}`}>
                {card.type === 'en' ? (
                  <><div className="card-type-badge en-badge">EN</div><div className="card-word">{card.text}</div>{card.pronunciation && <div className="card-pron">{card.pronunciation}</div>}<button className="card-speak" onClick={e => { e.stopPropagation(); speechService.speak(card.text); }}>🔊</button></>
                ) : (
                  <><div className="card-type-badge vi-badge">VI</div><div className="card-meaning">{card.text}</div></>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .mf-game{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg-primary)}
        .mf-hud{display:flex;align-items:center;justify-content:space-between;padding:10px 24px;background:var(--bg-secondary);border-bottom:1px solid var(--border);flex-shrink:0}
        .mf-combo{background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);color:#f59e0b;padding:4px 12px;border-radius:20px;font-size:14px;font-weight:700;animation:pulse .6s ease infinite}
        .mf-float{position:fixed;top:80px;left:50%;transform:translateX(-50%);font-size:18px;font-weight:700;pointer-events:none;animation:floatUp 1.2s ease forwards;z-index:100}
        @keyframes floatUp{0%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-40px)}}
        .mf-success{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;color:#f59e0b;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);z-index:200;animation:fadeIn .3s ease}
        .mf-grid{flex:1;padding:16px 24px;display:grid;gap:10px;align-content:center;overflow:hidden}
        .mf-card-wrap{perspective:800px;cursor:pointer;aspect-ratio:3/2}
        .mf-card-inner{width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform .45s cubic-bezier(.4,0,.2,1);border-radius:10px}
        .mf-card-wrap.flipped .mf-card-inner{transform:rotateY(180deg)}
        .mf-card-inner.matched .mf-face{border-color:#10b981 !important;box-shadow:0 0 16px rgba(16,185,129,.4) !important}
        .mf-face{position:absolute;inset:0;border-radius:10px;backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;border:2px solid var(--border)}
        .mf-back{background:linear-gradient(135deg,#1e1b4b,#312e81);border-color:#4f46e5}
        .mf-back:hover{border-color:#818cf8;box-shadow:0 0 12px rgba(99,102,241,.3)}
        .card-back-icon{font-size:28px;opacity:.6}
        .mf-front{transform:rotateY(180deg);background:var(--bg-card)}
        .mf-front.en{background:linear-gradient(135deg,#1e3a5f,#1e40af22);border-color:#3b82f6}
        .mf-front.vi{background:linear-gradient(135deg,#1f2d1f,#16653122);border-color:#22c55e}
        .card-type-badge{position:absolute;top:6px;left:8px;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;letter-spacing:.5px}
        .en-badge{background:rgba(59,130,246,.2);color:#60a5fa}
        .vi-badge{background:rgba(34,197,94,.2);color:#4ade80}
        .card-word{font-size:clamp(11px,1.4vw,16px);font-weight:700;text-align:center;color:var(--text-primary);line-height:1.3}
        .card-pron{font-size:clamp(9px,1vw,12px);color:#60a5fa;font-family:'JetBrains Mono',monospace;margin-top:3px}
        .card-meaning{font-size:clamp(10px,1.3vw,15px);font-weight:600;text-align:center;color:#4ade80;line-height:1.3}
        .card-speak{position:absolute;bottom:4px;right:6px;background:none;border:none;font-size:12px;cursor:pointer;opacity:.6}
      `}</style>
    </div>
  );
}
