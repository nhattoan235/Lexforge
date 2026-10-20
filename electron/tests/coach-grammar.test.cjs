const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../src/pages/AICoachPage.tsx'), 'utf8');
const effect = source.slice(source.indexOf('  // Debounced grammar check;'), source.indexOf('  // Dismiss selection tooltip'));
for (const state of [
 {mode:'speaking',isListening:false,isTranscribing:false,expected:1},
 {mode:'speaking',isListening:true,isTranscribing:false,expected:0},
 {mode:'speaking',isListening:false,isTranscribing:true,expected:0},
 {mode:'writing',isListening:false,isTranscribing:false,expected:1},
]) test(`grammar suggestions: ${JSON.stringify(state)}`, () => {
 let scheduled=0;
 const noop=()=>{};
 vm.runInNewContext(effect, {...state,input:'I usually spending my weekend at home',apiKey:'',grammarRetry:0,AbortController,
 setGrammarResult:noop,setGrammarError:noop,setIsCheckingGrammar:noop,
 useEffect:fn=>fn(),setTimeout:()=>{scheduled++;return 1;},clearTimeout:noop});
 assert.equal(scheduled,state.expected);
});
