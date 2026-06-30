// src/services/database.ts - SQLite version
export interface QueryResult<T = any> {
  success: boolean;
  data?: T[];
  rowsAffected?: number[];
  error?: string;
}

const api = (window as any).electronAPI;

// Convert SQL Server syntax to SQLite syntax
function convertQuery(query: string): string {
  return query
    // Remove OUTPUT INSERTED.*
    .replace(/OUTPUT INSERTED\.\*/gi, '')
    // GETDATE() -> datetime('now')
    .replace(/GETDATE\(\)/gi, "datetime('now')")
    // CAST(x AS DATE) -> date(x)
    .replace(/CAST\(GETDATE\(\) AS DATE\)/gi, "date('now')")
    .replace(/CAST\(CreatedAt AS DATE\)/gi, "date(CreatedAt)")
    // DATEADD -> datetime with offset
    .replace(/DATEADD\(day,\s*(-?\d+),\s*GETDATE\(\)\)/gi, (_, days) => `datetime('now', '${days} days')`)
    // TOP N -> LIMIT N
    .replace(/SELECT TOP (\d+)/gi, 'SELECT')
    .replace(/TOP (\d+)/gi, '')
    // ISNULL -> IFNULL
    .replace(/ISNULL\(/gi, 'IFNULL(')
    // NEWID() -> random()
    .replace(/NEWID\(\)/gi, 'random()')
    // NVARCHAR -> TEXT
    .replace(/NVARCHAR\(\d+\)/gi, 'TEXT')
    // IDENTITY -> AUTOINCREMENT (already handled in schema)
    // sysobjects check -> sqlite_master
    .replace(/SELECT \* FROM sysobjects WHERE name='(\w+)' AND xtype='U'/gi, 
             "SELECT * FROM sqlite_master WHERE type='table' AND name='$1'")
    // IF NOT EXISTS blocks - SQLite handles these differently
    .replace(/IF NOT EXISTS \(.*?\)\s*/gi, '')
    // Remove square brackets
    .replace(/\[(\w+)\]/g, '$1')
    // @@SPID not needed
    .replace(/WHERE session_id = @@SPID/gi, 'LIMIT 1')
    // Fix LIMIT for TOP replacements
    .replace(/FROM (\w+)(.*?)(?:ORDER|WHERE|GROUP|$)/gi, (match) => match)
    // @p0, @p1 params -> ? 
    .replace(/@p\d+/g, '?');
}

function convertParams(params: any[]): any[] {
  return params.map(p => {
    let val = p.value;
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return val;
  });
}

export const dbService = {
  connect: async (): Promise<{ success: boolean; error?: string }> => {
    return api.dbConnect({});
  },
  query: async <T = any>(query: string, params: any[] = []): Promise<QueryResult<T>> => {
    const converted = convertQuery(query);
    const convertedParams = convertParams(params);
    return api.dbQuery(converted, convertedParams);
  },
  status: async (): Promise<{ connected: boolean }> => {
    return api.dbStatus();
  },
};

export const db = {
  getGroups: () =>
    dbService.query(`SELECT *, (SELECT COUNT(*) FROM Words WHERE GroupId = WordGroups.Id) as WordCount FROM WordGroups ORDER BY CreatedAt DESC`),

  createGroup: (name: string, description: string, color: string, icon: string) =>
    dbService.query(
      `INSERT INTO WordGroups (Name, Description, Color, Icon) VALUES (?, ?, ?, ?)`,
      [{ value: name }, { value: description }, { value: color }, { value: icon }]
    ),

  updateGroup: (id: number, name: string, description: string, color: string, icon: string) =>
    dbService.query(
      `UPDATE WordGroups SET Name=?, Description=?, Color=?, Icon=?, UpdatedAt=datetime('now') WHERE Id=?`,
      [{ value: name }, { value: description }, { value: color }, { value: icon }, { value: id }]
    ),

  deleteGroup: (id: number) =>
    dbService.query(`DELETE FROM WordGroups WHERE Id=?`, [{ value: id }]),

  getWords: (groupId?: number) => {
    const query = groupId
      ? `SELECT w.*, g.Name as GroupName, g.Color as GroupColor FROM Words w JOIN WordGroups g ON w.GroupId = g.Id WHERE w.GroupId=? ORDER BY w.CreatedAt DESC`
      : `SELECT w.*, g.Name as GroupName, g.Color as GroupColor FROM Words w JOIN WordGroups g ON w.GroupId = g.Id ORDER BY w.CreatedAt DESC`;
    return dbService.query(query, groupId ? [{ value: groupId }] : []);
  },

  getWordsByGroups: (groupIds: number[]) => {
    if (!groupIds.length) return dbService.query(`SELECT w.*, g.Name as GroupName, g.Color as GroupColor FROM Words w JOIN WordGroups g ON w.GroupId = g.Id ORDER BY random()`);
    const placeholders = groupIds.map(() => '?').join(',');
    return dbService.query(
      `SELECT w.*, g.Name as GroupName, g.Color as GroupColor FROM Words w JOIN WordGroups g ON w.GroupId = g.Id WHERE w.GroupId IN (${placeholders}) ORDER BY random()`,
      groupIds.map(id => ({ value: id }))
    );
  },

  getDueWords: (limit = 20) =>
    dbService.query(`SELECT w.*, g.Name as GroupName FROM Words w JOIN WordGroups g ON w.GroupId = g.Id WHERE w.NextReview <= datetime('now') ORDER BY w.NextReview ASC LIMIT ${limit}`),

  createWord: (word: any) =>
    dbService.query(
      `INSERT INTO Words (GroupId, English, Vietnamese, Pronunciation, PartOfSpeech, Example, ExampleVi) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        { value: word.groupId }, { value: word.english }, { value: word.vietnamese },
        { value: word.pronunciation || '' }, { value: word.partOfSpeech || '' },
        { value: word.example || '' }, { value: word.exampleVi || '' },
      ]
    ),

  updateWord: (id: number, word: any) =>
    dbService.query(
      `UPDATE Words SET English=?, Vietnamese=?, Pronunciation=?, PartOfSpeech=?, Example=?, ExampleVi=?, GroupId=?, UpdatedAt=datetime('now') WHERE Id=?`,
      [
        { value: word.english }, { value: word.vietnamese },
        { value: word.pronunciation || '' }, { value: word.partOfSpeech || '' },
        { value: word.example || '' }, { value: word.exampleVi || '' },
        { value: word.groupId }, { value: id },
      ]
    ),

  deleteWord: (id: number) =>
    dbService.query(`DELETE FROM Words WHERE Id=?`, [{ value: id }]),

  moveWordsToGroup: (wordIds: number[], targetGroupId: number) => {
    if (!wordIds.length) return Promise.resolve({ success: true });
    const placeholders = wordIds.map(() => '?').join(',');
    return dbService.query(
      `UPDATE Words SET GroupId=?, UpdatedAt=datetime('now') WHERE Id IN (${placeholders})`,
      [{ value: targetGroupId }, ...wordIds.map(id => ({ value: id }))]
    );
  },

  updateWordSRS: (id: number, level: number, nextReview: Date, correct: boolean) =>
    dbService.query(
      `UPDATE Words SET Level=?, NextReview=?, TotalReviews=TotalReviews+1, CorrectReviews=CorrectReviews+${correct ? 1 : 0}, UpdatedAt=datetime('now') WHERE Id=?`,
      [{ value: level }, { value: nextReview.toISOString() }, { value: id }]
    ),

  saveSession: (session: any) =>
    dbService.query(
      `INSERT INTO StudySessions (Mode, Score, TotalWords, CorrectWords, DurationSeconds, GroupIds) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        { value: session.mode }, { value: session.score }, { value: session.totalWords },
        { value: session.correctWords }, { value: session.duration }, { value: session.groupIds },
      ]
    ),

  saveGameScore: (game: any) =>
    dbService.query(
      `INSERT INTO GameScores (GameType, Score, Level, WordsTyped, Accuracy, DurationSeconds) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        { value: game.gameType }, { value: game.score }, { value: game.level },
        { value: game.wordsTyped }, { value: game.accuracy }, { value: game.duration },
      ]
    ),

  getStats: () =>
    dbService.query(`
      SELECT
        (SELECT COUNT(*) FROM Words) as TotalWords,
        (SELECT COUNT(*) FROM WordGroups) as TotalGroups,
        (SELECT COUNT(*) FROM Words WHERE Level >= 4) as MasteredWords,
        (SELECT COUNT(*) FROM Words WHERE NextReview <= datetime('now')) as DueWords,
        (SELECT IFNULL(SUM(CorrectWords),0) FROM StudySessions WHERE date(CreatedAt) = date('now')) as TodayCorrect,
        (SELECT IFNULL(MAX(Score),0) FROM GameScores WHERE GameType='monster') as BestMonsterScore,
        (SELECT IFNULL(MAX(Score),0) FROM GameScores WHERE GameType='typing') as BestTypingScore,
        (SELECT IFNULL(MAX(Score),0) FROM GameScores WHERE GameType='zombie') as BestZombieScore,
        (SELECT IFNULL(MAX(Score),0) FROM GameScores WHERE GameType='sniper') as BestSniperScore
    `),

  getWeeklyStats: () =>
    dbService.query(`
      SELECT date(CreatedAt) as StudyDate, SUM(CorrectWords) as Correct, SUM(TotalWords) as Total
      FROM StudySessions WHERE CreatedAt >= datetime('now', '-7 days')
      GROUP BY date(CreatedAt) ORDER BY StudyDate
    `),

  getSetting: (key: string) =>
    dbService.query(`SELECT SettingValue FROM UserSettings WHERE SettingKey=?`, [{ value: key }]),

  setSetting: (key: string, value: string) =>
    dbService.query(
      `INSERT INTO UserSettings (SettingKey, SettingValue) VALUES (?, ?) ON CONFLICT(SettingKey) DO UPDATE SET SettingValue=excluded.SettingValue, UpdatedAt=datetime('now')`,
      [{ value: key }, { value: value }]
    ),

  // ─── LSTM STUDY SESSIONS ───────────────────────────────────────────────
  logStudySession: (wordId: number, groupId: number, correct: boolean, viewedCount: number, correctCount: number) =>
    dbService.query(
      `INSERT INTO StudySessionsLSTM (WordId, GroupId, Correct, ViewedCount, CorrectCount, Timestamp)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [{ value: wordId }, { value: groupId }, { value: correct ? 1 : 0 }, { value: viewedCount }, { value: correctCount }]
    ),

  getStudyHistory: (wordId: number, limit = 10) =>
    dbService.query(
      `SELECT * FROM StudySessionsLSTM WHERE WordId=? ORDER BY Timestamp DESC LIMIT ?`,
      [{ value: wordId }, { value: limit }]
    ),

  getWordMetrics: (wordId: number) =>
    dbService.query(
      `SELECT 
        WordId,
        COUNT(*) as TotalSessions,
        SUM(Correct) as CorrectSessions,
        MAX(ViewedCount) as MaxViewed,
        MAX(CorrectCount) as MaxCorrect,
        (SUM(Correct) * 1.0 / COUNT(*)) as RecallRate,
        MAX(Timestamp) as LastReviewTime
       FROM StudySessionsLSTM WHERE WordId=? GROUP BY WordId`,
      [{ value: wordId }]
    ),

  getGroupSchedule: (groupId: number) =>
    dbService.query(
      `SELECT w.Id, w.English, w.Vietnamese, 
        COALESCE((SELECT RecallRate FROM WordMetrics WHERE WordId=w.Id), 0.5) as PRecall,
        COALESCE((SELECT ScheduleDays FROM WordSchedule WHERE WordId=w.Id), 1) as ScheduleDays,
        COALESCE((SELECT ScheduleUrgency FROM WordSchedule WHERE WordId=w.Id), 'low') as Urgency,
        COALESCE((SELECT MAX(Timestamp) FROM StudySessionsLSTM WHERE WordId=w.Id), w.CreatedAt) as LastReview
       FROM Words w WHERE w.GroupId=? ORDER BY ScheduleDays ASC, LastReview ASC`,
      [{ value: groupId }]
    ),

  saveWordSchedule: (wordId: number, scheduleDays: number, urgency: string, pForget: number) =>
    dbService.query(
      `INSERT INTO WordSchedule (WordId, ScheduleDays, ScheduleUrgency, PForget, UpdatedAt)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(WordId) DO UPDATE SET ScheduleDays=?, ScheduleUrgency=?, PForget=?, UpdatedAt=datetime('now')`,
      [
        { value: wordId }, { value: scheduleDays }, { value: urgency }, { value: pForget },
        { value: scheduleDays }, { value: urgency }, { value: pForget }
      ]
    ),
};

