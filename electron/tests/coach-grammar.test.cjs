const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../src/pages/AICoachPage.tsx'), 'utf8');
const effect = source.slice(source.indexOf('  // Debounced grammar check;'), source.indexOf('  // Dismiss selection tooltip'))
 .replace('chatRequest<{hasError:boolean;correctedText:string;explanation:string}>', 'chatRequest');
for (const state of [
 {mode:'speaking',isListening:false,isTranscribing:false,expected:1},
 {mode:'speaking',isListening:true,isTranscribing:false,expected:0},
 {mode:'speaking',isListening:false,isTranscribing:true,expected:0},
 {mode:'writing',isListening:false,isTranscribing:false,expected:1},
]) test(`grammar suggestions: ${JSON.stringify(state)}`, async () => {
 let scheduled=0,timer,request;
 const noop=()=>{};
 vm.runInNewContext(effect, {...state,input:'I usually spending my weekend at home',grammarRetry:0,AbortController,
 chatRequest:async(operation,args)=>{request={operation,args};return {hasError:false,correctedText:'',explanation:''};},
 setGrammarResult:noop,setGrammarError:noop,setIsCheckingGrammar:noop,
 useEffect:fn=>fn(),setTimeout:fn=>{scheduled++;timer=fn;return 1;},clearTimeout:noop});
 assert.equal(scheduled,state.expected);
 if(timer){await timer();assert.equal(request.operation,'correctEnglish');assert.equal(request.args.mode,state.mode);}
 else assert.equal(request,undefined);
});
