const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const MODELS=['openai/gpt-oss-120b','openai/gpt-oss-20b'];
function createApiPool({filePath,encryption,getLegacyKey=()=>'',fetchImpl=fetch,now=Date.now}){
 let configured=fs.existsSync(filePath),state=configured?JSON.parse(fs.readFileSync(filePath,'utf8')):{version:1,keys:[],allow20b:false};
 if(state.version!==1||!Array.isArray(state.keys)||state.keys.length>3||typeof state.allow20b!=='boolean'||state.keys.some(item=>!item||typeof item.id!=='string'||typeof item.label!=='string'||typeof item.enabled!=='boolean'||typeof item.secret!=='string')||new Set(state.keys.map(item=>item.id)).size!==state.keys.length)throw Error('Kho API key không hợp lệ. Chưa thay đổi file.');
 const runtime=new Map(),invalid=new Set(),used=new Map();let sequence=0,lastUsed=null;
 const available=()=>encryption.isEncryptionAvailable();
 const entries=()=>!configured&&getLegacyKey()?.trim()?[{id:'legacy',label:'Key hiện tại',enabled:true,legacy:true}]:state.keys;
 const reveal=item=>item.legacy?getLegacyKey().trim():encryption.decryptString(Buffer.from(item.secret,'base64'));
 const slot=(id,model)=>id+':'+model;
 function persist(next){const temp=filePath+'.tmp';fs.writeFileSync(temp,JSON.stringify(next));fs.renameSync(temp,filePath);state=next;configured=true;}
 function snapshot(){return {encryptionAvailable:available(),allow20b:state.allow20b,lastUsed,keys:entries().map(item=>{
  let masked='••••';try{masked+=' '+reveal(item).slice(-4);}catch{}
  const models=MODELS.map(model=>{const info=runtime.get(slot(item.id,model));return {model,status:info?.until>now()?'cooldown':'ready',retryAt:info?.until>now()?info.until:null};});
  return {id:item.id,label:item.label,enabled:item.enabled,masked,status:!item.enabled?'disabled':invalid.has(item.id)?'invalid':models[0].status,models};
 })};}
 function add({label,key}){
  if(!available())throw Error('Windows chưa hỗ trợ mã hóa API key trong phiên này.');
  if(typeof label!=='string'||!label.trim()||label.trim().length>40)throw Error('Tên key cần 1–40 ký tự.');
  if(typeof key!=='string'||!/^gsk_[A-Za-z0-9_-]{16,}$/.test(key.trim())||key.trim().length>256)throw Error('API key Groq không đúng định dạng.');
  if(state.keys.length>=3)throw Error('Chỉ lưu tối đa 3 API key.');
  if(entries().some(item=>reveal(item)===key.trim()))throw Error('API key này đã có trong danh sách.');
  persist({...state,keys:[...state.keys,{id:randomUUID(),label:label.trim(),enabled:true,secret:encryption.encryptString(key.trim()).toString('base64')}]});return snapshot();
 }
 function toggle({id,enabled}){
  if(typeof enabled!=='boolean')throw Error('Trạng thái key không hợp lệ.');
  if(id==='legacy'&&!configured){if(enabled)return snapshot();persist({...state,keys:[]});return snapshot();}
  if(!state.keys.some(item=>item.id===id))throw Error('Không tìm thấy API key.');
  persist({...state,keys:state.keys.map(item=>item.id===id?{...item,enabled}:item)});invalid.delete(id);for(const model of MODELS)runtime.delete(slot(id,model));return snapshot();
 }
 function remove({id}){if(!entries().some(item=>item.id===id))throw Error('Không tìm thấy API key.');persist({...state,keys:state.keys.filter(item=>item.id!==id)});invalid.delete(id);return snapshot();}
 function configure({allow20b}){if(entries().some(item=>item.legacy))throw Error('Hãy thêm key vào kho mã hóa trước khi đổi model.');if(typeof allow20b!=='boolean')throw Error('Cấu hình model không hợp lệ.');persist({...state,allow20b});return snapshot();}
 function delay(response){
  const retry=response.headers?.get('retry-after');if(retry!==null&&retry!==undefined){if(Number.isFinite(Number(retry)))return Math.max(1000,Number(retry)*1000);const date=Date.parse(retry);if(Number.isFinite(date))return Math.max(1000,date-now());}
  const reset=response.headers?.get('x-ratelimit-reset-tokens')||'';let ms=0;for(const match of reset.matchAll(/([\d.]+)(ms|h|m|s)/g))ms+=Number(match[1])*({ms:1,h:3600000,m:60000,s:1000}[match[2]]);return ms||30000;
 }
 async function request(url,options){
  if(url!=='https://api.groq.com/openai/v1/chat/completions'||options?.method!=='POST')throw Error('Đường gọi AI không hợp lệ.');
  let body;try{body=JSON.parse(options.body);}catch{throw Error('Yêu cầu AI không hợp lệ.');}
  if(!Array.isArray(body.messages))throw Error('Yêu cầu AI không hợp lệ.');
  const reviewer=body.messages.some(message=>message.role==='system'&&message.content?.startsWith('You are the bounded Lexforge English reviewer.'));
  const enabled=entries().filter(item=>item.enabled&&!invalid.has(item.id)).sort((a,b)=>(used.get(a.id)||0)-(used.get(b.id)||0));
  if(!enabled.length)throw Error('Chưa có API key trợ lý đang bật. Hãy thêm hoặc bật key trong Cài đặt.');
  const models=reviewer||!state.allow20b?[MODELS[0]]:MODELS;
  const candidates=models.flatMap(model=>enabled.map(item=>({id:item.id,model})));
  const deadline=AbortSignal.timeout(reviewer?22000:35000);let lastResponse=null;
  for(const candidate of candidates){
   if(deadline.aborted||options.signal?.aborted)break;
   const item=entries().find(entry=>entry.id===candidate.id&&entry.enabled&&!invalid.has(entry.id));if(!item)continue;
   const token=slot(item.id,candidate.model);if(runtime.get(token)?.until>now())continue;
   let key;try{key=reveal(item);}catch{invalid.add(item.id);continue;}
   const headers=new Headers(options.headers);headers.set('Authorization','Bearer '+key);headers.set('Content-Type','application/json');
   used.set(item.id,++sequence);
   try{
    const signal=AbortSignal.any([deadline,AbortSignal.timeout(10000),...(options.signal?[options.signal]:[])]);
    const response=await fetchImpl(url,{...options,headers,signal,body:JSON.stringify({...body,model:candidate.model})});lastResponse=response;
    if(response.ok){runtime.delete(token);lastUsed={label:item.label,model:candidate.model,role:reviewer?'reviewer':'generation'};return response;}
    if(response.status===401){invalid.add(item.id);continue;}
    if(response.status===429){runtime.set(token,{until:now()+delay(response)});continue;}
    if([403,404].includes(response.status)){runtime.set(token,{until:now()+3600000});continue;}
    if(response.status>=500){runtime.set(token,{until:now()+15000});continue;}
    return response;
   }catch{if(options.signal?.aborted||deadline.aborted)break;runtime.set(token,{until:now()+15000});}
  }
  if(options.signal?.aborted||deadline.aborted)throw Error('Yêu cầu AI đã hết thời gian chờ.');
  if(lastResponse)return lastResponse;
  return new Response(null,{status:429,headers:{'retry-after':'30'}});
 }
 // Copy the existing default key into the encrypted assistant vault without changing AI Coach settings.
 if(!configured&&available()&&/^gsk_[A-Za-z0-9_-]{16,}$/.test(getLegacyKey()?.trim()||'')){
  const key=getLegacyKey().trim();persist({...state,keys:[{id:randomUUID(),label:'Key hiện tại',enabled:true,secret:encryption.encryptString(key).toString('base64')}]});
 }
 return {snapshot,add,toggle,remove,configure,fetch:request};
}
module.exports={createApiPool};
