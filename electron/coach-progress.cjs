const fs=require('node:fs');
const path=require('node:path');

const labels={
 present_simple:'Hiện tại đơn',verb_tense:'Thì và thời gian',subject_verb_agreement:'Chia động từ',
 articles:'Mạo từ',prepositions:'Giới từ',word_form:'Dạng từ',sentence_structure:'Cấu trúc câu',
 cohesion:'Liên kết ý',collocation:'Kết hợp từ',vocabulary_use:'Dùng từ đúng ngữ cảnh'
};
const categories=new Set(Object.keys(labels));
const modes=new Set(['chat','speaking','writing']);
const kinds=new Set(['error','structure','phrase']);

function createCoachProgressStore(filePath){
 let state={version:1,attempts:[]};
 let generation=0;
 if(fs.existsSync(filePath)){
  const loaded=JSON.parse(fs.readFileSync(filePath,'utf8'));
  if(loaded?.version!==1||!Array.isArray(loaded.attempts)||loaded.attempts.some(attempt=>!attempt||typeof attempt.id!=='string'||!modes.has(attempt.mode)||typeof attempt.createdAt!=='string'||!Array.isArray(attempt.observations)||attempt.observations.some(item=>!item||!kinds.has(item.kind)||!categories.has(item.category)||typeof item.evidence!=='string')))throw Error('Hồ sơ tiến bộ không hợp lệ; file cũ được giữ nguyên.');
  state=loaded;
 }
 function persist(next){
  fs.mkdirSync(path.dirname(filePath),{recursive:true});
  const temporary=filePath+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify(next),'utf8');
  fs.renameSync(temporary,filePath);
  state=next;
 }
 function snapshot(){
  const issues=new Map(),strengths=new Map(),phrases=new Map();
  for(const [index,attempt] of state.attempts.entries()){
   for(const item of attempt.observations){
    const key=item.kind==='phrase'?item.evidence.toLocaleLowerCase('en'):`${attempt.mode}:${item.category}`;
    const target=item.kind==='error'?issues:item.kind==='structure'?strengths:phrases;
    const prior=target.get(key)||{mode:attempt.mode,category:item.category,label:labels[item.category],evidence:item.evidence,count:0,lastAt:''};
    target.set(key,{...prior,evidence:item.evidence,count:prior.count+1,lastAt:attempt.createdAt,lastIndex:index});
   }
  }
  const weakPoints=[...issues.values()].filter(item=>item.count>=2).filter(item=>{
   const later=state.attempts.slice(item.lastIndex+1).filter(attempt=>attempt.mode===item.mode).flatMap(attempt=>attempt.observations).filter(observation=>observation.kind==='structure'&&observation.category===item.category);
   return later.length<2;
  }).sort((a,b)=>b.count-a.count||b.lastAt.localeCompare(a.lastAt));
  return {attemptCount:state.attempts.length,weakPoints,developing:[...issues.values()].filter(item=>item.count===1),strengths:[...strengths.values()].sort((a,b)=>b.count-a.count),phrases:[...phrases.values()].sort((a,b)=>b.count-a.count).slice(0,15)};
 }
 return {
  has:id=>state.attempts.some(attempt=>attempt.id===id),
  generation:()=>generation,
  record:attempt=>{if(state.attempts.some(item=>item.id===attempt.id))return snapshot();persist({...state,attempts:[...state.attempts,attempt]});return snapshot();},
  snapshot,
  clear:()=>{generation++;persist({version:1,attempts:[]});return snapshot();}
 };
}

async function observeCoachAttempt(store,{id,mode,text},apiKey,fetchImpl=fetch){
 if(typeof id!=='string'||!/^[A-Za-z0-9-]{1,64}$/.test(id)||!modes.has(mode)||typeof text!=='string'||!text.trim()||text.length>40000)throw Error('Bài luyện không hợp lệ.');
 if(store.has(id))return store.snapshot();
 const generation=store.generation();
 const response=await fetchImpl('https://api.groq.com/openai/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model:'openai/gpt-oss-120b',temperature:0,max_tokens:900,response_format:{type:'json_object'},messages:[
  {role:'system',content:`Extract conservative learning evidence from learnerText ONLY. Return JSON only: {"observations":[{"kind":"error|structure|phrase","category":"one allowed category","evidence":"exact contiguous substring of learnerText"}]}. Allowed categories: ${Object.keys(labels).join(', ')}. At most two errors, two correctly used structures, and two correctly used multiword phrases. Use error only for a definite language mistake; accept valid alternatives. Use structure or phrase only for something actually used correctly by the learner. Omit uncertain observations. Keep evidence under 160 characters. A phrase needs at least two words. For a Speaking transcript, assess only visible grammar, wording and textual organisation. Never infer pronunciation, intonation, rhythm, pace, hesitation, actual spoken fluency or an IELTS band. No score, no suggestions without source evidence.`},
  {role:'user',content:JSON.stringify({mode,learnerText:text})}
 ]})});
 if(!response.ok)throw Error(response.status===429?'Groq đang giới hạn phân tích tiến bộ. Hãy thử lại sau.':`Không phân tích được tiến bộ (HTTP ${response.status}).`);
 const data=await response.json();
 let parsed;try{parsed=JSON.parse(data.choices?.[0]?.message?.content);}catch{throw Error('AI trả về hồ sơ tiến bộ không hợp lệ.');}
 if(!parsed||!Array.isArray(parsed.observations)||parsed.observations.length>6)throw Error('AI trả về hồ sơ tiến bộ không hợp lệ.');
 const counts={error:0,structure:0,phrase:0},observations=[],seen=new Set();
 for(const item of parsed.observations){
  if(!item||!kinds.has(item.kind)||!categories.has(item.category)||typeof item.evidence!=='string'||!item.evidence.trim()||item.evidence.length>160)continue;
  const at=text.toLocaleLowerCase('en').indexOf(item.evidence.toLocaleLowerCase('en'));
  if(at<0||item.kind==='phrase'&&item.evidence.trim().split(/\s+/).length<2||counts[item.kind]>=2)continue;
  const evidence=text.slice(at,at+item.evidence.length),key=item.kind==='phrase'?[item.kind,evidence.toLocaleLowerCase('en')].join(':'):[item.kind,item.category].join(':');
  if(seen.has(key))continue;
  seen.add(key);counts[item.kind]++;observations.push({kind:item.kind,category:item.category,evidence});
 }
 return generation===store.generation()?store.record({id,mode,createdAt:new Date().toISOString(),observations}):store.snapshot();
}

module.exports={createCoachProgressStore,observeCoachAttempt,labels};
