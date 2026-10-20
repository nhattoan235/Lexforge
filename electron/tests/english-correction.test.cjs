const test=require('node:test'),assert=require('node:assert/strict');
const {correctEnglish}=require('../english-correction.cjs');
const response=value=>async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(value)}}]})});
test('correction uses only supplied text and returns structured feedback',async()=>{
 let payload;const result=await correctEnglish('I usually spending my weekend at home.','key',async(_url,options)=>{payload=JSON.parse(options.body);return response({hasError:true,correctedText:'I usually spend my weekend at home.',explanation:'Thói quen dùng hiện tại đơn, chủ ngữ I đi với spend.'})();});
 assert.equal(payload.messages.at(-1).content,'I usually spending my weekend at home.');assert.equal(result.hasError,true);
});
test('rejects invalid input before sending and malformed suggestions',async()=>{
 const never=()=>{throw Error('must not fetch');};
 for(const input of ['',null,'a'.repeat(8001)])await assert.rejects(correctEnglish(input,'key',never),/8.000/);
 await assert.rejects(correctEnglish('hello','',never),/API key/);
 for(const value of [{hasError:'yes'}, {hasError:true,correctedText:'',explanation:'x'},{hasError:true,correctedText:'x',explanation:5}])await assert.rejects(correctEnglish('I spending','key',response(value)),/không hợp lệ/);
});
test('valid text has no replacement and failures are visible',async()=>{
 assert.deepEqual(await correctEnglish('I am usually working when you call.','key',response({hasError:false,correctedText:'ignored',explanation:'ignored'})),{hasError:false,correctedText:'',explanation:''});
 await assert.rejects(correctEnglish('I spending','key',async()=>({ok:false,status:429})),/giới hạn/);
});
