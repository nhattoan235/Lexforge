const fs=require('node:fs');const path=require('node:path');
const {createNotesStore}=require('./notes-store.cjs');
const {createTextNotesStore}=require('./notes-text-store.cjs');
function validateDirectory(directory){
 if(typeof directory!=='string'||!directory.trim()||!path.isAbsolute(directory))throw Error('Hãy nhập đường dẫn thư mục tuyệt đối hoặc bấm Chọn thư mục.');
 if(!fs.existsSync(directory))throw Error(`Thư mục lưu không tồn tại hoặc chưa kết nối: ${directory}`);
 if(!fs.statSync(directory).isDirectory())throw Error('Đường dẫn lưu phải là một thư mục.');
 fs.accessSync(directory,fs.constants.R_OK|fs.constants.W_OK);
 return fs.realpathSync(directory);
}
function createNotesStorage(SQL,{defaultDirectory,getDirectory,setDirectory}){
 let directory=getDirectory()||defaultDirectory;
 let current=null,loadError='';
 try{validateDirectory(directory);current=createTextNotesStore(SQL,{directory});}catch(error){loadError=error.message;}
 function status(){
  let error='';try{validateDirectory(directory);if(!current){current=createTextNotesStore(SQL,{directory});loadError='';}}catch(e){error=e.message;}
  return {directory,filePath:directory,format:'txt',valid:!error,error};
 }
 return {
  status,
  getStore(){
   validateDirectory(directory);
   if(!current){current=createTextNotesStore(SQL,{directory});loadError='';}
   return current;
  },
  changeDirectory(requested){
   const target=validateDirectory(requested);
   if(path.resolve(target).toLowerCase()===path.resolve(directory).toLowerCase()){
    if(loadError&&!current)throw Error(loadError);
    return status();
   }
   const metadata=path.join(target,'.lexforge-notes');
   if(fs.existsSync(path.join(target,'notes.sqlite'))||fs.existsSync(metadata)||fs.readdirSync(target).some(name=>/\.txt$/i.test(name)))
    throw Error('Thư mục này đã có ghi chú. Hãy chọn thư mục trống khác để không ghi đè dữ liệu.');
   const source=current||createNotesStore(SQL,{persist:()=>{}});
   const bytes=source.exportData();
   let candidate=null;
   try{
    candidate=createTextNotesStore(SQL,{directory:target,initialData:bytes});
    setDirectory(target);
   }catch(error){
    if(candidate)candidate.close();
    const manifest=path.join(metadata,'state.json');
    if(fs.existsSync(manifest)){
     const state=JSON.parse(fs.readFileSync(manifest,'utf8'));
     for(const note of state.Notes){
      if(note.fileName!==path.basename(note.fileName))continue;
      const created=path.resolve(note.deleted?path.join(metadata,'trash'):target,note.fileName);
      if(!created.startsWith(path.resolve(target)+path.sep))throw Error('Unsafe rollback path');
      if(fs.existsSync(created))fs.unlinkSync(created);
     }
    }
    if(fs.existsSync(metadata)){
     if(path.resolve(metadata)!==path.join(path.resolve(target),'.lexforge-notes'))throw Error('Unsafe rollback directory');
     fs.rmSync(metadata,{recursive:true,force:true});
    }
    if(!current)source.close();throw error;
   }
   source.close();current=candidate;directory=target;loadError='';return status();
  },
  close(){if(current)current.close();current=null;},
 };
}
module.exports={createNotesStorage,validateDirectory};
