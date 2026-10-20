const {app,BrowserWindow,ipcMain}=require('electron'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{pathToFileURL}=require('node:url');
const root=process.env.LEXFORGE_TEST_APP_ROOT||path.resolve(__dirname,'../..');app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-file-repro-')));app.commandLine.appendSwitch('use-fake-device-for-media-stream');app.commandLine.appendSwitch('use-file-for-fake-audio-capture',path.resolve('models/test-fixtures/english.wav'));
const chatUrl=pathToFileURL(path.join(root,'build/index.html')).href+'?assistantChat=1';
const snapshot={selectedId:'test',autoRead:false,conversations:[{id:'test',title:'File chat test',messages:[],draft:'',pending:false,unread:false}]};
ipcMain.handle('assistant:get-state',()=>({enabled:true,expanded:true}));ipcMain.handle('assistant:get-theme',()=> 'light');ipcMain.handle('assistant:open-panel',()=>({enabled:true,expanded:true}));ipcMain.handle('assistant:chat',(_event,op)=>({success:true,data:op==='url'?chatUrl:snapshot}));
(async()=>{await app.whenReady();const win=new BrowserWindow({width:440,height:740,show:false,webPreferences:{contextIsolation:true,sandbox:true,preload:path.join(root,'electron/assistant-widget-preload.js')}});win.webContents.setBackgroundThrottling(false);await win.loadFile(path.join(root,'electron/assistant-widget.html'));await win.webContents.executeJavaScript("window.__origins=[];window.addEventListener('message',e=>window.__origins.push({origin:e.origin,sourceMatches:e.source===document.querySelector('#chat-frame').contentWindow,sourceNull:e.source===null,kind:e.data?.kind}));document.querySelector('#chat-frame').addEventListener('load',()=>window.__origins.push({loaded:true}));document.querySelector('#chat-ai-mode').click();true");
let frame;for(let i=0;i<100;i++){frame=win.webContents.mainFrame.frames.find(f=>f.url.includes('assistantChat=1'));if(frame&&await frame.executeJavaScript("!!document.querySelector('.lf-chat')"))break;await new Promise(r=>setTimeout(r,100));}
await frame.executeJavaScript("window.__received=[];window.addEventListener('message',e=>window.__received.push({kind:e.data?.kind,id:e.data?.id,sourceMatches:e.source===window.parent}));true");
const media=await frame.executeJavaScript("navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());return 'ok';}).catch(e=>e.name+': '+e.message)");
const messages=await frame.executeJavaScript("new Promise(resolve=>{const id='file-repro';const receive=e=>{if(e.data?.kind==='lexforge-chat-result'&&e.data.id===id){window.removeEventListener('message',receive);resolve('ok');}};window.addEventListener('message',receive);window.parent.postMessage({kind:'lexforge-chat-request',id,operation:'snapshot',args:{}},'*');setTimeout(()=>resolve('timeout'),3000);})");
console.log(JSON.stringify({media,messages,origins:await win.webContents.executeJavaScript('window.__origins'),expectedOrigin:await win.webContents.executeJavaScript("new URL(document.querySelector('#chat-frame').src).origin"),received:await frame.executeJavaScript('window.__received')})) ;
if(media!=='ok'||messages!=='ok'){app.exit(1);return;}
if(process.env.LEXFORGE_TEST_DICTATION==='1'){
 await frame.executeJavaScript(`document.querySelector('[aria-label="Nhập giọng nói"]').click();true`);
 await new Promise(r=>setTimeout(r,4000));
 const recording=await frame.executeJavaScript(`!!document.querySelector('[aria-label="Dừng ghi âm"]')`);if(!recording)throw Error('Packaged dictation stopped before capture: '+await frame.executeJavaScript("document.body.innerText"));
 await frame.executeJavaScript(`document.querySelector('[aria-label="Dừng ghi âm"]').click();true`);
 let transcript='';for(let i=0;i<300;i++){transcript=await frame.executeJavaScript("document.querySelector('textarea').value");if(transcript.trim())break;await new Promise(r=>setTimeout(r,100));}
 if(!transcript.trim())throw Error('Packaged dictation did not produce text');console.log('PASS: packaged local VAD, MediaRecorder and offline transcription');
}
console.log('PASS: file-based chat bridge and delegated microphone');app.exit(0);
})().catch(e=>{console.error(e);app.exit(1);});
