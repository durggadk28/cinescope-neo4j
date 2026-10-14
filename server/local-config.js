// Desktop-only configuration. Never imported by the hosted function.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const file=resolve('.env');
export function readLocalConfig(){
 if(!existsSync(file))return {};
 return Object.fromEntries(readFileSync(file,'utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#')&&x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
}
export function saveLocalConfig(input){
 const config={NEO4J_URI:input.NEO4J_URI||'bolt://127.0.0.1:7687',NEO4J_USER:input.NEO4J_USER||'neo4j',NEO4J_PASSWORD:input.NEO4J_PASSWORD,NEO4J_DATABASE:input.NEO4J_DATABASE||'neo4j'};
 writeFileSync(file,Object.entries(config).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
}
