// game-server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3001;

// ─── GAME CONSTANTS ──────────────────────────────────────────────────────────
const TOWER_TYPES = {
  archer:   { name: 'Xạ Thủ',   icon: '🏹', cost: 30,  damage: 15, range: 180, fireRate: 1200, color: '#22c55e', desc: 'Tấn công đơn, tốc độ trung bình' },
  cannon:   { name: 'Đại Bác',  icon: '💣', cost: 60,  damage: 40, range: 140, fireRate: 2500, color: '#f97316', desc: 'Damage cao, sát thương diện rộng' },
  ice:      { name: 'Băng',     icon: '❄️', cost: 50,  damage: 8,  range: 160, fireRate: 1000, color: '#60a5fa', desc: 'Làm chậm quái vật' },
  lightning:{ name: 'Sét',      icon: '⚡', cost: 80,  damage: 25, range: 200, fireRate: 800,  color: '#a855f7', desc: 'Chain lightning 3 mục tiêu' },
  poison:   { name: 'Độc',      icon: '☠️', cost: 45,  damage: 5,  range: 150, fireRate: 600,  color: '#84cc16', desc: 'DoT, gây độc liên tục' },
  sniper:   { name: 'Bắn Tỉa',  icon: '🎯', cost: 90,  damage: 80, range: 300, fireRate: 3000, color: '#f59e0b', desc: 'Damage cực cao, tầm xa' },
};

const ENEMY_TYPES = {
  normal:  { name: 'Zombie',    icon: '🧟', hp: 80,   speed: 0.8, reward: 10, size: 'sm' },
  fast:    { name: 'Runner',    icon: '🏃', hp: 40,   speed: 2.0, reward: 15, size: 'sm' },
  tank:    { name: 'Tank',      icon: '🦾', hp: 300,  speed: 0.5, reward: 30, size: 'lg' },
  flying:  { name: 'Bat',       icon: '🦇', hp: 60,   speed: 1.5, reward: 20, size: 'sm' },
  boss:    { name: 'BOSS',      icon: '👹', hp: 1000, speed: 0.4, reward: 100, size: 'xl' },
  ghost:   { name: 'Ghost',     icon: '👻', hp: 50,   speed: 1.2, reward: 25, size: 'sm' },
};

const BOSS_SKILLS = [
  { id: 'rage',      name: '😡 Rage',       desc: 'Tăng speed tất cả quái x1.5 trong 10s' },
  { id: 'shield',    name: '🛡️ Shield',     desc: 'Tất cả quái có shield 1 lần' },
  { id: 'heal',      name: '💊 Mass Heal',  desc: 'Hồi 20% máu tất cả quái' },
  { id: 'spawn',     name: '🌊 Swarm',      desc: 'Triệu hồi thêm 5 quái ngay lập tức' },
  { id: 'freeze',    name: '❄️ Freeze',     desc: 'Đóng băng tất cả tháp 5s' },
];

const TOWER_WEAPONS = [
  { id: 'basic',   name: 'Đạn Cơ Bản',  icon: '🔵', price: 0,    dmgBonus: 1.0, desc: 'Mặc định' },
  { id: 'silver',  name: 'Đạn Bạc',     icon: '⚪', price: 100,  dmgBonus: 1.3, desc: '+30% damage' },
  { id: 'fire',    name: 'Đạn Lửa',     icon: '🔴', price: 250,  dmgBonus: 1.6, desc: '+60% damage + burn' },
  { id: 'ice',     name: 'Đạn Băng',    icon: '🔷', price: 200,  dmgBonus: 1.2, desc: '+20% damage + slow' },
  { id: 'thunder', name: 'Đạn Sét',     icon: '🟡', price: 400,  dmgBonus: 2.0, desc: '+100% damage' },
  { id: 'dark',    name: 'Đạn Tối',     icon: '🟣', price: 600,  dmgBonus: 2.5, desc: '+150% damage + poison' },
];

const MOUSE_HAMMERS = [
  { id: 'wood',    name: 'Búa Gỗ',      icon: '🔨', price: 0,   damage: 15, desc: 'Mặc định' },
  { id: 'stone',   name: 'Búa Đá',      icon: '🪨', price: 80,  damage: 25, desc: '+10 damage' },
  { id: 'iron',    name: 'Búa Sắt',     icon: '⚒️', price: 200, damage: 40, desc: '+25 damage' },
  { id: 'golden',  name: 'Búa Vàng',    icon: '🔱', price: 400, damage: 60, desc: '+45 damage, crit 20%' },
  { id: 'thunder', name: 'Búa Sấm',     icon: '⚡', price: 700, damage: 85, desc: '+70 damage, stun 1s' },
];