export const calculateNextReview = (level: number, correct: boolean): { newLevel: number; nextReview: Date } => {
  const intervals = [1, 3, 7, 14, 30, 90];
  let newLevel = correct ? Math.min(level + 1, 5) : Math.max(level - 1, 0);
  const days = intervals[newLevel] || 1;
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + days);
  return { newLevel, nextReview };
};

// ─── OFFLINE SCHEDULE COMPUTATION (SM-2 heuristic) ────────────────────────────

/**
 * Compute schedule for all words in a group using local SQLite data only.
 * No Flask/LSTM server required.
 */
export const computeOfflineSchedule = async (groupId?: number) => {
  // 1. Get all words
  const wordsRes = groupId
    ? await dbService.query(
        `SELECT w.Id, w.English, w.Vietnamese, w.Level, w.NextReview,
                w.TotalReviews, w.CorrectReviews, g.Name as GroupName, g.Color as GroupColor
         FROM Words w JOIN WordGroups g ON w.GroupId=g.Id
         WHERE w.GroupId=? ORDER BY w.English`,
        [{ value: groupId }]
      )
    : await dbService.query(
        `SELECT w.Id, w.English, w.Vietnamese, w.Level, w.NextReview,
                w.TotalReviews, w.CorrectReviews, g.Name as GroupName, g.Color as GroupColor
         FROM Words w JOIN WordGroups g ON w.GroupId=g.Id ORDER BY w.English`
      );

  if (!wordsRes.success || !wordsRes.data) return [];

  const results = [];
  for (const word of wordsRes.data) {
    // 2. Get LSTM session history
    const sessRes = await dbService.query(
      `SELECT Correct, ViewedCount, CorrectCount, Timestamp
       FROM StudySessionsLSTM WHERE WordId=? ORDER BY Timestamp DESC LIMIT 20`,
      [{ value: word.Id }]
    );

    const sessions = sessRes.data || [];
    const totalSessions = sessions.length;

    // 3. Compute p_forget using SM-2 heuristic
    let p_forget = 0.5; // default: new word
    let urgency = 'low';
    let schedule_days = 7;
    let lastReview: string | null = null;
    let daysSinceLast = 999;

    if (totalSessions > 0) {
      lastReview = sessions[0].Timestamp;
      const lastTs = new Date(lastReview!).getTime();
      daysSinceLast = (Date.now() - lastTs) / (1000 * 60 * 60 * 24);

      // Recall rate from recent 5 sessions
      const recent = sessions.slice(0, 5);
      const recallRate = recent.reduce((s: number, r: any) => s + (r.Correct ? 1 : 0), 0) / recent.length;

      // Forgetting curve: p_forget increases with time, decreases with recall
      const stability = Math.max(0.1, recallRate); // 0.1 – 1.0
      const halfLife = stability * 7; // days until 50% forgotten
      p_forget = Math.min(0.99, 1 - Math.exp(-0.693 * daysSinceLast / halfLife));

      // Consecutive wrong streak penalty
      let streak = 0;
      for (const s of sessions) {
        if (!s.Correct) streak++; else break;
      }
      if (streak >= 2) p_forget = Math.min(0.99, p_forget + 0.2);
    } else if (word.TotalReviews > 0) {
      // Fallback to SRS data
      const recallRate = word.CorrectReviews / word.TotalReviews;
      p_forget = 1 - recallRate;
      if (word.NextReview) {
        const nextTs = new Date(word.NextReview).getTime();
        if (nextTs <= Date.now()) p_forget = Math.max(p_forget, 0.5);
      }
    }

    // 4. Map p_forget → urgency + schedule
    if (p_forget > 0.70) { urgency = 'urgent'; schedule_days = 1; }
    else if (p_forget > 0.40) { urgency = 'high';   schedule_days = 3; }
    else { urgency = 'low';    schedule_days = 7; }

    // 5. Save to WordSchedule table
    await dbService.query(
      `INSERT INTO WordSchedule (WordId, ScheduleDays, ScheduleUrgency, PForget, UpdatedAt)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(WordId) DO UPDATE SET
         ScheduleDays=excluded.ScheduleDays,
         ScheduleUrgency=excluded.ScheduleUrgency,
         PForget=excluded.PForget,
         UpdatedAt=datetime('now')`,
      [
        { value: word.Id }, { value: schedule_days },
        { value: urgency }, { value: parseFloat(p_forget.toFixed(4)) },
      ]
    );

    results.push({
      id: word.Id,
      english: word.English,
      vietnamese: word.Vietnamese,
      groupName: word.GroupName,
      groupColor: word.GroupColor,
      urgency,
      schedule_days,
      p_forget: parseFloat(p_forget.toFixed(4)),
      last_review: lastReview,
      days_since_last: parseFloat(daysSinceLast.toFixed(1)),
      total_sessions: totalSessions,
      level: word.Level,
    });
  }

  // Sort: urgent first, then high, then low, then by days_since_last desc
  const order: Record<string, number> = { urgent: 0, high: 1, low: 2 };
  results.sort((a, b) => {
    const od = order[a.urgency] - order[b.urgency];
    return od !== 0 ? od : b.days_since_last - a.days_since_last;
  });

  return results;
};

/** Quick stats summary from WordSchedule table */
export const getScheduleSummary = async (groupId?: number) => {
  const query = groupId
    ? `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN ScheduleUrgency='urgent' THEN 1 ELSE 0 END) as urgent,
         SUM(CASE WHEN ScheduleUrgency='high'   THEN 1 ELSE 0 END) as high_count,
         SUM(CASE WHEN ScheduleUrgency='low'    THEN 1 ELSE 0 END) as low_count,
         AVG(PForget) as avg_p_forget
       FROM WordSchedule ws
       JOIN Words w ON ws.WordId=w.Id
       WHERE w.GroupId=?`
    : `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN ScheduleUrgency='urgent' THEN 1 ELSE 0 END) as urgent,
         SUM(CASE WHEN ScheduleUrgency='high'   THEN 1 ELSE 0 END) as high_count,
         SUM(CASE WHEN ScheduleUrgency='low'    THEN 1 ELSE 0 END) as low_count,
         AVG(PForget) as avg_p_forget
       FROM WordSchedule`;
  const res = groupId
    ? await dbService.query(query, [{ value: groupId }])
    : await dbService.query(query);
  return res.data?.[0] || { total: 0, urgent: 0, high_count: 0, low_count: 0, avg_p_forget: 0 };
};

