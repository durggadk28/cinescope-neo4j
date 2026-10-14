import { fail } from './helpers.js';
export function validateDatabaseUri(uri,{hosted=false,save=false}={}) {
 const local=/^bolt:\/\/(127\.0\.0\.1|localhost):\d{1,5}$/.test(uri);
 let remote=false;
 try { const url=new URL(uri);remote=url.protocol==='neo4j+s:' && /^[a-zA-Z0-9-]+\.databases\.neo4j\.io$/.test(url.hostname) && !url.username && !url.password && !url.search && !url.hash && ['','/'].includes(url.pathname); } catch {}
 if((hosted && !remote) || (save && !local) || (!local && !remote)) fail(400,hosted?'Hosting requires a TLS secured Neo4j Aura connection.':'Use a local Bolt URI or a TLS secured Neo4j Aura URI.');
 return uri;
}