const SHOOTER_GUNS = [
  { id: 'pistol',  name: 'Pistol',      icon: '🔫', price: 0,    damage: 20, fireRate: 1,   desc: 'Mặc định' },
  { id: 'shotgun', name: 'Shotgun',     icon: '💥', price: 150,  damage: 40, fireRate: 0.7, desc: '+20 dmg, -30% tốc độ' },
  { id: 'smg',     name: 'SMG',         icon: '🔥', price: 300,  damage: 15, fireRate: 1.5, desc: '-5 dmg, +50% tốc độ' },
  { id: 'sniper',  name: 'Sniper',      icon: '🎯', price: 500,  damage: 80, fireRate: 0.5, desc: '+60 dmg, -50% tốc độ' },
  { id: 'rocket',  name: 'Rocket',      icon: '🚀', price: 800,  damage: 120, fireRate: 0.4, desc: 'AoE damage' },
];

// ─── ROOM MANAGEMENT ─────────────────────────────────────────────────────────
const rooms = new Map();

function createRoom(gameType, hostId, hostName, settings = {}) {
  const roomId = uuidv4().substring(0, 6).toUpperCase();
  const room = {
    id: roomId,
    gameType,
    hostId,
    settings: {
      maxPlayers: settings.maxPlayers || 4,
      minWords: gameType === 'tower' ? 50 : 20,
      ...settings,
    },
    players: [],
    state: 'lobby', // lobby | playing | ended
    gameState: null,
    createdAt: Date.now(),
  };
  rooms.set(roomId, room);
  return room;
}

function getRoom(roomId) { return rooms.get(roomId); }
function deleteRoom(roomId) { rooms.delete(roomId); }

// ─── TOWER DEFENSE GAME LOGIC ─────────────────────────────────────────────────
class TowerDefenseGame {
  constructor(room, words) {
    this.room = room;
    this.words = words;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.wave = 0;
    this.lives = 20;
    this.gold = 150;
    this.score = 0;
    this.rage = 0; // 0-100 nộ khí
    this.activeSkills = [];
    this.bossSkills = [];
    this.playerWeapons = {}; // playerId -> weaponId
    this.towerId = 0;
    this.enemyId = 0;
    this.projId = 0;
    this.gameLoop = null;
    this.waveTimer = null;
    this.isPaused = false;
  }

  start() {
    // Init player weapons
    this.room.players.forEach(p => { this.playerWeapons[p.id] = 'basic'; });
    this.startWave();
    this.gameLoop = setInterval(() => this.tick(), 100);
  }

  stop() {
    if (this.gameLoop) clearInterval(this.gameLoop);
    if (this.waveTimer) clearTimeout(this.waveTimer);
  }

  startWave() {
    this.wave++;
    const count = 5 + this.wave * 3;
    const bossEvery = 5;
    let spawned = 0;
    const spawnInterval = setInterval(() => {
      if (spawned >= count) { clearInterval(spawnInterval); return; }
      const types = ['normal', 'fast'];
      if (this.wave >= 3) types.push('tank');
      if (this.wave >= 4) types.push('flying');
      const isBoss = spawned === count - 1 && this.wave % bossEvery === 0;
      const type = isBoss ? 'boss' : types[Math.floor(Math.random() * types.length)];
      const word = this.words[Math.floor(Math.random() * this.words.length)];
      const eType = ENEMY_TYPES[type];
      this.enemies.push({
        id: ++this.enemyId,
        type, word: word.English, meaning: word.Vietnamese,
        hp: Math.round(eType.hp * (1 + this.wave * 0.15)),
        maxHp: Math.round(eType.hp * (1 + this.wave * 0.15)),
        speed: eType.speed, x: -5, y: 50 + (Math.random() - 0.5) * 20,
        reward: eType.reward, icon: eType.icon,
        effects: [], shield: false,
      });
      spawned++;
    }, 1200);

    io.to(this.room.id).emit('wave:start', { wave: this.wave });
    this.waveTimer = setTimeout(() => {
      if (this.enemies.length === 0) this.startWave();
    }, count * 1200 + 8000);
  }

