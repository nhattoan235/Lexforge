/**
 * LSTM Scheduler Service
 * Strategy: Try Flask LSTM microservice first → fallback to local SM-2 (offline)
 * The app always works offline; LSTM is a bonus enhancement.
 */

import { computeOfflineSchedule, getScheduleSummary, db } from './database';

export interface SchedulePrediction {
  p_forget: number;
  schedule_days: number;
  urgency: 'urgent' | 'high' | 'low';
  use_lstm?: boolean;
}

export interface ScheduledWord {
  id: number;
  english: string;
  vietnamese: string;
  groupName?: string;
  groupColor?: string;
  urgency: string;
  schedule_days: number;
  p_forget: number;
  last_review: string | null;
  days_since_last: number;
  total_sessions: number;
  level: number;
}

export interface DailySchedule {
  words_to_review: ScheduledWord[];
  total_words: number;
  urgent_count: number;
  high_count: number;
  low_count: number;
  source: 'lstm' | 'sm2';
}

const LSTM_API = 'http://127.0.0.1:5001';
let _lstmAvailable: boolean | null = null;
let _lastCheck = 0;

/**
 * Check LSTM service (cached for 30s)
 */
export const lstmService = {
  isAvailable: async (): Promise<boolean> => {
    const now = Date.now();
    if (_lstmAvailable !== null && now - _lastCheck < 30_000) return _lstmAvailable;
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(`${LSTM_API}/health`, { signal: ctrl.signal });
      const data = await res.json();
      _lstmAvailable = res.ok && data.status === 'ok';
    } catch {
      _lstmAvailable = false;
    }
    _lastCheck = now;
    return _lstmAvailable!;
  },

  /**
   * Get full daily schedule — tries LSTM, falls back to offline SM-2
   */
  getDailySchedule: async (groupId?: number): Promise<DailySchedule> => {
    const available = await lstmService.isAvailable();

    if (available) {
      try {
        const url = new URL(`${LSTM_API}/daily-schedule`);
        if (groupId) url.searchParams.append('group_id', groupId.toString());
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url.toString(), { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const s = data.schedule;
        return {
          words_to_review: s.words_to_review,
          total_words: s.total_words,
          urgent_count: s.urgent_count,
          high_count: s.high_count,
          low_count: s.total_words - s.urgent_count - s.high_count,
          source: 'lstm',
        };
      } catch (err) {
        console.warn('LSTM fallback to SM-2:', err);
        _lstmAvailable = false;
      }
    }

    // Offline SM-2 fallback
    return lstmService.getOfflineSchedule(groupId);
  },

  /**
   * Pure offline schedule using local SM-2 computation
   */
  getOfflineSchedule: async (groupId?: number): Promise<DailySchedule> => {
    const words = await computeOfflineSchedule(groupId);
    const urgent = words.filter(w => w.urgency === 'urgent').length;
    const high = words.filter(w => w.urgency === 'high').length;
    return {
      words_to_review: words,
      total_words: words.length,
      urgent_count: urgent,
      high_count: high,
      low_count: words.length - urgent - high,
      source: 'sm2',
    };
  },

  /**
   * Predict schedule for a single word via LSTM (falls back to sm2)
   */
  predictWordSchedule: async (wordId: number): Promise<SchedulePrediction> => {
    const available = await lstmService.isAvailable();
    if (available) {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(`${LSTM_API}/predict-word`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word_id: wordId }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return { ...data.prediction, use_lstm: true };
      } catch { /* fall through */ }
    }
    return { p_forget: 0.5, schedule_days: 3, urgency: 'high', use_lstm: false };
  },

  /**
   * Log a study result to StudySessionsLSTM and optionally trigger a LSTM predict.
   * Pass cumulative viewedCount/correctCount from the word's stats.
   */
  logStudyResult: async (
    wordId: number,
    groupId: number,
    correct: boolean,
    viewedCount: number,
    correctCount: number,
  ): Promise<void> => {
    try {
      await db.logStudySession(wordId, groupId, correct, viewedCount, correctCount);
    } catch (e) {
      console.error('logStudyResult error:', e);
    }
  },
};
