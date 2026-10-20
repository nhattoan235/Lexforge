const fs=require('node:fs'),{randomUUID}=require('node:crypto');
function createConversations({filePath,respond,onChange=()=>{}}){
 const fresh=()=>({id:randomUUID(),title:'Hội thoại mới',draft:'',messages:[],unread:false,error:'',updatedAt:new Date().toISOString()});
 let state=fs.existsSync(filePath)?JSON.parse(fs.readFileSync(filePath,'utf8')):{version:1,selectedId:null,conversations:[],migrated:false};
 if(state.version!==1||!Array.isArray(state.conversations))throw Error('Dữ liệu hội thoại không hợp lệ. Chưa thay đổi file.');
 state.autoRead=state.autoRead===true;
 const spoken=new Set();
 const pending=new Set();
 const get=id=>{const chat=state.conversations.find(c=>c.id===id);if(!chat)throw Error('Không tìm thấy hội thoại.');return chat;};
 const snapshot=()=>JSON.parse(JSON.stringify({...state,conversations:state.conversations.map(c=>({...c,pending:pending.has(c.id)})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))}));
 function commit(change){const previous=structuredClone(state);try{change();const temp=filePath+'.tmp';fs.writeFileSync(temp,JSON.stringify(state));fs.renameSync(temp,filePath);}catch(error){state=previous;throw error;}onChange(snapshot());}
 if(!state.conversations.length){const chat=fresh();commit(()=>{state.conversations.push(chat);state.selectedId=chat.id;});}
 return {
 snapshot,
 settings({autoRead}){if(typeof autoRead!=='boolean')throw Error('Invalid auto-read setting');commit(()=>{state.autoRead=autoRead;});return snapshot();},
 claimSpeech(id,messageId){if(!state.autoRead||spoken.has(messageId)||!get(id).messages.some(message=>message.id===messageId&&message.role==='assistant'))return false;spoken.add(messageId);return true;},
 create(){const chat=fresh();commit(()=>{state.conversations.push(chat);state.selectedId=chat.id;});return snapshot();},
 select(id){get(id);commit(()=>{state.selectedId=id;});return snapshot();},
 draft(id,text){if(typeof text!=='string'||text.length>40000)throw Error('Bản nháp tối đa 40.000 ký tự.');get(id);commit(()=>{get(id).draft=text;});return snapshot();},
 read(id,lastId){const chat=get(id);if(chat.unread&&chat.messages.at(-1)?.id===lastId)commit(()=>{get(id).unread=false;});return snapshot();},
 remove(id){get(id);if(pending.has(id))throw Error('Hội thoại đang chờ phản hồi. Hãy đợi hoàn tất trước khi xóa.');commit(()=>{state.conversations=state.conversations.filter(c=>c.id!==id);if(!state.conversations.length)state.conversations.push(fresh());if(state.selectedId===id)state.selectedId=state.conversations.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0].id;});return snapshot();},
 migrate(messages){if(state.migrated)return snapshot();if(!Array.isArray(messages)||messages.length>40||messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>212200))throw Error('Invalid legacy chat');commit(()=>{if(messages.length){const chat=fresh();chat.title='Hội thoại trước đây';chat.messages=messages.map(m=>({id:randomUUID(),role:m.role,content:m.content}));state.conversations.push(chat);state.selectedId=chat.id;}state.migrated=true;});return snapshot();},
 async send(id,prompt,noteId){const chat=get(id);if(pending.has(id))throw Error('Hội thoại đang chờ phản hồi.');if(typeof prompt!=='string'||!prompt.trim()||prompt.length>40000)throw Error('Yêu cầu phải có 1–40.000 ký tự.');
 const history=chat.messages.slice(-12).map(({role,content})=>({role,content:content.slice(0,12000)}));pending.add(id);
 try{commit(()=>{const current=get(id);current.messages.push({id:randomUUID(),role:'user',content:prompt});current.draft='';current.error='';current.updatedAt=new Date().toISOString();if(current.title==='Hội thoại mới')current.title=prompt.trim().replace(/\s+/g,' ').slice(0,55);});}
 catch(error){pending.delete(id);throw error;}
 try{const result=await respond({prompt,history,noteId});pending.delete(id);commit(()=>{const current=get(id);current.messages.push({id:randomUUID(),role:'assistant',content:result.reply});current.unread=true;current.updatedAt=new Date().toISOString();});return {state:snapshot(),note:result.action==='answer'?null:result.note,warning:result.warning||''};}
 catch(error){pending.delete(id);try{commit(()=>{const current=get(id);current.error=error.message||'Không nhận được phản hồi.';if(!current.draft)current.draft=prompt;});}catch{onChange(snapshot());}throw error;}
 }
 };
}
module.exports={createConversations};
