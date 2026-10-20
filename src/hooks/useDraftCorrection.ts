import {useEffect,useRef,useState} from 'react';
import {chatRequest} from '../services/conversations';
export interface DraftCorrection {hasError:boolean;correctedText:string;explanation:string;}
export function useDraftCorrection(text:string,conversationId:string,enabled:boolean){
 const [state,setState]=useState<{text:string;id:string;result:DraftCorrection|null;checking:boolean;error:string}>({text:'',id:'',result:null,checking:false,error:''});
 const generation=useRef(0),timer=useRef<ReturnType<typeof setTimeout>>();
 useEffect(()=>{
  generation.current++;
  setState({text,id:conversationId,result:null,checking:false,error:''});
  if(enabled&&conversationId&&text.trim().split(/\s+/).length>=2&&text.length<=8000&&/[a-z]/i.test(text))timer.current=setTimeout(()=>void check(),1000);
  return()=>{generation.current++;clearTimeout(timer.current);};
 },[text,conversationId,enabled]);
 const check=async()=>{
  if(!enabled||!conversationId||!text.trim()||text.length>8000)return;
  clearTimeout(timer.current);
  const request=++generation.current;
  setState({text,id:conversationId,result:null,checking:true,error:''});
  try{const result=await chatRequest<DraftCorrection>('correctEnglish',{text});if(request===generation.current)setState({text,id:conversationId,result,checking:false,error:''});}
  catch(e:any){if(request===generation.current)setState({text,id:conversationId,result:null,checking:false,error:e.message||'Không kiểm tra được câu.'});}
 };
 const current=enabled&&state.text===text&&state.id===conversationId;
 return {result:current?state.result:null,checking:current&&state.checking,error:current?state.error:'',check};
}
