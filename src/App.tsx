import React, { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { dbService } from './services/database';
import { Page } from './types';
import Sidebar from './components/Layout/Sidebar';
import ToastHost from './components/Feedback/ToastHost';
import Dashboard from './pages/Dashboard';
const FlashcardPage = lazy(() => import('./pages/FlashcardPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const MP4ListeningPage = lazy(() => import('./pages/MP4ListeningPage'));
const TypingGamePage = lazy(() => import('./pages/TypingGamePage'));
const MonsterGamePage = lazy(() => import('./pages/MonsterGamePage'));
const ZombieGamePage = lazy(() => import('./pages/ZombieGamePage'));
const MemoryFlipPage = lazy(() => import('./pages/MemoryFlipPage'));
const MultiplayerHub = lazy(() => import('./pages/MultiplayerHub'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const VocabularyPage = lazy(() => import('./pages/VocabularyPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const AICoachPage = lazy(() => import('./pages/AICoachPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
import './App.css';
import './components/Layout/Shell.css';
import './pages/TrainingShell.css';
import './pages/Theme.css';
import './pages/ZombieShell.css';

interface AppContextType {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  currentPage: Page;
  setPage: (p: Page) => void;
  isConnected: boolean;
  setConnected: (v: boolean) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

function LoadingScreen() {
  const stars = [[7,9,2],[12,38,3],[8,65,2],[16,87,4],[24,5,3],[27,42,2],[33,81,3],[39,16,2],[45,7,4],[52,22,2],[57,80,3],[63,6,2],[69,43,3],[74,87,4],[82,8,2],[89,42,3],[94,72,2],[96,18,3],[3,83,3],[36,56,2],[61,59,2],[85,63,3],[19,58,2],[76,24,2]];
  return (
    <div className="lexforge-loading" role="status" aria-live="polite">
      <div className="lexforge-loading-cosmos" aria-hidden="true">
        {['a', 'b', 'c', 'd', 'e', 'f'].map(planet => <div className={`lexforge-planet planet-${planet}`} key={planet}><span className="lexforge-planet-belt"><i>✦</i><i>✧</i><i>✦</i><i>✧</i></span><span className="lexforge-planet-core" /></div>)}
        {stars.map(([x, y, size], index) => <span key={index} className={`lexforge-sky-star${index % 5 === 0 ? ' four-point' : ''}`} style={{ left: `${x}%`, top: `${y}%`, ['--size' as any]: `${size}px`, ['--speed' as any]: `${4 + index % 6}s`, ['--delay' as any]: `-${index * .47}s`, ['--tone' as any]: index % 4 === 0 ? '#ffe0a0' : '#c3f3e9' }} />)}
      </div>
      <div className="lexforge-loading-ambient ambient-left" aria-hidden="true"><span>TỪ VỰNG <b>✧</b></span><i /><i /></div>
      <div className="lexforge-loading-ambient ambient-right" aria-hidden="true"><span>GHI NHỚ <b>✦</b></span><i /><i /></div>
      <span className="lexforge-loading-dust dust-one" aria-hidden="true" />
      <span className="lexforge-loading-dust dust-two" aria-hidden="true" />
      <span className="lexforge-loading-dust dust-three" aria-hidden="true" />
      <div className="lexforge-loading-orbit" aria-hidden="true">
        <span className="lexforge-loading-ring" />
        <span className="lexforge-loading-star star-one">✦</span>
        <span className="lexforge-loading-star star-two">✧</span>
        <span className="lexforge-loading-center"><img src={`${process.env.PUBLIC_URL}/lexforge-mark.png`} alt="" /></span>
      </div>
      <span className="lexforge-loading-eyebrow">HÀNH TRÌNH GHI NHỚ</span>
      <strong>Lexforge</strong>
      <p>Đang chuẩn bị không gian học của bạn...</p>
      <div className="lexforge-loading-track" aria-hidden="true"><span /></div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('lexforge-theme') === 'dark' ? 'dark' : 'light');
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    document.body.dataset.lexforgeTheme = theme;
    localStorage.setItem('lexforge-theme', theme);
    (window as any).electronAPI?.setTheme?.(theme);
  }, [theme]);

  useEffect(() => {
    return (window as any).electronAPI?.onThemeChange?.((nextTheme: string) => {
      if (nextTheme === 'light' || nextTheme === 'dark') setTheme(nextTheme);
    });
  }, []);

  useEffect(() => {
    // SQLite auto-connects on startup
    dbService.connect().then(res => {
      setIsConnected(res.success);
      setLoading(false);
    }).catch(() => {
      setIsConnected(false);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading || !dashboardReady) return;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => (window as any).electronAPI?.uiReady?.());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, dashboardReady]);

  const triggerRefresh = () => setRefreshTrigger(t => t + 1);

  if (loading) return <LoadingScreen />;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':    return <Dashboard onInitialLoad={() => setDashboardReady(true)} />;
      case 'flashcard':    return <FlashcardPage />;
      case 'quiz':         return <QuizPage />;
      case 'mp4-listening': return <MP4ListeningPage />;
      case 'typing-game':  return <TypingGamePage />;
      case 'monster-game': return <MonsterGamePage />;
      case 'zombie-game':  return <ZombieGamePage />;
      case 'memory-flip':  return <MemoryFlipPage />;
      case 'multiplayer':  return <MultiplayerHub />;
      case 'progress':     return <ProgressPage />;
      case 'groups':       return <GroupsPage />;
      case 'vocabulary':   return <VocabularyPage />;
      case 'schedule':     return <SchedulePage />;
      case 'settings':     return <SettingsPage />;
      case 'help':         return <HelpPage />;
      case 'ai-coach':     return <AICoachPage />;
      default:             return <Dashboard onInitialLoad={() => setDashboardReady(true)} />;
    }
  };

  return (
    <AppContext.Provider value={{ theme, setTheme, currentPage, setPage: setCurrentPage, isConnected, setConnected: setIsConnected, refreshTrigger, triggerRefresh }}>
      <div className="app">
        <Sidebar />
        <main className={`main-content${['dashboard','vocabulary','groups','flashcard','schedule','progress','settings','help','ai-coach','mp4-listening','typing-game','monster-game','memory-flip','multiplayer'].includes(currentPage) ? ' lf-dashboard-main' : ''}`}><Suspense fallback={<div className="lf-page-loading" role="status">Đang mở trang…</div>}>{renderPage()}</Suspense></main>
      </div>
      <ToastHost />
    </AppContext.Provider>
  );
}

export default App;
