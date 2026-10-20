// Chat lives in its own renderer; the mature writing/selection handlers stay untouched.
(()=>{
 const api=window.assistantAPI,frame=document.getElementById('chat-frame'),host=document.getElementById('chat-host'),tools=document.getElementById('chat-tools-mode'),chat=document.getElementById('chat-ai-mode');
 const brand=document.querySelector('.brand-lockup strong'),originalBrand=brand.textContent;
 let mode=localStorage.getItem('lexforge-floating-mode')==='chat'?'chat':'tools',expanded=false,latest=null,url='',loaded=false;
 const post=packet=>{if(loaded&&url)frame.contentWindow.postMessage(packet,new URL(url).origin==='null'?'*':new URL(url).origin);};
 const visibility=()=>post({kind:'lexforge-chat-visibility',visible:expanded&&mode==='chat'&&!document.hidden&&document.hasFocus()});
 const theme=()=>post({kind:'lexforge-chat-theme',theme:document.documentElement.dataset.theme==='dark'?'dark':'light'});
 function showMode(next){mode=next;brand.textContent=mode==='chat'?'Trợ lý AI':originalBrand;localStorage.setItem('lexforge-floating-mode',mode);document.body.classList.toggle('assistant-chat-mode',mode==='chat');host.hidden=mode!=='chat';tools.setAttribute('aria-pressed',String(mode==='tools'));chat.setAttribute('aria-pressed',String(mode==='chat'));if(mode==='chat'&&!url)load();visibility();}
 async function load(){try{const result=await api.chatRequest('url');if(!result.success)throw Error(result.error);url=result.data;loaded=false;frame.src=url;frame.hidden=false;}catch(error){host.textContent=error.message;}}
 frame.addEventListener('load',()=>{loaded=true;if(latest)post({kind:'lexforge-chat-state',state:latest});theme();visibility();});
 function state(next){latest=next;if(next.shortcut)chat.title='Mở chat: '+next.shortcut;const unread=next.conversations.some(c=>c.unread);document.getElementById('chat-unread-dot').hidden=!unread;document.getElementById('chat-tab-dot').hidden=!unread;post({kind:'lexforge-chat-state',state:next});}
 window.addEventListener('message',async event=>{if(!url||event.source!==frame.contentWindow||event.origin!==new URL(url).origin||event.data?.kind!=='lexforge-chat-request')return;const {id,operation,args}=event.data;if(typeof id!=='string'||!['snapshot','select','create','remove','draft','read','send','settings','claimSpeech'].includes(operation))return;const result=await api.chatRequest(operation,args);post({kind:'lexforge-chat-result',id,result});visibility();theme();});
 tools.addEventListener('click',()=>showMode('tools'));chat.addEventListener('click',()=>showMode('chat'));
 api.onOpenChat(()=>{showMode('chat');frame.focus();});api.onStateChange(next=>{expanded=!!next.expanded;visibility();});api.onChatChange(state);api.onThemeChange(theme);
 api.getState().then(next=>{expanded=!!next.expanded;visibility();});api.chatRequest('snapshot').then(result=>{if(result.success)state(result.data);});
 window.addEventListener('focus',visibility);window.addEventListener('blur',visibility);document.addEventListener('visibilitychange',visibility);
 new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 showMode(mode);
})();
