const {test}=require('node:test');
const assert=require('node:assert/strict');
const {coachReply}=require('../ielts-coach.cjs');
const pass={status:'pass',task_completion:'complete',issues:[],corrected_response:null};
const request={mode:'speaking',prompt:'I usually spending my weekend at home.',history:[],words:['spend:tiêu thời gian']};
const answer='That sounds relaxing. What do you like to do at home?\n\nBạn có thể nói: I usually spend my weekend at home. Câu nói về thói quen nên dùng hiện tại đơn với I spend.';
const response=content=>({ok:true,json:async()=>({choices:[{message:{content}}]})});

test('Coach uses the shared IELTS guidance and review before displaying a speaking correction',async()=>{
 let generation,review;
 const reply=await coachReply(request,'managed',async(_url,options)=>{
  const body=JSON.parse(options.body);
  if(body.messages[0].content.startsWith('You are the bounded')){review=body;return response(JSON.stringify(pass));}
  generation=body;return response(answer);
 });
 assert.equal(reply,answer);
 assert.match(generation.messages[0].content,/English guidance v1\.1/);
 assert.match(generation.messages[0].content,/never infer pronunciation/i);
 assert.match(generation.messages[0].content,/Respond to what the learner means first/i);
 assert.match(generation.messages[0].content,/language note at the very end/i);
 assert.match(generation.messages[0].content,/no Markdown, asterisks, headings/i);
 assert.match(generation.messages[0].content,/one or two useful changes/i);
 assert.match(generation.messages[0].content,/ask a genuine follow-up question/i);
 assert.match(generation.messages[0].content,/do not invent an error/i);
 assert.match(generation.messages[0].content,/label optional suggestions accordingly/i);
 assert.match(generation.messages[0].content,/ALL grammar explanation in Vietnamese by default/i);
 assert.match(review.messages[0].content,/English guidance v1\.1/);
 assert.match(review.messages[0].content,/An English grammar explanation in the conversation is a definite rule_01 violation/i);
 assert.equal(JSON.parse(review.messages[1].content).context.mode,'speaking');
 assert.equal(JSON.parse(review.messages[1].content).context.coachGrammarNoteLanguage,'vi');
});

test('Coach withholds a reply when the shared reviewer cannot confirm it',async()=>{
 let calls=0;
 await assert.rejects(coachReply(request,'managed',async()=>{
  calls++;
  return calls===1?response(answer):{ok:false,status:429};
 }),/giới hạn lượt kiểm tra/);
 assert.equal(calls,2);
});

test('Coach repairs a rejected teaching reply once and reviews the repair before showing it',async()=>{
 const issue={rule_id:'rule_12',severity:'major',evidence:'usually',explanation:'The explanation overstates the rule.',suggested_fix:'Explain the present-simple construction for a habit.'};
 const rejected={status:'revise',task_completion:'partial',issues:[issue],corrected_response:null};
 const repaired='I usually spend my weekend at home. Đây là thói quen nên dùng hiện tại đơn: I spend. What do you usually do at home?';
 let calls=0,repairRequest;
 const result=await coachReply(request,'managed',async(_url,options)=>{
  calls++;
  const body=JSON.parse(options.body);
  if(calls===1)return response(answer);
  if(calls===2)return response(JSON.stringify(rejected));
  if(calls===3){repairRequest=body;return response(repaired);}
  return response(JSON.stringify(pass));
 });
 assert.equal(result,repaired);
 assert.equal(calls,4);
 assert.match(JSON.stringify(repairRequest.messages),/overstates the rule/);
});

test('Coach removes visible Markdown markers before review and display',async()=>{
 const marked='**That sounds relaxing.** What do you do at home?\n\n**Correction**\n1. I usually **spend** my weekend at home.\n\n**Explanation**\n→ Dùng `I spend` cho *thói quen*.\n\n)';
 const cleaned='That sounds relaxing. What do you do at home?\n\nI usually spend my weekend at home.\n\nDùng I spend cho thói quen.';
 let reviewed;
 const result=await coachReply(request,'managed',async(_url,options)=>{
  const body=JSON.parse(options.body);
  if(body.messages[0].content.startsWith('You are the bounded')){reviewed=JSON.parse(body.messages[1].content).draft_response;return response(JSON.stringify(pass));}
  return response(marked);
 });
 assert.equal(reviewed,cleaned);
 assert.equal(result,cleaned);
});

test('Coach repairs a misleading usually rule before asking the reviewer',async()=>{
 const bad='That sounds relaxing. What do you do at home?\n\nGhi chú ngữ pháp: I usually spend my weekend at home.\n→ “spending” nên dùng dạng nguyên mẫu “spend” sau “usually”.\n\n)';
 const good='That sounds relaxing. What do you do at home?\n\nI usually spend my weekend at home. Đây là thói quen nên dùng hiện tại đơn với I spend.';
 let calls=0,repairRequest,reviewed;
 const result=await coachReply(request,'managed',async(_url,options)=>{
  calls++;
  const body=JSON.parse(options.body);
  if(calls===1)return response(bad);
  if(calls===2){repairRequest=body;return response(good);}
  reviewed=JSON.parse(body.messages[1].content).draft_response;
  return response(JSON.stringify(pass));
 });
 assert.equal(result,good);
 assert.equal(reviewed,good);
 assert.equal(calls,3);
 assert.match(JSON.stringify(repairRequest.messages),/Usually is an adverb and does not govern the verb form/i);
});
