export interface ChatMessage {id:string;role:'user'|'assistant';content:string;}
export interface Conversation {id:string;title:string;draft:string;messages:ChatMessage[];unread:boolean;pending:boolean;error:string;updatedAt:string;}
export interface ChatState {selectedId:string;autoRead:boolean;conversations:Conversation[];shortcutAvailable?:boolean;shortcut?:string|null;}
const embedded=new URLSearchParams(window.location.search).get('assistantChat')==='1';
export async function chatRequest<T>(operation:string,args:object={}):Promise<T>{
 const api=(window as any).electronAPI;
 let result:any;
 if(!embedded&&api?.chatRequest)result=await api.chatRequest(operation,args);
 else if(embedded&&window.parent!==window){
  result=await new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timeout=setTimeout(()=>{window.removeEventListener('message',receive);reject(Error('Không kết nối được trợ lý. Hãy mở lại bảng chat.'));},75000);
   const receive=(event:MessageEvent)=>{if(event.source!==window.parent||event.data?.kind!=='lexforge-chat-result'||event.data.id!==id)return;clearTimeout(timeout);window.removeEventListener('message',receive);resolve(event.data.result);};window.addEventListener('message',receive);window.parent.postMessage({kind:'lexforge-chat-request',id,operation,args},'*');
  });
 }else throw Error('Hãy mở lại Lexforge để nạp chức năng hội thoại.');
 if(!result.success)throw Error(result.error||'Không xử lý được hội thoại.');return result.data;
}
export function subscribeChat(callback:(state:ChatState)=>void):()=>void{
 if(!embedded)return (window as any).electronAPI?.onChatChange?.(callback)||(()=>{});
 const receive=(event:MessageEvent)=>{if(event.source===window.parent&&event.data?.kind==='lexforge-chat-state')callback(event.data.state);};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
}

export async function migrateLegacyChat():Promise<void>{
 if(embedded)return;
 const legacy=localStorage.getItem('lexforge-assistant-conversation-v1');
 if(legacy){await chatRequest('migrate',{messages:JSON.parse(legacy)});localStorage.removeItem('lexforge-assistant-conversation-v1');}
}
