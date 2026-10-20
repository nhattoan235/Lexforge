const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const initSqlJs = require('sql.js');
const { createNotesStorage } = require('../notes-storage.cjs');

test('failed settings persistence leaves the original library and destination untouched', async t => {
 const SQL=await initSqlJs();const root=fs.mkdtempSync(path.join(os.tmpdir(),'lexforge-storage-failure-'));
 t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));assert.ok(path.basename(root).startsWith('lexforge-storage-failure-'));fs.rmSync(root,{recursive:true,force:true});});
 const original=path.join(root,'original'),target=path.join(root,'target');fs.mkdirSync(original);fs.mkdirSync(target);
 const manager=createNotesStorage(SQL,{defaultDirectory:original,getDirectory:()=>original,setDirectory:()=>{throw Error('settings disk full');}});
 manager.getStore().create({title:'Keep',content:'original'});
 assert.throws(()=>manager.changeDirectory(target),/settings disk full/);
 assert.equal(manager.status().directory,original);assert.equal(manager.getStore().list().length,1);assert.equal(fs.existsSync(path.join(target,'notes.sqlite')),false);manager.close();
});
