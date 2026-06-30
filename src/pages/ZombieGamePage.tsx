import React, { useEffect, useState, useRef, useCallback } from 'react';
import multiplayerService from '../services/multiplayer';
import { speechService } from '../services/speech';

// ─── TYPES ───────────────────────────────────────────────────────────────────

type EnemyType = 'normal' | 'fast' | 'tank' | 'boss';
type PlayerAnim = 'idle' | 'aim' | 'shoot' | 'hit';

interface EnemyData {
  id: number;
  meaning: string;
  maxHp: number;
  icon: string;
  type: EnemyType;
  y: number;
  speed: number;
  word: string;
  hp: number;
}

interface ZombieProps {
  enemy: EnemyData;
  typedAnswer: string;                // Chuỗi người chơi đang gõ (để highlight chữ)
  onDie: (enemy: EnemyData) => void;
  onAttackPlayer: () => void;
}

interface GameState {
  wave: number;
  lives: number;
  gold: number;
  score: number;
  rage: number;
}

// ─── SVG HELPERS ─────────────────────────────────────────────────────────────

function ZombieSVG({ type, attacking }: { type: EnemyType; attacking: boolean }) {
  const colors: Record<EnemyType, string> = {
    normal: '#4a6e3c',
    fast: '#cc3333',
    tank: '#795548',
    boss: '#aa00ff',
  };
  const c = colors[type];

  if (type === 'boss') {
    return (
      <svg viewBox="0 0 60 80" className="zombie-svg" style={{ overflow: 'visible' }}>
        <circle cx="30" cy="14" r="12" fill="none" stroke={c} strokeWidth="5" />
        <line x1="30" y1="26" x2="30" y2="60" stroke={c} strokeWidth="6" strokeLinecap="round" />
        <line x1="30" y1="60" x2="14" y2="80" stroke={c} strokeWidth="5" strokeLinecap="round" />
        <line x1="30" y1="60" x2="46" y2="80" stroke={c} strokeWidth="5" strokeLinecap="round" />
        {/* Tay vươn tấn công nếu attacking */}
        {attacking
          ? <line x1="30" y1="38" x2="-10" y2="26" stroke={c} strokeWidth="5" strokeLinecap="round" />
          : <line x1="30" y1="38" x2="4" y2="50" stroke={c} strokeWidth="5" strokeLinecap="round" />
        }
        <line x1="30" y1="38" x2="56" y2="50" stroke={c} strokeWidth="5" strokeLinecap="round" />
        {/* Mắt boss */}
        <circle cx="24" cy="12" r="3" fill="yellow" />
        <circle cx="36" cy="12" r="3" fill="yellow" />
      </svg>
    );
  }

  if (type === 'tank') {
    return (
      <svg viewBox="0 0 56 76" className="zombie-svg" style={{ overflow: 'visible' }}>
        <circle cx="28" cy="14" r="12" fill="none" stroke={c} strokeWidth="6" />
        <line x1="28" y1="26" x2="28" y2="58" stroke={c} strokeWidth="8" strokeLinecap="round" />
        <line x1="28" y1="58" x2="14" y2="76" stroke={c} strokeWidth="6" strokeLinecap="round" />
        <line x1="28" y1="58" x2="42" y2="76" stroke={c} strokeWidth="6" strokeLinecap="round" />
        {attacking
          ? <line x1="28" y1="38" x2="-8" y2="26" stroke={c} strokeWidth="6" strokeLinecap="round" />
          : <line x1="28" y1="38" x2="4" y2="52" stroke={c} strokeWidth="6" strokeLinecap="round" />
        }
        <line x1="28" y1="38" x2="52" y2="52" stroke={c} strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'fast') {
    return (
      <svg viewBox="0 0 40 60" className="zombie-svg" style={{ overflow: 'visible' }}>
        <circle cx="20" cy="9" r="8" fill="none" stroke={c} strokeWidth="3.5" />
        <line x1="20" y1="17" x2="20" y2="44" stroke={c} strokeWidth="4" strokeLinecap="round" />
        <line x1="20" y1="44" x2="10" y2="59" stroke={c} strokeWidth="3" strokeLinecap="round" />
        <line x1="20" y1="44" x2="30" y2="59" stroke={c} strokeWidth="3" strokeLinecap="round" />
        {attacking
          ? <line x1="20" y1="28" x2="-6" y2="20" stroke={c} strokeWidth="3" strokeLinecap="round" />
          : <line x1="20" y1="28" x2="4" y2="36" stroke={c} strokeWidth="3" strokeLinecap="round" />
        }
        <line x1="20" y1="28" x2="36" y2="36" stroke={c} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  // normal
  return (
    <svg viewBox="0 0 44 64" className="zombie-svg" style={{ overflow: 'visible' }}>
      <circle cx="22" cy="10" r="9" fill="none" stroke={c} strokeWidth="4" />
      <line x1="22" y1="19" x2="22" y2="48" stroke={c} strokeWidth="4.5" strokeLinecap="round" />
      <line x1="22" y1="48" x2="10" y2="64" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="22" y1="48" x2="34" y2="64" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
      {attacking
        ? <line x1="22" y1="30" x2="-8" y2="20" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
        : <line x1="22" y1="30" x2="5" y2="40" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
      }
      <line x1="22" y1="30" x2="39" y2="40" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── SUB COMPONENTS ───────────────────────────────────────────────────────────

const BossShieldEffect: React.FC = () => (
  <div className="boss-shield-orbit">
    <div className="shield-segment" style={{ transform: 'rotate(0deg) translateY(-80px)' }}>🛡️</div>
    <div className="shield-segment" style={{ transform: 'rotate(120deg) translateY(-80px)' }}>🛡️</div>
    <div className="shield-segment" style={{ transform: 'rotate(240deg) translateY(-80px)' }}>🛡️</div>
  </div>
);

const GameHUD: React.FC<GameState & { wave: number }> = ({ lives, gold, score, rage, wave }) => (
  <div className="game-hud">
    <div className="hud-item">WAVE <span className="hud-val">{wave}</span></div>
    <div className="hud-item hearts">
      {Array(5).fill('❤️').map((h, i) => (
        <span key={i} style={{ opacity: i < lives / 4 ? 1 : 0.2 }}>{h}</span>
      ))}
    </div>
    <div className="hud-item gold">💰 {gold}</div>
    <div className="hud-item score">🏆 {score}</div>
    <div className="hud-bar-container">
      <div className="hud-bar-fill rage" style={{ width: `${rage}%` }} />
      <span className="hud-bar-label">RAGE</span>
    </div>
  </div>
);

// ─── ZOMBIE COMPONENT ─────────────────────────────────────────────────────────

const ATTACK_RANGE_X = 18; // % từ bên trái → zombie dừng và tấn công

const Zombie: React.FC<ZombieProps> = React.memo(({ enemy, typedAnswer, onDie, onAttackPlayer }) => {
  const xRef = useRef(-10);
  const yRef = useRef(enemy.y);
  const speedRef = useRef(enemy.speed);
  const hasAttackedRef = useRef(false);

  const [hp, setHp] = useState(enemy.maxHp);
  const [showDamage, setShowDamage] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [dying, setDying] = useState(false);            // ← Trạng thái đang chết (hiện nghĩa + fade)
  const [showMeaning, setShowMeaning] = useState(false); // ← Hiện nghĩa tiếng Việt
  const [bloodParticles, setBloodParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [hasShield, setHasShield] = useState(enemy.type === 'boss');

  const elementRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const onDieRef = useRef(onDie);
  const onAttackPlayerRef = useRef(onAttackPlayer);

  useEffect(() => { onDieRef.current = onDie; }, [onDie]);
  useEffect(() => { onAttackPlayerRef.current = onAttackPlayer; }, [onAttackPlayer]);

  useEffect(() => {
    speechService.speak(enemy.meaning, 'vi-VN');

    const animate = () => {
      if (speedRef.current > 0 && !dying) {
        xRef.current += speedRef.current * 0.3;

        // Kích hoạt tấn công khi đến gần player
        if (xRef.current >= ATTACK_RANGE_X && !hasAttackedRef.current) {
          hasAttackedRef.current = true;
          speedRef.current = 0;
          setIsAttacking(true);
          onAttackPlayerRef.current();

          setTimeout(() => {
            setIsAttacking(false);
            speedRef.current = enemy.speed;
            hasAttackedRef.current = false;
          }, 700);
        }

        if (elementRef.current) {
          elementRef.current.style.left = `${xRef.current}%`;
          elementRef.current.style.top = `${yRef.current}%`;
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);

    const handleHit = (data: { id: number; hp: number; isBoss?: boolean }) => {
      if (data.id !== enemy.id) return;
      setHp(data.hp);
      setShowDamage(true);
      if (enemy.type === 'boss') setHasShield(true);
      setIsAttacking(false);
      speedRef.current = enemy.speed;
      hasAttackedRef.current = false;
      setTimeout(() => setShowDamage(false), 300);
    };

    const handleRemove = (data: { id: number; isBoss?: boolean }) => {
      if (data.id !== enemy.id) return;

      // Hiệu ứng máu nổ
      setBloodParticles(
        Array.from({ length: data.isBoss ? 15 : 8 }).map((_, i) => ({
          id: i,
          x: (Math.random() - 0.5) * (data.isBoss ? 30 : 16),
          y: (Math.random() - 0.5) * (data.isBoss ? 30 : 16),
        }))
      );

      if (data.isBoss) speechService.speak('Boss eliminated', 'en-US');

      // ── THÊM MỚI: Hiện nghĩa tiếng Việt + fade out từ từ ──
      setShowMeaning(true);
      setDying(true);
      speedRef.current = 0;

      // Sau 1.2s mới gọi onDie để cho animation chạy xong
      setTimeout(() => {
        onDieRef.current(enemy);
      }, 1200);
    };

    const handleSync = (data: { enemies: { id: number; x: number }[] }) => {
      const syncData = data.enemies.find(e => e.id === enemy.id);
      if (syncData) {
        xRef.current += (syncData.x - xRef.current) * 0.1;
      }
    };

    multiplayerService.on('enemy:hit', handleHit);
    multiplayerService.on('enemy:remove', handleRemove);
    multiplayerService.on('game:sync_positions', handleSync);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      multiplayerService.off('enemy:hit', handleHit);
      multiplayerService.off('enemy:remove', handleRemove);
      multiplayerService.off('game:sync_positions', handleSync);
    };
  }, [enemy.id, enemy.meaning, enemy.type, enemy.speed, dying]);

  // Tính phần đã gõ đúng để highlight chữ dưới chân zombie
  const typed = typedAnswer.toLowerCase();
  const wordLower = enemy.word.toLowerCase();
  const matchLen = wordLower.startsWith(typed) ? typed.length : 0;

  return (
    <div
      ref={elementRef}
      className={`zombie-unit type-${enemy.type} ${showDamage ? 'damaged' : ''} ${isAttacking ? 'attacking' : ''} ${dying ? 'dying' : ''}`}
    >
      {/* ── Nghĩa tiếng Việt hiện lên khi zombie chết ── */}
      {showMeaning && (
        <div className="zombie-meaning-popup">{enemy.meaning}</div>
      )}

      {/* ── Chữ tiếng Anh ở dưới chân (highlight phần đã gõ) ── */}
      <div className="zombie-word-label">
        {matchLen > 0 ? (
          <>
            <span className="typed-ok">{enemy.word.slice(0, matchLen)}</span>
            <span>{enemy.word.slice(matchLen)}</span>
          </>
        ) : (
          enemy.word
        )}
      </div>

      <div className="zombie-visual-container">
        <ZombieSVG type={enemy.type} attacking={isAttacking} />

        {enemy.type === 'boss' && hasShield && showDamage && <BossShieldEffect />}

        {bloodParticles.map(p => (
          <div
            key={p.id}
            className="blood-particle"
            style={{ '--tx': `${p.x}px`, '--ty': `${p.y}px` } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="zombie-hp-bar">
        <div className="zombie-hp-fill" style={{ width: `${(hp / enemy.maxHp) * 100}%` }} />
      </div>
    </div>
  );
});

Zombie.displayName = 'Zombie';

// ─── PLAYER CHARACTER ─────────────────────────────────────────────────────────

const PlayerCharacter: React.FC<{ anim: PlayerAnim }> = ({ anim }) => (
  <div className={`player-container anim-${anim}`}>
    <svg viewBox="0 0 64 90" className="player-svg" style={{ overflow: 'visible' }}>
      <circle cx="32" cy="10" r="9" fill="none" stroke="#ddd" strokeWidth="3.5" />
      <line x1="32" y1="19" x2="32" y2="60" stroke="#ddd" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="32" y1="60" x2="18" y2="80" stroke="#ddd" strokeWidth="4" strokeLinecap="round" />
      <line x1="32" y1="60" x2="46" y2="80" stroke="#ddd" strokeWidth="4" strokeLinecap="round" />
      <g className="gun-arm">
        <line x1="32" y1="34" x2="58" y2="28" stroke="#ddd" strokeWidth="4" strokeLinecap="round" />
        <rect x="54" y="22" width="20" height="10" rx="2" fill="#555" stroke="#aaa" strokeWidth="1.5" />
        <circle className="muzzle-flash" cx="74" cy="27" r="7" fill="#ffe000" opacity="0" />
      </g>
      {/* Tay trái bình thường */}
      <line className="arm-left-normal" x1="32" y1="34" x2="10" y2="46" stroke="#ddd" strokeWidth="4" strokeLinecap="round" />
      {/* Tay trái giơ đỡ khi bị đánh */}
      <line className="arm-left-hit" x1="32" y1="28" x2="10" y2="12" stroke="#ff4444" strokeWidth="4" strokeLinecap="round" />
    </svg>

    {/* Máu bắn ra khi bị đánh */}
    <div className="player-hit-blood">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="player-blood-drop" style={{ '--angle': `${i * 60}deg` } as React.CSSProperties} />
      ))}
    </div>
  </div>
);

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const ZombieGamePage: React.FC = () => {
  const [enemies, setEnemies] = useState<Map<number, EnemyData>>(new Map());
  const [gameState, setGameState] = useState<GameState>({ wave: 0, lives: 20, gold: 150, score: 0, rage: 0 });
  const [answer, setAnswer] = useState('');
  const [playerAnim, setPlayerAnim] = useState<PlayerAnim>('idle');
  const [screenShake, setScreenShake] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const battlefieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();

    const handleWaveStart = (data: { wave: number }) =>
      setGameState(prev => ({ ...prev, wave: data.wave }));

    const handleGameState = (data: Partial<GameState>) =>
      setGameState(prev => ({ ...prev, ...data }));

    const handleEnemySpawn = (data: EnemyData) =>
      setEnemies(prev => {
        const next = new Map(prev);
        next.set(data.id, { ...data, type: data.type ?? 'normal' });
        return next;
      });

    multiplayerService.on('wave:start', handleWaveStart);
    multiplayerService.on('game:state', handleGameState);
    multiplayerService.on('enemy:spawn', handleEnemySpawn);

    if (inputRef.current) inputRef.current.focus();

    return () => {
      multiplayerService.off('wave:start', handleWaveStart);
      multiplayerService.off('game:state', handleGameState);
      multiplayerService.off('enemy:spawn', handleEnemySpawn);
      speechService.stop();
    };
  }, []);

  const handleEnemyDie = useCallback((enemy: EnemyData) => {
    setEnemies(prev => {
      const next = new Map(prev);
      next.delete(enemy.id);
      return next;
    });
  }, []);

  const handleZombieAttackPlayer = useCallback(() => {
    setPlayerAnim('hit');
    setScreenShake(true);
    setTimeout(() => {
      setPlayerAnim('idle');
      setScreenShake(false);
    }, 600);
  }, []);

  const handleAttack = () => {
    if (!answer.trim()) return;

    setPlayerAnim('aim');
    multiplayerService.emit('tower:attack', { roomId: 'ROOM_ID', answer: answer.trim() });

    setTimeout(() => {
      setPlayerAnim('shoot');

      if (battlefieldRef.current) {
        const bulletLine = document.createElement('div');
        bulletLine.className = 'bullet-tracer';
        battlefieldRef.current.appendChild(bulletLine);
        setTimeout(() => bulletLine.remove(), 150);
      }

      speechService.speak('fire', 'en-US', 1.2);
      setTimeout(() => setPlayerAnim('idle'), 100);
    }, 150);

    setAnswer('');
  };

  return (
    <div className={`zombie-game-page ${screenShake ? 'screen-shake' : ''}`}>
      <GameHUD {...gameState} />

      <div ref={battlefieldRef} className="game-battlefield">
        <div className="game-background-layer dark-street" />
        <div className="game-background-layer ruined-city" />
        <div className="game-background-layer glowing-street-light" />

        <PlayerCharacter anim={playerAnim} />

        {Array.from(enemies.values()).map(enemy => (
          <Zombie
            key={enemy.id}
            enemy={enemy}
            typedAnswer={answer}
            onDie={handleEnemyDie}
            onAttackPlayer={handleZombieAttackPlayer}
          />
        ))}
      </div>

      <div className="game-controls">
        <input
          ref={inputRef}
          type="text"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAttack(); }}
          placeholder="Gõ từ tiếng Anh, nhấn Enter để bắn..."
          autoComplete="off"
          spellCheck={false}
        />
        <button onClick={handleAttack}>FIRE 🔫</button>
      </div>

      <style>{`
        /* ── Page ── */
        .zombie-game-page { height: 100vh; background: #000; color: #fff; display: flex; flex-direction: column; }

        /* ── Screen shake ── */
        @keyframes screen-shake {
          0%{transform:translate(0,0)} 15%{transform:translate(-6px,4px)} 30%{transform:translate(6px,-4px)}
          45%{transform:translate(-4px,6px)} 60%{transform:translate(4px,-3px)} 75%{transform:translate(-3px,3px)}
          90%{transform:translate(2px,-2px)} 100%{transform:translate(0,0)}
        }
        .screen-shake { animation: screen-shake 0.5s ease-out; }

        /* ── HUD ── */
        .game-hud { display:flex; padding:8px 16px; background:rgba(0,0,0,0.8); justify-content:space-around; border-bottom:2px solid #333; align-items:center; flex-wrap:wrap; gap:6px; }
        .hud-item { font-size:1rem; color:#aaa; }
        .hud-val { color:#fff; font-weight:700; }
        .hud-bar-container { width:120px; height:13px; background:#333; border:1px solid #555; position:relative; border-radius:3px; }
        .hud-bar-fill.rage { height:100%; background:#aa00ff; border-radius:3px; transition:width 0.3s ease; }
        .hud-bar-label { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font-size:9px; color:#ccc; }

        /* ── Battlefield ── */
        .game-battlefield { flex:1; position:relative; overflow:hidden; border-bottom:2px solid #333; }
        .game-background-layer { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; }
        .game-background-layer.dark-street { background:linear-gradient(180deg,#0a0a1a 0%,#0d1a0d 60%,#1a1a0a 100%); }
        .game-background-layer.ruined-city { opacity:0.18; background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="10" y="30" width="18" height="70" fill="%23111"/><rect x="36" y="10" width="28" height="90" fill="%23111"/><rect x="74" y="40" width="16" height="60" fill="%23111"/></svg>'); }
        .game-background-layer.glowing-street-light { opacity:0.08; background:radial-gradient(circle at 70% 30%, yellow 0%, transparent 40%); }

        /* ── Player ── */
        .player-container { position:absolute; bottom:0; left:10px; width:100px; height:120px; z-index:10; pointer-events:none; }
        .player-svg { width:100%; height:100%; }
        .gun-arm { transition:transform 0.08s ease-out; transform-origin:32px 34px; }
        .arm-left-normal { transition:opacity 0.1s; opacity:1; }
        .arm-left-hit { transition:opacity 0.1s; opacity:0; }

        @keyframes player-hit-shake {
          0%{transform:translateX(0) rotate(0deg)} 20%{transform:translateX(-8px) rotate(-5deg)}
          40%{transform:translateX(6px) rotate(4deg)} 60%{transform:translateX(-5px) rotate(-3deg)}
          80%{transform:translateX(3px) rotate(2deg)} 100%{transform:translateX(0) rotate(0deg)}
        }
        .anim-hit .player-svg { animation:player-hit-shake 0.5s ease-out; }
        .anim-hit .arm-left-normal { opacity:0; }
        .anim-hit .arm-left-hit { opacity:1; }
        .muzzle-flash { opacity:0; }
        .anim-shoot .muzzle-flash { opacity:1; }
        .anim-aim .gun-arm { transform:rotate(-12deg); }

        /* Máu player bị đánh */
        .player-hit-blood { position:absolute; top:35%; left:65%; pointer-events:none; }
        .player-blood-drop { position:absolute; width:6px; height:6px; background:#cc0000; border-radius:50%; opacity:0; }
        @keyframes blood-burst {
          0%{transform:rotate(var(--angle)) translateY(0);opacity:1}
          100%{transform:rotate(var(--angle)) translateY(-30px);opacity:0}
        }
        .anim-hit .player-blood-drop { animation:blood-burst 0.5s ease-out forwards; }
        .anim-hit .player-blood-drop:nth-child(1){animation-delay:0ms}
        .anim-hit .player-blood-drop:nth-child(2){animation-delay:30ms}
        .anim-hit .player-blood-drop:nth-child(3){animation-delay:60ms}
        .anim-hit .player-blood-drop:nth-child(4){animation-delay:90ms}
        .anim-hit .player-blood-drop:nth-child(5){animation-delay:120ms}
        .anim-hit .player-blood-drop:nth-child(6){animation-delay:150ms}

        /* Bullet tracer */
        .bullet-tracer { position:absolute; bottom:80px; left:110px; width:280px; height:2px; background:yellow; transform-origin:left center; animation:bullet-fly 0.15s ease-out forwards; }
        @keyframes bullet-fly { 0%{transform:rotate(-15deg) scaleX(0)} 100%{transform:rotate(-15deg) scaleX(1)} }

        /* ── Zombie ── */
        .zombie-unit {
          position:absolute; display:flex; flex-direction:column; align-items:center;
          transform:translate(-50%, -100%);
          transition:opacity 0.15s ease;
        }
        .zombie-unit.damaged { filter:drop-shadow(0 0 10px red); }

        /* Animation lao vào tấn công */
        @keyframes zombie-lunge {
          0%{filter:brightness(1)} 30%{filter:brightness(1.8)} 60%{filter:brightness(1.4)} 100%{filter:brightness(1)}
        }
        .zombie-unit.attacking { animation:zombie-lunge 0.6s ease-out; }

        /* ── THÊM MỚI: Fade out khi chết ── */
        @keyframes zombie-die {
          0%{opacity:1;transform:translate(-50%,-100%) scale(1)}
          40%{opacity:0.8;transform:translate(-50%,-100%) scale(1.1)}
          100%{opacity:0;transform:translate(-50%,-85%) scale(0.8)}
        }
        .zombie-unit.dying { animation:zombie-die 1.1s ease-out forwards; pointer-events:none; }

        /* ── THÊM MỚI: Nghĩa tiếng Việt popup khi zombie chết ── */
        @keyframes meaning-rise {
          0%{opacity:0;transform:translateX(-50%) translateY(0) scale(0.8)}
          20%{opacity:1;transform:translateX(-50%) translateY(-5px) scale(1.05)}
          80%{opacity:1;transform:translateX(-50%) translateY(-14px) scale(1)}
          100%{opacity:0;transform:translateX(-50%) translateY(-28px) scale(0.95)}
        }
        .zombie-meaning-popup {
          position:absolute; top:-42px; left:50%; transform:translateX(-50%);
          background:#22bb55; color:#fff; font-size:13px; font-weight:700;
          padding:4px 12px; border-radius:10px; white-space:nowrap;
          pointer-events:none; z-index:20;
          animation:meaning-rise 1.1s ease-out forwards;
        }
        .zombie-unit.type-boss .zombie-meaning-popup { background:#aa00ff; border:2px solid yellow; font-size:15px; }

        /* ── THÊM MỚI: Chữ tiếng Anh dưới chân zombie + highlight khi gõ ── */
        .zombie-word-label {
          font-size:13px; font-weight:700; color:#f0e040;
          background:rgba(0,0,0,0.75); padding:2px 8px; border-radius:6px;
          margin-bottom:4px; letter-spacing:1px; white-space:nowrap;
          border:1px solid rgba(240,224,64,0.3);
        }
        .zombie-unit.type-fast .zombie-word-label { color:#ff8888; border-color:rgba(255,80,80,0.3); }
        .zombie-unit.type-tank .zombie-word-label { color:#ffcc88; font-size:14px; }
        .zombie-unit.type-boss .zombie-word-label { color:#fff; font-size:16px; border:2px solid yellow; padding:3px 12px; }
        .typed-ok { color:#4ef; text-shadow:0 0 6px #4ef; }

        /* Zombie SVG walk animation */
        .zombie-svg { animation:zombie-walk 0.8s ease-in-out infinite alternate; transform-origin:50% 90%; }
        @keyframes zombie-walk { 0%{transform:rotate(-4deg)} 100%{transform:rotate(4deg)} }
        .zombie-unit.type-fast .zombie-svg { animation-duration:0.35s; }
        .zombie-unit.type-tank .zombie-svg { animation-duration:1.2s; }
        .zombie-unit.type-boss .zombie-svg { animation-duration:1s; }
        .zombie-unit.attacking .zombie-svg { animation:none; }
        .zombie-unit.dying .zombie-svg { animation:none; }

        .zombie-visual-container { position:relative; }

        /* HP Bar */
        .zombie-hp-bar { width:52px; height:5px; background:#333; border-radius:2px; margin-top:2px; }
        .zombie-hp-fill { height:100%; background:#4caf50; border-radius:2px; transition:width 0.15s; }
        .damaged .zombie-hp-fill { background:red; }

        /* Blood splatter khi chết */
        .blood-particle { position:absolute; top:50%; left:50%; width:5px; height:5px; background:red; border-radius:50%; animation:blood-splat 0.35s ease-out forwards; pointer-events:none; }
        @keyframes blood-splat { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 100%{transform:translate(var(--tx),var(--ty)) scale(0.4);opacity:0} }

        /* Boss Shield */
        .boss-shield-orbit { position:absolute; top:-10px; left:50%; transform:translateX(-50%); width:0; height:0; animation:shield-rotate 2s linear infinite; }
        .shield-segment { position:absolute; font-size:1.4rem; opacity:0.8; }
        @keyframes shield-rotate { 100%{transform:translateX(-50%) rotate(360deg)} }

        /* ── Controls ── */
        .game-controls { padding:12px 16px; background:rgba(0,0,0,0.85); display:flex; gap:10px; border-top:2px solid #333; }
        .game-controls input { flex:1; padding:11px 14px; font-size:1.05rem; background:#111; border:2px solid #444; color:#fff; border-radius:8px; font-family:monospace; outline:none; transition:border-color 0.15s; }
        .game-controls input:focus { border-color:#4ef; }
        .game-controls button { padding:11px 24px; font-size:1rem; background:#cc3333; border:none; color:#fff; border-radius:8px; cursor:pointer; font-weight:700; letter-spacing:1px; }
        .game-controls button:hover { background:#ff3333; }
        .game-controls button:active { transform:scale(0.97); }
      `}</style>
    </div>
  );
};

export default ZombieGamePage;
