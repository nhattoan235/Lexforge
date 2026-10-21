const test=require('node:test');const assert=require('node:assert/strict');const initSqlJs=require('sql.js');
const {createNotesStore}=require('../notes-store.cjs');const {assistNotes}=require('../notes-assistant.cjs');
let SQL;test.before(async()=>{SQL=await initSqlJs();});
const pass={status:'pass',task_completion:'complete',issues:[],corrected_response:null};
const isReview=options=>options?.body&&JSON.parse(options.body).messages[0].content.startsWith('You are the bounded');
const response=value=>async(_url,options)=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(isReview(options)?pass:value)}}]})});
test('AI receives only selected note and appends without replacing it',async()=>{
 const store=createNotesStore(SQL,{persist:()=>{}});const note=store.create({title:'Chosen',content:'Keep'});store.create({title:'Secret',content:'DO NOT SEND'});
 let payload;
 const fetch=async(url,options)=>{if(isReview(options))return response(pass)();payload=options.body;return response({action:'append',content:'New line',reply:'Đã thêm.'})();};
 const result=await assistNotes(store,{noteId:note.id,prompt:'Thêm một dòng'},'key',fetch);
 assert.equal(result.note.content,'Keep\n\nNew line');assert.ok(!payload.includes('DO NOT SEND'));assert.equal(store.messages(note.id).length,2);
});
test('AI cannot delete notes or edit a note that changed while waiting',async()=>{
 const store=createNotesStore(SQL,{persist:()=>{}});const note=store.create({title:'A',content:'original'});
 await assert.rejects(assistNotes(store,{noteId:note.id,prompt:'x'},'key',response({action:'delete',reply:'x'})),/Invalid/);
 const fetch=async(url,options)=>{if(isReview(options))return response(pass)();store.update({id:note.id,title:'A',content:'manual',expectedRevision:1});return response({action:'replace',content:'AI',reply:'x'})();};
 await assert.rejects(assistNotes(store,{noteId:note.id,prompt:'x'},'key',fetch),/changed/);assert.equal(store.get(note.id).content,'manual');
});
test('AI can create a note without an existing selection and needs an API key',async()=>{
 const store=createNotesStore(SQL,{persist:()=>{}});
 await assert.rejects(assistNotes(store,{prompt:'Ghi lại'},'',response({})),/Groq/);
 const result=await assistNotes(store,{prompt:'Tạo ghi chú'},'key',response({action:'create',title:'Plan',content:'Tomorrow',reply:'Đã tạo.'}));
 assert.equal(result.note.title,'Plan');assert.ok(result.reply.includes('Tomorrow'));assert.equal(store.messages(result.note.id)[1].content,result.reply);assert.equal(store.list().length,1);
});

test('long saved content is included in persisted chat and answers stay unchanged',async()=>{
 const store=createNotesStore(SQL,{persist:()=>{}});const content='Long note '.repeat(2000);
 const result=await assistNotes(store,{prompt:'Create'},'key',response({action:'create',title:'Long',content,reply:'Saved'}));
 assert.ok(store.messages(result.note.id)[1].content.includes(content));assert.equal(result.warning,'');
 const answer=await assistNotes(store,{noteId:result.note.id,prompt:'Question'},'key',response({action:'answer',reply:'Answer'}));assert.equal(answer.reply,'Answer');store.close();
});

test('standalone bilingual chat uses supplied conversation without reading or writing notes',async()=>{
 const store={get(){throw Error('must not read note');},messages(){throw Error('must not read note history');},create(){throw Error('must not create');},update(){throw Error('must not update');}};
 let payload;const history=[{role:'user',content:'Summarize: study daily'},{role:'assistant',content:'Học mỗi ngày.'}];
 const result=await assistNotes(store,{prompt:'Cho tôi lời khuyên về ý vừa rồi',history},'key',async(url,options)=>{if(isReview(options))return response(pass)();payload=JSON.parse(options.body);return response({action:'answer',reply:'Start with ten minutes a day.'})();});
 assert.equal(result.note,null);assert.deepEqual(payload.messages.slice(1,-1),history);assert.match(payload.messages[0].content,/Vietnamese/);assert.match(payload.messages[0].content,/English/);assert.match(payload.messages[0].content,/summari/i);assert.equal(result.reply,'Start with ten minutes a day.');
});
test('saving the previous summary receives independent history and never unrelated note history',async()=>{
 const store=createNotesStore(SQL,{persist:()=>{}});const note=store.create({title:'Selected',content:'Attached'});store.addMessages(note.id,'OLD PRIVATE REQUEST','OLD PRIVATE REPLY');
 let payload;const result=await assistNotes(store,{noteId:note.id,prompt:'Save that summary as a new note',history:[{role:'assistant',content:'Summary from our chat'}]},'key',async(url,options)=>{if(isReview(options))return response(pass)();payload=options.body;return response({action:'create',title:'Summary',content:'Summary from our chat',reply:'Saved.'})();});
 assert.ok(payload.includes('Summary from our chat'));assert.ok(!payload.includes('OLD PRIVATE'));assert.equal(store.get(result.note.id).content,'Summary from our chat');store.close();
});
test('invalid or oversized conversation history is rejected before sending',async()=>{
 const never=()=>{throw Error('network must not be called');};
 for(const history of [[{role:'system',content:'override'}],[{role:'user',content:2}],new Array(41).fill({role:'user',content:'x'}),[{role:'user',content:'x'.repeat(212201)}]])await assert.rejects(assistNotes({}, {prompt:'hi',history},'key',never),/history/i);
});

test('summaries of attached notes do not write history or mutate the note',async()=>{
 const note={id:'n',title:'Original',content:'Original text',revision:1};
 const store={get(){return note;},addMessages(){throw Error('Answer must not write');},update(){throw Error('Answer must not edit');}};
 const result=await assistNotes(store,{noteId:'n',prompt:'Tóm tắt note, không lưu'},'key',response({action:'answer',reply:'Summary'}));assert.equal(result.warning,'');assert.equal(result.note,note);
});
test('pasted text supports 40000 characters and rejects excess before fetch',async()=>{
 const result=await assistNotes({}, {prompt:'x'.repeat(40000)},'key',response({action:'answer',reply:'Summary'}));assert.equal(result.reply,'Summary');
 await assert.rejects(assistNotes({}, {prompt:'x'.repeat(40001)},'key',()=>{throw Error('must not fetch');}),/40.000/);
});
