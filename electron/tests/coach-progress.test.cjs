const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createCoachProgressStore,observeCoachAttempt}=require('../coach-progress.cjs');

const response=observations=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({observations})}}]})});

test('progress records only source-backed text evidence, deduplicates attempts and survives reload',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-coach-progress-'));
 t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 const filePath=path.join(folder,'progress.json'),store=createCoachProgressStore(filePath);
 const text='I usually spending my weekend at home. I look forward to meeting my friends.';
 const observations=[
  {kind:'error',category:'present_simple',evidence:'usually spending'},
  {kind:'error',category:'present_simple',evidence:'spending my weekend'},
  {kind:'structure',category:'verb_tense',evidence:'look forward to meeting'},
  {kind:'phrase',category:'collocation',evidence:'look forward to meeting'},
  {kind:'phrase',category:'collocation',evidence:'a phrase the learner never used'}
 ];
 let calls=0;
 const fetchImpl=async(_url,options)=>{calls++;const body=JSON.parse(options.body);assert.match(body.messages[0].content,/Never infer pronunciation/i);return response(observations);};
 const args={id:'attempt-1',mode:'speaking',text,reply:'Try saying: I usually spend my weekend at home.'};
 const first=await observeCoachAttempt(store,args,'managed',fetchImpl);
 assert.equal(first.attemptCount,1);
 assert.equal(first.weakPoints.length,0);
 assert.equal(first.developing[0].count,1);
 assert.equal(first.strengths[0].evidence,'look forward to meeting');
 assert.equal(first.phrases.length,1);
 assert.equal((await observeCoachAttempt(store,args,'managed',fetchImpl)).attemptCount,1);
 assert.equal(calls,1);
 const second=await observeCoachAttempt(store,{...args,id:'attempt-2'},'managed',fetchImpl);
 assert.equal(second.weakPoints[0].category,'present_simple');
 assert.equal(second.weakPoints[0].count,2);
 assert.equal(createCoachProgressStore(filePath).snapshot().weakPoints[0].count,2);
 const stored=JSON.parse(fs.readFileSync(filePath,'utf8'));
 assert.equal(JSON.stringify(stored).includes(text),false);
 assert.equal(JSON.stringify(stored).includes('pronunciation'),false);
});

test('two later correct uses retire a recurring weakness',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-coach-progress-'));
 t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 const store=createCoachProgressStore(path.join(folder,'progress.json'));
 const wrong='I usually spending time at home.';
 const right='I usually spend time at home.';
 for(let i=0;i<2;i++)await observeCoachAttempt(store,{id:`wrong-${i}`,mode:'writing',text:wrong,reply:'Correction.'},'managed',async()=>response([{kind:'error',category:'present_simple',evidence:'usually spending'}]));
 assert.equal(store.snapshot().weakPoints.length,1);
 for(let i=0;i<2;i++)await observeCoachAttempt(store,{id:`right-${i}`,mode:'writing',text:right,reply:'Good.'},'managed',async()=>response([{kind:'structure',category:'present_simple',evidence:'usually spend'}]));
 assert.equal(store.snapshot().weakPoints.length,0);
 assert.equal(store.snapshot().strengths[0].count,2);
 assert.equal(store.clear().attemptCount,0);
});

test('clearing the profile cannot be undone by an in-flight analysis',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-coach-progress-'));
 t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 const store=createCoachProgressStore(path.join(folder,'progress.json'));
 let finish;
 const pending=observeCoachAttempt(store,{id:'in-flight',mode:'speaking',text:'I usually spending time at home.'},'managed',()=>new Promise(resolve=>{finish=resolve;}));
 store.clear();
 finish(response([{kind:'error',category:'present_simple',evidence:'usually spending'}]));
 assert.equal((await pending).attemptCount,0);
 assert.equal(store.snapshot().weakPoints.length,0);
});
