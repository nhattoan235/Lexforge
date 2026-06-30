// src/services/aiVocabService.ts
import { db } from './database';

export interface AIVocabWord {
  english: string;
  vietnamese: string;
  pronunciation: string;
  partOfSpeech: string;
  example: string;
  exampleVi: string;
}

export const CATEGORIES = [
  { id: 'toeic', label: 'TOEIC Vocabulary', icon: '📝', color: '#6366f1' },
  { id: 'ielts', label: 'IELTS Academic', icon: '🎓', color: '#ec4899' },
  { id: 'communication', label: 'Giao tiếp thông dụng', icon: '💬', color: '#10b981' },
];

export const DEFAULT_TOPICS: Record<string, string[]> = {
  toeic: [
    'Business Meetings',
    'Office Communication',
    'Travel & Hospitality',
    'Banking & Finance',
    'Marketing & Sales',
    'Customer Service',
    'Job Interviews',
    'Shipping & Logistics',
  ],
  ielts: [
    'Environment & Ecology',
    'Education & Learning',
    'Technology & Science',
    'Health & Medicine',
    'Art & Culture',
    'Crime & Justice',
    'Media & Advertising',
    'Work & Society',
  ],
  communication: [
    'Daily Routines',
    'Ordering Food at Restaurants',
    'Asking for Directions',
    'Making New Friends',
    'Shopping & Bargaining',
    'Expressing Feelings & Emotions',
    'Hobbies & Free Time',
    'Talking about the Weather',
  ],
};

export const aiVocabService = {
  /**
   * Sinh danh sách 10 từ vựng từ Groq API
   */
  generateWords: async (category: string, topic: string): Promise<AIVocabWord[]> => {
    // 1. Lấy API Key từ Database
    const keyRes = await db.getSetting('groq_api_key');
    const apiKey = keyRes.success && keyRes.data?.[0]?.SettingValue;
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('NO_KEY');
    }

    const catLabel = CATEGORIES.find(c => c.id === category)?.label || category;
    
    const systemPrompt = `You are an expert English vocabulary builder and curriculum developer.
Generate exactly 10 English words or common phrases suitable for:
Category: ${catLabel}
Topic: ${topic}

You MUST return a JSON object with a single key "words" containing an array of 10 objects.
Each word object must have exactly these keys:
- english: (string) the English word or phrase
- vietnamese: (string) Vietnamese meaning
- pronunciation: (string) IPA pronunciation (e.g. /ˌnɪˌɡoʊʃiˈeɪʃn/)
- partOfSpeech: (string) part of speech (e.g., noun, verb, adjective, phrase)
- example: (string) a clear, short example sentence in English using this word/phrase
- exampleVi: (string) natural Vietnamese translation of the example sentence

Keep the response strictly as valid JSON, with NO markdown block formatting (\`\`\`json), NO introduction, and NO trailing explanation.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate 10 words for ${catLabel} - Topic: ${topic}` },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq Vocab Gen Error:', response.status, errText);
      throw new Error(`HTTP_${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('EMPTY_RESPONSE');
    }

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.words) && parsed.words.length > 0) {
        return parsed.words as AIVocabWord[];
      }
      throw new Error('INVALID_JSON_STRUCTURE');
    } catch (e) {
      console.error('Failed to parse vocab response JSON:', content);
      throw new Error('JSON_PARSE_ERROR');
    }
  },

  /**
   * Lưu nhóm từ vựng và 10 từ vào SQLite
   */
  saveGeneratedWordsToDb: async (
    category: string,
    topic: string,
    words: AIVocabWord[]
  ): Promise<{ success: boolean; groupId?: number; error?: string }> => {
    try {
      const catObj = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
      const groupName = `[AI] ${category.toUpperCase()} - ${topic}`;
      const description = `Sinh tự động bằng AI ngày ${new Date().toLocaleDateString('vi-VN')}`;
      
      // Tạo nhóm từ mới
      const groupRes = await db.createGroup(
        groupName,
        description,
        catObj.color,
        catObj.icon
      );

      if (!groupRes.success || !groupRes.data || groupRes.data.length === 0) {
        return { success: false, error: 'Không thể tạo nhóm từ vựng mới.' };
      }

      const newGroupId = groupRes.data[0].Id;

      // Thêm 10 từ vào nhóm mới tạo
      for (const w of words) {
        await db.createWord({
          groupId: newGroupId,
          english: w.english,
          vietnamese: w.vietnamese,
          pronunciation: w.pronunciation,
          partOfSpeech: w.partOfSpeech,
          example: w.example,
          exampleVi: w.exampleVi,
        });
      }

      return { success: true, groupId: newGroupId };
    } catch (err: any) {
      console.error('Lỗi khi lưu từ vào DB:', err);
      return { success: false, error: err.message || 'Lỗi không xác định.' };
    }
  },

  /**
   * Tra cứu nghĩa của một từ tiếng Anh bằng AI (Groq API).
   * Trả về nghĩa tiếng Việt phổ biến, phát âm IPA, từ loại, ví dụ.
   */
  lookupWord: async (english: string): Promise<{
    vietnamese: string;
    pronunciation: string;
    partOfSpeech: string;
    example: string;
    exampleVi: string;
  }> => {
    const keyRes = await db.getSetting('groq_api_key');
    const apiKey = keyRes.success && keyRes.data?.[0]?.SettingValue;

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('NO_KEY');
    }

    const systemPrompt = `You are an expert English-Vietnamese dictionary.
Given an English word or phrase, provide:
- vietnamese: 1–2 most common Vietnamese meanings, separated by comma
- pronunciation: IPA pronunciation (e.g. /əˈkɒmplɪʃ/)
- partOfSpeech: the part of speech in English (e.g. noun, verb, adjective, phrase)
- example: a clear, short example sentence in English using this word
- exampleVi: natural Vietnamese translation of the example sentence

Return ONLY a valid JSON object with exactly these 5 keys. No markdown, no introduction, no extra text.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Look up: ${english}` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq Lookup Error:', response.status, errText);
      throw new Error(`HTTP_${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('EMPTY_RESPONSE');
    }

    try {
      const parsed = JSON.parse(content);
      return {
        vietnamese: parsed.vietnamese || '',
        pronunciation: parsed.pronunciation || '',
        partOfSpeech: parsed.partOfSpeech || '',
        example: parsed.example || '',
        exampleVi: parsed.exampleVi || '',
      };
    } catch (e) {
      console.error('Failed to parse lookup response JSON:', content);
      throw new Error('JSON_PARSE_ERROR');
    }
  },
};
