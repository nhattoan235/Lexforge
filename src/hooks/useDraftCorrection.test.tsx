import {jest,test,expect,beforeEach,afterEach} from '@jest/globals';
import React from 'react';
import {createRoot,Root} from 'react-dom/client';
import {act} from 'react-dom/test-utils';
import {useDraftCorrection} from './useDraftCorrection';
import {chatRequest} from '../services/conversations';
jest.mock('../services/conversations');
const request=chatRequest as any;
let root:Root,container:HTMLDivElement,current:ReturnType<typeof useDraftCorrection>;
function Probe({text,id='A',enabled=true}:{text:string;id?:string;enabled?:boolean}){current=useDraftCorrection(text,id,enabled);return null;}
const render=(text:string,id='A',enabled=true)=>act(()=>root.render(<Probe text={text} id={id} enabled={enabled}/>));
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;jest.useFakeTimers();request.mockReset();container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();jest.useRealTimers();});
test('debounces edits and sends only the final draft',async()=>{
 request.mockResolvedValue({hasError:true,correctedText:'I spend weekends at home.',explanation:'Hiện tại đơn.'});
 render('I spending');act(()=>{jest.advanceTimersByTime(700);});render('I spending weekends at home.');
 act(()=>{jest.advanceTimersByTime(999);});expect(request).not.toHaveBeenCalled();
 await act(async()=>{jest.advanceTimersByTime(1);});expect(request).toHaveBeenCalledTimes(1);expect(request).toHaveBeenCalledWith('correctEnglish',{text:'I spending weekends at home.'});expect(current.result?.hasError).toBe(true);
});
test('ignores replies after an edit or conversation switch',async()=>{
 let resolve:any;request.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 render('I spending weekends');act(()=>{jest.advanceTimersByTime(1000);});render('Another draft','B');
 await act(async()=>{resolve({hasError:true,correctedText:'old',explanation:'old'});});expect(current.result).toBeNull();expect(current.checking).toBe(false);
});
test('does not send when hidden, recording, composing, pending or over the limit',()=>{
 render('I spending weekends','A',false);act(()=>{jest.advanceTimersByTime(2000);});expect(request).not.toHaveBeenCalled();
 render('word '.repeat(1700));act(()=>{jest.advanceTimersByTime(2000);});expect(request).not.toHaveBeenCalled();
});
test('manual retry surfaces failures and no-error response',async()=>{
 request.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({hasError:false,correctedText:'',explanation:''});
 render('I spend weekends at home.');await act(async()=>{jest.advanceTimersByTime(1000);});expect(current.error).toBe('offline');
 await act(async()=>{await current.check();});expect(current.error).toBe('');expect(current.result?.hasError).toBe(false);
});
