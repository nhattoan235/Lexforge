const languageOf=(text:string)=>/[ăâđêôơư\u1EA0-\u1EF9àáãèéìíòóõùúý]/iu.test(text)?'vi':'en';
export function createChatSpeech(onChange:(id:string|null)=>void,onError:(message:string)=>void,dependencies?:{synthesis:SpeechSynthesis;utterance:()=>SpeechSynthesisUtterance}){
 const synthesis=dependencies?.synthesis||(typeof window!=='undefined'?window.speechSynthesis:undefined);
 const utterance=dependencies?.utterance||(()=>new SpeechSynthesisUtterance());
 let generation=0,current:string|null=null;
 const stop=()=>{generation++;current=null;synthesis?.cancel();onChange(null);};
 async function play(id:string,text:string){
  if(current===id){stop();return;}
  stop();if(!text.trim())return;
  if(!synthesis){onError('Máy chưa hỗ trợ đọc văn bản.');return;}
  const token=generation;current=id;onChange(id);
  let voices=synthesis.getVoices();
  if(!voices.some(voice=>voice.localService))await new Promise<void>(resolve=>{let timeout:ReturnType<typeof setTimeout>;const ready=()=>{clearTimeout(timeout);synthesis.removeEventListener('voiceschanged',ready);resolve();};synthesis.addEventListener('voiceschanged',ready);timeout=setTimeout(ready,1000);});
  if(token!==generation)return;
  voices=synthesis.getVoices().filter(voice=>voice.localService);
  const chunks=text.match(/[\s\S]{1,350}(?:\s|$)|[\s\S]{1,350}/g)||[];
  let index=0;
  const next=()=>{if(token!==generation)return;if(index>=chunks.length){current=null;onChange(null);return;}
   const chunk=chunks[index++],language=languageOf(chunk),voice=voices.find(item=>item.lang.toLowerCase().replace('_','-')===(language==='vi'?'vi-vn':'en-us'))||voices.find(item=>item.lang.toLowerCase().startsWith(language));
   if(!voice){current=null;onChange(null);onError(`Máy chưa có giọng đọc ${language==='vi'?'tiếng Việt':'tiếng Anh'} cục bộ. Hãy cài giọng nói đó trong cài đặt Windows.`);return;}
   const sentence=utterance();sentence.text=chunk;sentence.voice=voice;sentence.lang=voice.lang;sentence.rate=1;
   sentence.onend=next;sentence.onerror=()=>{if(token!==generation)return;current=null;onChange(null);onError('Không phát được giọng đọc. Hãy thử lại.');};
   try{synthesis.speak(sentence);}catch{sentence.onerror?.({} as SpeechSynthesisErrorEvent);}
  };next();
 }
 return {play,stop};
}
