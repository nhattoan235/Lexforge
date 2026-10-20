const path=require('node:path');
const result=require('node:child_process').spawnSync(require('electron'),[path.join(__dirname,'../electron/tests/writing-drag.integration.cjs')],{stdio:'inherit',timeout:20000});
process.exit(result.status===null?1:result.status);
