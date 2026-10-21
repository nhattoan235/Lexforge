const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApiPool}=require('../api-pool.cjs');
const secret='gsk_'+ 'A'.repeat(44),other='gsk_'+ 'B'.repeat(44);
const encryption={isEncryptionAvailable:()=>true,encryptString:text=>Buffer.from('cipher:'+Buffer.from(text).toString('base64')),decryptString:buffer=>Buffer.from(buffer.toString().slice(7),'base64').toString()};
const setup=(options={})=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-api-'));return createApiPool({filePath:path.join(dir,'keys.json'),encryption,...options});};
const options={method:'POST',body:JSON.stringify({model:'openai/gpt-oss-120b',messages:[{role:'user',content:'hello'}]})};
test('stores encrypted keys, masks snapshots and caps the list at three',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-api-vault-')),filePath=path.join(dir,'keys.json');const pool=createApiPool({filePath,encryption});
 pool.add({label:'One',key:secret});assert.ok(!fs.readFileSync(filePath,'utf8').includes(secret));assert.ok(!JSON.stringify(pool.snapshot()).includes(secret));
 assert.throws(()=>pool.add({label:'Duplicate',key:secret}),/đã có/);
 pool.add({label:'Two',key:other});pool.add({label:'Three',key:'gsk_'+'C'.repeat(44)});assert.throws(()=>pool.add({label:'Four',key:'gsk_'+'D'.repeat(44)}),/3/);
 assert.equal(createApiPool({filePath,encryption}).snapshot().keys.length,3);
});
test('falls back across keys without sending the old Authorization header',async()=>{
 const calls=[];const pool=setup({fetchImpl:async(_url,input)=>{calls.push(input);return new Response('{}',{status:calls.length===1?429:200,headers:{'retry-after':'20'}});}});
 pool.add({label:'One',key:secret});pool.add({label:'Two',key:other});
 const response=await pool.fetch('https://api.groq.com/openai/v1/chat/completions',{...options,headers:{Authorization:'Bearer should-not-leak'}});
 assert.equal(response.status,200);assert.equal(calls.length,2);assert.equal(new Headers(calls[1].headers).get('Authorization'),'Bearer '+other);
 assert.equal(pool.snapshot().keys[0].models[0].status,'cooldown');
});
test('does not enable 20B or silently downgrade the reviewer',async()=>{
 const models=[];const pool=setup({fetchImpl:async(_url,input)=>{models.push(JSON.parse(input.body).model);return new Response('{}',{status:429,headers:{'retry-after':'10'}});}});pool.add({label:'One',key:secret});
 await pool.fetch('https://api.groq.com/openai/v1/chat/completions',options);assert.deepEqual(models,['openai/gpt-oss-120b']);
 pool.configure({allow20b:true});pool.toggle({id:pool.snapshot().keys[0].id,enabled:true});models.length=0;
 await pool.fetch('https://api.groq.com/openai/v1/chat/completions',{...options,body:JSON.stringify({messages:[{role:'system',content:'You are the bounded Lexforge English reviewer.'}]})});assert.deepEqual(models,['openai/gpt-oss-120b']);
});
test('401 disables a key until reset, 400 does not rotate, and disabling all keys stops egress',async()=>{
 let calls=0;const pool=setup({fetchImpl:async()=>{calls++;return new Response('{}',{status:401});}});pool.add({label:'One',key:secret});await pool.fetch('https://api.groq.com/openai/v1/chat/completions',options);assert.equal(pool.snapshot().keys[0].status,'invalid');
 const id=pool.snapshot().keys[0].id;pool.toggle({id,enabled:false});await assert.rejects(pool.fetch('https://api.groq.com/openai/v1/chat/completions',options),/key/);assert.equal(calls,1);
});
test('unavailable encryption never writes plaintext or migrates legacy credentials',()=>{
 const pool=setup({encryption:{isEncryptionAvailable:()=>false},getLegacyKey:()=>secret});assert.equal(pool.snapshot().encryptionAvailable,false);assert.throws(()=>pool.add({label:'New',key:other}),/mã hóa/);
});

