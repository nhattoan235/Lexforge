const test=require('node:test');const assert=require('node:assert/strict');const initSqlJs=require('sql.js');
const {createNotesStore}=require('../notes-store.cjs');const {assistNotes}=require('../notes-assistant.cjs');
let SQL;test.before(async()=>{SQL=await initSqlJs();});
const response=value=>async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(value)}}]})});
test('AI receives only selected note and appends without replacing it',async()=>{
 const store=createNotesStore(SQL,{persist:()=>{}});const note=store.create({title:'Chosen',content:'Keep'});store.create({title:'Secret',content:'DO NOT SEND'});
 let payload;
 const fetch=async(url,options)=>{payload=options.body;return response({action:'append',content:'New line',reply:'Đã thêm.'})();};
 const result=await assistNotes(store,{noteId:note.id,prompt:'Thêm một dòng'},'key',fetch);
 assert.equal(result.note.content,'Keep\n\nNew line');assert.ok(!payload.includes('DO NOT SEND'));assert.equal(store.messages(note.id).length,2);
});
test('AI cannot delete notes or edit a note that changed while waiting',async()=>{
 const store=createNotesStore(SQL,{persist:()=>{}});const note=store.create({title:'A',content:'original'});
 await assert.rejects(assistNotes(store,{noteId:note.id,prompt:'x'},'key',response({action:'delete',reply:'x'})),/Invalid/);
 const fetch=async()=>{store.update({id:note.id,title:'A',content:'manual',expectedRevision:1});return response({action:'replace',content:'AI',reply:'x'})();};
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