  tick() {
    if (this.isPaused || this.lives <= 0) return;

    // Move enemies
    this.enemies = this.enemies.filter(e => {
      const speedMult = this.activeSkills.includes('rage') ? 1.5 : this.activeSkills.includes('freeze_towers') ? 1 : 1;
      e.x += e.speed * speedMult * 0.3;
      if (e.x > 105) {
        this.lives = Math.max(0, this.lives - 1);
        if (this.lives <= 0) this.endGame(false);
        return false;
      }
      return true;
    });

    // Tower auto-attack
    if (!this.activeSkills.includes('freeze_towers')) {
      this.towers.forEach(tower => {
        if (!tower.lastFire || Date.now() - tower.lastFire > tower.fireRate) {
          const tType = TOWER_TYPES[tower.type];
          const target = this.enemies.find(e =>
            Math.sqrt(Math.pow(e.x - tower.x, 2) + Math.pow(e.y - tower.y, 2)) < tType.range / 10
          );
          if (target) {
            tower.lastFire = Date.now();
            const weaponBonus = TOWER_WEAPONS.find(w => w.id === (this.playerWeapons[tower.ownerId] || 'basic'))?.dmgBonus || 1;
            const dmg = Math.round(tType.damage * weaponBonus);
            this.dealDamage(target, dmg, tower.type);
            this.projId++;
            io.to(this.room.id).emit('tower:fire', {
              pid: this.projId, towerId: tower.id,
              targetId: target.id, damage: dmg, type: tower.type
            });
          }
        }
      });
    }

    // Check win
    if (this.wave >= 20 && this.enemies.length === 0) {
      this.endGame(true);
    }

    io.to(this.room.id).emit('game:state', {
      enemies: this.enemies.map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, word: e.word, icon: e.icon, shield: e.shield })),
      lives: this.lives, gold: this.gold, score: this.score, rage: this.rage,
      wave: this.wave, towers: this.towers,
    });
  }

  // game-server/server.js (Chỉ cập nhật hàm dealDamage)

  dealDamage(enemy, dmg, source = 'player') {
    // 1. Kiểm tra Boss Skill có đang chặn đòn không
    if (this.bossSkills.includes('shield') && source === 'tower') {
      io.to(this.room.id).emit('tower:blocked', { enemyId: enemy.id });
      return 0; // Tháp bắn bị chặn
    }

    if (enemy.shield) { enemy.shield = false; return 0; } // Khiên tạm thời bị mất
    
    enemy.hp -= dmg;
    this.rage = Math.min(100, this.rage + 2); // Tăng điểm thịnh nộ

    if (enemy.hp <= 0) {
      this.gold += enemy.reward;
      this.score += enemy.reward * 10;
      this.rage = Math.min(100, this.rage + 10);
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) {
        const isBoss = enemy.type === 'boss'; // Kiểm tra Boss
        this.enemies.splice(idx, 1);
        
        // 📢 Gửi event kèm FLAG isBoss: Quan trọng cho render
        io.to(this.room.id).emit('enemy:remove', { 
          id: enemy.id, 
          gold: this.gold, 
          score: this.score, 
          rage: this.rage,
          isBoss: isBoss // 🔥 THÊM FLAG NÀY
        });
        
        if (isBoss) {
          const skill = BOSS_SKILLS[Math.floor(Math.random() * BOSS_SKILLS.length)];
          this.bossSkills.push(skill);
          // Gửi thông báo giết Boss và skill
          io.to(this.room.id).emit('boss:killed', { skill, gold: enemy.reward });
        }
      }
    } else {
      // 📢 CẬP NHẬT: Gửi event trúng đòn kèm FLAG isBoss: Cho hiệu ứng khiên
      io.to(this.room.id).emit('enemy:hit', { 
        id: enemy.id, 
        hp: enemy.hp, 
        maxHp: enemy.maxHp,
        isBoss: enemy.type === 'boss' // 🔥 THÊM FLAG NÀY
      });
    }
    return dmg;
  }

  playerAttack(playerId, answer) {
    const target = this.enemies.find(e => e.word.toLowerCase() === answer.toLowerCase());
    if (target) {
      const weapon = TOWER_WEAPONS.find(w => w.id === (this.playerWeapons[playerId] || 'basic'));
      const dmg = Math.round(25 * (weapon?.dmgBonus || 1));
      const actual = this.dealDamage(target, dmg, 'player');
      return { hit: true, enemyId: target.id, damage: actual };
    }
    return { hit: false };
  }

  buildTower(playerId, type, x, y) {
    const tType = TOWER_TYPES[type];
    if (!tType || this.gold < tType.cost) return { success: false, reason: 'Không đủ vàng' };
    this.gold -= tType.cost;
    const tower = { id: ++this.towerId, type, x, y, ownerId: playerId, ...tType, lastFire: 0 };
    this.towers.push(tower);
    return { success: true, tower };
  }

  useUlti() {
    if (this.rage < 100) return { success: false };
    this.rage = 0;
    // Ulti: damage all enemies
    this.enemies.forEach(e => { e.hp -= 150; if (e.hp < 1) e.hp = 1; });
    io.to(this.room.id).emit('ulti:fired', { damage: 150 });
    return { success: true };
  }

  endGame(win) {
    this.stop();
    io.to(this.room.id).emit('game:end', { win, score: this.score, wave: this.wave, lives: this.lives });
    this.room.state = 'ended';
  }
}

