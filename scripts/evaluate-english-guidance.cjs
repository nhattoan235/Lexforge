// Runs the reviewed fixtures, not private conversation history. Explicit --live enables Groq calls.
const fs=require('node:fs'),path=require('node:path'),{reviewDraft}=require('../electron/english-guidance.cjs');
(async()=>{
 if(!process.argv.includes('--live'))throw Error('Use --live to evaluate the 30 fixtures through Groq.');
 const SQL=await require('sql.js')();const db=new SQL.Database(fs.readFileSync(path.join(process.env.APPDATA,'toeic-vocab-master/vocab.db')));
 const key=db.exec("SELECT SettingValue FROM UserSettings WHERE SettingKey='groq_api_key'")[0]?.values[0][0];db.close();if(!key)throw Error('Missing configured API key');
 const allCases=require('../electron/english-guidance/evaluation_cases.json').cases;
 const selection=process.argv.find(arg=>arg.startsWith('--cases='))?.slice(8).split(',');
 const cases=selection?allCases.filter(item=>selection.includes(item.id)):allCases;
 const reportPath=path.join(__dirname,'../models/test-fixtures/english-guidance-evaluation.json');
 const results=selection&&fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')).results.filter(item=>!selection.includes(item.id)):[];
 let nextDelay=0;const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 for(const item of cases){
  if(nextDelay>0){console.log('Waiting for token budget:',Math.ceil(nextDelay/1000),'seconds');await pause(nextDelay);}
  nextDelay=0;
  const pacedFetch=async(...args)=>{const response=await fetch(...args);const remaining=Number(response.headers.get('x-ratelimit-remaining-tokens'));nextDelay=Number.isFinite(remaining)?Math.min(30000,Math.max(2500,Math.ceil((4200-remaining)/110)*1000)):24000;return response;};
  const result=await reviewDraft({request:item.user_request,context:{task_type:item.task_type,source_context:item.context,...(item.id==='case_25'?{reviewSourceRequired:true}:{})},draft:item.candidate_response,apiKey:key,...(item.id==='case_27'?{fetchImpl:async()=>({ok:false,status:429}),failureCompletion:'complete'}:{fetchImpl:pacedFetch,...(item.id==='case_25'?{failureCompletion:'not_applicable'}:{})})});
  const unavailable=result.assessment.issues.some(issue=>issue.evidence==='HTTP 429'||issue.evidence==='Invalid or unavailable review'||issue.evidence==='Timeout');
  results.push({review_service_ok:item.id==='case_27'||!unavailable,id:item.id,expected_status:item.expected_status,expected_task_completion:item.expected_task_completion,assessment:result.assessment,decision:result.decision,status_match:result.assessment.status===item.expected_status,completion_match:result.assessment.task_completion===item.expected_task_completion});
  console.log(item.id,result.assessment.status,result.assessment.task_completion,results.at(-1).status_match?'status OK':'STATUS MISMATCH');
 }
 const summary={version:'1.1',model:'openai/gpt-oss-120b',total:results.length,status_matches:results.filter(r=>r.review_service_ok&&r.status_match).length,completion_matches:results.filter(r=>r.review_service_ok&&r.completion_match).length,unavailable:results.filter(r=>!r.review_service_ok).length,simulated_http429:['case_27'],missing_source_fixture:['case_25'],deterministic_verbatim:['case_15','case_16','case_17'],independent_human_review:false};
 fs.writeFileSync(path.join(__dirname,'../models/test-fixtures/english-guidance-evaluation.json'),JSON.stringify({summary,results},null,2));console.log(JSON.stringify(summary));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
