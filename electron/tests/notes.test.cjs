const test = require('node:test');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');
const { createNotesStore } = require('../notes-store.cjs');
let SQL; test.before(async () => { SQL = await initSqlJs(); });

test('notes survive reopening and support revisions, trash and restore', () => {
 let bytes;
 const store = createNotesStore(SQL, {persist: value => {bytes=value;}});
 const note=store.create({title:'Meeting',content:'First'});
 const changed=store.update({id:note.id,title:'Meeting',content:'Second',expectedRevision:note.revision});
 assert.equal(store.undo({id:note.id,expectedRevision:changed.revision}).content,'First');
 store.trash({id:note.id}); assert.equal(store.list().length,0);assert.equal(store.list({deleted:true}).length,1);
 store.restore({id:note.id});
 assert.equal(createNotesStore(SQL,{initialData:bytes,persist:()=>{}}).get(note.id).content,'First');
});
test('stale edits cannot replace newer content',()=>{
 const store=createNotesStore(SQL,{persist:()=>{}}); const note=store.create({title:'A',content:'a'});
 store.update({id:note.id,title:'B',content:'b',expectedRevision:note.revision});
 assert.throws(()=>store.update({id:note.id,title:'C',content:'c',expectedRevision:note.revision}),/changed/);
 assert.equal(store.get(note.id).content,'b');
});
test('persistence failure never reports success or changes in-memory notes',()=>{
 let fail=false;const store=createNotesStore(SQL,{persist:()=>{if(fail)throw Error('disk full');}});
 const note=store.create({title:'A',content:'a'});fail=true;
 assert.throws(()=>store.update({id:note.id,title:'A',content:'lost',expectedRevision:note.revision}),/disk full/);
 assert.equal(store.get(note.id).content,'a');
});
test('input validation and parameter binding preserve note text safely',()=>{
 const store=createNotesStore(SQL,{persist:()=>{}});
 assert.throws(()=>store.create({title:'x',content:'a'.repeat(200001)}));
 const note=store.create({title:"'); DROP TABLE Notes; --",content:'Xin chào'});
 assert.equal(store.list()[0].content,'Xin chào');
 store.addMessages(note.id,'ghi lại','Đã lưu');
 assert.equal(store.messages(note.id).length,2);
});
