import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const site=JSON.parse(readFileSync('.local/netlify-site.json','utf8'));
try {
 const output=execFileSync(process.execPath,['node_modules/netlify-cli/bin/run.js','deploy','--prod','--no-build','--dir','public','--functions','netlify/functions','--site',site.id,'--json'],{encoding:'utf8',windowsHide:true,env:{...process.env,NETLIFY_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024});
 writeFileSync('.local/netlify-deploy-result.json',output);
 const result=JSON.parse(output.slice(output.indexOf('{')));
 const safe={siteId:site.id,name:site.name,deployId:result.deploy_id||result.id,url:result.site_url||site.ssl_url,deployUrl:result.deploy_url,adminUrl:site.admin_url,deployedAt:new Date().toISOString()};
 writeFileSync('reports/netlify-deployment.json',JSON.stringify(safe,null,2));console.log(JSON.stringify(safe,null,2));
}catch(e){let message=String(e.stderr||'')+'\n'+String(e.stdout||'');const cloud=JSON.parse(readFileSync('.local/cloud-credentials.json','utf8'));for(const value of Object.values(cloud))if(value)message=message.replaceAll(value,'[redacted]');console.error('Netlify deployment did not complete cleanly. Exit status:',e.status||'parse error',message.slice(-4000));process.exitCode=1;}
