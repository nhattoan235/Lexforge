import React,{useEffect,useRef,useState} from 'react';
import {Plus,Trash2,Eye,EyeOff} from 'lucide-react';
import ConfirmDialog from './Feedback/ConfirmDialog';
import './AssistantApiSettings.css';
interface ApiKey {id:string;label:string;masked:string;enabled:boolean;status:string;models:{model:string;status:string;retryAt:number|null}[];}
interface PoolState {encryptionAvailable:boolean;allow20b:boolean;keys:ApiKey[];lastUsed:{label:string;model:string;role:string}|null;}
async function request(operation:string,args:object={}):Promise<PoolState>{
 const api=(window as any).electronAPI;if(!api?.apiKeyRequest)throw Error('Mở bản ứng dụng Desktop để quản lý API key.');
 const result=await api.apiKeyRequest(operation,args);if(!result.success)throw Error(result.error);return result.data;
}
export default function AssistantApiSettings(){
 const [state,setState]=useState<PoolState|null>(null),[label,setLabel]=useState(''),[key,setKey]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[showKey,setShowKey]=useState(false),[removing,setRemoving]=useState<ApiKey|null>(null);
 const keyInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{let live=true;const refresh=()=>void request('snapshot').then(next=>{if(live)setState(next);}).catch(e=>{if(live)setError(e.message);});refresh();const timer=setInterval(refresh,5000);return()=>{live=false;clearInterval(timer);};},[]);
 const act=async(operation:string,args:object={})=>{if(busy)return;setBusy(true);setError('');try{setState(await request(operation,args));if(operation==='add'){setKey('');setLabel('');setShowKey(false);}setRemoving(null);}catch(e:any){setError(e.message);if(operation==='add')keyInput.current?.focus();}finally{setBusy(false);}};
 const status=(item:ApiKey)=>!item.enabled?'Đã tắt':item.status==='invalid'?'Key không hợp lệ':item.status==='cooldown'?`Đang chờ${item.models[0].retryAt?' · '+Math.max(1,Math.ceil((item.models[0].retryAt-Date.now())/1000))+'s':''}`:'Sẵn sàng';
 return <div className="lsa-card lf-api-settings" aria-label="API key trợ lý AI">
  <header><div><h3>API cho trợ lý AI</h3><p>Tối đa 3 key · ưu tiên GPT-OSS 120B. Áp dụng cho dashboard, bong bóng và gợi ý sửa câu.</p></div><span>{state?.keys.length||0}/3 key</span></header>
  {error&&<p id="assistant-key-error" className="lf-api-error" role="alert">{error}</p>}
  {state&&!state.encryptionAvailable&&<p className="lf-api-error">Windows chưa sẵn sàng mã hóa key. Không lưu key mới trong phiên này.</p>}
  <div className="lf-api-list">{state?.keys.map(item=><div className="lf-api-key" key={item.id}><div><strong>{item.label}</strong><code>{item.masked}</code><small data-status={item.status}>{status(item)}</small></div><button type="button" role="switch" aria-checked={item.enabled} aria-label={`Bật ${item.label}`} disabled={busy} onClick={()=>void act('toggle',{id:item.id,enabled:!item.enabled})}>{item.enabled?'Đang bật':'Đã tắt'}</button><button type="button" aria-label={`Xóa ${item.label}`} title="Xóa key khỏi ứng dụng" disabled={busy} onClick={()=>setRemoving(item)}><Trash2 size={17}/></button></div>)}</div>
  <form className="lf-api-add" onSubmit={e=>{e.preventDefault();void act('add',{label,key});}}><label>Tên key<input aria-label="Tên API key trợ lý" aria-describedby={error?'assistant-key-error':undefined} value={label} maxLength={40} placeholder="Ví dụ: Key cá nhân 2" onChange={e=>setLabel(e.target.value)} disabled={busy||!state?.encryptionAvailable||state.keys.length>=3}/></label><label>Groq API key<span className="lf-api-secret"><input ref={keyInput} aria-label="API key trợ lý mới" aria-describedby={error?'assistant-key-error':undefined} type={showKey?'text':'password'} value={key} maxLength={256} autoComplete="off" spellCheck={false} placeholder="gsk_…" onChange={e=>setKey(e.target.value)} disabled={busy||!state?.encryptionAvailable||state.keys.length>=3}/><button type="button" aria-label={showKey?'Ẩn key đang nhập':'Hiện key đang nhập'} disabled={busy||!key} onClick={()=>setShowKey(!showKey)}>{showKey?<EyeOff size={17}/>:<Eye size={17}/>}</button></span></label><button type="submit" disabled={busy||!state?.encryptionAvailable||state.keys.length>=3||!label.trim()||!key.trim()}><Plus size={17}/> Thêm key</button></form>
  <div className="lf-api-fallback"><div><strong>GPT-OSS 20B dự phòng</strong><p>Mặc định tắt để kiểm tra chất lượng sau. Bước kiểm tra phản hồi vẫn dùng 120B.</p></div><button type="button" role="switch" aria-label="Cho phép GPT-OSS 20B dự phòng" aria-checked={!!state?.allow20b} disabled={busy||!state?.encryptionAvailable} onClick={()=>void act('configure',{allow20b:!state?.allow20b})}>{state?.allow20b?'Đang bật':'Đang tắt'}</button></div>
  <small className="lf-api-help">Key được lưu mã hóa trên máy. Các key cùng tổ chức Groq có thể dùng chung hạn mức. Thiết lập AI Coach ở phía trên được giữ riêng.</small>
  {state?.lastUsed&&<small className="lf-api-help">Lượt gần nhất: {state.lastUsed.label} · {state.lastUsed.model==='openai/gpt-oss-120b'?'GPT-OSS 120B':'GPT-OSS 20B'}</small>}
  {removing&&<ConfirmDialog title="Xóa API key khỏi ứng dụng?" description={`Xóa ${removing.label} khỏi danh sách trợ lý. Thao tác này không thu hồi key tại Groq và không xóa ghi chú.`} confirmLabel="Xóa key" cancelLabel="Giữ lại" onCancel={()=>setRemoving(null)} onConfirm={()=>void act('remove',{id:removing.id})}/>}
 </div>;
}