// ─── WHACK-A-MOUSE GAME LOGIC ─────────────────────────────────────────────────
class WhackMouseGame {
  constructor(room, words) {
    this.room = room;
    this.words = words;
    this.players = {};
    this.duration = room.settings.duration || 120;
    this.timeLeft = this.duration;
    this.gameLoop = null;
    this.timerInterval = null;
  }

  start() {
    // Init players
    this.room.players.forEach(p => {
      this.players[p.id] = {
        id: p.id, name: p.name,
        hp: 100, maxHp: 100,
        x: 10 + Math.random() * 80,
        y: 20 + Math.random() * 60,
        word: this.getRandomWord(),
        score: 0,
        hammer: p.hammer || 'wood',
        alive: true,
        stunned: false,
        effects: [],
        kills: 0,
      };
    });

    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      io.to(this.room.id).emit('timer:tick', { timeLeft: this.timeLeft });
      if (this.timeLeft <= 0) this.endGame();
    }, 1000);

    this.gameLoop = setInterval(() => this.moveRandomly(), 2000);
    io.to(this.room.id).emit('game:state', { players: this.players });
  }

  stop() {
    if (this.gameLoop) clearInterval(this.gameLoop);
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  moveRandomly() {
    Object.values(this.players).filter(p => p.alive && !p.stunned).forEach(p => {
      p.x = Math.max(5, Math.min(90, p.x + (Math.random() - 0.5) * 20));
      p.y = Math.max(10, Math.min(85, p.y + (Math.random() - 0.5) * 15));
    });
    io.to(this.room.id).emit('players:move', { players: this.players });
  }

  getRandomWord() {
    return this.words[Math.floor(Math.random() * this.words.length)];
  }

  attack(attackerId, answer) {
    const attacker = this.players[attackerId];
    if (!attacker || !attacker.alive) return { hit: false };

    const target = Object.values(this.players).find(p =>
      p.id !== attackerId && p.alive && p.word.English.toLowerCase() === answer.toLowerCase()
    );

    if (target) {
      const hammer = MOUSE_HAMMERS.find(h => h.id === attacker.hammer) || MOUSE_HAMMERS[0];
      let dmg = hammer.damage;
      let crit = false;
      let stun = false;

      if (hammer.id === 'golden' && Math.random() < 0.2) { dmg *= 2; crit = true; }
      if (hammer.id === 'thunder') { stun = true; target.stunned = true; setTimeout(() => { if (target) target.stunned = false; }, 1000); }

      target.hp = Math.max(0, target.hp - dmg);
      target.word = this.getRandomWord();
      attacker.score += dmg;

      if (target.hp <= 0) {
        target.alive = false;
        attacker.kills++;
        attacker.score += 50;
        io.to(this.room.id).emit('player:died', { id: target.id, killerId: attackerId });

        const alive = Object.values(this.players).filter(p => p.alive);
        if (alive.length <= 1) { this.endGame(); return { hit: true, killed: true }; }
      }

      io.to(this.room.id).emit('player:hit', {
        targetId: target.id, attackerId, damage: dmg, crit, stun,
        targetHp: target.hp, newWord: target.word.English,
      });
      return { hit: true, damage: dmg, crit, stun };
    }
    return { hit: false };
  }

  endGame() {
    this.stop();
    const ranked = Object.values(this.players).sort((a, b) => b.score - a.score);
    io.to(this.room.id).emit('game:end', { ranked, winner: ranked[0] });
    this.room.state = 'ended';
  }
}

