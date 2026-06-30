const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 680,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
    show: false, backgroundColor: '#0f0f1a',
  });
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
  mainWindow.once('ready-to-show', () => { mainWindow.show(); mainWindow.maximize(); });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── sql.js SQLite (Pure JavaScript - No build tools needed!) ─────────────────
const initSqlJs = require('sql.js');

const userDataPath = app.getPath('userData');
if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
const DB_PATH = path.join(userDataPath, 'vocab.db');

let db = null;
let SQL = null;

async function initDatabase() {
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`PRAGMA foreign_keys = ON;`);
  createTables();
  saveDb(); // Save initial state
  console.log('✅ sql.js DB initialized at:', DB_PATH);

  // Auto-save every 30 seconds
  setInterval(saveDb, 30000);
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('Save DB error:', e.message);
  }
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS WordGroups (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL,
      Description TEXT DEFAULT '',
      Color TEXT DEFAULT '#4f46e5',
      Icon TEXT DEFAULT '📖',
      CreatedAt TEXT DEFAULT (datetime('now')),
      UpdatedAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS Words (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      GroupId INTEGER REFERENCES WordGroups(Id) ON DELETE CASCADE,
      English TEXT NOT NULL,
      Vietnamese TEXT NOT NULL,
      Pronunciation TEXT DEFAULT '',
      PartOfSpeech TEXT DEFAULT '',
      Example TEXT DEFAULT '',
      ExampleVi TEXT DEFAULT '',
      Level INTEGER DEFAULT 0,
      NextReview TEXT DEFAULT (datetime('now')),
      TotalReviews INTEGER DEFAULT 0,
      CorrectReviews INTEGER DEFAULT 0,
      CreatedAt TEXT DEFAULT (datetime('now')),
      UpdatedAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS StudySessions (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Mode TEXT NOT NULL,
      Score INTEGER DEFAULT 0,
      TotalWords INTEGER DEFAULT 0,
      CorrectWords INTEGER DEFAULT 0,
      DurationSeconds INTEGER DEFAULT 0,
      GroupIds TEXT DEFAULT '',
      CreatedAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS GameScores (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      GameType TEXT NOT NULL,
      Score INTEGER DEFAULT 0,
      Level INTEGER DEFAULT 1,
      WordsTyped INTEGER DEFAULT 0,
      Accuracy REAL DEFAULT 0,
      DurationSeconds INTEGER DEFAULT 0,
      CreatedAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS UserSettings (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      SettingKey TEXT NOT NULL UNIQUE,
      SettingValue TEXT DEFAULT '',
      UpdatedAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS DailyGoals (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      GoalDate TEXT DEFAULT (date('now')),
      TargetWords INTEGER DEFAULT 20,
      ReviewedWords INTEGER DEFAULT 0,
      IsCompleted INTEGER DEFAULT 0
    );
  `);
}

// Convert sql.js result to array of objects
function resultToObjects(res) {
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('db-connect', () => ({ success: true }));
ipcMain.handle('db-status', () => ({ connected: !!db }));
ipcMain.handle('db-get-path', () => DB_PATH);

ipcMain.handle('db-query', (event, query, params = []) => {
  try {
    if (!db) return { success: false, error: 'Database not ready' };
    
    const sql = query.trim().toUpperCase();
    const isSelect = sql.startsWith('SELECT') || sql.startsWith('PRAGMA') || sql.startsWith('WITH');
    
    if (isSelect) {
      const res = db.exec(query, params);
      return { success: true, data: resultToObjects(res), rowsAffected: [0] };
    } else {
      db.run(query, params);
      const changes = db.getRowsModified();
      const lastId = db.exec('SELECT last_insert_rowid() as id');
      const lastInsertId = lastId.length > 0 ? lastId[0].values[0][0] : null;
      
      // For INSERT, return the inserted row
      if (sql.startsWith('INSERT') && lastInsertId) {
        const table = query.match(/INTO\s+(\w+)/i)?.[1];
        if (table) {
          const row = db.exec(`SELECT * FROM ${table} WHERE Id = ?`, [lastInsertId]);
          saveDb();
          return { success: true, data: resultToObjects(row), rowsAffected: [changes] };
        }
      }
      
      saveDb();
      return { success: true, data: [], rowsAffected: [changes] };
    }
  } catch (err) {
    console.error('DB Error:', err.message, '\nQuery:', query.substring(0, 100));
    return { success: false, error: err.message };
  }
});
