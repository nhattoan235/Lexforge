import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListeningQuestion, mp4ListeningService } from '../services/mp4ListeningService';
import './ListeningApproved.css';

type LessonState = 'setup' | 'generating' | 'study' | 'result';
type LessonPhase = 'english' | 'meaning';

interface AnswerRecord {
  questionId: string;
  phase: LessonPhase;
  selected: string;
  correct: boolean;
}

const formatTime = (value: number) => {
  const total = Math.max(0, Math.floor(value));
  const min = Math.floor(total / 60).toString().padStart(2, '0');
  const sec = (total % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
};

const getErrorMessage = (err: any) => {
  const msg = err?.message || String(err || '');
  if (msg === 'NO_KEY') return 'Bạn chưa cấu hình Groq API key. Vào Cài Đặt để nhập key trước.';
  if (msg.includes('TRANSCRIBE_413')) return 'File quá lớn để gửi trực tiếp lên Groq. Hãy thử file MP4 ngắn/nhẹ hơn.';
  if (msg.includes('TRANSCRIBE_401') || msg.includes('QUESTION_401')) return 'Groq API key không hợp lệ hoặc đã hết hạn.';
  if (msg.includes('TRANSCRIBE_429') || msg.includes('QUESTION_429')) return 'Groq đang giới hạn tốc độ. Chờ một chút rồi thử lại.';
  if (msg === 'NO_TRANSCRIPT') return 'Chưa tách được nội dung nghe chính từ file này. Hãy thử lại hoặc kiểm tra file có lời thoại tiếng Anh rõ không.';
  return `Không tạo được bài học: ${msg}`;
};

export default function MP4ListeningPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lessonState, setLessonState] = useState<LessonState>('setup');
  const [phase, setPhase] = useState<LessonPhase>('english');
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [questions, setQuestions] = useState<ListeningQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [showScript, setShowScript] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [activeEnd, setActiveEnd] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const question = questions[currentIndex];
  const correctAnswer = question
    ? phase === 'english' ? question.script : question.vietnameseCorrect
    : '';
  const options = question
    ? phase === 'english' ? question.englishOptions : question.vietnameseOptions
    : [];

  const englishStats = useMemo(() => {
    const records = answers.filter(a => a.phase === 'english');
    return { total: records.length, correct: records.filter(a => a.correct).length };
  }, [answers]);

  const meaningStats = useMemo(() => {
    const records = answers.filter(a => a.phase === 'meaning');
    return { total: records.length, correct: records.filter(a => a.correct).length };
  }, [answers]);

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setFile(nextFile);
    setObjectUrl(URL.createObjectURL(nextFile));
    setQuestions([]);
    setCurrentIndex(0);
    setPhase('english');
    setAnswers([]);
    setSelected('');
    setShowScript(false);
    setError('');
    setLessonState('setup');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleCreateLesson = async () => {
    if (!file) return;
    setLessonState('generating');
    setError('');
    setSelected('');
    setShowScript(false);
    try {
      const lesson = await mp4ListeningService.createLesson(file);
      setQuestions(lesson);
      setCurrentIndex(0);
      setPhase('english');
      setAnswers([]);
      setLessonState('study');
    } catch (err: any) {
      setError(getErrorMessage(err));
      setLessonState('setup');
    }
  };

  const playCurrentSegment = useCallback(() => {
    if (!question || !audioRef.current) return;
    const audio = audioRef.current;
    audio.pause();
    audio.currentTime = question.start;
    setActiveEnd(question.end);
    audio.play().catch(() => undefined);
  }, [question]);

  useEffect(() => {
    if (lessonState !== 'study' || !question) return;
    const timer = window.setTimeout(() => playCurrentSegment(), 150);
    return () => window.clearTimeout(timer);
  }, [lessonState, phase, currentIndex, question, playCurrentSegment]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || activeEnd === null) return;
    if (audio.currentTime >= activeEnd) {
      audio.pause();
      setActiveEnd(null);
    }
  };

  const chooseAnswer = (option: string) => {
    if (selected || !question) return;
    const correct = option === correctAnswer;
    setSelected(option);
    setAnswers(prev => [
      ...prev,
      { questionId: question.id, phase, selected: option, correct },
    ]);
  };

  const goNext = () => {
    setSelected('');
    setShowScript(false);
    setActiveEnd(null);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(i => i + 1);
      return;
    }

    if (phase === 'english') {
      setPhase('meaning');
      setCurrentIndex(0);
      return;
    }

    setLessonState('result');
  };

  const resetLesson = () => {
    setLessonState('setup');
    setQuestions([]);
    setCurrentIndex(0);
    setPhase('english');
    setAnswers([]);
    setSelected('');
    setShowScript(false);
    setActiveEnd(null);
  };

  const restartGeneratedLesson = () => {
    setLessonState('study');
    setCurrentIndex(0);
    setPhase('english');
    setAnswers([]);
    setSelected('');
    setShowScript(false);
  };

  const progress = questions.length
    ? phase === 'english'
      ? ((currentIndex + 1) / (questions.length * 2)) * 100
      : ((questions.length + currentIndex + 1) / (questions.length * 2)) * 100
    : 0;

  const fileSizeMb = file ? file.size / 1024 / 1024 : 0;
  const totalCorrect = englishStats.correct + meaningStats.correct;
  const totalAnswers = englishStats.total + meaningStats.total;
  const totalAccuracy = totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

  return (
    <div className={`mp4-page lf-training-page lf-listening-page lf-listening-${lessonState}`}>
      <div className="page-header lf-training-hero">
        <div>
          <span className="lf-training-eyebrow">NGHE · HIỂU · GHI NHỚ</span><h1 className="page-title">Học nghe <em>theo nhịp của bạn.</em></h1>
          <p className="page-subtitle">Biến file MP3 thành bài luyện nghe và kiểm tra mức độ hiểu bằng AI.</p>
          <div className="lf-training-tags"><span>Chọn file MP3</span><span>Nghe từng đoạn</span><span>Hiểu nghĩa</span></div>
        </div>
        <div className="lf-listening-hero-art">
          <div className="lf-listening-disc"><span>♫</span></div>
          <div className="lf-listening-wave" aria-hidden="true">{[16,30,45,24,53,35,18,41,28,48,22,34,17].map((height, index) => <i key={index} style={{ height }} />)}</div>
          <div className="lf-listening-file-action"><small>PHÒNG NGHE CỦA BẠN</small><strong>Một file, nhiều điều để khám phá.</strong><button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>Chọn file MP3 <span aria-hidden="true">↗</span></button></div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="audio/mpeg,.mp3" style={{ display: 'none' }} onChange={handleFileChange} />

      <div className="mp4-content">
        <div className="mp4-player-panel">
          {objectUrl ? (
            <div className="mp4-audio-wrap">
              <div className="mp4-audio-icon">MP3</div>
              <audio ref={audioRef} src={objectUrl} onTimeUpdate={handleTimeUpdate} className="mp4-audio" controls />
            </div>
          ) : (
          <div className="mp4-drop" onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); e.stopPropagation(); const dropped = e.dataTransfer.files?.[0]; if (dropped?.type === 'audio/mpeg' || dropped?.name.toLowerCase().endsWith('.mp3')) selectFile(dropped); else setError('Hãy chọn file MP3 để tạo bài nghe.'); }}>
              <div className="mp4-drop-icon">♫</div>
              <div className="mp4-drop-title">Kéo thả file MP3 vào đây</div>
              <div className="mp4-drop-sub">Hoặc chọn file từ máy tính</div>
              <button type="button" className="btn btn-secondary" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>Chọn file MP3</button>
            </div>
          )}

          {file && (
            <div className="file-info">
              <div>
                <div className="file-name">{file.name}</div>
                <div className="file-meta">{fileSizeMb.toFixed(1)} MB</div>
              </div>
              {fileSizeMb > 90 && (
                <span className="file-warning">File lớn, có thể vượt giới hạn Groq</span>
              )}
            </div>
          )}
        </div>

        {lessonState === 'setup' && (
          <div className="mp4-card setup-card">
            <h2>Tạo bài luyện nghe</h2>
            <p>AI tách lời thoại, chia đoạn và tạo câu hỏi.</p>
            {error && <div className="mp4-error">{error}</div>}
            <button className="btn btn-primary btn-lg" onClick={handleCreateLesson} disabled={!file}>
              Tạo bài học →
            </button>
          </div>
        )}
        {lessonState === 'setup' && <aside className="lf-listening-guide"><h2>Bài học gồm 2 lượt</h2><p>Mỗi đoạn âm thanh được nghe lại ở cả hai lượt.</p><div className="lf-listening-step"><i>1</i><div><strong>Nghe và chọn câu tiếng Anh</strong><span>Nhận ra chính xác điều bạn vừa nghe.</span></div></div><b className="lf-listening-arrow">↓</b><div className="lf-listening-step"><i>2</i><div><strong>Nghe lại và chọn nghĩa</strong><span>Ghép lời thoại với ý nghĩa tiếng Việt.</span></div></div><div className="lf-listening-note">Bạn có thể nghe lại đoạn âm thanh và mở lời thoại khi cần.</div></aside>}

        {lessonState === 'generating' && (
          <div className="mp4-card generating-card">
            <div className="mp4-spinner" />
            <h2>Đang tạo bài học...</h2>
            <p>Groq đang nghe file MP3, viết script và sinh đáp án trắc nghiệm. File càng dài thì bước này càng lâu.</p>
          </div>
        )}

        {lessonState === 'study' && question && (
          <div className="mp4-card study-card">
            <div className="study-top">
              <div>
                <div className="phase-badge">{phase === 'english' ? 'Phần 1: Nghe script' : 'Phần 2: Chọn nghĩa'}</div>
                <h2>Câu {currentIndex + 1}/{questions.length}</h2>
              </div>
              <div className="time-pill">{formatTime(question.start)} - {formatTime(question.end)}</div>
            </div>

            <div className="lesson-progress">
              <div className="lesson-progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="prompt-box">
              <div className="prompt-label">
                {phase === 'english'
                  ? 'Nghe đoạn vừa phát và chọn đúng câu tiếng Anh.'
                  : 'Nghe lại đoạn đó và chọn nghĩa tiếng Việt đúng.'}
              </div>
              <div className="prompt-actions">
                <button className="btn btn-secondary btn-sm" onClick={playCurrentSegment}>Nghe lại</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowScript(s => !s)}>
                  {showScript ? 'Ẩn script' : 'Hiện script'}
                </button>
              </div>
            </div>

            {showScript && (
              <div className="script-box">
                <div className="script-label">Script</div>
                <div>{question.script}</div>
              </div>
            )}

            <div className="option-list">
              {options.map((option, idx) => {
                const isSelected = selected === option;
                const isCorrect = option === correctAnswer;
                const revealClass = selected
                  ? isCorrect ? 'correct' : isSelected ? 'wrong' : ''
                  : '';
                return (
                  <button
                    key={`${option}-${idx}`}
                    className={`answer-option ${revealClass}`}
                    onClick={() => chooseAnswer(option)}
                    disabled={!!selected}
                  >
                    <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className={`feedback ${selected === correctAnswer ? 'ok' : 'bad'}`}>
                {selected === correctAnswer ? 'Đúng rồi.' : 'Chưa đúng.'}
                <span> Đáp án đúng: {correctAnswer}</span>
              </div>
            )}

            <div className="study-footer">
              <div className="mini-stats">
                <span>Script: {englishStats.correct}/{englishStats.total}</span>
                <span>Nghĩa: {meaningStats.correct}/{meaningStats.total}</span>
              </div>
              <button className="btn btn-primary" onClick={goNext} disabled={!selected}>
                {phase === 'meaning' && currentIndex + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'}
              </button>
            </div>
          </div>
        )}

        {lessonState === 'result' && (
          <div className="mp4-card result-card">
            <div className="result-mark">{totalAccuracy >= 80 ? 'Great' : totalAccuracy >= 60 ? 'Good' : 'Keep going'}</div>
            <h2>Kết quả bài nghe</h2>
            <div className="result-grid">
              <div>
                <strong>{englishStats.correct}/{questions.length}</strong>
                <span>Nghe script</span>
              </div>
              <div>
                <strong>{meaningStats.correct}/{questions.length}</strong>
                <span>Chọn nghĩa</span>
              </div>
              <div>
                <strong>{totalAccuracy}%</strong>
                <span>Chính xác</span>
              </div>
            </div>
            <div className="result-actions">
              <button className="btn btn-secondary" onClick={resetLesson}>Tạo bài khác</button>
              <button className="btn btn-primary" onClick={restartGeneratedLesson}>Học lại bài này</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .mp4-page { padding-bottom: 32px; }
        .mp4-content {
          padding: 24px 32px;
          display: grid;
          grid-template-columns: minmax(360px, 0.9fr) minmax(420px, 1.1fr);
          gap: 18px;
          align-items: start;
        }
        .mp4-player-panel, .mp4-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .mp4-audio-wrap {
          width: 100%;
          aspect-ratio: 16 / 9;
          background: linear-gradient(135deg, rgba(99,102,241,0.16), rgba(16,185,129,0.09));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 22px;
          padding: 24px;
        }
        .mp4-audio-icon {
          width: 88px;
          height: 64px;
          border-radius: 10px;
          border: 1px solid rgba(99,102,241,0.42);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-bright);
          background: rgba(13,13,26,0.35);
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .mp4-audio {
          width: min(100%, 460px);
        }
        .mp4-drop {
          aspect-ratio: 16 / 9;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          background: var(--bg-secondary);
          text-align: center;
          padding: 24px;
        }
        .mp4-drop-icon {
          width: 72px;
          height: 48px;
          border-radius: 8px;
          border: 1px solid rgba(99,102,241,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-bright);
          font-weight: 800;
          letter-spacing: 1px;
        }
        .mp4-drop-title { font-size: 16px; font-weight: 700; }
        .mp4-drop-sub { font-size: 13px; color: var(--text-secondary); max-width: 320px; line-height: 1.5; }
        .file-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-top: 1px solid var(--border);
        }
        .file-name { font-size: 13px; font-weight: 600; word-break: break-all; }
        .file-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .file-warning {
          font-size: 11px;
          color: #f59e0b;
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.28);
          border-radius: 999px;
          padding: 4px 9px;
          white-space: nowrap;
        }
        .mp4-card { padding: 24px; }
        .setup-card, .generating-card, .result-card {
          min-height: 320px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 14px;
        }
        .setup-card h2, .generating-card h2, .result-card h2, .study-card h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
        }
        .setup-card p, .generating-card p {
          color: var(--text-secondary);
          line-height: 1.7;
          font-size: 14px;
          margin: 0;
        }
        .setup-icon, .result-mark {
          width: fit-content;
          padding: 6px 11px;
          border-radius: 8px;
          background: rgba(99,102,241,0.12);
          color: var(--accent-bright);
          border: 1px solid rgba(99,102,241,0.28);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .mp4-error {
          padding: 11px 13px;
          border-radius: 8px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: #ef4444;
          font-size: 13px;
          line-height: 1.5;
        }
        .mp4-spinner {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          animation: spin 0.8s linear infinite;
        }
        .study-card { display: flex; flex-direction: column; gap: 16px; }
        .study-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .phase-badge {
          width: fit-content;
          margin-bottom: 7px;
          padding: 4px 9px;
          border-radius: 999px;
          background: rgba(16,185,129,0.1);
          color: #10b981;
          font-size: 11px;
          font-weight: 700;
        }
        .time-pill {
          padding: 6px 10px;
          border-radius: 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 12px;
          font-family: monospace;
          white-space: nowrap;
        }
        .lesson-progress {
          height: 5px;
          border-radius: 999px;
          background: var(--bg-secondary);
          overflow: hidden;
        }
        .lesson-progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: inherit;
          transition: width 0.25s;
        }
        .prompt-box {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
        }
        .prompt-label { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .prompt-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .script-box {
          padding: 13px 15px;
          border-radius: 10px;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.25);
          color: var(--text-primary);
          line-height: 1.6;
          font-size: 14px;
        }
        .script-label {
          font-size: 11px;
          color: var(--accent-bright);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 5px;
          font-weight: 700;
        }
        .option-list { display: flex; flex-direction: column; gap: 9px; }
        .answer-option {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          text-align: left;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: inherit;
          font-size: 14px;
          line-height: 1.45;
          cursor: pointer;
          transition: all 0.15s;
        }
        .answer-option:hover:not(:disabled) {
          border-color: var(--accent);
          transform: translateY(-1px);
        }
        .answer-option.correct {
          border-color: rgba(16,185,129,0.55);
          background: rgba(16,185,129,0.12);
        }
        .answer-option.wrong {
          border-color: rgba(239,68,68,0.55);
          background: rgba(239,68,68,0.1);
        }
        .option-letter {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(99,102,241,0.13);
          color: var(--accent-bright);
          font-size: 12px;
          font-weight: 800;
        }
        .feedback {
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.5;
        }
        .feedback.ok { background: rgba(16,185,129,0.1); color: #10b981; }
        .feedback.bad { background: rgba(239,68,68,0.1); color: #ef4444; }
        .feedback span { color: var(--text-secondary); }
        .study-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border-top: 1px solid var(--border);
          padding-top: 14px;
        }
        .mini-stats { display: flex; gap: 12px; color: var(--text-muted); font-size: 12px; }
        .result-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .result-grid div {
          padding: 14px;
          border-radius: 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          text-align: center;
        }
        .result-grid strong {
          display: block;
          color: var(--accent-bright);
          font-size: 26px;
          margin-bottom: 4px;
          font-family: monospace;
        }
        .result-grid span { color: var(--text-secondary); font-size: 12px; }
        .result-actions { display: flex; gap: 10px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1100px) {
          .mp4-content { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
