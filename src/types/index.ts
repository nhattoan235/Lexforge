// src/types/index.ts
export interface WordGroup {
  Id: number;
  Name: string;
  Description: string;
  Color: string;
  Icon: string;
  WordCount: number;
  CreatedAt: string;
}

export interface Word {
  Id: number;
  GroupId: number;
  GroupName: string;
  GroupColor: string;
  English: string;
  Vietnamese: string;
  Pronunciation: string;
  PartOfSpeech: string;
  Example: string;
  ExampleVi: string;
  Level: number;
  NextReview: string;
  TotalReviews: number;
  CorrectReviews: number;
  CreatedAt: string;
}

export interface StudySession {
  mode: string;
  score: number;
  totalWords: number;
  correctWords: number;
  duration: number;
  groupIds: string;
}

export interface GameScore {
  gameType: string;
  score: number;
  level: number;
  wordsTyped: number;
  accuracy: number;
  duration: number;
}

export interface AppStats {
  TotalWords: number;
  TotalGroups: number;
  MasteredWords: number;
  DueWords: number;
  TodayCorrect: number;
  BestMonsterScore: number;
  BestTypingScore: number;
}

export type Page = 'dashboard' | 'flashcard' | 'typing-game' | 'monster-game' | 'zombie-game' | 'memory-flip' | 'multiplayer' | 'progress' | 'groups' | 'vocabulary' | 'schedule' | 'settings' | 'help' | 'ai-coach';

export const PART_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'phrase'];

export const GROUP_COLORS = [
  '#4f46e5', '#7c3aed', '#db2777', '#dc2626', '#ea580c',
  '#ca8a04', '#16a34a', '#0891b2', '#0284c7', '#6366f1'
];

export const GROUP_ICONS = [
  'BookOpen', 'Star', 'Zap', 'Target', 'Award',
  'Brain', 'Lightbulb', 'TrendingUp', 'Globe', 'MessageSquare'
];
