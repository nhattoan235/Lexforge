import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notify } from '../components/Feedback/ToastHost';
import { db } from '../services/database';
import { speechService } from '../services/speech';
import { Word, WordGroup } from '../types';
import './AICoachApproved.css';

interface SentenceTranslation {
  text: string;
  translation?: string;
  showTranslation?: boolean;
  isLoading?: boolean;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  translatedContent?: string;
  showTranslation?: boolean;
  sentenceTranslations?: SentenceTranslation[];
}

function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  // Split by newlines first to preserve paragraph breaks
  const lines = text.split('\n');
  const result: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Split the line into sentences
    const matches = trimmedLine.match(/[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g);
    if (matches) {
      result.push(...matches.map(s => s.trim()).filter(s => s.length > 0));
    } else {
      result.push(trimmedLine);
    }
  }
  return result;
}

type Mode = 'chat' | 'writing' | 'speaking';

const MODES = [
  { id: 'chat' as Mode,     icon: '💬', label: 'Hội Thoại',   desc: 'Luyện giao tiếp tự nhiên với AI' },
  { id: 'writing' as Mode,  icon: '✍️',  label: 'Luyện Viết',  desc: 'AI sửa lỗi ngữ pháp, từ vựng' },
  { id: 'speaking' as Mode, icon: '🎤',  label: 'Luyện Nói',   desc: 'Nói rồi AI phản hồi bằng giọng' },
];

function buildSystemPrompt(words: Word[], groups: WordGroup[], mode: Mode): string {
  // Giới hạn danh sách từ vựng truyền vào
  const wordList = words.slice(0, 25).map(w =>
    `${w.English}:${w.Vietnamese}`
  ).join(', ');

  // Cấu trúc lại câu lệnh: Ép AI tập trung vào cốt lõi, ngắn gọn và hạ giới hạn số câu xuống
  const modeInstruction = {
    chat: 'You are a friendly English coach. Chat naturally, but be extremely concise. Use exactly 1-2 sentences. Never say long greetings. Weave 1 vocab word and end with a short question.',
    writing: 'You are a writing coach. Review the text: directly list errors or give 1 best improvement using bullet points. Maximum 2 sentences. No fluff.',
    speaking: 'You are a speaking coach. Reply in short spoken English. Maximum 1-2 very short sentences (under 15 words total). Keep it punchy.',
  }[mode];

  // Thêm điều khoản ép buộc cuối cùng
  return `${modeInstruction} Vocab to use: ${wordList}. CRITICAL: Be brief, focus only on the main point, and do not write long paragraphs. Reply in plain text only, no markdown.`;
}

