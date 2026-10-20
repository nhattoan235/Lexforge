const {app,BrowserWindow,ipcMain}=require('electron'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{pathToFileURL}=require('node:url');
const root=process.env.LEXFORGE_TEST_APP_ROOT||path.resolve(__dirname,'../..');app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-draft-correction-')));
let checks=0,sends=0;const snapshot={selectedId:'test',autoRead:false,conversations:[{id:'test',title:'Test',messages:[],draft:'',pending:false,unread:false}]};
ipcMain.handle('assistant:get-state',()=>({enabled:true,expanded:true}));ipcMain.handle('assistant:get-theme',()=> 'light');
ipcMain.handle('assistant:chat',async(_event,operation,args)=>{
 if(operation==='correctEnglish'){checks++;return {success:true,data:{hasError:true,correctedText:'I usually spend my weekend at home.',explanation:'Hiện tại đơn, chủ ngữ I dùng spend.'}};}
 if(operation==='send')sends++;
 if(operation==='draft')snapshot.conversations[0].draft=args.text;
 return {success:true,data:operation==='url'?pathToFileURL(path.join(root,'build/index.html')).href+'?assistantChat=1':snapshot};
});
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){for(let i=0;i<150;i++){if(await fn())return;await pause(100);}throw Error('Timed out');}
(async()=>{await app.whenReady();const win=new BrowserWindow({show:false,width:440,height:740,webPreferences:{contextIsolation:true,sandbox:true,preload:path.join(root,'electron/assistant-widget-preload.js')}});win.webContents.setBackgroundThrottling(false);await win.loadFile(path.join(root,'electron/assistant-widget.html'));await win.webContents.executeJavaScript("Object.defineProperty(document,'hidden',{get:()=>false});document.hasFocus=()=>true;document.querySelector('#chat-ai-mode').click();true");let frame;
await until(()=>{frame=win.webContents.mainFrame.frames.find(f=>f.url.includes('assistantChat=1'));return !!frame;});
await until(()=>frame.executeJavaScript("!!document.querySelector('.lf-chat textarea')"));
await frame.executeJavaScript(`window.dispatchEvent(new MessageEvent('message',{source:window.parent,data:{kind:'lexforge-chat-visibility',visible:true}}));const field=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'I usually spending my weekend at home.');field.dispatchEvent(new Event('input',{bubbles:true}));true`);
await until(()=>frame.executeJavaScript("!!document.querySelector('.lf-chat-correction')"));assert.equal(checks,1);assert.equal(sends,0);
assert.equal(await frame.executeJavaScript("document.querySelector('textarea').value"),'I usually spending my weekend at home.');
await frame.executeJavaScript("document.querySelector('.lf-chat-correction button').click();true");
assert.equal(await frame.executeJavaScript("document.querySelector('textarea').value"),'I usually spend my weekend at home.');assert.equal(sends,0);
console.log('PASS: file-based floating chat auto-checks, displays suggestion below input, applies only on click and never sends chat');app.exit(0);
})().catch(e=>{console.error(e.message);app.exit(1);});
