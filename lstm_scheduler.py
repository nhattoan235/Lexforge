#!/usr/bin/env python3
"""
LSTM Scheduler Service — Personalized study scheduling using LSTM
Flask microservice for TOEIC App
Reuses model from AppTuVung: duolingo_model_best.pt + scaler_v2.pkl
"""

import os
import sys
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    import numpy as np
    import pandas as pd
    import torch
    import joblib
except ImportError as e:
    print(f"⚠️ Missing dependency: {e}")
    print("Run: pip install flask flask-cors torch numpy pandas scikit-learn joblib")
    sys.exit(1)

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ══════════════════════════════════════════════════════════════════════════════

SEQ_LEN = 7  # Look at last 7 sessions
THRESHOLD = 0.45
FEATURE_COLS = [
    'p_recall', 'delta_hours', 'history_seen', 'history_correct',
    'session_seen', 'session_correct', 'correct_ratio', 'session_ratio',
    'is_new_word', 'lag_p_recall', 'streak_forget', 'days_since_last'
]

# Paths — resolve DB from multiple locations
SCRIPT_DIR = Path(__file__).parent.absolute()
MODEL_PATH = SCRIPT_DIR / 'duolingo_model_best.pt'
SCALER_PATH = SCRIPT_DIR / 'scaler_v2.pkl'

def _find_db() -> Path:
    """Find Electron app's SQLite database."""
    # 1. Explicit env variable
    env_path = os.environ.get('TOEIC_DB_PATH')
    if env_path and Path(env_path).exists():
        return Path(env_path)

    # 2. Common Electron userData locations
    candidates = []
    if sys.platform == 'win32':
        appdata = os.environ.get('APPDATA', '')
        if appdata:
            candidates += [
                Path(appdata) / 'toeic-vocab-master' / 'vocabapp.db',
                Path(appdata) / 'toeic-vocab-master' / 'database.db',
                Path(appdata) / 'TOEIC Vocab Master' / 'vocabapp.db',
            ]
    elif sys.platform == 'darwin':
        home = Path.home()
        candidates += [
            home / 'Library' / 'Application Support' / 'toeic-vocab-master' / 'vocabapp.db',
        ]
    else:
        home = Path.home()
        candidates += [
            home / '.config' / 'toeic-vocab-master' / 'vocabapp.db',
        ]

    # 3. Check script dir fallback
    candidates += [
        SCRIPT_DIR / 'vocabapp.db',
        SCRIPT_DIR / 'database.db',
    ]

    for p in candidates:
        if p.exists():
            print(f"   Database: {p}")
            return p

    # 4. First .db file in AppData subdirs (Windows)
    if sys.platform == 'win32':
        appdata = os.environ.get('APPDATA', '')
        if appdata:
            for db_file in Path(appdata).glob('*/vocabapp.db'):
                print(f"   Database (auto): {db_file}")
                return db_file

    # Fallback — will fail at runtime if not found
    fallback = SCRIPT_DIR / 'vocabapp.db'
    print(f"⚠️  DB not found — defaulting to {fallback}")
    return fallback

DB_PATH = _find_db()


# ══════════════════════════════════════════════════════════════════════════════
# LSTM PREDICTOR
# ══════════════════════════════════════════════════════════════════════════════

