const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const initSqlJs=require('sql.js');
const {createTextNotesStore}=require('../notes-text-store.cjs');const {createNotesStore}=require('../notes-store.cjs');
let SQL;test.before(async()=>{SQL=await initSqlJs();});
function folder(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-txt-'));t.after(()=>{assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));assert.ok(path.basename(directory).startsWith('lexforge-txt-'));fs.rmSync(directory,{recursive:true,force:true});});return directory;}
test('writes separate UTF-8 TXT files and reopens all notes, revisions and messages',t=>{
 const directory=folder(t);let store=createTextNotesStore(SQL,{directory});const a=store.create({title:'Tiếng Việt',content:'Xin chào'});const b=store.create({title:'Second',content:'two'});
 store.update({id:a.id,title:a.title,content:'new',expectedRevision:1});store.addMessages(a.id,'request','reply');
 assert.equal(fs.readdirSync(directory).filter(f=>f.endsWith('.txt')).length,2);assert.equal(fs.existsSync(path.join(directory,'notes.sqlite')),false);store.close();
 store=createTextNotesStore(SQL,{directory});assert.equal(store.list().length,2);assert.equal(store.messages(a.id).length,2);assert.equal(store.undo({id:a.id,expectedRevision:2}).content,'Xin chào');assert.equal(store.get(b.id).content,'two');store.close();
});
test('migrates legacy SQLite without changing or removing the original file',t=>{
 const directory=folder(t);const legacy=path.join(directory,'notes.sqlite');const old=createNotesStore(SQL,{filePath:legacy});const a=old.create({title:'Legacy',content:'keep'});old.create({title:'Other',content:'also keep'});old.update({id:a.id,title:'Legacy',content:'revised',expectedRevision:1});old.addMessages(a.id,'legacy request','legacy reply');old.close();const backup=fs.readFileSync(legacy);
 const store=createTextNotesStore(SQL,{directory});assert.equal(store.list().length,2);assert.equal(store.get(a.id).content,'revised');assert.equal(store.messages(a.id).length,2);assert.equal(store.undo({id:a.id,expectedRevision:2}).content,'keep');assert.deepEqual(fs.readFileSync(legacy),backup);assert.equal(fs.readdirSync(directory).filter(f=>f.endsWith('.txt')).length,2);store.close();
});
test('reads external TXT edits and imports new TXT without overwriting them',t=>{
 const directory=folder(t);const store=createTextNotesStore(SQL,{directory});const a=store.create({title:'Original',content:'old'});const file=fs.readdirSync(directory).find(f=>f.endsWith('.txt'));fs.writeFileSync(path.join(directory,file),'edited in Notepad','utf8');
 const edited=store.get(a.id);assert.equal(edited.content,'edited in Notepad');assert.ok(edited.revision>a.revision);assert.throws(()=>store.update({id:a.id,title:'A',content:'overwrite',expectedRevision:a.revision}),/changed/);
 fs.writeFileSync(path.join(directory,'manual.txt'),'manual content','utf8');assert.equal(store.list().length,2);store.close();
});
test('trash and restore retain file content and unique note identities',t=>{
 const directory=folder(t);const store=createTextNotesStore(SQL,{directory});const a=store.create({title:'Same title',content:'first'});store.create({title:'Same title',content:'second'});store.trash({id:a.id});assert.equal(store.list().length,1);assert.equal(store.list({deleted:true}).length,1);store.restore({id:a.id});assert.equal(store.get(a.id).content,'first');assert.equal(fs.readdirSync(directory).filter(f=>f.endsWith('.txt')).length,2);store.close();
});

test('renaming updates the TXT filename without creating a second note',t=>{
 const directory=folder(t);const store=createTextNotesStore(SQL,{directory});const a=store.create({title:'Old',content:'keep'});
 store.update({id:a.id,title:'Tên mới',content:'keep',expectedRevision:1});const files=fs.readdirSync(directory).filter(f=>f.endsWith('.txt'));
 assert.equal(files.length,1);assert.match(files[0],/^keep_\d{2}-\d{2}-\d{4}\.txt$/);assert.equal(store.list().length,1);store.close();
});
test('metadata write failure rolls TXT content back and never claims success',t=>{
 const directory=folder(t);const store=createTextNotesStore(SQL,{directory});const a=store.create({title:'A',content:'original'});
 const rename=fs.renameSync;fs.renameSync=(source,target)=>{if(String(target).endsWith('state.json'))throw Error('metadata disk full');return rename(source,target);};
 try{assert.throws(()=>store.update({id:a.id,title:'A',content:'bad',expectedRevision:1}),/disk full/);}finally{fs.renameSync=rename;}
 assert.equal(store.get(a.id).content,'original');store.close();
});

test('content filenames include creation date and avoid collisions',t=>{
 const directory=folder(t);const store=createTextNotesStore(SQL,{directory});
 const a=store.create({title:'Generic title',content:'Wake at five and prepare presentation'});
 store.create({title:'Other title',content:a.content});
 const files=fs.readdirSync(directory).filter(f=>f.endsWith('.txt'));
 assert.equal(files.length,2);assert.ok(files.every(f=>f.startsWith('Wake at five and prepare presentation_')));assert.ok(files.some(f=>f.endsWith('_2.txt')));
 store.update({id:a.id,title:a.title,content:'Updated plan',expectedRevision:a.revision});
 assert.ok(fs.readdirSync(directory).some(f=>/^Updated plan_\d{2}-\d{2}-\d{4}\.txt$/.test(f)));assert.equal(store.list().length,2);store.close();
});
