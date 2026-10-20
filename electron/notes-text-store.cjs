const fs=require('node:fs');const path=require('node:path');const {randomUUID,createHash}=require('node:crypto');
const {createNotesStore}=require('./notes-store.cjs');
const META='.lexforge-notes';
function digest(text){return createHash('sha256').update(text).digest('hex');}
function table(database,name){const result=database.exec(`SELECT * FROM ${name}`)[0];return result?result.values.map(row=>Object.fromEntries(result.columns.map((column,i)=>[column,row[i]]))):[];}
function ensureDirectory(directory){if(!fs.existsSync(directory)||!fs.statSync(directory).isDirectory())throw Error('Thư mục lưu không tồn tại hoặc chưa kết nối.');}
function safeName(name){if(typeof name!=='string'||name!==path.basename(name)||/[<>:"/\\|?*\x00-\x1f]/.test(name)||!/\.txt$/i.test(name))throw Error('Tên file ghi chú không hợp lệ.');return name;}
function readText(file){const info=fs.lstatSync(file);if(info.isSymbolicLink()||!info.isFile()||info.size>1000000)throw Error('File ghi chú không hợp lệ hoặc quá lớn.');const bytes=fs.readFileSync(file);const value=bytes[0]===255&&bytes[1]===254?bytes.subarray(2).toString('utf16le'):bytes.toString('utf8').replace(/^\uFEFF/,'');if(value.length>200000)throw Error('Ghi chú vượt quá 200.000 ký tự.');return value;}
function atomicWrite(file,bytes){const temp=file+'.tmp-'+randomUUID();try{fs.writeFileSync(temp,bytes,{flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
function createTextNotesStore(SQL,{directory,initialData}={}){
 ensureDirectory(directory);
 const metaDir=path.join(directory,META),manifestPath=path.join(metaDir,'state.json'),trashDir=path.join(metaDir,'trash');
 let closed=false,discovered=new Map(),memory;
 const location=(note,fileName)=>path.join(note.deleted?trashDir:directory,safeName(fileName));
 function readManifest(){if(fs.existsSync(metaDir)&&fs.lstatSync(metaDir).isSymbolicLink())throw Error('Thư mục quản lý TXT không được là liên kết.');if(fs.existsSync(manifestPath)&&fs.lstatSync(manifestPath).isSymbolicLink())throw Error('File quản lý TXT không được là liên kết.');if(!fs.existsSync(manifestPath))return {version:1,Notes:[],NoteRevisions:[],NoteMessages:[]};const data=JSON.parse(fs.readFileSync(manifestPath,'utf8'));if(data.version!==1||!Array.isArray(data.Notes)||!Array.isArray(data.NoteRevisions)||!Array.isArray(data.NoteMessages))throw Error('Dữ liệu quản lý TXT không hợp lệ. Bản ghi chú chưa bị thay đổi.');return data;}
 function prepareMeta(){for(const dir of [metaDir,trashDir]){if(fs.existsSync(dir)&&fs.lstatSync(dir).isSymbolicLink())throw Error('Thư mục quản lý ghi chú không được là liên kết.');if(!fs.existsSync(dir))fs.mkdirSync(dir);}}
 function persist(bytes){
  ensureDirectory(directory);prepareMeta();
  const database=new SQL.Database(bytes);let next;
  try{next={version:1,Notes:table(database,'Notes'),NoteRevisions:table(database,'NoteRevisions'),NoteMessages:table(database,'NoteMessages')};}finally{database.close();}
  const previous=readManifest(),oldById=new Map(previous.Notes.map(note=>[note.id,note]));
  const backups=new Map();
  const backup=file=>{if(!backups.has(file))backups.set(file,fs.existsSync(file)?fs.readFileSync(file):null);};
  try{
   for(const note of next.Notes){
    const old=oldById.get(note.id);
    // A short local content excerpt keeps filename generation offline.
    const slug=(note.content.trim()||note.title).normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').replace(/^[#*\s-]+/,'').split(/\s+/).slice(0,8).join(' ').slice(0,60).replace(/[. ]+$/g,'')||'ghi-chu';
    const date=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(note.createdAt)).replace(/\//g,'-');
    const base=`${slug}_${date}`;
    let generated=`${base}.txt`,suffix=2;
    while(next.Notes.some(other=>other!==note&&other.fileName?.toLowerCase()===generated.toLowerCase())||(fs.existsSync(location(note,generated))&&(!old||location(old,old.fileName)!==location(note,generated))))generated=`${base}_${suffix++}.txt`;
    note.fileName=safeName(discovered.get(note.id)||generated);
    const file=location(note,note.fileName);
    if(fs.existsSync(file)&&(!old||location(old,old.fileName)!==file)&&!discovered.has(note.id))throw Error('File TXT đích đã tồn tại. Chưa ghi đè dữ liệu.');
    if(!fs.existsSync(file)||readText(file)!==note.content){backup(file);atomicWrite(file,Buffer.from(note.content,'utf8'));}
    if(old){const oldFile=location(old,old.fileName);if(oldFile!==file&&fs.existsSync(oldFile)){backup(oldFile);fs.unlinkSync(oldFile);}}
    note.hash=digest(note.content);delete note.content;
   }
   atomicWrite(manifestPath,JSON.stringify(next));
  }catch(error){
   let recoveryFailed=false;
   for(const [file,bytesBefore] of backups){try{if(bytesBefore===null){if(fs.existsSync(file))fs.unlinkSync(file);}else atomicWrite(file,bytesBefore);}catch{recoveryFailed=true;}}
   if(recoveryFailed)throw Error('Lưu TXT thất bại và chưa thể khôi phục toàn bộ file. Hãy kiểm tra ổ đĩa; không xóa bản sao cũ.');
   throw error;
  }
 }
 function loadBytes(){
  const manifest=readManifest();discovered=new Map();
  const empty=createNotesStore(SQL,{persist:()=>{}});const database=new SQL.Database(empty.exportData());empty.close();
  let imported=false;
  try{
   const knownNames=new Set(manifest.Notes.map(note=>safeName(note.fileName)));
   const notes=[];
   for(const stored of manifest.Notes){
    const note={...stored};let file=location(note,note.fileName);
    if(!fs.existsSync(file)){const alternate=location({...note,deleted:note.deleted?0:1},note.fileName);if(!fs.existsSync(alternate))continue;note.deleted=note.deleted?0:1;file=alternate;}
    note.content=readText(file);
    if(digest(note.content)!==note.hash){note.revision++;note.updatedAt=fs.statSync(file).mtime.toISOString();}
    notes.push(note);
   }
   for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.toLowerCase().endsWith('.txt')||knownNames.has(entry.name))continue;
    const name=safeName(entry.name),file=path.join(directory,name),content=readText(file),info=fs.statSync(file),id=randomUUID();
    notes.push({id,title:path.parse(name).name.slice(0,180)||'Ghi chú',content,revision:1,deleted:0,createdAt:info.birthtime.toISOString(),updatedAt:info.mtime.toISOString()});discovered.set(id,name);imported=true;
   }
   for(const note of notes)database.run('INSERT INTO Notes VALUES(?,?,?,?,?,?,?)',[note.id,note.title,note.content,note.revision,note.deleted,note.createdAt,note.updatedAt]);
   for(const row of manifest.NoteRevisions)database.run('INSERT INTO NoteRevisions(id,noteId,title,content,deleted,createdAt) VALUES(?,?,?,?,?,?)',[row.id,row.noteId,row.title,row.content,row.deleted,row.createdAt]);
   for(const row of manifest.NoteMessages)database.run('INSERT INTO NoteMessages(id,noteId,role,content,createdAt) VALUES(?,?,?,?,?)',[row.id,row.noteId,row.role,row.content,row.createdAt]);
   return {bytes:database.export(),imported};
  }finally{database.close();}
 }
 function sync(){
  if(closed)throw Error('Kho ghi chú đã thay đổi. Hãy tải lại ghi chú.');ensureDirectory(directory);
  const {bytes,imported}=loadBytes();if(imported)persist(bytes);
  const next=createNotesStore(SQL,{initialData:bytes,persist});if(memory)memory.close();memory=next;
 }
 if(initialData){if(fs.existsSync(manifestPath))throw Error('Thư mục này đã có kho TXT.');persist(initialData);}
 else if(!fs.existsSync(manifestPath)&&fs.existsSync(path.join(directory,'notes.sqlite'))){
  const legacy=createNotesStore(SQL,{initialData:fs.readFileSync(path.join(directory,'notes.sqlite')),persist:()=>{throw Error('Legacy database is read-only');}});
  try{persist(legacy.exportData());}finally{legacy.close();}
 }
 sync();
 const api={};
 for(const operation of ['list','get','create','update','trash','restore','undo','messages','addMessages','exportData'])api[operation]=(...args)=>{sync();return memory[operation](...args);};
 api.exportData=()=>{if(closed)throw Error('Kho ghi chú đã thay đổi.');if(fs.existsSync(directory))sync();return memory.exportData();};
 api.close=()=>{closed=true;if(memory)memory.close();};
 return api;
}
module.exports={createTextNotesStore};
