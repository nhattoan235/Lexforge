const test=require('node:test'),assert=require('node:assert/strict');
const {assistNotes}=require('../notes-assistant.cjs');
const reply=value=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(value)}}]})});
test('assistant reviews English before displaying and accepts a local grammar repair',async()=>{
 const calls=[];const result=await assistNotes({}, {prompt:'Answer in English: where does she spend weekends?'},'key',async(_url,options)=>{calls.push(JSON.parse(options.body));return reply(calls.length===1?{action:'answer',reply:'She spend weekends at home.'}:{status:'revise',task_completion:'complete',issues:[{rule_id:'rule_10',severity:'major',evidence:'She spend',explanation:'She requires spends in the present simple.',suggested_fix:'Use She spends.'}],corrected_response:'She spends weekends at home.'});});
 assert.equal(calls.length,2);assert.equal(result.reply,'She spends weekends at home.');
});
test('review failure never saves a proposed note',async()=>{
 let calls=0,writes=0;
 const store={create(){writes++;return {id:'n',title:'Plan',content:'Study'};},addMessages(){}};
 await assert.rejects(assistNotes(store,{prompt:'Create a note: Study'},'key',async()=>++calls===1?reply({action:'create',title:'Plan',content:'Study',reply:'Saved'}):{ok:false,status:429}),/kiểm tra|giới hạn/i);
 assert.equal(writes,0);assert.equal(calls,2);
});

test('note acknowledgements come from successful persistence, not unreviewed model claims',async()=>{
 let writes=0;const store={create({title,content}){writes++;return {id:'n',title,content};},addMessages(){}};
 const result=await assistNotes(store,{prompt:'Create a note: Study'},'key',async(_url,options)=>JSON.parse(options.body).messages[0].content.startsWith('You are the bounded')?reply({status:'pass',task_completion:'partial',issues:[],corrected_response:null}):reply({action:'create',title:'Study',content:'Study',reply:'I scheduled a reminder and shared the note.',replyLanguage:'en'}));
 assert.equal(writes,1);assert.match(result.reply,/Note created/);assert.doesNotMatch(result.reply,/reminder|shared/);
});