// ─── CO-OP SHOOTER GAME LOGIC ──────────────────────────────────────────────────
class CoopShooterGame {
  constructor(room, words) {
    this.room = room;
    this.words = words;
    this.players = {};
    this.enemies = [];
    this.duration = room.settings.duration || 180;
    this.timeLeft = this.duration;
    this.enemyId = 0;
    this.gameLoop = null;
    this.timerInterval = null;
    this.spawnInterval = null;
    this.wave = 1;
    this.ULTI_PHRASE = [];
  }

  start() {
    this.room.players.forEach(p => {
      this.players[p.id] = {
        id: p.id, name: p.name,
        score: 0, kills: 0,
        gun: p.gun || 'pistol',
        ultiCooldown: 0,
        powerups: [],
        alive: true,
      };
    });

    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      // Ulti cooldown
      Object.values(this.players).forEach(p => {
        if (p.ultiCooldown > 0) p.ultiCooldown--;
      });
      io.to(this.room.id).emit('timer:tick', { timeLeft: this.timeLeft, players: this.players });
      if (this.timeLeft <= 0) this.endGame();
    }, 1000);

    this.spawnInterval = setInterval(() => this.spawnEnemy(), Math.max(600, 1500 - this.wave * 50));
    this.gameLoop = setInterval(() => this.tick(), 150);

    // Wave up
    setInterval(() => { this.wave++; }, 20000);

    this.spawnEnemy();
    this.spawnEnemy();
  }

  stop() {
    if (this.gameLoop) clearInterval(this.gameLoop);
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.spawnInterval) clearInterval(this.spawnInterval);
  }

  spawnEnemy() {
    const types = ['normal', 'fast'];
    if (this.wave >= 2) types.push('tank');
    if (this.wave >= 3) types.push('flying');
    const type = types[Math.floor(Math.random() * types.length)];
    const word = this.words[Math.floor(Math.random() * this.words.length)];
    const eType = ENEMY_TYPES[type];
    this.enemies.push({
      id: ++this.enemyId, type,
      word: word.English, meaning: word.Vietnamese,
      hp: Math.round(eType.hp * (1 + this.wave * 0.1)),
      maxHp: Math.round(eType.hp * (1 + this.wave * 0.1)),
      x: 5 + Math.random() * 90, y: 5 + Math.random() * 60,
      icon: eType.icon, reward: eType.reward,
      powerup: Math.random() < 0.15 ? this.randomPowerup() : null,
    });
  }

  randomPowerup() {
    const powerups = [
      { id: 'rapidfire', name: '⚡ Rapid Fire', desc: 'x2 tốc độ bắn 15s' },
      { id: 'double_dmg', name: '💥 Double DMG', desc: 'x2 damage 10s' },
      { id: 'shield',    name: '🛡️ Shield',    desc: 'Miễn damage 5s' },
      { id: 'gold',      name: '💰 Gold x2',   desc: 'x2 điểm 20s' },
    ];
    return powerups[Math.floor(Math.random() * powerups.length)];
  }

  tick() {
    io.to(this.room.id).emit('game:state', {
      enemies: this.enemies.map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, word: e.word, icon: e.icon, powerup: e.powerup?.id })),
      players: this.players, wave: this.wave,
    });
  }

  shoot(playerId, answer) {
    const player = this.players[playerId];
    if (!player) return { hit: false };
    const target = this.enemies.find(e => e.word.toLowerCase() === answer.toLowerCase());
    if (target) {
      const gun = SHOOTER_GUNS.find(g => g.id === player.gun) || SHOOTER_GUNS[0];
      let dmg = gun.damage;
      if (player.powerups.includes('double_dmg')) dmg *= 2;
      if (player.powerups.includes('rapidfire')) dmg = Math.round(dmg * 0.8);

      target.hp -= dmg;
      let powerup = null;

      if (target.hp <= 0) {
        player.kills++;
        player.score += target.reward * (player.powerups.includes('gold') ? 20 : 10);
        powerup = target.powerup;
        if (powerup) {
          player.powerups.push(powerup.id);
          setTimeout(() => {
            player.powerups = player.powerups.filter(p => p !== powerup.id);
          }, 15000);
        }
        this.enemies = this.enemies.filter(e => e.id !== target.id);
        io.to(this.room.id).emit('enemy:die', { id: target.id, killerId: playerId, powerup });
      } else {
        io.to(this.room.id).emit('enemy:hit', { id: target.id, hp: target.hp, damage: dmg, shooterId: playerId });
      }
      return { hit: true, damage: dmg, powerup };
    }
    return { hit: false };
  }

  useUlti(playerId, typedWords) {
    const player = this.players[playerId];
    if (!player || player.ultiCooldown > 0) return { success: false };

    // Generate ulti phrase
    const phrase = this.words.slice(0, 12).map(w => w.English);
    const correct = typedWords.filter(w => phrase.includes(w)).length;
    const speedBonus = Math.min(typedWords.length / 12, 1);
    const damage = Math.round(200 * (correct / 12) * (0.5 + speedBonus * 0.5));

    // Damage all enemies
    this.enemies.forEach(e => { e.hp = Math.max(1, e.hp - damage); });
    player.ultiCooldown = 120; // 2 min
    player.score += damage * 2;

    io.to(this.room.id).emit('ulti:fired', { playerId, damage, correct, total: 12 });
    return { success: true, damage, phrase };
  }

  endGame() {
    this.stop();
    const ranked = Object.values(this.players).sort((a, b) => b.score - a.score);
    io.to(this.room.id).emit('game:end', { ranked, winner: ranked[0] });
    this.room.state = 'ended';
  }
}

