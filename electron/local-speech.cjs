const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
async function probe(){try{const response=await fetch('http://127.0.0.1:5000/health',{signal:AbortSignal.timeout(1000)});const status=await response.json();return status.service==='faster-whisper'&&status.processing==='local'&&status.ready===true;}catch{return false;}}
function startLocalSpeech(resourcesPath,dependencies={}){
 const health=dependencies.probe||probe,launch=dependencies.spawn||spawn,exists=dependencies.exists||fs.existsSync,wait=dependencies.wait||(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 let child,stopped=false;
 const ready=(async()=>{if(await health()||stopped)return;
  const executable=path.join(resourcesPath,'speech','lexforge-speech.exe');if(!exists(executable))throw Error('Không tìm thấy bộ nhận dạng local trong bản đóng gói.');
  let launchError;child=launch(executable,[],{windowsHide:true,stdio:'ignore',env:{...process.env,LEXFORGE_SPEECH_MODELS:path.join(resourcesPath,'speech','models'),PYTHONIOENCODING:'utf-8'}});child.once('error',error=>{launchError=error;});
  for(let attempt=0;attempt<60&&!stopped;attempt++){if(launchError)throw launchError;if(child.exitCode!==null)throw Error('Bộ nhận dạng local đã dừng trước khi sẵn sàng.');if(await health())return;await wait(500);}
  if(!stopped)throw Error('Bộ nhận dạng local chưa sẵn sàng. Hãy mở lại Lexforge.');
 })();
 return {ready,stop(){stopped=true;if(child&&!child.killed)child.kill();}};
}
module.exports={startLocalSpeech};
