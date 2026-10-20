const path=require('node:path');
const result=require('node:child_process').spawnSync(require('electron'),[path.join(__dirname,'../electron/tests/floating-chat.integration.cjs')],{stdio:'inherit',timeout:70000});
process.exit(result.status===null?1:result.status);