class LSTMScheduler:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.ready = False
        self._load_model()

    def _load_model(self):
        """Load PyTorch LSTM model and scaler"""
        if not MODEL_PATH.exists() or not SCALER_PATH.exists():
            print("⚠️  LSTM model/scaler not found → Using SM-2 fallback only")
            return
        
        try:
            self.model = torch.load(str(MODEL_PATH), map_location='cpu', weights_only=False)
            self.model.eval()
            self.scaler = joblib.load(str(SCALER_PATH))
            self.ready = True
            print("✅ LSTM model loaded")
        except Exception as e:
            print(f"❌ Failed to load LSTM: {e}")

    def predict(self, sessions: list) -> dict:
        """
        Predict probability of forgetting a word
        Input: list of study session dicts from DB
        Output: {'p_forget': float, 'schedule_days': int, 'urgency': str}
        """
        if not sessions or len(sessions) < SEQ_LEN:
            return self._sm2_fallback(sessions)
        
        try:
            if self.ready:
                return self._lstm_predict(sessions)
            else:
                return self._sm2_fallback(sessions)
        except Exception as e:
            print(f"Prediction error: {e}")
            return self._sm2_fallback(sessions)

    def _lstm_predict(self, sessions):
        """Run LSTM model prediction"""
        feats = self._build_features(sessions)
        seq = feats[-SEQ_LEN:]
        scaled = self.scaler.transform(seq)
        X = torch.tensor(scaled.reshape(1, SEQ_LEN, len(FEATURE_COLS)), dtype=torch.float32)
        
        with torch.no_grad():
            out = self.model(X)
        
        if isinstance(out, (tuple, list)):
            out = out[0]
        
        p = float(out.squeeze()[-1] if out.dim() > 1 else out.squeeze())
        
        # Clamp to [0, 1]
        if not (0.0 <= p <= 1.0):
            p = torch.sigmoid(torch.tensor(p)).item()
        
        return self._schedule(p)

    def _build_features(self, sessions):
        """Feature engineering from study sessions"""
        df = pd.DataFrame(sessions)
        eps = 1e-8
        
        # Time delta in hours
        df['delta_hours'] = (df['delta'] / 3600).clip(0, 8760)
        
        # Ratios
        df['correct_ratio'] = (df['history_correct'] / (df['history_seen'] + eps)).clip(0, 1)
        df['session_ratio'] = (df['session_correct'] / (df['session_seen'] + eps)).clip(0, 1)
        
        # New word flag
        df['is_new_word'] = (df['history_seen'] == 0).astype(float)
        
        # Lag features
        df['lag_p_recall'] = df['p_recall'].shift(1).fillna(1.0)
        df['days_since_last'] = (df['delta_hours'] / 24).clip(0, 365)
        
        # Streak calculation
        labels = (df['p_recall'] == 0.0).astype(int).values
        streaks = np.zeros(len(labels), dtype='float32')
        streak = 0
        for i in range(1, len(labels)):
            streak = 0 if labels[i] else streak + 1
            streaks[i] = streak
        df['streak_forget'] = streaks
        
        return df[FEATURE_COLS].values

    def _sm2_fallback(self, sessions):
        """SM-2 algorithm fallback when data insufficient"""
        if not sessions:
            return self._schedule(0.5)
        
        last = sessions[-1]
        p = float(last.get('p_recall', 0.5))
        return self._schedule(1.0 - p)

    def _schedule(self, p_forget):
        """Convert p_forget to schedule days and urgency"""
        if p_forget > 0.7:
            days, urgency = 1, 'urgent'
        elif p_forget > 0.4:
            days, urgency = 3, 'high'
        else:
            days, urgency = 7, 'low'
        
        return {
            'p_forget': round(p_forget, 4),
            'schedule_days': days,
            'urgency': urgency,
        }

scheduler = LSTMScheduler()

# ══════════════════════════════════════════════════════════════════════════════
# FLASK APP
# ══════════════════════════════════════════════════════════════════════════════

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'ok',
        'service': 'LSTM Scheduler',
        'model_ready': scheduler.ready
    })

