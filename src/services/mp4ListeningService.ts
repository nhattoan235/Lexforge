import { db } from './database';

export interface TranscriptChunk {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface ListeningQuestion {
  id: string;
  start: number;
  end: number;
  script: string;
  englishOptions: string[];
  vietnameseCorrect: string;
  vietnameseOptions: string[];
}

interface GroqSegment {
  start?: number;
  end?: number;
  text?: string;
}

interface CleanSegment {
  id: string;
  start: number;
  end: number;
  text: string;
}

const GROQ_AUDIO_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

function isQuestionPrompt(text: string) {
  const value = normalize(text).toLowerCase();
  return /\b(?:number|question)\s+\d+\b/.test(value)
    || /^what\s+(?:are|is|does|do|will|did)\b/.test(value)
    || /^where\s+(?:are|is|does|do|will|did)\b/.test(value)
    || /^who\s+(?:are|is|does|do|will|did)\b/.test(value)
    || /^why\s+(?:are|is|does|do|will|did)\b/.test(value)
    || /^how\s+(?:are|is|does|do|will|did|many|much)\b/.test(value);
}

const uniqueOptions = (correct: string, distractors: string[]) => {
  const seen = new Set<string>();
  const options = [correct, ...distractors]
    .map(normalize)
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  while (options.length < 4) {
    options.push(`None of the above ${options.length}`);
  }

  return shuffle(options.slice(0, 4));
};

function stripWorkbookMeta(text: string) {
  let value = normalize(text);

  value = value
    .replace(/^questions?\s+\d+(?:\s*(?:through|to|-)\s*\d+)?\s+(?:refer to|are based on)?\s*(?:the following)?\s*(?:conversation|talk|announcement|passage|recording|interview)?\.?\s*/i, '')
    .replace(/^you will hear\s+(?:a|an|the)?\s*(?:conversation|talk|announcement|passage|recording|interview)?\.?\s*/i, '')
    .replace(/^listen to\s+(?:a|an|the)?\s*(?:conversation|talk|announcement|passage|recording|interview)?\.?\s*/i, '')
    .replace(/^directions?[:.]?\s*/i, '')
    .replace(/^part\s+\d+[:.]?\s*/i, '')
    .replace(/^unit\s+\d+[:.]?\s*/i, '')
    .replace(/^exercise\s+\d+[:.]?\s*/i, '');

  value = value
    .split(/\b(?:Question|Number)\s+\d+\b/i)[0]
    .split(/(?=\b(?:A|B|C|D)[.)]\s+)/)[0];

  return normalize(value);
}

function buildChunks(cleanSegments: CleanSegment[]): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];
  let buffer: typeof cleanSegments = [];

  const flush = () => {
    if (!buffer.length) return;
    chunks.push({
      id: `q-${chunks.length + 1}`,
      start: Math.max(0, buffer[0].start - 0.15),
      end: buffer[buffer.length - 1].end + 0.25,
      text: normalize(buffer.map(s => s.text).join(' ')),
    });
    buffer = [];
  };

  for (const segment of cleanSegments) {
    buffer.push(segment);
    const duration = buffer[buffer.length - 1].end - buffer[0].start;
    const words = buffer.map(s => s.text).join(' ').split(/\s+/).length;

    if (buffer.length >= 2 || duration >= 12 || words >= 28) {
      flush();
    }
  }

  flush();
  return chunks.filter(c => c.text.split(/\s+/).length >= 3);
}

function isLikelyWorkbookMeta(text: string) {
  const value = normalize(text).toLowerCase();
  if (isQuestionPrompt(value)) return true;
  return [
    /^question\s+\d+/,
    /^number\s+\d+/,
    /^mark your answer/,
    /^look at the/,
    /^listen to/,
    /^now listen/,
    /^you will hear/,
    /^you will be asked/,
    /^directions?/,
    /^part\s+\d+/,
    /^unit\s+\d+/,
    /^exercise\s+\d+/,
    /^choice\s+[a-d]/,
    /^[a-d][.)]\s+/,
  ].some(pattern => pattern.test(value));
}

function selectMainContentByTiming(segments: CleanSegment[]) {
  const firstQuestionIndex = segments.findIndex(s => isQuestionPrompt(s.text));
  const beforeQuestions = firstQuestionIndex > 0
    ? segments.slice(0, firstQuestionIndex)
    : segments;

  const cleaned = beforeQuestions
    .map(s => ({ ...s, text: stripWorkbookMeta(s.text) }))
    .filter(s => s.text && !isLikelyWorkbookMeta(s.text));

  const wordCount = cleaned.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
  return wordCount >= 8 ? cleaned : [];
}

function cleanGroqSegments(segments: GroqSegment[]): CleanSegment[] {
  return segments
    .map((s, idx) => ({
      id: `s-${idx + 1}`,
      start: Number(s.start || 0),
      end: Number(s.end || 0),
      text: stripWorkbookMeta(s.text || ''),
    }))
    .filter(s => s.text && s.end > s.start);
}