test('20B is used only when explicitly enabled for generation',async()=>{
 const models=[];const pool=setup({fetchImpl:async(_url,input)=>{models.push(JSON.parse(input.body).model);return new Response('{}',{status:models.length===1?429:200});}});pool.add({label:'One',key:secret});pool.configure({allow20b:true});
 assert.equal((await pool.fetch('https://api.groq.com/openai/v1/chat/completions',options)).status,200);assert.deepEqual(models,['openai/gpt-oss-120b','openai/gpt-oss-20b']);
});
test('balances healthy keys and does not rotate on an invalid request',async()=>{
 const keys=[];const pool=setup({fetchImpl:async(_url,input)=>{keys.push(new Headers(input.headers).get('Authorization'));return new Response('{}',{status:200});}});pool.add({label:'One',key:secret});pool.add({label:'Two',key:other});
 await pool.fetch('https://api.groq.com/openai/v1/chat/completions',options);await pool.fetch('https://api.groq.com/openai/v1/chat/completions',options);assert.deepEqual(keys,['Bearer '+secret,'Bearer '+other]);
 let calls=0;const bad=setup({fetchImpl:async()=>{calls++;return new Response('{}',{status:400});}});bad.add({label:'One',key:secret});bad.add({label:'Two',key:other});bad.configure({allow20b:true});assert.equal((await bad.fetch('https://api.groq.com/openai/v1/chat/completions',options)).status,400);assert.equal(calls,1);
});
test('honors cooldowns, caller cancellation, and intentional removal of all keys',async()=>{
 let time=1000,calls=0;const pool=setup({now:()=>time,fetchImpl:async()=>{calls++;return new Response('{}',{status:calls===1?429:200,headers:{'retry-after':'20'}});}});pool.add({label:'One',key:secret});
 await pool.fetch('https://api.groq.com/openai/v1/chat/completions',options);await pool.fetch('https://api.groq.com/openai/v1/chat/completions',options);assert.equal(calls,1);time+=21000;assert.equal((await pool.fetch('https://api.groq.com/openai/v1/chat/completions',options)).status,200);
 await assert.rejects(pool.fetch('https://api.groq.com/openai/v1/chat/completions',{...options,signal:AbortSignal.abort()}),/thời gian/);assert.equal(calls,2);
 pool.remove({id:pool.snapshot().keys[0].id});await assert.rejects(pool.fetch('https://api.groq.com/openai/v1/chat/completions',options),/key/);assert.equal(calls,2);
});

test('migrates the default into the encrypted vault once and never revives deleted keys',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-api-migration-')),filePath=path.join(dir,'keys.json');
 const pool=createApiPool({filePath,encryption,getLegacyKey:()=>secret});assert.equal(pool.snapshot().keys.length,1);assert.notEqual(pool.snapshot().keys[0].id,'legacy');assert.ok(!fs.readFileSync(filePath,'utf8').includes(secret));
 pool.remove({id:pool.snapshot().keys[0].id});assert.equal(createApiPool({filePath,encryption,getLegacyKey:()=>secret}).snapshot().keys.length,0);
});
test('failed persistence leaves the previous vault and in-memory settings unchanged',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-api-persist-')),filePath=path.join(dir,'keys.json');const pool=createApiPool({filePath,encryption});pool.add({label:'One',key:secret});const before=fs.readFileSync(filePath,'utf8'),rename=fs.renameSync;
 try{fs.renameSync=()=>{throw Error('simulated persistence failure');};assert.throws(()=>pool.add({label:'Two',key:other}),/persistence/);}finally{fs.renameSync=rename;}
 assert.equal(pool.snapshot().keys.length,1);assert.equal(fs.readFileSync(filePath,'utf8'),before);
});