@app.route('/predict-word', methods=['POST'])
def predict_word():
    """Predict schedule for a single word"""
    try:
        data = request.json
        word_id = data.get('word_id')
        
        if not word_id:
            return jsonify({'error': 'Missing word_id'}), 400
        
        prediction = predict_word_schedule(word_id)
        return jsonify({
            'success': True,
            'word_id': word_id,
            'prediction': prediction
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/predict-group', methods=['POST'])
def predict_group():
    """Predict schedules for all words in a group"""
    try:
        data = request.json
        group_id = data.get('group_id')
        
        if not group_id:
            return jsonify({'error': 'Missing group_id'}), 400
        
        result = predict_group_schedule(group_id)
        return jsonify({
            'success': True,
            'group_id': group_id,
            'result': result
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/daily-schedule', methods=['GET'])
def daily_schedule():
    """Get daily review schedule"""
    try:
        group_id = request.args.get('group_id', type=int)
        schedule = get_daily_schedule(group_id)
        return jsonify({
            'success': True,
            'schedule': schedule
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ══════════════════════════════════════════════════════════════════════════════

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def get_word_sessions(word_id: int, limit: int = 20) -> list:
    """Get recent study sessions for a word"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM StudySessionsLSTM 
            WHERE WordId=? 
            ORDER BY Timestamp DESC 
            LIMIT ?
        """, (word_id, limit))
        
        sessions = []
        for row in cursor.fetchall():
            sessions.append({
                'word_id': row['WordId'],
                'correct': row['Correct'],
                'viewed_count': row['ViewedCount'],
                'correct_count': row['CorrectCount'],
                'timestamp': row['Timestamp'],
                # Computed fields
                'p_recall': row['CorrectCount'] / max(row['ViewedCount'], 1),
                'delta': (datetime.now() - datetime.fromisoformat(row['Timestamp'])).total_seconds(),
                'history_seen': row['ViewedCount'],
                'history_correct': row['CorrectCount'],
                'session_seen': 1,
                'session_correct': row['Correct'],
            })
        
        return list(reversed(sessions))  # Reverse to chronological order
    finally:
        conn.close()

def save_schedule(word_id: int, schedule_days: int, urgency: str, p_forget: float):
    """Save calculated schedule to database"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO WordSchedule (WordId, ScheduleDays, ScheduleUrgency, PForget, UpdatedAt)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(WordId) DO UPDATE SET 
                ScheduleDays=excluded.ScheduleDays,
                ScheduleUrgency=excluded.ScheduleUrgency,
                PForget=excluded.PForget,
                UpdatedAt=datetime('now')
        """, (word_id, schedule_days, urgency, p_forget))
        conn.commit()
    finally:
        conn.close()

# ══════════════════════════════════════════════════════════════════════════════
# API FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def predict_word_schedule(word_id: int) -> dict:
    """Get LSTM-predicted schedule for a word"""
    sessions = get_word_sessions(word_id)
    prediction = scheduler.predict(sessions)
    save_schedule(word_id, prediction['schedule_days'], prediction['urgency'], prediction['p_forget'])
    return prediction

def predict_group_schedule(group_id: int) -> dict:
    """Get LSTM-predicted schedule for all words in a group"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT Id FROM Words WHERE GroupId=?", (group_id,))
        word_ids = [row['Id'] for row in cursor.fetchall()]
        
        schedule = {}
        for word_id in word_ids:
            schedule[word_id] = predict_word_schedule(word_id)
        
        return {
            'group_id': group_id,
            'word_count': len(word_ids),
            'schedule': schedule,
        }
    finally:
        conn.close()

def get_daily_schedule(group_id: int = None) -> dict:
    """Get words to review today"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        if group_id:
            query = """
                SELECT w.Id, w.English, w.Vietnamese, 
                       COALESCE(s.ScheduleDays, 1) as days_due,
                       COALESCE(s.ScheduleUrgency, 'low') as urgency,
                       MAX(sl.Timestamp) as last_review
                FROM Words w
                LEFT JOIN WordSchedule s ON w.Id = s.WordId
                LEFT JOIN StudySessionsLSTM sl ON w.Id = sl.WordId
                WHERE w.GroupId=?
                GROUP BY w.Id
                ORDER BY urgency DESC, days_due ASC
            """
            cursor.execute(query, (group_id,))
        else:
            query = """
                SELECT w.Id, w.English, w.Vietnamese,
                       COALESCE(s.ScheduleDays, 1) as days_due,
                       COALESCE(s.ScheduleUrgency, 'low') as urgency,
                       MAX(sl.Timestamp) as last_review
                FROM Words w
                LEFT JOIN WordSchedule s ON w.Id = s.WordId
                LEFT JOIN StudySessionsLSTM sl ON w.Id = sl.WordId
                GROUP BY w.Id
                ORDER BY urgency DESC, days_due ASC
            """
            cursor.execute(query)
        
        words = []
        for row in cursor.fetchall():
            words.append({
                'id': row['Id'],
                'english': row['English'],
                'vietnamese': row['Vietnamese'],
                'days_due': row['days_due'],
                'urgency': row['urgency'],
                'last_review': row['last_review'],
            })
        
        return {
            'words_to_review': words,
            'total_words': len(words),
            'urgent_count': sum(1 for w in words if w['urgency'] == 'urgent'),
            'high_count': sum(1 for w in words if w['urgency'] == 'high'),
        }
    finally:
        conn.close()

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("🧠 LSTM Scheduler Service")
    print("=" * 60)
    
    if scheduler.ready:
        print("✅ LSTM model loaded")
    else:
        print("⚠️  LSTM model not found - using SM-2 fallback")
    
    print(f"   Database: {DB_PATH}")
    print(f"   Starting on http://localhost:5001")
    print("=" * 60)
    print()
    
    app.run(host='127.0.0.1', port=5001, debug=False)