// ─── ACTIVE GAMES ────────────────────────────────────────────────────────────
const activeGames = new Map();

// ─── SOCKET.IO EVENTS ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅ Connected: ${socket.id}`);

  // ── ROOM ──────────────────────────────────────────────────────────────────
  socket.on('room:create', ({ gameType, playerName, settings }) => {
    const room = createRoom(gameType, socket.id, playerName, settings);
    room.players.push({ id: socket.id, name: playerName, ready: false, hammer: 'wood', gun: 'pistol' });
    socket.join(room.id);
    socket.emit('room:created', { room });
    console.log(`🏠 Room ${room.id} created (${gameType})`);
  });

  socket.on('room:join', ({ roomId, playerName }) => {
    const room = getRoom(roomId.toUpperCase());
    if (!room) { socket.emit('room:error', { msg: 'Phòng không tồn tại!' }); return; }
    if (room.state !== 'lobby') { socket.emit('room:error', { msg: 'Game đang diễn ra!' }); return; }
    if (room.players.length >= room.settings.maxPlayers) { socket.emit('room:error', { msg: 'Phòng đã đầy!' }); return; }

    room.players.push({ id: socket.id, name: playerName, ready: false, hammer: 'wood', gun: 'pistol' });
    socket.join(room.id);
    socket.emit('room:joined', { room });
    io.to(room.id).emit('room:updated', { room });
    console.log(`👤 ${playerName} joined room ${room.id}`);
  });

  socket.on('room:ready', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) { player.ready = !player.ready; io.to(roomId).emit('room:updated', { room }); }
  });

  socket.on('room:leave', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    socket.leave(roomId);
    if (room.players.length === 0) { deleteRoom(roomId); return; }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    io.to(roomId).emit('room:updated', { room });
  });

  // ── STORE ─────────────────────────────────────────────────────────────────
  socket.on('store:buy_weapon', ({ roomId, weaponId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) { player.weapon = weaponId; io.to(roomId).emit('room:updated', { room }); }
  });

  socket.on('store:buy_hammer', ({ roomId, hammerId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) { player.hammer = hammerId; io.to(roomId).emit('room:updated', { room }); }
  });

  socket.on('store:buy_gun', ({ roomId, gunId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) { player.gun = gunId; io.to(roomId).emit('room:updated', { room }); }
  });

  // ── GAME START ────────────────────────────────────────────────────────────
  socket.on('game:start', ({ roomId, words }) => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (words.length < room.settings.minWords) {
      socket.emit('game:error', { msg: `Cần ít nhất ${room.settings.minWords} từ vựng!` });
      return;
    }

    room.state = 'playing';
    let game;
    if (room.gameType === 'tower') game = new TowerDefenseGame(room, words);
    else if (room.gameType === 'mouse') game = new WhackMouseGame(room, words);
    else if (room.gameType === 'shooter') game = new CoopShooterGame(room, words);

    if (game) {
      activeGames.set(roomId, game);
      game.start();
      io.to(roomId).emit('game:started', { gameType: room.gameType });
    }
  });

  // ── TOWER DEFENSE ─────────────────────────────────────────────────────────
  socket.on('tower:build', ({ roomId, type, x, y }) => {
    const game = activeGames.get(roomId);
    if (!game || !(game instanceof TowerDefenseGame)) return;
    const result = game.buildTower(socket.id, type, x, y);
    socket.emit('tower:build_result', result);
    if (result.success) io.to(roomId).emit('tower:built', result);
  });

  socket.on('tower:attack', ({ roomId, answer }) => {
    const game = activeGames.get(roomId);
    if (!game || !(game instanceof TowerDefenseGame)) return;
    const result = game.playerAttack(socket.id, answer);
    socket.emit('attack:result', result);
    if (result.hit) io.to(roomId).emit('player:attacked', { playerId: socket.id, ...result });
  });

  socket.on('tower:ulti', ({ roomId }) => {
    const game = activeGames.get(roomId);
    if (!game || !(game instanceof TowerDefenseGame)) return;
    const result = game.useUlti();
    if (result.success) io.to(roomId).emit('ulti:activated', { playerId: socket.id });
  });

  socket.on('boss:skill', ({ roomId, skillId }) => {
    const game = activeGames.get(roomId);
    if (!game || !(game instanceof TowerDefenseGame)) return;
    const skill = game.bossSkills.find(s => s.id === skillId);
    if (!skill) return;
    game.bossSkills = game.bossSkills.filter(s => s.id !== skillId);
    // Apply skill
    if (skillId === 'rage') { game.activeSkills.push('rage'); setTimeout(() => { game.activeSkills = game.activeSkills.filter(s => s !== 'rage'); }, 10000); }
    else if (skillId === 'heal') { game.enemies.forEach(e => { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.2); }); }
    else if (skillId === 'shield') { game.enemies.forEach(e => e.shield = true); }
    else if (skillId === 'freeze') { game.activeSkills.push('freeze_towers'); setTimeout(() => { game.activeSkills = game.activeSkills.filter(s => s !== 'freeze_towers'); }, 5000); }
    io.to(roomId).emit('skill:activated', { skill, playerId: socket.id });
  });

  // ── WHACK MOUSE ───────────────────────────────────────────────────────────
  socket.on('mouse:attack', ({ roomId, answer }) => {
    const game = activeGames.get(roomId);
    if (!game || !(game instanceof WhackMouseGame)) return;
    const result = game.attack(socket.id, answer);
    socket.emit('attack:result', result);
  });

  // ── CO-OP SHOOTER ─────────────────────────────────────────────────────────
  socket.on('shooter:shoot', ({ roomId, answer }) => {
    const game = activeGames.get(roomId);
    if (!game || !(game instanceof CoopShooterGame)) return;
    const result = game.shoot(socket.id, answer);
    socket.emit('shoot:result', result);
  });

  socket.on('shooter:ulti', ({ roomId, typedWords }) => {
    const game = activeGames.get(roomId);
    if (!game || !(game instanceof CoopShooterGame)) return;
    const result = game.useUlti(socket.id, typedWords);
    socket.emit('ulti:result', result);
  });

  // ── DISCONNECT ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    rooms.forEach((room, roomId) => {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) { deleteRoom(roomId); activeGames.delete(roomId); }
        else {
          if (room.hostId === socket.id) room.hostId = room.players[0].id;
          io.to(roomId).emit('room:updated', { room });
          io.to(roomId).emit('player:left', { playerId: socket.id });
        }
      }
    });
  });
});

// ─── REST API ────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', rooms: rooms.size, games: activeGames.size }));
app.get('/constants', (_, res) => res.json({ TOWER_TYPES, ENEMY_TYPES, TOWER_WEAPONS, MOUSE_HAMMERS, SHOOTER_GUNS, BOSS_SKILLS }));
app.get('/rooms', (_, res) => res.json([...rooms.values()].map(r => ({ id: r.id, gameType: r.gameType, players: r.players.length, state: r.state }))));

server.listen(PORT, () => {
  console.log(`🚀 TOEIC Game Server running on port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`🎮 Ready for connections!`);
});
