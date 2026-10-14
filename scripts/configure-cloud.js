import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { connect,query,close } from '../server/db.js';
import { seed } from '../server/seed.js';
const credentialFile=process.argv[2];
if(!credentialFile)throw new Error('Pass the downloaded Aura credential file path.');
const values=Object.fromEntries(readFileSync(credentialFile,'utf8').split(/\r?\n/).filter(s=>s.includes('=')&&!s.trim().startsWith('#')).map(line=>{const at=line.indexOf('=');let value=line.slice(at+1).trim();if(value.startsWith('"')&&value.endsWith('"'))value=value.slice(1,-1);return [line.slice(0,at).trim(),value];}));
const cloud={NEO4J_URI:values.NEO4J_URI,NEO4J_USER:values.NEO4J_USER||values.NEO4J_USERNAME||'neo4j',NEO4J_PASSWORD:values.NEO4J_PASSWORD,NEO4J_DATABASE:values.NEO4J_DATABASE||'neo4j'};
try {
 await connect(cloud,false,{hosted:true});
 const result=await seed();
 const counts=await query(`MATCH (n:CineScope) RETURN count(n) AS nodes`);
 mkdirSync('.local',{recursive:true});
 writeFileSync('.local/cloud-credentials.json',JSON.stringify(cloud),{mode:0o600});
 writeFileSync('reports/cloud-database-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),connected:true,seeded:!result.alreadySeeded,nodes:counts[0].nodes},null,2));
 console.log('Aura connected. Sample graph nodes:',counts[0].nodes);
 console.log('Cloud configuration saved in ignored local storage. No credential values displayed.');
} catch(e) {let message=String(e.message||'');for(const value of Object.values(cloud))if(value)message=message.replaceAll(value,'[redacted]');console.error('Aura setup failed:',e.code || e.name,message);process.exitCode=1;}
finally {await close();}
