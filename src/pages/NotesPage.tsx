import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Plus, Search, Trash2, RotateCcw, Download, Save, Mic, Square, Send, Sparkles, ShieldCheck, FileText, Undo2, FolderOpen, Settings, User } from 'lucide-react';
import { LocalNote, NoteMessage, NotesStorageStatus, notesRequest, exportNote } from '../services/notes';
import { useLocalDictation } from '../hooks/useLocalDictation';
import { registerMicrophoneShortcut } from '../services/microphoneShortcut';
import { notify } from '../components/Feedback/ToastHost';
import './NotesPage.css';

type Form = {title: string; content: string};
const chatKey = 'lexforge-assistant-conversation-v1';
const draftKey = (id: string) => `lexforge-note-draft-${id}`;
export default function NotesPage() {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [selected, setSelected] = useState<LocalNote | null>(null);
  const [form, setForm] = useState<Form>({title:'',content:''});
  const [messages, setMessages] = useState<NoteMessage[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(chatKey) || '[]');
      return Array.isArray(saved) ? saved.filter(message => message && ['user','assistant'].includes(message.role) && typeof message.content === 'string' && message.content.length <= 212200).slice(-40) : [];
    } catch { return []; }
  });
  const [attachNote, setAttachNote] = useState(false);
  const messageEnd = useRef<HTMLDivElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const operationRunning = useRef(false);
  const restorePromptFocus = useRef(false);
  const [prompt, setPrompt] = useState('');
  const [search, setSearch] = useState('');
  const [trash, setTrash] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storage, setStorage] = useState<NotesStorageStatus | null>(null);
  const [folderInput, setFolderInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15);
  const [dictationTarget, setDictationTarget] = useState<'note'|'prompt'>('prompt');
  const target = useRef<'note'|'prompt'>('prompt');
  const promptMic = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const dirty = !!selected && (form.title !== selected.title || form.content !== selected.content);
  const dictation = useLocalDictation(text => {
    if (target.current === 'note') setForm(previous => ({...previous, content:[previous.content,text].filter(Boolean).join('\n')}));
    else setPrompt(previous => [previous,text].filter(Boolean).join(' '));
  }, 'auto');
  const recordingBusy = dictation.isListening || dictation.isTranscribing;
  const locked = busy || recordingBusy;

  const refresh = async (deleted = trash) => {
    const rows = await notesRequest<LocalNote[]>('list',{deleted});
    if (alive.current) setNotes(rows);
    return rows;
  };
  const loadNote = async (note: LocalNote) => {
    setSelected(note); setForm({title:note.title,content:note.content});
    localStorage.setItem('lexforge-note-selection',note.id);
    if (!note.deleted) {
      try { const draft=JSON.parse(localStorage.getItem(draftKey(note.id)) || 'null');
        if (draft && typeof draft.title === 'string' && typeof draft.content === 'string') setForm({title:draft.title,content:draft.content});
      } catch { /* A malformed draft must not hide saved notes. */ }
    }
  };
  useEffect(() => {
    alive.current=true;
    (async () => { try {
      const location=await notesRequest<NotesStorageStatus>('storageStatus');
      if(!alive.current)return;
      setStorage(location);setFolderInput(location.directory);
      if(!location.valid){setSettingsOpen(true);return;}
      const rows=await refresh(false);
      const last=rows.find(note=>note.id===localStorage.getItem('lexforge-note-selection')) || rows[0];
      if(last && alive.current) await loadNote(last);
    } catch(e:any) {if(alive.current)setError(e.message);} finally {if(alive.current)setLoading(false);} })();
    return () => {alive.current=false;};
  }, []);
  useEffect(() => {
    let stopped=false;
    const check = async () => {
      try {const status=await notesRequest<NotesStorageStatus>('storageStatus');if(!stopped){setStorage(status);if(status.valid){const rows=await notesRequest<LocalNote[]>('list',{deleted:trash});if(!stopped)setNotes(rows);}}} catch (error:any) { if(!stopped)setError(error.message); }
    };
    const timer=setInterval(check,5000);
    window.addEventListener('focus',check);
    return () => {stopped=true;clearInterval(timer);window.removeEventListener('focus',check);};
  }, [trash]);
  useEffect(() => {
    if (!selected || selected.deleted) return;
    try {
      if (dirty) localStorage.setItem(draftKey(selected.id),JSON.stringify(form));
      else localStorage.removeItem(draftKey(selected.id));
    } catch { setError('Không lưu được bản nháp. Hãy bấm Lưu để ghi ra file TXT.'); }
  }, [selected?.id, form.title, form.content, dirty]);
  useEffect(() => {if(!selected||selected.deleted)setAttachNote(false);}, [selected?.id,selected?.deleted]);
  useEffect(() => {
    try {localStorage.setItem(chatKey, JSON.stringify(messages));}
    catch {setError('Không lưu được hội thoại trên máy. Nội dung vẫn còn trong phiên này.');}
    messageEnd.current?.scrollIntoView({block:'nearest'});
  }, [messages]);
  useEffect(() => registerMicrophoneShortcut(() => promptMic.current?.click()), []);
  useEffect(() => {
    const onKey = (event:KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase()==='s') {event.preventDefault(); if(!locked && dirty) void run(save);}
    };
    window.addEventListener('keydown',onKey);
    return () => window.removeEventListener('keydown',onKey);
  });
  const run = async (operation:()=>Promise<any>) => {
    if(locked||operationRunning.current)return;
    operationRunning.current=true;
    setBusy(true);setError('');
    try {await operation();} catch(e:any){setError(e.message);} finally {operationRunning.current=false;if(alive.current)setBusy(false);}
  };
  const save = async () => {
    if(!selected || selected.deleted || !dirty)return selected;
    if(!storage?.valid)throw new Error(storage?.error || 'Hãy chọn thư mục lưu hợp lệ trước khi lưu.');
    const saved=await notesRequest<LocalNote>('update',{id:selected.id,...form,expectedRevision:selected.revision});
    localStorage.removeItem(draftKey(saved.id));setSelected(saved);setForm({title:saved.title,content:saved.content});await refresh();
    return saved;
  };
  const select = (note:LocalNote) => void run(async()=>{await save();await loadNote(await notesRequest<LocalNote>('get',{id:note.id}));});
  const create = () => void run(async()=>{
    await save();const note=await notesRequest<LocalNote>('create',{title:'Ghi chú mới',content:''});
    setSearch('');setVisibleCount(15);setTrash(false);await refresh(false);await loadNote(note);
  });
  const saveAsNew = () => void run(async()=>{
    if(!selected || selected.deleted)return;
    const note=await notesRequest<LocalNote>('create',{...form});
    localStorage.removeItem(draftKey(selected.id));
    setSearch('');setVisibleCount(15);setTrash(false);await refresh(false);await loadNote(note);
    notify('Đã lưu thành ghi chú mới. Ghi chú cũ vẫn được giữ.','success');
  });
  const changeTrash = (deleted:boolean) => void run(async()=>{
    await save();setVisibleCount(15);setTrash(deleted);setSelected(null);setForm({title:'',content:''});
    const rows=await refresh(deleted);if(rows[0])await loadNote(rows[0]);
  });
  const changeNote = (operation:'trash'|'restore'|'undo') => void run(async()=>{
    if(!selected)return;
    const current=await save();
    const note=await notesRequest<LocalNote>(operation,{id:current!.id,expectedRevision:current!.revision});
    if(operation==='undo'){await loadNote(note);await refresh();}
    else {localStorage.removeItem(draftKey(note.id));setSelected(null);const rows=await refresh();if(rows[0])await loadNote(rows[0]);}
  });
  const chooseFolder = () => void run(async () => {
    const chosen=await notesRequest<string | null>('storageChoose');
    if(chosen)setFolderInput(chosen);
  });
  const applyFolder = () => void run(async () => {
    if(storage?.valid)await save();
    const location=await notesRequest<NotesStorageStatus>('storageSet',{directory:folderInput.trim()});
    setStorage(location);setFolderInput(location.directory);setSearch('');setVisibleCount(15);setTrash(false);
    setSelected(null);setForm({title:'',content:''});
    const rows=await refresh(false);
    const last=rows.find(note=>note.id===selected?.id)||rows[0];
    if(last)await loadNote(last);
    notify('Đã áp dụng thư mục lưu. Toàn bộ ghi chú được giữ lại.','success');
  });
  useEffect(() => {
    if(!locked&&restorePromptFocus.current){restorePromptFocus.current=false;promptInput.current?.focus();}
  }, [locked]);
  const sendAI = () => void run(async()=>{
    if(!prompt.trim())return;
    restorePromptFocus.current=true;
    const current=attachNote ? await save() : null;
    if(attachNote && (!current || current.deleted))throw new Error('Hãy chọn một ghi chú đang hoạt động để đính kèm.');
    const request=prompt.trim();
    const history=messages.slice(-12).map(({role,content})=>({role,content:content.slice(0,12000)}));
    const result=await notesRequest<{note:LocalNote|null;reply:string;action:string;warning:string}>('assist',{noteId:current?.id,prompt:request,history});
    const now=Date.now();
    setMessages(previous=>[...previous,{id:now,noteId:'',role:'user' as const,content:request,createdAt:new Date().toISOString()},{id:now+1,noteId:'',role:'assistant' as const,content:result.reply,createdAt:new Date().toISOString()}].slice(-40));
    setPrompt('');
    if(result.note && result.action!=='answer'){setSearch('');setVisibleCount(15);setTrash(false);await refresh(false);await loadNote(result.note);}
    if(result.warning)notify(result.warning,'error');
    else if(result.action!=='answer')notify(result.action==='create'?'Đã tạo và lưu note.':'Đã cập nhật và lưu note.','success');
  });
  const toggleMicrophone = (where:'note'|'prompt') => {
    if(busy||dictation.isTranscribing)return;
    if(dictation.isListening){dictation.stop();return;}
    target.current=where;setDictationTarget(where);void dictation.start();
  };
  const filtered=notes.filter(note=>`${note.title}\n${note.content}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const shown=filtered.slice(0,visibleCount);
  const microphoneLabel = (where:'note'|'prompt') => dictationTarget===where && dictation.isTranscribing?'Đang nhận dạng…':dictationTarget===where && dictation.isListening?'Dừng ghi âm':'Nhập giọng nói';
  return <div className="lf-notes">
    <header className="lf-notes-heading"><div><span className="lf-notes-eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Ghi chú <em>& trợ lý</em></h1><p>Ghi lại ý tưởng, rồi cùng AI làm rõ điều quan trọng.</p></div><div className="lf-notes-heading-actions"><span className="lf-notes-local"><ShieldCheck size={16}/> File TXT trên máy</span><button className="lf-notes-options" aria-expanded={settingsOpen} aria-controls="notes-storage-settings" onClick={()=>setSettingsOpen(open=>!open)}><Settings size={18}/> Tùy chọn</button></div></header>
    {error && <div className="lf-notes-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Đóng lỗi">×</button></div>}
    {!settingsOpen && storage && !storage.valid && <div className="lf-notes-storage-invalid" role="alert"><strong>Thư mục lưu chưa sẵn sàng.</strong> {storage.error} <button onClick={()=>setSettingsOpen(true)}>Mở tùy chọn lưu</button></div>}
    {settingsOpen && <section id="notes-storage-settings" className="lf-notes-storage" aria-labelledby="notes-storage-title">
      <div className="lf-notes-storage-heading"><FolderOpen size={22}/><div><h2 id="notes-storage-title">Thư mục lưu ghi chú</h2><p>Mỗi ghi chú là một <strong>file .txt riêng</strong>. Lịch sử và hội thoại nằm trong thư mục phụ <strong>.lexforge-notes</strong>.</p></div></div>
      <label htmlFor="notes-storage-path">Đường dẫn thư mục</label>
      <div className="lf-notes-storage-controls"><input id="notes-storage-path" value={folderInput} onChange={event=>setFolderInput(event.target.value)} disabled={locked} placeholder="Ví dụ: D:\GhiChu"/><button onClick={chooseFolder} disabled={locked}><FolderOpen size={17}/> Chọn thư mục</button><button className="lf-notes-primary" onClick={applyFolder} disabled={locked||!folderInput.trim()}>Áp dụng thư mục</button></div>
      <p className="lf-notes-storage-current"><strong>Kho đang dùng:</strong> <span>{storage?.directory || 'Đang kiểm tra…'}</span></p>
      <small>Đổi thư mục sẽ chép toàn bộ kho hiện tại sang vị trí mới và giữ bản cũ. Không ghi đè kho đã có. Thư mục phải tồn tại trước khi áp dụng.</small>
      {storage && !storage.valid && <div className="lf-notes-storage-invalid" role="alert"><strong>Chưa thể lưu ghi chú.</strong> {storage.error} Hãy kết nối lại ổ đĩa hoặc chọn thư mục khác. Bản nháp hiện tại vẫn ở trên máy.</div>}
      <div className="lf-notes-privacy"><ShieldCheck size={15}/><p>Ghi âm xử lý trên máy. Bấm <b>Gửi AI</b> sẽ gửi yêu cầu và chat gần đây tới Groq. Note chỉ đính kèm khi bạn bật đính kèm; nội dung đã chia sẻ vẫn có trong chat.</p></div>
      <p className="lf-notes-storage-current">Chat giữ 40 tin gần nhất trên máy. Enter để gửi, Shift+Enter để xuống dòng. Ctrl+Shift+M bật/tắt micro.</p>
    </section>}
    <div className="lf-notes-workspace">
      <aside className="lf-notes-library" aria-label="Danh sách ghi chú">
        <div className="lf-notes-library-top"><strong>Thư viện <span className="lf-notes-count">{notes.length} {trash?'đã xóa':'ghi chú'}</span></strong><button onClick={create} disabled={locked||loading||!storage?.valid} title="Tạo ghi chú mới" aria-label="Tạo ghi chú mới"><Plus size={19}/> Ghi chú mới</button></div>
        <label className="lf-notes-search"><Search size={16}/><input value={search} onChange={event=>{setSearch(event.target.value);setVisibleCount(15);}} placeholder="Tìm trong ghi chú…" aria-label="Tìm ghi chú"/></label>
        <div className="lf-notes-tabs"><button className={!trash?'active':''} disabled={locked} onClick={()=>changeTrash(false)}><FileText size={14}/> Ghi chú</button><button className={trash?'active':''} disabled={locked} onClick={()=>changeTrash(true)}><Trash2 size={14}/> Thùng rác</button></div>
        <p className="lf-notes-recent-caption">{search?'Kết quả tìm kiếm':'15 ghi chú gần nhất'} · {shown.length}/{filtered.length}</p>
        <div className="lf-notes-list">{loading?<p>Đang mở thư viện…</p>:shown.length?shown.map(note=><button key={note.id} className={`lf-note-item ${note.id===selected?.id?'selected':''}`} disabled={locked} onClick={()=>select(note)}><strong>{note.title}</strong><span>{note.content.slice(0,100)||'Chưa có nội dung'}</span><small>{new Date(note.updatedAt).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></button>):<div className="lf-notes-list-empty"><BookOpen size={24}/><p>{search?'Không tìm thấy ghi chú.':trash?'Thùng rác đang trống.':'Một ý tưởng đáng để giữ lại? Tạo ghi chú đầu tiên.'}</p></div>}{filtered.length>shown.length&&<button className="lf-notes-load-more" onClick={()=>setVisibleCount(count=>count+15)}>Xem thêm 15 ghi chú</button>}</div>
        <small className="lf-notes-library-foot">File TXT local · Không đồng bộ cloud</small>
      </aside>
      <section className="lf-notes-editor" aria-label="Trình sửa ghi chú">
        {selected?<><div className="lf-notes-editor-toolbar"><span className={dirty?'lf-note-draft':''}>{!storage?.valid?'Thư mục lưu chưa sẵn sàng':selected.deleted?'Trong thùng rác':dirty?'Bản nháp · Ctrl+S để cập nhật note này':'Đã lưu trên máy'}</span><div>
          <button title="Tải bản TXT" aria-label="Tải bản TXT" disabled={locked} onClick={()=>void run(async()=>{const note=await save();if(note)exportNote(note);})}><Download size={17}/></button>
          {!selected.deleted&&<button title="Hoàn tác bản lưu gần nhất" aria-label="Hoàn tác bản lưu gần nhất" disabled={locked||dirty||!storage?.valid} onClick={()=>changeNote('undo')}><Undo2 size={17}/></button>}
          <button title={selected.deleted?'Khôi phục ghi chú':'Chuyển vào thùng rác'} aria-label={selected.deleted?'Khôi phục ghi chú':'Chuyển vào thùng rác'} disabled={locked||!storage?.valid} onClick={()=>changeNote(selected.deleted?'restore':'trash')}>{selected.deleted?<RotateCcw size={17}/>:<Trash2 size={17}/>}</button>
        </div></div>
        <label className="lf-notes-title-label"><span>Tiêu đề</span><input value={form.title} maxLength={180} readOnly={locked||!!selected.deleted} onChange={event=>setForm({...form,title:event.target.value})} placeholder="Đặt tên cho ý tưởng…"/></label>
        <label className="lf-notes-content-label"><span>Nội dung ghi chú · văn bản TXT</span><textarea value={form.content} maxLength={200000} readOnly={locked||!!selected.deleted} onChange={event=>setForm({...form,content:event.target.value})} placeholder="Viết tự do, ghi bằng giọng nói hoặc nhờ trợ lý sắp xếp ý tưởng…"/></label>
        {!selected.deleted&&<footer className="lf-notes-editor-footer"><button disabled={busy||dictation.isTranscribing} className={dictation.isListening&&dictationTarget==='note'?'recording':''} onClick={()=>toggleMicrophone('note')}>{dictation.isListening&&dictationTarget==='note'?<Square size={16}/>:<Mic size={16}/>} {microphoneLabel('note')}</button><button disabled={locked||!storage?.valid} onClick={saveAsNew} title="Tạo note riêng từ nội dung hiện tại"><Plus size={16}/> Lưu thành ghi chú mới</button><button className="lf-notes-primary" aria-label="Lưu ghi chú hiện tại" disabled={locked||!dirty||!storage?.valid} onClick={()=>void run(save)}><Save size={16}/> Lưu <kbd>Ctrl S</kbd></button></footer>}</>:<div className="lf-notes-editor-empty"><div><FileText size={32}/></div><h2>Chỗ cho ý tưởng tiếp theo</h2><p>Tạo một ghi chú, hoặc yêu cầu trợ lý tạo giúp bạn. Nội dung được lưu trên máy của bạn.</p><button className="lf-notes-primary" disabled={locked||loading||!storage?.valid} onClick={create}><Plus size={16}/> Tạo ghi chú</button></div>}
      </section>
      <section className="lf-notes-assistant" aria-label="Trợ lý AI">
        <header><span className="lf-notes-ai-icon"><Sparkles size={20}/></span><div><strong>Trợ lý AI</strong>{attachNote&&selected&&<small>{`Đính kèm: ${selected.title}`}</small>}</div><button className="lf-notes-new-chat" disabled={locked||!messages.length} onClick={()=>{setMessages([]);setAttachNote(false);}} title="Xóa hội thoại hiện tại để bắt đầu mới" aria-label="Hội thoại mới"><Plus size={18}/></button></header>
        <div className="lf-notes-messages" aria-live="polite">{messages.length?messages.map(message=><div key={message.id} className={`lf-notes-message ${message.role}`}><div className="lf-notes-message-author"><span className="lf-notes-message-avatar" aria-hidden="true">{message.role==='user'?<User size={16}/>:<Sparkles size={16}/>}</span><strong>{message.role==='user'?'Bạn':'Trợ lý AI'}</strong></div><p>{message.content}</p></div>):<div className="lf-notes-ai-empty"><h3>Bạn cần tôi giúp gì?</h3></div>}{busy&&<p className="lf-notes-working" role="status">Đang xử lý…</p>}<div ref={messageEnd}/></div>
        <div className="lf-notes-prompt"><label className="lf-notes-attach"><input type="checkbox" checked={attachNote} disabled={locked||!selected||!!selected.deleted||!storage?.valid} onChange={event=>setAttachNote(event.target.checked)}/> Đính kèm note đang chọn</label><textarea ref={promptInput} id="notes-prompt" aria-label="Nhập yêu cầu cho trợ lý" title="Enter để gửi · Shift+Enter để xuống dòng" value={prompt} maxLength={40000} disabled={locked} onChange={event=>setPrompt(event.target.value)} onKeyDown={event=>{
          if(event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return;
          event.preventDefault();
          if(!event.repeat&&!locked&&prompt.trim())sendAI();
        }}/><div><button ref={promptMic} aria-keyshortcuts="Control+Shift+M" disabled={busy||dictation.isTranscribing} onClick={()=>toggleMicrophone('prompt')} title="Ctrl + Shift + M" aria-label={microphoneLabel('prompt')} className={dictation.isListening&&dictationTarget==='prompt'?'recording':''}>{dictation.isListening&&dictationTarget==='prompt'?<Square size={17}/>:<Mic size={17}/>}</button><button className="lf-notes-primary" disabled={locked||!prompt.trim()} onClick={sendAI}><Send size={16}/> Gửi AI</button></div></div>
      </section>
    </div>
  </div>;
}
