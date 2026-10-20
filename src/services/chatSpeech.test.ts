import {test,expect,jest} from '@jest/globals';
import {createChatSpeech} from './chatSpeech';
function setup(voices:any[]){const spoken:any[]=[];const synthesis={getVoices:()=>voices,cancel:jest.fn(),speak:(sentence:any)=>spoken.push(sentence)} as unknown as SpeechSynthesis;const state=jest.fn(),error=jest.fn();const reader=createChatSpeech(state,error,{synthesis,utterance:()=>({}) as SpeechSynthesisUtterance});return {reader,state,error,spoken,synthesis};}
test('reads English and Vietnamese with local voices only and toggles stop',async()=>{
 const localEn={lang:'en-US',localService:true},localVi={lang:'vi-VN',localService:true};const {reader,spoken,state,synthesis}=setup([{lang:'en-US',localService:false},localEn,localVi]);
 await reader.play('a','Hello there');expect(spoken[0].voice).toBe(localEn);await reader.play('a','Hello there');expect(state).toHaveBeenLastCalledWith(null);expect(spoken).toHaveLength(1);
 await reader.play('b','Xin chào bạn');expect(spoken[1].voice).toBe(localVi);expect(synthesis.cancel).toHaveBeenCalled();
});
test('missing local Vietnamese voice reports error instead of using a remote voice',async()=>{const {reader,error,spoken}=setup([{lang:'en-US',localService:true},{lang:'vi-VN',localService:false}]);await reader.play('a','Xin chào bạn');expect(spoken).toHaveLength(0);expect(error).toHaveBeenCalled();});
test('long messages continue in chunks and cancellation prevents stale continuation',async()=>{const {reader,spoken,state}=setup([{lang:'en-US',localService:true}]);await reader.play('a','Long text. '.repeat(100));expect(spoken).toHaveLength(1);spoken[0].onend();expect(spoken).toHaveLength(2);reader.stop();spoken[1].onend();expect(spoken).toHaveLength(2);expect(state).toHaveBeenLastCalledWith(null);});
