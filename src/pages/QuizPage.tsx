import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, CheckCircle2, Clock3, RotateCcw, Sparkles, Target, Volume2, X } from 'lucide-react';
import { db, calculateNextReview } from '../services/database';
import { lstmService } from '../services/lstmScheduler';
import { speechService } from '../services/speech';
import { notify } from '../components/Feedback/ToastHost';
import { Word, WordGroup } from '../types';
import './QuizPage.css';

type StudyMode = 'all' | 'due';
type QuizDirection = 'en-vi' | 'vi-en';
type PageState = 'select' | 'quiz' | 'result';
type QuizQuestion = { word: Word; questionText: string; choices: string[]; correctIndex: number };

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const random = Math.floor(Math.random() * (index + 1));
    [result[index], result[random]] = [result[random], result[index]];
  }
  return result;
}

function buildQuizQuestions(words: Word[], direction: QuizDirection): QuizQuestion[] {
  const pool = [...new Set(words.map(word => direction === 'en-vi' ? word.Vietnamese : word.English))];
  return shuffle(words).map(word => {
    const correctAnswer = direction === 'en-vi' ? word.Vietnamese : word.English;
    const choices = shuffle([correctAnswer, ...shuffle(pool.filter(value => value !== correctAnswer)).slice(0, 3)]);
    return {
      word,
      questionText: direction === 'en-vi' ? word.English : word.Vietnamese,
      choices,
      correctIndex: choices.indexOf(correctAnswer),
    };
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

  useEffect(() => { db.getGroups().then(result => { if (result.success) setGroups(result.data || []); }); }, []);

  const correctCount = results.filter(result => result.correct).length;
  const accuracy = results.length ? Math.round(correctCount / results.length * 100) : 0;
  const currentQuestion = questions[currentIndex];
  const selectedGroupNames = useMemo(() => groups.filter(group => selectedGroups.includes(group.Id)).map(group => group.Name), [groups, selectedGroups]);

  const startQuiz = async () => {
    setLoading(true);
    try {
      const result = studyMode === 'due'
        ? await db.getDueWords(50)
        : selectedGroups.length ? await db.getWordsByGroups(selectedGroups) : await db.getWords();
      if (!result.success || !result.data?.length) {
        notify('Chưa có từ nào để làm trắc nghiệm trong lựa chọn này.', 'info');
        return;
      }
      const pool = new Set(result.data.map(word => direction === 'en-vi' ? word.Vietnamese : word.English));
      if (pool.size < 4) {
        notify('Cần ít nhất 4 đáp án khác nhau để tạo câu hỏi trắc nghiệm.', 'info');
        return;
      }
      const nextQuestions = buildQuizQuestions(result.data, direction);
      setQuestions(nextQuestions);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setResults([]);
      setScore(0);
      setStartTime(Date.now());
      setPageState('quiz');
      speechService.speak(nextQuestions[0].word.English);
    } catch (error) {
      notify('Không chuẩn bị được bài trắc nghiệm. Hãy thử lại.', 'error');
    } finally { setLoading(false); }
  };

  const handleAnswer = async (index: number) => {
    if (!currentQuestion || selectedAnswer !== null) return;
    setSelectedAnswer(index);
    const correct = index === currentQuestion.correctIndex;
    const word = currentQuestion.word;
    try {
      const { newLevel, nextReview } = calculateNextReview(word.Level, correct);
      await db.updateWordSRS(word.Id, newLevel, nextReview, correct);
      await lstmService.logStudyResult(word.Id, word.GroupId, correct,
        (word.TotalReviews || 0) + 1, (word.CorrectReviews || 0) + (correct ? 1 : 0), 'quiz');
    } catch (error) {
      notify('Không lưu được tiến độ của từ này.', 'error');
    }
    if (correct) setScore(value => value + 10);
    speechService.speak(correct ? 'Correct' : 'Wrong');
    const nextResults = [...results, { word, correct }];
    setResults(nextResults);
    setTimeout(() => {
      if (currentIndex + 1 >= questions.length) {
        void db.saveSession({
          mode: 'quiz', score: score + (correct ? 10 : 0), totalWords: questions.length,
          correctWords: nextResults.filter(result => result.correct).length,
          duration: Math.round((Date.now() - startTime) / 1000), groupIds: selectedGroups.join(','),
        });
        setPageState('result');
      } else {
        setCurrentIndex(value => value + 1);
        setSelectedAnswer(null);
        speechService.speak(questions[currentIndex + 1].word.English);
      }
    }, 700);
  };

  return <div className="lf-quiz">
    <header className="lf-quiz-topbar"><strong>Trắc nghiệm</strong><span>Ôn tập từ vựng · Chọn đáp án đúng</span></header>
    <div className="lf-quiz-content">
      {pageState === 'select' && <>
        <section className="lf-quiz-hero">
          <div><span className="lf-quiz-eyebrow"><Sparkles size={15} /> LUYỆN TẬP MỖI NGÀY</span><h1>Nhớ từ tốt hơn<br /><em>qua mỗi câu hỏi.</em></h1><p>Chọn từ muốn ôn, xác định hướng dịch và bắt đầu bài trắc nghiệm của riêng bạn.</p><div className="lf-quiz-hero-pills"><span><BookOpen size={15} /> 4 lựa chọn mỗi câu</span><span><Clock3 size={15} /> Học theo nhịp của bạn</span></div></div>
          <div className="lf-quiz-hero-art" aria-hidden="true"><div className="lf-quiz-art-ring"/><div className="lf-quiz-art-core">A<span>·</span>B<span>·</span>C<span>·</span>D</div><div className="lf-quiz-art-note">Chọn đúng · Nhớ lâu</div></div>
        </section>
        <div className="lf-quiz-setup">
          <section className="lf-quiz-panel">
            <div className="lf-quiz-panel-heading"><span className="lf-quiz-step">01</span><div><h2>Thiết lập bài học</h2><p>Chọn nguồn từ và hướng câu hỏi.</p></div></div>
            <div className="lf-quiz-field"><h3>Chế độ học</h3><div className="lf-quiz-options"><button className={studyMode === 'all' ? 'active' : ''} onClick={() => setStudyMode('all')} aria-pressed={studyMode === 'all'}><BookOpen size={21}/><strong>Tất cả từ</strong><small>Ôn rộng thư viện của bạn</small></button><button className={studyMode === 'due' ? 'active' : ''} onClick={() => setStudyMode('due')} aria-pressed={studyMode === 'due'}><Clock3 size={21}/><strong>Từ cần ôn</strong><small>Tập trung vào từ đến hạn</small></button></div></div>
            <div className="lf-quiz-field"><h3>Hướng trắc nghiệm</h3><div className="lf-quiz-options"><button className={direction === 'en-vi' ? 'active' : ''} onClick={() => setDirection('en-vi')} aria-pressed={direction === 'en-vi'}><span className="lf-quiz-lang">EN → VI</span><strong>Anh → Việt</strong><small>Chọn nghĩa tiếng Việt</small></button><button className={direction === 'vi-en' ? 'active' : ''} onClick={() => setDirection('vi-en')} aria-pressed={direction === 'vi-en'}><span className="lf-quiz-lang">VI → EN</span><strong>Việt → Anh</strong><small>Chọn từ tiếng Anh</small></button></div></div>
          </section>
          <aside className="lf-quiz-panel lf-quiz-groups"><div className="lf-quiz-panel-heading"><span className="lf-quiz-step">02</span><div><h2>Nhóm từ</h2><p>{studyMode === 'due' ? 'Hệ thống tự chọn các từ đến hạn.' : 'Để trống để dùng tất cả nhóm.'}</p></div></div><div className="lf-quiz-group-list">{groups.map(group => <button key={group.Id} disabled={studyMode === 'due'} className={selectedGroups.includes(group.Id) ? 'selected' : ''} onClick={() => setSelectedGroups(value => value.includes(group.Id) ? value.filter(id => id !== group.Id) : [...value, group.Id])}><span className="lf-quiz-group-icon">{group.Icon || '◈'}</span><span className="lf-quiz-group-name"><strong>{group.Name}</strong><small>{group.WordCount} từ</small></span><span className="lf-quiz-check">{selectedGroups.includes(group.Id) && <Check size={15}/>}</span></button>)}</div><div className="lf-quiz-group-summary">{studyMode === 'due' ? 'Sẽ dùng từ cần ôn' : selectedGroupNames.length ? `${selectedGroupNames.length} nhóm đã chọn` : 'Đang dùng tất cả nhóm'}</div></aside>
        </div>
        <div className="lf-quiz-start"><div><strong>Sẵn sàng bắt đầu?</strong><span>Mỗi đáp án sẽ cập nhật tiến độ ghi nhớ của bạn.</span></div><button onClick={startQuiz} disabled={loading}>{loading ? 'Đang chuẩn bị…' : 'Bắt đầu trắc nghiệm'} <ArrowRight size={19}/></button></div>
      </>}
      {pageState === 'quiz' && currentQuestion && <>
        <section className="lf-quiz-study-head"><div><span className="lf-quiz-eyebrow">BÀI TRẮC NGHIỆM</span><h1>Câu {currentIndex + 1} <small>/ {questions.length}</small></h1><p>{direction === 'en-vi' ? 'Chọn nghĩa tiếng Việt phù hợp.' : 'Chọn từ tiếng Anh phù hợp.'}</p></div><button onClick={() => setPageState('select')}><X size={17}/> Kết thúc</button></section>
        <div className="lf-quiz-progress" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={0} aria-valuemax={questions.length}><span style={{ width: `${(currentIndex + 1) / questions.length * 100}%` }}/></div>
        <section className="lf-quiz-question-card"><span className="lf-quiz-question-label">{direction === 'en-vi' ? 'TỪ TIẾNG ANH' : 'NGHĨA TIẾNG VIỆT'}</span><div className="lf-quiz-prompt"><h2>{currentQuestion.questionText}</h2><button aria-label="Nghe phát âm" onClick={() => speechService.speak(currentQuestion.word.English)}><Volume2 size={20}/></button></div><p>Chọn một đáp án đúng trong bốn lựa chọn bên dưới.</p><div className="lf-quiz-answers">{currentQuestion.choices.map((choice, index) => <button key={`${index}-${choice}`} disabled={selectedAnswer !== null} className={selectedAnswer === null ? '' : index === currentQuestion.correctIndex ? 'correct' : index === selectedAnswer ? 'wrong' : 'muted'} onClick={() => handleAnswer(index)}><span>{'ABCD'[index]}</span><strong>{choice}</strong>{selectedAnswer !== null && index === currentQuestion.correctIndex && <CheckCircle2 size={20}/>}</button>)}</div></section>
        <div className="lf-quiz-live-stats"><span><Target size={17}/> {score} điểm</span><span><CheckCircle2 size={17}/> {correctCount} câu đúng</span><span>{results.length ? accuracy : 0}% chính xác</span></div>
      </>}
      {pageState === 'result' && <><section className="lf-quiz-result-hero"><span className="lf-quiz-eyebrow">HOÀN THÀNH BÀI HỌC</span><h1>{accuracy >= 80 ? 'Bạn làm rất tốt!' : 'Mỗi lần ôn là một bước tiến.'}</h1><p>Bạn đã trả lời {questions.length} câu hỏi. Hãy tiếp tục luyện để ghi nhớ lâu hơn.</p><strong>{accuracy}% <small>chính xác</small></strong></section><div className="lf-quiz-result-grid"><div><span>TỔNG CÂU</span><strong>{questions.length}</strong></div><div><span>TRẢ LỜI ĐÚNG</span><strong>{correctCount}</strong></div><div><span>CẦN ÔN THÊM</span><strong>{questions.length - correctCount}</strong></div><div><span>ĐIỂM ĐẠT ĐƯỢC</span><strong>{score}</strong></div></div><div className="lf-quiz-result-actions"><button onClick={() => setPageState('select')}>Đổi thiết lập</button><button onClick={startQuiz}><RotateCcw size={18}/> Làm lại bài</button></div></>}
    </div>
  </div>;
}
