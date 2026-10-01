import React, { useState, useEffect, useMemo } from 'react';
import { db, calculateNextReview } from '../services/database';
import { lstmService } from '../services/lstmScheduler';
import { speechService } from '../services/speech';
import { Word, WordGroup } from '../types';

type StudyMode = 'all' | 'due';
type QuizDirection = 'en-vi' | 'vi-en';
type PageState = 'select' | 'quiz' | 'result';

type QuizQuestion = {
  word: Word;
  questionText: string;
  choices: string[];
  correctIndex: number;
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildQuizQuestions(words: Word[], direction: QuizDirection): QuizQuestion[] {
  const pool = direction === 'en-vi'
    ? words.map(w => w.Vietnamese)
    : words.map(w => w.English);

  return words.map((word) => {
    const correctAnswer = direction === 'en-vi' ? word.Vietnamese : word.English;
    const wrongChoices = shuffle(pool.filter(item => item !== correctAnswer)).slice(0, 3);
    const choices = shuffle([correctAnswer, ...wrongChoices]);
    const correctIndex = choices.findIndex(item => item === correctAnswer);
    const questionText = direction === 'en-vi' ? word.English : word.Vietnamese;
    return { word, questionText, choices, correctIndex };
  });
}

export default function QuizPage() {
  const [pageState, setPageState] = useState<PageState>('select');
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [studyMode, setStudyMode] = useState<StudyMode>('all');
  const [direction, setDirection] = useState<QuizDirection>('en-vi');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [results, setResults] = useState<{ word: Word; correct: boolean }[]>([]);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.getGroups().then(res => { if (res.success) setGroups(res.data || []); });
  }, []);

  const toggleGroup = (id: number) => {
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const startQuiz = async () => {
    setLoading(true);
    try {
      const res = studyMode === 'due'
        ? await db.getDueWords(50)
        : selectedGroups.length > 0
          ? await db.getWordsByGroups(selectedGroups)
          : await db.getWords();

      if (!res.success || !res.data?.length) {
        alert('Không có từ nào để làm quiz!');
        return;
      }

      const shuffledWords = shuffle(res.data);
      const built = buildQuizQuestions(shuffledWords, direction);
      setQuestions(built);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setResults([]);
      setScore(0);
      setStartTime(Date.now());
      setPageState('quiz');
      speechService.speak(built[0].word.English);
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const answered = selectedAnswer !== null;

  const handleAnswer = async (index: number) => {
    if (!currentQuestion || selectedAnswer !== null) return;
    setSelectedAnswer(index);

    const correct = index === currentQuestion.correctIndex;
    const word = currentQuestion.word;
    const { newLevel, nextReview } = calculateNextReview(word.Level, correct);
    await db.updateWordSRS(word.Id, newLevel, nextReview, correct);

    const viewedCount = (word.TotalReviews || 0) + 1;
    const correctCount = (word.CorrectReviews || 0) + (correct ? 1 : 0);
    await lstmService.logStudyResult(word.Id, word.GroupId, correct, viewedCount, correctCount, 'quiz');

    if (correct) {
      setScore(s => s + 10);
      speechService.speak('Correct');
    } else {
      speechService.speak('Wrong');
    }

    setResults(prev => [...prev, { word, correct }]);

    setTimeout(() => {
      if (currentIndex + 1 >= questions.length) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        db.saveSession({
          mode: 'quiz',
          score: score + (correct ? 10 : 0),
          totalWords: questions.length,
          correctWords: results.filter(r => r.correct).length + (correct ? 1 : 0),
          duration,
          groupIds: selectedGroups.join(','),
        });
        setPageState('result');
      } else {
        setCurrentIndex(i => i + 1);
        setSelectedAnswer(null);
        speechService.speak(questions[currentIndex + 1].word.English);
      }
    }, 700);
  };

  const correctCount = results.filter(r => r.correct).length;
  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const summary = useMemo(() => ({
    total: questions.length,
    correct: correctCount,
    wrong: results.length - correctCount,
    accuracy,
  }), [questions.length, correctCount, results.length, accuracy]);

  if (pageState === 'result') {
    return (
      <div className="quiz-result">
        <div className="result-card">
          <div className="result-emoji">{accuracy >= 80 ? '🏆' : accuracy >= 60 ? '👍' : '💪'}</div>
          <h2>Kết quả Quiz</h2>
          <div className="result-grid">
            <div><strong>{summary.total}</strong><div>Tổng câu</div></div>
            <div><strong>{summary.correct}</strong><div>Đúng</div></div>
            <div><strong>{summary.wrong}</strong><div>Sai</div></div>
            <div><strong>{summary.accuracy}%</strong><div>Chính xác</div></div>
          </div>
          <div className="result-actions">
            <button className="btn btn-secondary" onClick={() => setPageState('select')}>← Quay lại</button>
            <button className="btn btn-primary" onClick={startQuiz}>Làm lại Quiz</button>
          </div>
        </div>
        <style>{`
          .quiz-result { display: flex; align-items: center; justify-content: center; min-height: 80vh; padding: 32px; }
          .result-card { width: min(560px, 100%); background: var(--bg-card); border: 1px solid var(--border); border-radius: 24px; padding: 36px; text-align: center; }
          .result-emoji { font-size: 64px; margin-bottom: 18px; }
          .result-card h2 { margin-bottom: 18px; }
          .result-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; margin-bottom: 24px; }
          .result-grid div { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
          .result-grid strong { display: block; font-size: 28px; margin-bottom: 6px; }
          .result-actions { display: flex; justify-content: center; gap: 12px; }
        `}</style>
      </div>
    );
  }

  if (pageState === 'quiz' && currentQuestion) {
    return (
      <div className="quiz-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Quiz ABCD 📝</h1>
            <p className="page-subtitle">Ôn từ bằng trắc nghiệm chọn đáp án.</p>
          </div>
          <div className="quiz-progress">Câu {currentIndex + 1} / {questions.length}</div>
        </div>

        <div className="quiz-card">
          <div className="quiz-question-label">{direction === 'en-vi' ? 'Chọn nghĩa đúng cho' : 'Chọn từ đúng cho'}:</div>
          <div className="quiz-question">{currentQuestion.questionText}</div>

          <div className="quiz-choices">
            {currentQuestion.choices.map((choice, index) => {
              const isCorrect = answered && index === currentQuestion.correctIndex;
              const isWrong = answered && index === selectedAnswer && index !== currentQuestion.correctIndex;
              return (
                <button
                  key={choice}
                  className={`choice-btn ${answered ? (isCorrect ? 'correct' : isWrong ? 'wrong' : 'disabled') : ''}`}
                  onClick={() => handleAnswer(index)}
                  disabled={answered}
                >
                  <span className="choice-index">{['A', 'B', 'C', 'D'][index]}</span>
                  <span>{choice}</span>
                </button>
              );
            })}
          </div>

          <div className="quiz-summary">
            <span>Điểm: {score}</span>
            <span>Đúng: {correctCount}</span>
            <span>Chính xác: {accuracy}%</span>
          </div>
        </div>

        <style>{`
          .quiz-page { padding-bottom: 40px; }
          .quiz-progress { font-size: 14px; color: var(--text-muted); margin-top: 4px; }
          .quiz-card { margin-top: 24px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 24px; padding: 28px; max-width: 820px; }
          .quiz-question-label { font-size: 13px; color: var(--text-muted); margin-bottom: 12px; }
          .quiz-question { font-size: 24px; font-weight: 700; margin-bottom: 24px; }
          .quiz-choices { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
          .choice-btn { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 18px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-size: 15px; text-align: left; cursor: pointer; transition: all 0.2s; }
          .choice-btn:hover { border-color: var(--accent); }
          .choice-btn.correct { border-color: #10b981; background: rgba(16,185,129,0.12); }
          .choice-btn.wrong { border-color: #ef4444; background: rgba(239,68,68,0.12); }
          .choice-btn.disabled { opacity: 0.6; cursor: default; }
          .choice-index { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; background: rgba(99,102,241,0.1); font-weight: 700; }
          .quiz-summary { margin-top: 24px; display: flex; gap: 16px; font-size: 13px; color: var(--text-secondary); }
        `}</style>
      </div>
    );
  }

  return (
    <div className="quiz-select">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quiz ABCD 📝</h1>
          <p className="page-subtitle">Chọn nhóm từ và bắt đầu ôn trắc nghiệm.</p>
        </div>
      </div>

      <div className="quiz-config">
        <div className="config-card">
          <h3>⚙️ Cấu hình Quiz</h3>

          <div className="config-row">
            <label>Chế độ học</label>
            <div className="mode-btns">
              <button className={`mode-btn ${studyMode === 'all' ? 'active' : ''}`} onClick={() => setStudyMode('all')}>Tất cả từ</button>
              <button className={`mode-btn ${studyMode === 'due' ? 'active' : ''}`} onClick={() => setStudyMode('due')}>Từ cần ôn</button>
            </div>
          </div>

          <div className="config-row">
            <label>Hướng quiz</label>
            <div className="mode-btns">
              <button className={`mode-btn ${direction === 'en-vi' ? 'active' : ''}`} onClick={() => setDirection('en-vi')}>Anh → Việt</button>
              <button className={`mode-btn ${direction === 'vi-en' ? 'active' : ''}`} onClick={() => setDirection('vi-en')}>Việt → Anh</button>
            </div>
          </div>

          {studyMode === 'all' && (
            <div className="config-row">
              <label>Chọn nhóm từ <span className="hint">(để trống = tất cả)</span></label>
              <div className="group-select-grid">
                {groups.map(group => (
                  <button
                    key={group.Id}
                    className={`group-select-btn ${selectedGroups.includes(group.Id) ? 'active' : ''}`}
                    style={{ '--group-color': group.Color } as any}
                    onClick={() => toggleGroup(group.Id)}
                  >
                    <span>{group.Icon}</span>
                    <span>{group.Name}</span>
                    <span className="group-count">{group.WordCount} từ</span>
                    {selectedGroups.includes(group.Id) && <span className="check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-lg w-full" onClick={startQuiz} disabled={loading}>
            {loading ? 'Đang chuẩn bị...' : '▶ Bắt đầu Quiz'}
          </button>
        </div>
      </div>

      <style>{`
        .quiz-page, .quiz-select { padding-bottom: 40px; }
        .quiz-config { padding: 24px 32px; display: grid; grid-template-columns: 1fr; gap: 20px; }
        .config-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: 18px; }
        .config-card h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .config-row { display: flex; flex-direction: column; gap: 10px; }
        .mode-btns { display: flex; gap: 10px; }
        .mode-btn { flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; transition: all 0.2s; }
        .mode-btn.active { border-color: var(--accent); background: rgba(99,102,241,0.1); color: var(--accent-bright); }
        .group-select-grid { display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; }
        .group-select-btn { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); text-align: left; cursor: pointer; }
        .group-select-btn.active { border-color: var(--group-color); background: color-mix(in srgb, var(--group-color) 10%, transparent); }
        .group-count { margin-left: auto; font-size: 12px; color: var(--text-muted); }
        .check { color: var(--green); font-weight: 700; }
        .hint { color: var(--text-muted); font-size: 12px; }
      `}</style>
    </div>
  );
}