export default function AICoachPage() {
  const [mode, setMode] = useState<Mode>('chat');
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [msgIdCounter, setMsgIdCounter] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Translation & Selection tooltip state
  const [selectionText, setSelectionText] = useState('');
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectionTranslation, setSelectionTranslation] = useState<string | null>(null);
  const [selectionPhonetic, setSelectionPhonetic] = useState<string | null>(null);
  const [isTranslatingSelection, setIsTranslatingSelection] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');

  // Translation Helper State (Vietnamese to English)
  const [showTranslatorHelper, setShowTranslatorHelper] = useState(false);
  const [translatorInput, setTranslatorInput] = useState('');
  const [translatorOutput, setTranslatorOutput] = useState('');
  const [isTranslatingHelper, setIsTranslatingHelper] = useState(false);
  const [helperCopied, setHelperCopied] = useState(false);

  // Grammar checker state
  const [grammarResult, setGrammarResult] = useState<{ hasError: boolean; correctedText: string; explanation: string } | null>(null);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const HISTORY_KEY = `ai_coach_chat_history_${mode}`;
  const WARN_THRESHOLD = 30;

  // Debounced translation effect for the helper panel
  useEffect(() => {
    if (!translatorInput.trim()) {
      setTranslatorOutput('');
      return;
    }

    const delayDebounce = setTimeout(() => {
      translateViToEn(translatorInput);
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [translatorInput]);

  useEffect(() => {
    db.getGroups().then(res => { if (res.success) setGroups(res.data || []); });
    db.getSetting('groq_api_key').then(res => { if (res.success && res.data?.[0]) setApiKey(res.data[0].SettingValue); });
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0 && sessionStarted) {
      const toSave = messages.filter(m => !m.isLoading).map(m => ({ ...m, timestamp: m.timestamp.toISOString() }));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
      if (toSave.length >= WARN_THRESHOLD && !showWarningBanner) setShowWarningBanner(true);
    }
  }, [messages, sessionStarted, HISTORY_KEY]);

  // Debounced grammar check
  useEffect(() => {
    if (!input.trim() || input.trim().split(/\s+/).length < 3) {
      setGrammarResult(null);
      return;
    }
    const t = setTimeout(async () => {
      if (!apiKey) return;
      setIsCheckingGrammar(true);
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.trim()}` },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: [
              { role: 'system', content: 'You are a grammar checker. Return ONLY a JSON object: {"hasError":boolean,"correctedText":"corrected if error else empty","explanation":"brief Vietnamese explanation if error else empty"}. No markdown, no extra text.' },
              { role: 'user', content: input.trim() }
            ],
            temperature: 0.1, max_tokens: 120,
            response_format: { type: 'json_object' }
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
          setGrammarResult(parsed);
        }
      } catch { /* ignore grammar errors silently */ }
      setIsCheckingGrammar(false);
    }, 1200);
    return () => clearTimeout(t);
  }, [input, apiKey]);

  // Dismiss selection tooltip when clicking outside
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      const tooltipEl = document.getElementById('selection-translation-tooltip');
      if (tooltipEl && tooltipEl.contains(e.target as Node)) {
        return;
      }
      setSelectionCoords(null);
      setSelectionText('');
    };

    document.addEventListener('mousedown', handleGlobalMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleGlobalMouseDown);
    };
  }, []);

  // Fetch translation & definition of highlighted word/phrase
  const fetchSelectionTranslation = async (text: string) => {
    setIsTranslatingSelection(true);
    setSelectionTranslation(null);
    setSelectionPhonetic(null);
    try {
      // 1. Google Translate API
      const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(translateUrl);
      let translated = '';
      if (res.ok) {
        const json = await res.json();
        try {
          translated = json[0].map((item: any) => item[0]).join('');
        } catch (e) {
          translated = json[0]?.[0]?.[0] || '';
        }
      }
      setSelectionTranslation(translated || 'Không thể dịch');

      // 2. Dictionary API (only for single English words)
      const cleanWord = text.trim().toLowerCase().replace(/[^a-z-]/g, '');
      if (cleanWord && !text.trim().includes(' ')) {
        const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`;
        const dictRes = await fetch(dictUrl);
        if (dictRes.ok) {
          const dictJson = await dictRes.json();
          const phonetic = dictJson[0]?.phonetic || dictJson[0]?.phonetics?.find((p: any) => p.text)?.text;
          if (phonetic) {
            setSelectionPhonetic(phonetic);
          }
        }
      }
    } catch (err) {
      console.error('Lỗi khi dịch phần tô đen:', err);
      setSelectionTranslation('Lỗi kết nối dịch');
    } finally {
      setIsTranslatingSelection(false);
    }
  };

  // Vietnamese to English Translator Helper
  const translateViToEn = async (text: string) => {
    if (!text.trim()) return;
    setIsTranslatingHelper(true);
    try {
      const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(translateUrl);
      if (res.ok) {
        const json = await res.json();
        let translated = '';
        try {
          translated = json[0].map((item: any) => item[0]).join('');
        } catch (e) {
          translated = json[0]?.[0]?.[0] || '';
        }
        setTranslatorOutput(translated);
      } else {
        setTranslatorOutput('Lỗi dịch thuật');
      }
    } catch (err) {
      console.error('Lỗi trợ lý dịch:', err);
      setTranslatorOutput('Lỗi kết nối dịch');
    } finally {
      setIsTranslatingHelper(false);
    }
  };

  const handleCopyHelperOutput = () => {
    if (!translatorOutput) return;
    navigator.clipboard.writeText(translatorOutput);
    setHelperCopied(true);
    setTimeout(() => setHelperCopied(false), 1500);
  };

  const handleInsertHelperOutput = () => {
    if (!translatorOutput) return;
    setInput(prev => prev ? prev + ' ' + translatorOutput : translatorOutput);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Translate full chat bubble
  const translateMessage = async (id: number, content: string) => {
    const existing = messages.find(m => m.id === id);
    if (existing && existing.translatedContent) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, showTranslation: !m.showTranslation } : m));
      return;
    }

    setMessages(prev => prev.map(m => m.id === id ? { ...m, translatedContent: 'Đang dịch...', showTranslation: true } : m));

    try {
      const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(content)}`;
      const res = await fetch(translateUrl);
      let translated = '';
      if (res.ok) {
        const json = await res.json();
        try {
          translated = json[0].map((item: any) => item[0]).join('');
        } catch (e) {
          translated = json[0]?.[0]?.[0] || '';
        }
      }
      setMessages(prev => prev.map(m => m.id === id ? { ...m, translatedContent: translated || 'Không thể dịch' } : m));
    } catch (err) {
      console.error('Lỗi dịch toàn câu:', err);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, translatedContent: 'Lỗi kết nối dịch' } : m));
    }
  };

  // Translate specific sentence in assistant reply
  const translateSentence = async (messageId: number, sentenceIndex: number, sentenceText: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const currentSentences: SentenceTranslation[] = message.sentenceTranslations || splitIntoSentences(message.content).map(s => ({ text: s }));
    const target = currentSentences[sentenceIndex];
    
    if (target && target.translation) {
      // Just toggle visibility
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const updated = (m.sentenceTranslations || currentSentences).map((s, idx) => 
          idx === sentenceIndex ? { ...s, showTranslation: !s.showTranslation } : s
        );
        return { ...m, sentenceTranslations: updated };
      }));
      return;
    }

    // Set loading state
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const updated = (m.sentenceTranslations || currentSentences).map((s, idx) => 
        idx === sentenceIndex ? { ...s, isLoading: true, showTranslation: true } : s
      );
      return { ...m, sentenceTranslations: updated };
    }));

    try {
      const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(sentenceText)}`;
      const res = await fetch(translateUrl);
      let translated = '';
      if (res.ok) {
        const json = await res.json();
        try {
          translated = json[0].map((item: any) => item[0]).join('');
        } catch (e) {
          translated = json[0]?.[0]?.[0] || '';
        }
      }

      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const updated = (m.sentenceTranslations || currentSentences).map((s, idx) => 
          idx === sentenceIndex ? { ...s, translation: translated || 'Không thể dịch', isLoading: false, showTranslation: true } : s
        );
        return { ...m, sentenceTranslations: updated };
      }));
    } catch (err) {
      console.error('Lỗi khi dịch câu:', err);
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const updated = (m.sentenceTranslations || currentSentences).map((s, idx) => 
          idx === sentenceIndex ? { ...s, translation: 'Lỗi kết nối dịch', isLoading: false, showTranslation: true } : s
        );
        return { ...m, sentenceTranslations: updated };
      }));
    }
  };

  // Handle mouse release for highlighting text
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (!text) return;

    let node: Node | null = selection.anchorNode;
    let isAssistant = false;
    let isInTranslation = false;
    while (node) {
      if (node instanceof HTMLElement) {
        if (node.getAttribute('data-is-translation') === 'true') {
          isInTranslation = true;
        }
        if (node.getAttribute('data-role') === 'assistant') {
          isAssistant = true;
          break;
        }
      }
      node = node.parentNode;
    }

    if (!isAssistant || isInTranslation) {
      setSelectionCoords(null);
      setSelectionText('');
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const position = rect.top < 100 ? 'bottom' : 'top';
    
    setTooltipPosition(position);
    setSelectionText(text);
    
    const centerX = Math.max(100, Math.min(window.innerWidth - 100, rect.left + rect.width / 2));
    
    setSelectionCoords({
      x: centerX,
      y: position === 'top' ? rect.top : rect.bottom
    });

    fetchSelectionTranslation(text);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadWords = async (groupIds: number[]) => {
    const res = groupIds.length > 0
      ? await db.getWordsByGroups(groupIds)
      : await db.getWords();
    if (res.success && res.data) setWords(res.data);
    return res.data || [];
  };

  const toggleGroup = (id: number) =>
    setSelectedGroups(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const nextId = () => { setMsgIdCounter(c => c + 1); return Date.now(); };

  const speakText = useCallback((text: string) => {
    if (!autoSpeak) return;
    setIsSpeaking(true);
    const clean = text.replace(/[*_`#]/g, '');
    speechService.speak(clean, 'en-US', 0.88);
    const duration = Math.max(2000, clean.length * 65);
    setTimeout(() => setIsSpeaking(false), duration);
  }, [autoSpeak]);

  // ─── ĐÃ THAY ĐỔI: LOGIC GỌI GROQ CLOUD API ───────────────────────────────────────
  const callAI = async (userMessage: string, history: Message[], currentWords: Word[]) => {
    // Đọc fresh key từ DB
    const keyRes = await db.getSetting('groq_api_key');
    const freshKey = keyRes.success && keyRes.data?.[0] ? keyRes.data[0].SettingValue : apiKey;
    if (!freshKey || freshKey.trim() === '') throw new Error('NO_KEY');

    const systemPrompt = buildSystemPrompt(currentWords, groups.filter(g => selectedGroups.includes(g.Id) || selectedGroups.length === 0), mode);

    // Cấu trúc mảng tin nhắn theo chuẩn OpenAI/Groq gọn nhẹ
    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).filter(m => !m.isLoading).map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: userMessage }
    ];

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshKey.trim()}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: groqMessages,
        temperature: 0.8,
        max_tokens: 300,
        top_p: 0.95
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error('Groq error:', response.status, errBody);
      throw new Error(`HTTP_${response.status}`);
    }
    
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      console.error('Groq empty response:', JSON.stringify(data));
      throw new Error('EMPTY_RESPONSE');
    }
    return text;
  };

  const startSession = async (resumeHistory = false) => {
    const loadedWords = await loadWords(selectedGroups);
    setSessionStarted(true);
    setGrammarResult(null);

    if (resumeHistory) {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
          setMessages(parsed);
          return;
        } catch { /* fall through to new session */ }
      }
    }

    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
    setShowWarningBanner(false);

    const greetings: Record<Mode, string> = {
      chat: "Hi there! I'm your English conversation coach. I've loaded your vocabulary list and I'm ready to practice with you. Let's have a natural conversation — what's on your mind today? 😊",
      writing: "Hello! I'm your writing coach. Share any English text you'd like me to review — emails, essays, sentences, anything! I'll give you constructive feedback and help you improve. What would you like to write about?",
      speaking: "Hey! Ready to practice speaking? Just type what you'd say out loud, and I'll respond as if we're having a real conversation. What topic shall we talk about?",
    };

    const greeting = greetings[mode];
    const id = Date.now();
    setMessages([{ id, role: 'assistant', content: greeting, timestamp: new Date() }]);
    speakText(greeting);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    setInput('');
    setGrammarResult(null);

    const userMsg: Message = { id: nextId(), role: 'user', content: userText, timestamp: new Date() };
    const loadingMsg: Message = { id: nextId(), role: 'assistant', content: '...', timestamp: new Date(), isLoading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      const history = messages.filter(m => !m.isLoading);
      const reply = await callAI(userText, history, words);

      setMessages(prev => prev.map(m => m.isLoading
        ? { ...m, content: reply, isLoading: false }
        : m
      ));
      speakText(reply);
    } catch (err: any) {
      const msg = err?.message || '';
      // ĐỔI THÀNH: Phản hồi lỗi chuẩn hoá cho Groq API
      const errMsg = msg === 'NO_KEY'
        ? '⚠️ Chưa có Groq API key. Vào Cài Đặt → nhập key → nhấn Lưu.'
        : msg.includes('400')
        ? '❌ Lỗi request sai định dạng. Kiểm tra lại cấu hình.'
        : msg.includes('403') || msg.includes('401')
        ? '❌ API key của Groq sai hoặc hết hạn. Hãy kiểm tra lại trong Cài Đặt.'
        : msg.includes('429')
        ? '⏳ Đạt giới hạn Rate Limit của Groq. Vui lòng chờ vài giây rồi thử lại.'
        : msg === 'EMPTY_RESPONSE'
        ? '⚠️ Hệ thống không phản hồi nội dung. Thử gửi lại.'
        : '❌ Lỗi kết nối (' + msg + '). Kiểm tra mạng internet và Groq API key.';
        
      setMessages(prev => prev.map(m => m.isLoading
        ? { ...m, content: errMsg, isLoading: false }
        : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const startListening = async () => {
    try {
      setIsListening(true);
      console.log('🎤 Bắt đầu ghi âm...');

      // Get access to microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        console.log('📤 Gửi audio tới server...');
        
        try {
          // Send to Python backend
          const formData = new FormData();
          formData.append('audioBlob', audioBlob, 'audio.wav');
          
          const response = await fetch('http://localhost:5000/transcribe-blob', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          if (result.success) {
            console.log('✅ Nhận được:', result.text);
            setInput(result.text);
          } else {
            console.error('Lỗi:', result.error);
            const errorMsg = result.errorCode === 'no-speech'
              ? '⏱ Không nghe thấy giọng nói. Hãy nói to hơn và thử lại.'
              : result.errorCode === 'service-error'
              ? '🌐 Lỗi kết nối server. Kiểm tra Python backend có chạy không.'
              : result.error || 'Lỗi không xác định';
            notify(errorMsg, 'error', 8000);
          }
        } catch (err) {
          console.error('Lỗi gửi audio:', err);
          notify('Không thể kết nối dịch vụ giọng nói. Hãy kiểm tra server và cổng 5000.', 'error', 8000);
        } finally {
          setIsListening(false);
        }
      };

      // Record for max 30 seconds
      mediaRecorder.start();
      const recordTimeout = setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, 30000);

      // Store reference for stop button
      recognitionRef.current = {
        stop: () => {
          clearTimeout(recordTimeout);
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        }
      };

    } catch (err: any) {
      console.error('Lỗi micro:', err);
      setIsListening(false);
      
      if (err.name === 'NotAllowedError') {
        notify('Quyền micro bị từ chối. Hãy cho phép micro trong cài đặt.', 'error', 8000);
      } else if (err.name === 'NotFoundError') {
        notify('Không tìm thấy micro. Hãy kiểm tra thiết bị âm thanh.', 'error', 8000);
      } else {
        notify('Lỗi micro: ' + err.message, 'error', 8000);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current?.stop) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // ─── Setup screen ─────────────────────────────────────────────────────────────
  if (!sessionStarted) return (
    <div className="lf-ai-approved">
      <div className="lf-ai-topbar">Luyện tập <span>› AI Coach</span></div>
      <header className="lf-ai-hero"><span>LUYỆN TIẾNG ANH CÙNG AI</span><h1>Nói có ý. <em>Viết có chất.</em></h1><p>Chọn cách luyện. AI Coach giúp bạn <strong>phản xạ và dùng từ đúng ngữ cảnh.</strong></p><div><b>Hội thoại</b><b>Luyện viết</b><b>Luyện nói</b></div></header>
      <div className="lf-ai-setup-grid"><section className="lf-ai-panel"><h2>Chọn cách luyện</h2><p>Bắt đầu từ kỹ năng bạn muốn cải thiện hôm nay.</p><div className="lf-ai-modes">{MODES.map(m => <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)}><i>{m.id === 'chat' ? '◌' : m.id === 'writing' ? '✎' : '♫'}</i><span><strong>{m.label}</strong><small>{m.id === 'chat' ? 'Trò chuyện và tập phản xạ bằng tiếng Anh' : m.id === 'writing' ? 'Viết câu, nhận góp ý cách diễn đạt' : 'Nói thành tiếng, nghe AI phản hồi'}</small></span><em>{mode === m.id ? '✓' : ''}</em></button>)}</div><div className="lf-ai-switch-row"><strong>Tự động đọc phản hồi của AI</strong><button role="switch" aria-checked={autoSpeak} className={autoSpeak ? 'on' : ''} onClick={() => setAutoSpeak(!autoSpeak)} aria-label="Tự động đọc phản hồi của AI"><span /></button></div></section>
      <section className="lf-ai-panel"><h2>Chọn từ vựng cho buổi luyện</h2><p>AI sẽ đưa từ trong nhóm bạn chọn vào câu trả lời.</p><div className="lf-ai-groups"><button className={selectedGroups.length === 0 ? 'active' : ''} onClick={() => setSelectedGroups([])}><i>◎</i><strong>Tất cả từ vựng</strong><small>{words.length} từ</small><em>{selectedGroups.length === 0 ? '✓' : ''}</em></button>{groups.map(g => <button key={g.Id} className={selectedGroups.includes(g.Id) ? 'active' : ''} onClick={() => toggleGroup(g.Id)}><i>{g.Icon || '▤'}</i><strong>{g.Name}</strong><small>{g.WordCount} từ</small><em>{selectedGroups.includes(g.Id) ? '✓' : ''}</em></button>)}</div>{!apiKey && <div className="lf-ai-key-warning">Chưa có Groq API key. Hãy nhập key trong Cài đặt để dùng AI Coach.</div>}<div className="lf-ai-ready"><strong>{mode === 'chat' ? 'Sẵn sàng hội thoại' : mode === 'writing' ? 'Sẵn sàng luyện viết' : 'Sẵn sàng luyện nói'}</strong><p>{mode === 'chat' ? 'Tập dùng từ vựng qua tình huống thực tế.' : mode === 'writing' ? 'Viết một câu hoặc đoạn ngắn để nhận góp ý.' : 'Nói thành tiếng hoặc nhập câu để luyện phản xạ.'}</p><div><button className="primary" onClick={() => startSession(false)}>Bắt đầu →</button>{localStorage.getItem(`ai_coach_chat_history_${mode}`) && <button onClick={() => startSession(true)}>Tiếp tục cuộc trò chuyện</button>}</div></div></section></div>
    </div>
  );

  // ─── Chat screen ──────────────────────────────────────────────────────────────
  return (
    <div className="lf-ai-chat" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Warning banner */}
      {showWarningBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
          background: 'rgba(234,179,8,0.12)', borderBottom: '1px solid rgba(234,179,8,0.3)',
          fontSize: 13,
        }}>
          <span>⚠️ Cuộc hội thoại hiện tại khá dài ({messages.length} tin nhắn). Hãy dọn dẹp để tránh làm chậm hệ thống.</span>
          <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px', marginLeft: 'auto', flexShrink: 0 }}
            onClick={() => { localStorage.removeItem(HISTORY_KEY); setMessages([]); setShowWarningBanner(false); }}>
            🗑️ Dọn dẹp
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px', flexShrink: 0 }}
            onClick={() => setShowWarningBanner(false)}>
            ✕ Bỏ qua
          </button>
        </div>
      )}
      {/* Header */}
      <div className="lf-ai-chat-head" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)', zIndex: 10, gap: 12,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={() => setSessionStarted(false)}>← Về</button>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 20, padding: '4px 12px',
          }}>
            <span style={{ fontSize: 16 }}>{MODES.find(m => m.id === mode)?.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-bright)' }}>
              {MODES.find(m => m.id === mode)?.label}
            </span>
          </div>
          {isSpeaking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22d3ee' }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 14 }}>
                {[1,2,3,2,1].map((h,i) => (
                  <div key={i} style={{
                    width: 3, background: '#22d3ee', borderRadius: 2,
                    height: h * 4, animation: `pulse ${0.4 + i * 0.1}s ease infinite alternate`,
                  }} />
                ))}
              </div>
              Đang đọc...
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            📚 {words.length} từ
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
            <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }} />
            <span>🔊 Tự đọc</span>
          </label>
          <button onClick={() => { speechService.stop(); setIsSpeaking(false); }}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
            ⏹ Dừng
          </button>
          <button onClick={() => { setMessages([]); startSession(); }}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="lf-ai-chat-messages" onMouseUp={handleMouseUp} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex', gap: 12, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
          }}>
            {/* Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: msg.role === 'assistant' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)',
              border: `1px solid ${msg.role === 'assistant' ? 'rgba(99,102,241,0.4)' : 'rgba(16,185,129,0.4)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>
              {msg.role === 'assistant' ? '🤖' : '👤'}
            </div>
            {/* Bubble */}
            <div style={{ maxWidth: '72%' }}>
              <div className="lf-ai-bubble"
                data-role={msg.role}
                style={{
                  padding: '12px 16px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? 'rgba(99,102,241,0.18)' : 'var(--bg-secondary)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
                  fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)',
                  userSelect: 'text', // Cho phép bôi đen chọn chữ
                }}>
                {msg.isLoading ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)',
                        animation: `pulse 0.8s ease ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                ) : (
                  <div>
                    {msg.role === 'assistant' && !msg.content.startsWith('⚠️') && !msg.content.startsWith('❌') && !msg.content.startsWith('⏳') ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {splitIntoSentences(msg.content).map((sentence, idx) => {
                          const sentenceState = msg.sentenceTranslations?.[idx];
                          const isTranslating = sentenceState?.isLoading;
                          const showTrans = sentenceState?.showTranslation;
                          const transText = sentenceState?.translation;

                          return (
                            <div key={idx} style={{ position: 'relative' }}>
                              <span style={{ marginRight: 6 }}>{sentence}</span>
                              <button 
                                onClick={() => translateSentence(msg.id, idx, sentence)}
                                title="Dịch câu này"
                                style={{
                                  background: showTrans ? 'rgba(99,102,241,0.2)' : 'transparent',
                                  border: 'none',
                                  borderRadius: 4,
                                  padding: '2px 6px',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  verticalAlign: 'middle',
                                  color: showTrans ? 'var(--accent-bright)' : 'var(--text-muted)',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                                onMouseLeave={e => {
                                  if (!showTrans) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                🌐
                              </button>

                              {showTrans && (
                                <div 
                                  data-is-translation="true"
                                  style={{
                                    marginTop: 6,
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    background: 'rgba(34, 211, 238, 0.08)',
                                    borderLeft: '3px solid #22d3ee',
                                    color: '#22d3ee',
                                    fontSize: 12.5,
                                    lineHeight: 1.5,
                                    animation: 'fadeIn 0.2s ease',
                                  }}>
                                  {isTranslating ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                      <span style={{
                                        width: 10,
                                        height: 10,
                                        border: '1.5px solid rgba(255,255,255,0.3)',
                                        borderTop: '1.5px solid #22d3ee',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite',
                                        display: 'inline-block'
                                      }} />
                                      Đang dịch...
                                    </span>
                                  ) : (
                                    transText
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div>{msg.content}</div>
                    )}
                    
                    {msg.showTranslation && msg.translatedContent && (
                      <div 
                        data-is-translation="true"
                        style={{
                          marginTop: 10,
                          paddingTop: 10,
                          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#22d3ee',
                          fontSize: 13,
                          lineHeight: 1.5,
                          animation: 'fadeIn 0.2s ease',
                        }}>
                        {msg.translatedContent}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Speak & Translate buttons per message */}
              {!msg.isLoading && msg.role === 'assistant' && (
                <div className="lf-ai-bubble-actions" style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => speakText(msg.content)} style={{
                    padding: '3px 8px', fontSize: 10, borderRadius: 10,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 4
                  }}>🔊 Nghe lại</button>
                  <button onClick={() => translateMessage(msg.id, msg.content)} style={{
                    padding: '3px 8px', fontSize: 10, borderRadius: 10,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: msg.showTranslation ? 'var(--accent-bright)' : 'var(--text-muted)', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 4
                  }}>🌐 {msg.showTranslation ? 'Ẩn dịch' : 'Dịch nghĩa'}</button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length <= 2 && (
        <div className="lf-ai-suggestions" style={{ padding: '0 24px 10px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(mode === 'chat'
            ? ["Tell me about your day", "Let's talk about business", "What's your opinion on technology?", "Can we practice job interviews?"]
            : mode === 'writing'
            ? ["Please correct this: I go to office yesterday", "Help me write a professional email", "Check my grammar: She don't likes coffee"]
            : ["Let's talk about my hobbies", "I want to practice introductions", "Can we do a job interview?"]
          ).map(prompt => (
            <button key={prompt} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
              style={{
                padding: '6px 12px', fontSize: 12, borderRadius: 16,
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}>
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Translator helper panel */}
      <div className="lf-ai-helper-toggle" style={{ padding: '0 20px 8px', display: 'flex', justifyContent: 'flex-start' }}>
        <button
          onClick={() => setShowTranslatorHelper(prev => !prev)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 14,
            border: `1px solid ${showTranslatorHelper ? 'var(--accent)' : 'var(--border)'}`,
            background: showTranslatorHelper ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
            color: showTranslatorHelper ? 'var(--accent-bright)' : 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            if (!showTranslatorHelper) e.currentTarget.style.borderColor = 'var(--border-bright)';
          }}
          onMouseLeave={e => {
            if (!showTranslatorHelper) e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <span>💡</span>
          <span>{showTranslatorHelper ? 'Ẩn trợ lý dịch Việt ➔ Anh' : 'Trợ lý dịch Việt ➔ Anh'}</span>
        </button>
      </div>

      {showTranslatorHelper && (
        <div className="lf-ai-helper-panel" style={{
          margin: '0 20px 12px',
          padding: 14,
          background: 'rgba(26, 26, 53, 0.6)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                Nhập từ/câu tiếng Việt cần dịch:
              </label>
              <input
                type="text"
                value={translatorInput}
                onChange={e => setTranslatorInput(e.target.value)}
                placeholder="Ví dụ: tôi đi học muộn ngày hôm qua..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-primary)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                Bản dịch tiếng Anh tương ứng:
              </label>
              <div style={{
                flex: 1,
                padding: '8px 12px',
                background: 'rgba(13, 13, 26, 0.4)',
                border: '1.5px solid var(--border)',
                borderRadius: 8,
                color: translatorOutput ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 13,
                lineHeight: 1.4,
                minHeight: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}>
                <span style={{ flex: 1, overflowWrap: 'anywhere' }}>
                  {isTranslatingHelper ? (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        border: '1.5px solid rgba(255,255,255,0.3)',
                        borderTop: '1.5px solid var(--accent)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        display: 'inline-block',
                      }} />
                      Đang dịch...
                    </span>
                  ) : (
                    translatorOutput || 'Chờ nhập tiếng Việt...'
                  )}
                </span>
                {translatorOutput && !isTranslatingHelper && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={handleCopyHelperOutput}
                      title="Sao chép"
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      {helperCopied ? '✓ Đã copy' : '📋 Copy'}
                    </button>
                    <button
                      onClick={handleInsertHelperOutput}
                      title="Chèn thẳng vào ô chat"
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        borderRadius: 6,
                        border: '1px solid var(--accent)',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: 'var(--accent-bright)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
                    >
                      📥 Chèn
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="lf-ai-composer" style={{ padding: '12px 20px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            className="lf-ai-message-input" ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'chat' ? 'Viết câu tiếng Anh của bạn...'
              : mode === 'writing' ? 'Viết câu hoặc đoạn tiếng Anh cần góp ý...'
              : 'Nói hoặc nhập điều bạn muốn luyện...'
            }
            rows={2}
            style={{
              flex: 1, padding: '12px 14px', background: 'var(--bg-primary)',
              border: '2px solid var(--border)', borderRadius: 12,
              color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14,
              outline: 'none', resize: 'none', lineHeight: 1.5,
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
          <button onClick={isListening ? stopListening : startListening}
            title="Nói để nhập văn bản"
            style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${isListening ? '#ef4444' : 'var(--border)'}`,
              background: isListening ? 'rgba(239,68,68,0.15)' : 'var(--bg-primary)',
              color: isListening ? '#ef4444' : 'var(--text-secondary)',
              fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: isListening ? 'pulse 1s ease infinite' : 'none',
            }}>
            {isListening ? '⏹' : '🎤'}
          </button>
          <button onClick={sendMessage} disabled={isLoading || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && !isLoading ? 'var(--accent)' : 'var(--bg-secondary)',
              border: 'none', color: '#fff', fontSize: 18, cursor: input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: input.trim() && !isLoading ? 1 : 0.4, transition: 'all 0.2s',
            }}>
            ↑
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Enter gửi • Shift+Enter xuống dòng • 🎤 để nói</span>
          {isCheckingGrammar && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-bright)' }}>
              <span className="spinner-small" style={{
                width: 10, height: 10, border: '1.5px solid transparent', borderTopColor: 'currentColor',
                borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite'
              }} />
              Đang check ngữ pháp...
            </span>
          )}
        </div>

        {/* Real-time Grammar Checker Banner */}
        {!isCheckingGrammar && grammarResult && grammarResult.hasError && (
          <div style={{
            marginTop: 8, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
            fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fca5a5', fontWeight: 600 }}>
              <span>⚠️ Có thể sai ngữ pháp:</span>
            </div>
            <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>
              Gợi ý sửa: <strong style={{ color: '#86efac' }}>{grammarResult.correctedText}</strong>
            </div>
            {grammarResult.explanation && (
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontStyle: 'italic', marginTop: 2 }}>
                💡 {grammarResult.explanation}
              </div>
            )}
            <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', marginTop: 6, padding: '4px 10px', fontSize: 11 }}
              onClick={() => { setInput(grammarResult.correctedText); setGrammarResult(null); }}>
              ✍️ Áp dụng gợi ý sửa
            </button>
          </div>
        )}
        {!isCheckingGrammar && grammarResult && !grammarResult.hasError && (
          <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, textAlign: 'right' }}>
            ✓ Ngữ pháp chuẩn xác!
          </div>
        )}
      </div>

      {/* Floating selection translation tooltip */}
      {selectionCoords && (
        <div
          id="selection-translation-tooltip"
          style={{
            position: 'fixed',
            left: selectionCoords.x,
            top: tooltipPosition === 'top' ? selectionCoords.y - 12 : selectionCoords.y + 12,
            transform: tooltipPosition === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 9999,
            background: 'rgba(26, 26, 53, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(129, 140, 248, 0.4)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(99, 102, 241, 0.3)',
            borderRadius: '10px',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxWidth: '280px',
            minWidth: '180px',
            pointerEvents: 'auto',
            animation: tooltipPosition === 'top' 
              ? 'slideUp 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              : 'slideDown 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <style>{`
            @keyframes slideDown {
              from { transform: translate(-50%, -10px); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translate(-50%, 10px); opacity: 0; }
              to { transform: translate(-50%, -100%); opacity: 1; }
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {/* Header with Word & Pronounce button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <span style={{
                fontWeight: 600,
                fontSize: '13px',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {selectionText}
              </span>
              {selectionPhonetic && (
                <span style={{ fontSize: '11px', color: 'var(--accent-bright)', fontStyle: 'italic', marginTop: 1 }}>
                  {selectionPhonetic}
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                speechService.speak(selectionText);
              }}
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--accent-bright)',
                fontSize: '11px',
                padding: 0,
                flexShrink: 0
              }}
              title="Phát âm"
            >
              🔊
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '2px 0' }} />

          {/* Translation content */}
          <div style={{ fontSize: '12px', color: '#22d3ee', fontWeight: 500, lineHeight: 1.4 }}>
            {isTranslatingSelection ? (
              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  borderTop: '1.5px solid var(--accent)',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'pulse 0.8s ease infinite'
                }} />
                Đang dịch...
              </span>
            ) : (
              selectionTranslation
            )}
          </div>
        </div>
      )}
    </div>
  );
}
