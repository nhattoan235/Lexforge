const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const initSqlJs=require('sql.js');
const {createNotesStorage}=require('../notes-storage.cjs');
let SQL;test.before(async()=>{SQL=await initSqlJs();});
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-notes-'));t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));assert.ok(path.basename(root).startsWith('lexforge-notes-'));fs.rmSync(root,{recursive:true,force:true});});const from=path.join(root,'from'),to=path.join(root,'to');fs.mkdirSync(from);fs.mkdirSync(to);let directory=from;return {root,from,to,manager:createNotesStorage(SQL,{defaultDirectory:from,getDirectory:()=>directory,setDirectory:value=>{directory=value;}}),saved:()=>directory};}
test('several notes survive storage relocation and reopening with history',t=>{
 const f=fixture(t),store=f.manager.getStore();
 const a=store.create({title:'First',content:'one'});store.create({title:'Second',content:'two'});store.addMessages(a.id,'request','reply');
 f.manager.changeDirectory(f.to);assert.equal(f.saved(),f.to);assert.equal(f.manager.getStore().list().length,2);assert.equal(f.manager.getStore().messages(a.id).length,2);assert.equal(fs.readdirSync(f.from).filter(name=>name.endsWith('.txt')).length,2);
 f.manager.close();const reopened=createNotesStorage(SQL,{defaultDirectory:f.from,getDirectory:()=>f.to,setDirectory:()=>{}});assert.equal(reopened.getStore().list().length,2);reopened.close();
});
test('missing target folder is reported without creating it or losing current notes',t=>{
 const f=fixture(t);f.manager.getStore().create({title:'Keep',content:'safe'});const missing=path.join(f.root,'missing');
 assert.throws(()=>f.manager.changeDirectory(missing),/không tồn tại/);assert.equal(fs.existsSync(missing),false);assert.equal(f.manager.getStore().list().length,1);f.manager.close();
});
test('deleted active directory blocks writes and reports invalid storage',t=>{
 const f=fixture(t);f.manager.getStore().create({title:'Keep',content:'safe'});fs.renameSync(f.from,f.from+'-moved');
 assert.equal(f.manager.status().valid,false);assert.throws(()=>f.manager.getStore(),/không tồn tại/);assert.equal(fs.existsSync(f.from),false);
 f.manager.changeDirectory(f.to);assert.equal(f.manager.getStore().list().length,1);f.manager.close();
});
test('existing target database is never overwritten',t=>{
 const f=fixture(t);const dest=path.join(f.to,'notes.sqlite');fs.writeFileSync(dest,'existing');
 assert.throws(()=>f.manager.changeDirectory(f.to),/đã có/);assert.equal(fs.readFileSync(dest,'utf8'),'existing');assert.equal(f.saved(),f.from);f.manager.close();
});
test('missing configured folder on startup remains visible and does not silently fall back',t=>{
 const f=fixture(t);f.manager.close();const missing=path.join(f.root,'offline');const manager=createNotesStorage(SQL,{defaultDirectory:f.from,getDirectory:()=>missing,setDirectory:()=>{}});
 assert.equal(manager.status().directory,missing);assert.equal(manager.status().valid,false);assert.throws(()=>manager.getStore(),/không tồn tại/);manager.close();
});
