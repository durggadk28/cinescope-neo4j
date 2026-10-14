import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const site=JSON.parse(readFileSync('.local/netlify-site.json','utf8'));
const cloud=JSON.parse(readFileSync('.local/cloud-credentials.json','utf8'));
const file='.local/netlify-cloud.env';
writeFileSync(file,Object.entries(cloud).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
const run=args=>execFileSync(process.execPath,['node_modules/netlify-cli/bin/run.js',...args],{encoding:'utf8',windowsHide:true,env:{...process.env,NETLIFY_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let stage='import';
try {
 run(['env:import',file,'--site',site.id,'--json']);
 stage='secret marking';
 run(['env:set','NEO4J_PASSWORD','--secret','--force','--site',site.id,'--json']);
 console.log('Configured four cloud database variables. NEO4J_PASSWORD is marked as a secret.');
}catch(e){let message=String(e.stderr||e.stdout||e.message);for(const value of Object.values(cloud))if(value)message=message.replaceAll(value,'[redacted]');console.error('Netlify environment configuration failed at',stage,'Exit status:',e.status,message);process.exitCode=1;}
