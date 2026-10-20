const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
function rows(db, sql, args=[]) {
 const result=db.exec(sql,args)[0];
 return result ? result.values.map(row=>Object.fromEntries(result.columns.map((key,i)=>[key,row[i]]))) : [];
}
function text(value, maximum, name) {
 if(typeof value!=='string'||value.length>maximum)throw Error(`Invalid ${name}`);
 return value;
}
function createNotesStore(SQL, options={}) {
 const filePath=options.filePath;
 let db=new SQL.Database(options.initialData || (filePath&&fs.existsSync(filePath)?fs.readFileSync(filePath):undefined));
 db.run(`CREATE TABLE IF NOT EXISTS Notes(id TEXT PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,revision INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS NoteRevisions(id INTEGER PRIMARY KEY AUTOINCREMENT,noteId TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,deleted INTEGER NOT NULL,createdAt TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS NoteMessages(id INTEGER PRIMARY KEY AUTOINCREMENT,noteId TEXT NOT NULL,role TEXT NOT NULL,content TEXT NOT NULL,createdAt TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS notes_messages_idx ON NoteMessages(noteId,id);`);
 const persist=options.persist || (bytes=>{if(!fs.existsSync(path.dirname(filePath))||!fs.statSync(path.dirname(filePath)).isDirectory())throw Error('Thư mục lưu không tồn tại hoặc chưa kết nối. Hãy chọn lại thư mục lưu.');const temp=filePath+'.tmp';fs.writeFileSync(temp,Buffer.from(bytes));fs.renameSync(temp,filePath);});
 function mutate(action) {
  const next=new SQL.Database(db.export());
  try {const value=action(next);persist(next.export());const old=db;db=next;old.close();return value;}
  catch(error){next.close();throw error;}
 }
 function getFrom(database,id,expectedRevision) {
  if(typeof id!=='string')throw Error('Invalid note ID');
  const note=rows(database,'SELECT * FROM Notes WHERE id=?',[id])[0];
  if(!note)throw Error('Note not found');
  if(expectedRevision!==undefined&&note.revision!==expectedRevision)throw Error('Note changed. Reload it before applying this edit.');
  return note;
 }
 function snapshot(database,note) {database.run('INSERT INTO NoteRevisions(noteId,title,content,deleted,createdAt) VALUES(?,?,?,?,?)',[note.id,note.title,note.content,note.deleted,new Date().toISOString()]);}
 const api={
  list({deleted=false}={}){return rows(db,'SELECT * FROM Notes WHERE deleted=? ORDER BY updatedAt DESC,id',[deleted?1:0]);},
  get(id){return getFrom(db,id);},
  create({title,content}){
   title=text(title,180,'title').trim()||'Ghi chú mới';content=text(content,200000,'content');
   return mutate(database=>{const id=randomUUID(),now=new Date().toISOString();database.run('INSERT INTO Notes VALUES(?,?,?,1,0,?,?)',[id,title,content,now,now]);return getFrom(database,id);});
  },
  update({id,title,content,expectedRevision}){
   title=text(title,180,'title').trim()||'Ghi chú mới';content=text(content,200000,'content');
   if(!Number.isInteger(expectedRevision))throw Error('Revision required');
   return mutate(database=>{const note=getFrom(database,id,expectedRevision);if(note.deleted)throw Error('Note is in trash');snapshot(database,note);database.run('UPDATE Notes SET title=?,content=?,revision=revision+1,updatedAt=? WHERE id=?',[title,content,new Date().toISOString(),id]);return getFrom(database,id);});
  },
  trash({id}){return setDeleted(id,1);},
  restore({id}){return setDeleted(id,0);},
  undo({id,expectedRevision}){return mutate(database=>{const note=getFrom(database,id,expectedRevision);const previous=rows(database,'SELECT * FROM NoteRevisions WHERE noteId=? ORDER BY id DESC LIMIT 1',[id])[0];if(!previous)throw Error('No earlier revision');database.run('UPDATE Notes SET title=?,content=?,deleted=?,revision=revision+1,updatedAt=? WHERE id=?',[previous.title,previous.content,previous.deleted,new Date().toISOString(),note.id]);database.run('DELETE FROM NoteRevisions WHERE id=?',[previous.id]);return getFrom(database,id);});},
  messages(id){getFrom(db,id);return rows(db,'SELECT * FROM (SELECT * FROM NoteMessages WHERE noteId=? ORDER BY id DESC LIMIT 20) ORDER BY id',[id]);},
  addMessages(id,prompt,reply){text(prompt,40000,'prompt');text(reply,212200,'reply');return mutate(database=>{getFrom(database,id);const now=new Date().toISOString();database.run('INSERT INTO NoteMessages(noteId,role,content,createdAt) VALUES(?,?,?,?)',[id,'user',prompt,now]);database.run('INSERT INTO NoteMessages(noteId,role,content,createdAt) VALUES(?,?,?,?)',[id,'assistant',reply,now]);return true;});},
  exportData(){return db.export();},
  close(){db.close();},
 };
 function setDeleted(id,deleted){return mutate(database=>{const note=getFrom(database,id);snapshot(database,note);database.run('UPDATE Notes SET deleted=?,revision=revision+1,updatedAt=? WHERE id=?',[deleted,new Date().toISOString(),id]);return getFrom(database,id);});}
 return api;
}
module.exports={createNotesStore};
