import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {handleRequest} from '../server/http.js';
import {validateDatabaseUri} from '../server/connection-settings.js';
import {readConfig} from '../server/db.js';
async function hostedRequest(path,method='GET',origin='https://cinescope.example') {
 const req=Readable.from(method==='GET'?[]:[Buffer.from('{}')]);
 req.method=method;req.url=path;req.headers={host:'cinescope.example',origin,'content-type':'application/json'};
 let status,body;const headers={};const res={headersSent:false,setHeader(k,v){headers[k]=v},writeHead(s,h){status=s;Object.assign(headers,h);this.headersSent=true},end(b){body=b}};
 await handleRequest(req,res,{hosted:true,origin:'https://cinescope.example'});
 return {status,body:JSON.parse(body),headers};
}
test('Hosted connections accept Aura with TLS and reject local or unencrypted databases',()=>{
 assert.equal(validateDatabaseUri('neo4j+s://example.databases.neo4j.io',{hosted:true}),'neo4j+s://example.databases.neo4j.io');
 for(const uri of ['bolt://127.0.0.1:7687','neo4j://example.databases.neo4j.io','neo4j+s://user:password@example.databases.neo4j.io','neo4j+s://unrelated.example'])assert.throws(()=>validateDatabaseUri(uri,{hosted:true}));
});
test('Hosted runtime never reads the local database credential file',()=>{const c=readConfig({hosted:true});if(!process.env.NEO4J_PASSWORD)assert.equal(c.NEO4J_PASSWORD,undefined);});
test('Public hosting has no credential setup or import endpoint',async()=>{for(const path of ['/api/setup','/api/seed'])assert.equal((await hostedRequest(path,'POST')).status,404);});
test('Hosted health identifies deployment mode without exposing credentials',async()=>{const r=await hostedRequest('/api/health');assert.equal(r.status,200);assert.equal(r.body.hosted,true);assert.equal(JSON.stringify(r.body).includes('PASSWORD'),false);});
test('Hosted writes reject a different origin',async()=>assert.equal((await hostedRequest('/api/auth/login','POST','https://attacker.example')).status,403));
