export interface NotesStorageStatus { directory: string; filePath: string; valid: boolean; error: string; format?: 'txt'; }
export interface LocalNote { id: string; title: string; content: string; revision: number; deleted: number; createdAt: string; updatedAt: string; }
export interface NoteMessage { id: number; noteId: string; role: 'user' | 'assistant'; content: string; createdAt: string; }
export async function notesRequest<T>(operation: string, args: object = {}): Promise<T> {
  const request = (window as any).electronAPI?.notesRequest;
  if (!request) throw new Error('Hãy thoát Lexforge ở khay hệ thống rồi mở lại để nạp tính năng Ghi chú.');
  const result = await request(operation, args);
  if (!result.success) throw new Error(result.error || 'Không xử lý được ghi chú.');
  return result.data;
}
export function exportNote(note: Pick<LocalNote, 'title' | 'content' | 'createdAt'>) {
  const file = new Blob([note.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a'); anchor.href = url;
  const summary = (note.content.trim() || note.title).normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/^[#*\s-]+/, '').split(/\s+/).slice(0, 8).join(' ').slice(0, 60).replace(/[. ]+$/g, '') || 'ghi-chu';
  const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(note.createdAt)).replace(/\//g, '-');
  anchor.download = `${summary}_${date}.txt`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
