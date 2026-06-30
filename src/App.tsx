import React, { useState, useEffect, createContext, useContext } from 'react';
import { dbService } from './services/database';
import { Page } from './types';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './pages/Dashboard';
import FlashcardPage from './pages/FlashcardPage';
import MP4ListeningPage from './pages/MP4ListeningPage';
import TypingGamePage from './pages/TypingGamePage';
import MonsterGamePage from './pages/MonsterGamePage';
import ZombieGamePage from './pages/ZombieGamePage';
import MemoryFlipPage from './pages/MemoryFlipPage';
import MultiplayerHub from './pages/MultiplayerHub';
import ProgressPage from './pages/ProgressPage';
import GroupsPage from './pages/GroupsPage';
import VocabularyPage from './pages/VocabularyPage';
import SettingsPage from './pages/SettingsPage';
import HelpPage from './pages/HelpPage';
import AICoachPage from './pages/AICoachPage';
import SchedulePage from './pages/SchedulePage';
import './App.css';

interface AppContextType {
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 20, background: '#0d0d1a' }}>
      <div style={{ fontSize: 64 }}>📚</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>TOEIC Vocab Master</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94a3b8', fontSize: 14 }}>
        <div style={{ width: 20, height: 20, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Đang khởi động...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  const triggerRefresh = () => setRefreshTrigger(t => t + 1);

  if (loading) return <LoadingScreen />;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':    return <Dashboard />;
      case 'flashcard':    return <FlashcardPage />;
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
      default:             return <Dashboard />;
    }
  };

  return (
    <AppContext.Provider value={{ currentPage, setPage: setCurrentPage, isConnected, setConnected: setIsConnected, refreshTrigger, triggerRefresh }}>
      <div className="app">
        <Sidebar />
        <main className="main-content">{renderPage()}</main>
      </div>
    </AppContext.Provider>
  );
}

export default App;