async function filterMainContentSegments(
  segments: CleanSegment[],
  apiKey: string,
): Promise<CleanSegment[]> {
  const timingSelection = selectMainContentByTiming(segments);
  if (timingSelection.length) return timingSelection;

  if (segments.length <= 2) return segments;

  const keptIds = new Set<string>();
  const batchSize = 70;

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    const systemPrompt = `You clean transcripts from TOEIC workbook audio.
Keep only the main listening content: the conversation, interview, talk, announcement, voicemail, lecture, or passage learners should listen to.
Remove directions, unit titles, "Questions X through Y refer to...", numbered question prompts, answer choices, explanations, and workbook navigation.

Return only valid JSON:
{ "keptIds": ["s-1", "s-2"] }

Rules:
- Keep natural dialogue/talk content even if it contains questions between speakers.
- Remove quiz questions that ask the learner what/why/where/who after the passage.
- If unsure, keep the segment only when it sounds like part of the actual conversation/talk.`;

    try {
      const response = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify({ segments: batch }) },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) throw new Error(`FILTER_${response.status}`);
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      const parsed = content ? JSON.parse(content) : null;
      const ids = Array.isArray(parsed?.keptIds) ? parsed.keptIds : [];
      ids.forEach((id: string) => keptIds.add(id));
    } catch (err) {
      console.warn('Transcript filter fallback:', err);
      batch.forEach(segment => keptIds.add(segment.id));
    }
  }

  const filtered = segments
    .filter(s => keptIds.has(s.id))
    .map(s => ({ ...s, text: stripWorkbookMeta(s.text) }))
    .filter(s => !isLikelyWorkbookMeta(s.text));

  return filtered.length ? filtered : segments.filter(s => !isLikelyWorkbookMeta(s.text));
}

async function getGroqKey() {
  const keyRes = await db.getSetting('groq_api_key');
  const apiKey = keyRes.success && keyRes.data?.[0]?.SettingValue;
  if (!apiKey || !apiKey.trim()) throw new Error('NO_KEY');
  return apiKey.trim();
}

async function transcribeAudio(file: File, apiKey: string): Promise<CleanSegment[]> {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('language', 'en');
  form.append('timestamp_granularities[]', 'segment');

  const response = await fetch(GROQ_AUDIO_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TRANSCRIBE_${response.status}: ${text.slice(0, 180)}`);
  }

  const data = await response.json();
  const segments = Array.isArray(data.segments) ? data.segments : [];
  const cleanSegments = cleanGroqSegments(segments);
  if (!cleanSegments.length && data.text) {
    return [{
      id: 's-1',
      start: 0,
      end: 12,
      text: stripWorkbookMeta(data.text),
    }];
  }
  return cleanSegments;
}

async function generateQuestionBatch(
  chunks: TranscriptChunk[],
  apiKey: string,
): Promise<ListeningQuestion[]> {
  const compactChunks = chunks.map(c => ({
    id: c.id,
    start: c.start,
    end: c.end,
    script: c.text,
  }));

  const systemPrompt = `You create listening comprehension multiple-choice questions for Vietnamese learners of English.
Return only valid JSON with this exact shape:
{
  "items": [
    {
      "id": "same id from input",
      "englishDistractors": ["wrong option 1", "wrong option 2", "wrong option 3"],
      "vietnameseCorrect": "natural Vietnamese translation of the script",
      "vietnameseDistractors": ["wrong Vietnamese option 1", "wrong Vietnamese option 2", "wrong Vietnamese option 3"]
    }
  ]
}

Rules:
- Keep the original English script as the correct English answer; do not rewrite it.
- English distractors must be plausible, similar length, and clearly not identical.
- Vietnamese distractors must be plausible meanings but clearly wrong.
- Use natural Vietnamese.
- Make exactly 3 distractors for each item.`;

  const response = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ chunks: compactChunks }) },
      ],
      temperature: 0.65,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QUESTION_${response.status}: ${text.slice(0, 180)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('QUESTION_EMPTY_RESPONSE');

  const parsed = JSON.parse(content);
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  return chunks.map(chunk => {
    const item = items.find((x: any) => x.id === chunk.id) || {};
    const vietnameseCorrect = normalize(item.vietnameseCorrect || '');
    const fallbackVi = vietnameseCorrect || `Nghĩa của đoạn: ${chunk.text}`;

    return {
      id: chunk.id,
      start: chunk.start,
      end: chunk.end,
      script: chunk.text,
      englishOptions: uniqueOptions(chunk.text, item.englishDistractors || []),
      vietnameseCorrect: fallbackVi,
      vietnameseOptions: uniqueOptions(fallbackVi, item.vietnameseDistractors || []),
    };
  });
}

export const mp4ListeningService = {
  createLesson: async (file: File): Promise<ListeningQuestion[]> => {
    const apiKey = await getGroqKey();
    const segments = await transcribeAudio(file, apiKey);
    const mainSegments = await filterMainContentSegments(segments, apiKey);
    let chunks = buildChunks(mainSegments).filter(c => !isQuestionPrompt(c.text));
    if (!chunks.length) {
      chunks = buildChunks(selectMainContentByTiming(segments)).filter(c => !isQuestionPrompt(c.text));
    }
    if (!chunks.length) throw new Error('NO_TRANSCRIPT');

    const allQuestions: ListeningQuestion[] = [];
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const questions = await generateQuestionBatch(batch, apiKey);
      allQuestions.push(...questions);
    }

    return allQuestions;
  },
};
