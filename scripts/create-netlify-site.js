import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
const cli='node_modules/netlify-cli/bin/run.js';
const linked=existsSync('.netlify/state.json')?JSON.parse(readFileSync('.netlify/state.json','utf8')):null;
if(linked?.siteId){console.log('Project already linked:',linked.siteId);process.exit(0);}
const output=execFileSync(process.execPath,[cli,'sites:create','--name','cinescope-movies-dk28','--account-slug','durggadk28','--json'],{encoding:'utf8',windowsHide:true,env:{...process.env,NETLIFY_TELEMETRY_DISABLED:'1'}});
const site=JSON.parse(output.slice(output.indexOf('{')));
const safe={id:site.id,name:site.name,url:site.url,ssl_url:site.ssl_url,admin_url:site.admin_url,account_slug:site.account_slug};
mkdirSync('.local',{recursive:true});writeFileSync('.local/netlify-site.json',JSON.stringify(safe,null,2));
console.log(JSON.stringify(safe,null,2));
