const test=require('node:test'),assert=require('node:assert/strict');
const {reviewDraft,guidancePrompt}=require('../english-guidance.cjs');
const response=value=>async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(value)}}]})});
const pass={status:'pass',task_completion:'complete',issues:[],corrected_response:null};
const input={request:'Please correct this sentence.',draft:'She spend 15 minutes at home.',apiKey:'key'};
const issue={rule_id:'rule_10',severity:'major',evidence:'She spend',explanation:'Third-person singular agreement.',suggested_fix:'Use spends.'};
test('loads v1.1 policy with all response languages and contextual guidance',()=>{
 assert.match(guidancePrompt(),/v1.1/);assert.match(guidancePrompt(),/rule_24/);assert.match(guidancePrompt(),/not only IELTS/);
});
test('pass can legitimately report missing task input',async()=>{
 const result=await reviewDraft({...input,fetchImpl:response({...pass,task_completion:'blocked_by_missing_input'})});assert.equal(result.decision,'accepted_original');
});
test('rejects forged rule IDs, severity, evidence and contradictory statuses',async()=>{
 for(const value of [
  {...pass,issues:[issue]},
  {status:'revise',task_completion:'complete',issues:[{...issue,rule_id:'rule_99'}],corrected_response:'She spends 15 minutes at home.'},
  {status:'revise',task_completion:'complete',issues:[{...issue,severity:'minor'}],corrected_response:'She spends 15 minutes at home.'},
  {status:'revise',task_completion:'complete',issues:[{...issue,evidence:'invented text'}],corrected_response:'She spends 15 minutes at home.'},
 ]){const result=await reviewDraft({...input,fetchImpl:response(value)});assert.equal(result.decision,'review_unavailable');assert.equal(result.text,null);}
});
test('numeric/negation changes and note-action rewrites cannot auto-apply',async()=>{
 const review={status:'revise',task_completion:'complete',issues:[issue],corrected_response:'She spends 50 minutes at home.'};
 assert.equal((await reviewDraft({...input,fetchImpl:response(review)})).text,null);
 review.corrected_response='She spends 15 minutes at home.';
 assert.equal((await reviewDraft({...input,format:'note',fetchImpl:response(review)})).text,null);
 assert.equal((await reviewDraft({...input,fetchImpl:response(review)})).decision,'accepted_revision');
});
test('verbatim-only tasks are checked by exact bytes without an API call',async()=>{
 const result=await reviewDraft({request:"Chỉ trích nguyên văn câu: She don't like tea.",draft:"She doesn't like tea.",apiKey:'key',fetchImpl:()=>{throw Error('must not call');}});
 assert.equal(result.text,"She don't like tea.");assert.equal(result.assessment.status,'revise');
});
test('HTTP 429 is one failure without retries or a fabricated pass',async()=>{
 let calls=0;const result=await reviewDraft({...input,failureCompletion:'complete',fetchImpl:async()=>{calls++;return {ok:false,status:429};}});
 assert.equal(calls,1);assert.equal(result.assessment.status,'uncertain');assert.equal(result.assessment.task_completion,'complete');assert.equal(result.text,null);
});

test('bundled reviewer schema and documented examples validate using the shared draft-07 keyword subset',()=>{
 const fs=require('node:fs'),path=require('node:path'),Ajv=require('ajv');
 const md=fs.readFileSync(path.join(__dirname,'../english-guidance/quality_gate.md'),'utf8');
 const blocks=[...md.matchAll(/```json\s*([\s\S]*?)```/g)].map(match=>JSON.parse(match[1]));
 // The supplied 2020-12 schema uses only keywords also supported by installed Ajv's draft-07 validator.
 const schema=structuredClone(blocks[0]);delete schema.$schema;
 const validate=new Ajv({allErrors:true}).compile(schema);
 for(const example of blocks.slice(1))assert.ok(validate(example),JSON.stringify(validate.errors));
 assert.equal(validate({...pass,issues:[issue]}),false);
 assert.equal(validate({...pass,task_completion:'invented'}),false);
});

test('missing required reviewer source is blocked by metadata, never guessed by the model',async()=>{
 const result=await reviewDraft({...input,context:{reviewSourceRequired:true},failureCompletion:'not_applicable',fetchImpl:()=>{throw Error('must not call');}});
 assert.equal(result.assessment.status,'uncertain');assert.equal(result.decision,'review_unavailable');assert.equal(result.assessment.task_completion,'not_applicable');
});
