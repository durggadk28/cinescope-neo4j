import {readLocalConfig} from '../server/local-config.js';
import { mkdirSync,writeFileSync } from 'node:fs';
import { initialize,query,close } from '../server/db.js';
import { catalogue } from '../server/queries.js';
import { csvCell } from '../server/helpers.js';
const schema=`// Run each statement separately in Neo4j Query. Compatible with Neo4j 5 and later.\nCREATE CONSTRAINT cinescope_id IF NOT EXISTS FOR (n:CineScope) REQUIRE n.id IS UNIQUE;\nCREATE CONSTRAINT cinescope_email IF NOT EXISTS FOR (n:CineAccount) REQUIRE n.email IS UNIQUE;\nCREATE CONSTRAINT cinescope_session IF NOT EXISTS FOR (n:CineSession) REQUIRE n.tokenHash IS UNIQUE;\nCREATE INDEX cinescope_movie_title IF NOT EXISTS FOR (n:CineScope) ON (n.title);\n`;
mkdirSync('cypher',{recursive:true});mkdirSync('reports',{recursive:true});mkdirSync('data',{recursive:true});
writeFileSync('cypher/01-schema.cypher',schema);
writeFileSync('cypher/03-demonstration-queries.cypher',`// Parameters for Neo4j Browser / Query: userId = CS-U101, showId = CS-SH401.\n// Use the in-app Query Studio to run these with parameters automatically.\n\n`+catalogue.map(q=>`// ${q.title}\n// ${q.description}\n${q.query};\n`).join('\n'));
await initialize({local:readLocalConfig()});
try{
 const counts=await query(`MATCH (n:CineScope) UNWIND [l IN labels(n) WHERE NOT l IN ['CineScope','CineAccount','DemoDataset']] AS label RETURN label,count(*) AS count ORDER BY label`);
 const relationships=await query(`MATCH (:CineScope)-[r]->(:CineScope) RETURN type(r) AS type,count(*) AS count ORDER BY type`);
 const version=await query(`CALL dbms.components() YIELD name,versions,edition RETURN name,versions,edition`);
 const constraints=await query(`SHOW CONSTRAINTS YIELD name,type,labelsOrTypes,properties WHERE name STARTS WITH 'cinescope' RETURN name,type,labelsOrTypes,properties`);
 const recommendation=await query(catalogue.find(q=>q.id==='recommendations').query,{userId:'CS-U101'});
 const available=await query(catalogue.find(q=>q.id==='availability').query,{showId:'CS-SH401'});
 writeFileSync('reports/database-evidence.json',JSON.stringify({capturedAt:new Date().toISOString(),version,counts,relationships,constraints,arunRecommendations:recommendation,interstellarAvailableSeats:available.length},null,2));
 const nodes=await query(`MATCH (n:CineScope) WHERE n.id =~ 'CS-(M[0-9]+|U10[1-4]|G-.+|L-.+|T[0-9]+|SC[0-9]+(-.+)?|SH[0-9]+|B[0-9]+)' RETURN labels(n) AS labels, properties(n) AS props ORDER BY n.id`);
 const edges=await query(`MATCH (a:CineScope)-[r]->(b:CineScope) WHERE a.id =~ 'CS-(M[0-9]+|U10[1-4]|G-.+|L-.+|T[0-9]+|SC[0-9]+(-.+)?|SH[0-9]+|B[0-9]+)' AND b.id =~ 'CS-(M[0-9]+|U10[1-4]|G-.+|L-.+|T[0-9]+|SC[0-9]+(-.+)?|SH[0-9]+|B[0-9]+)' RETURN a.id AS source,b.id AS target,type(r) AS type,properties(r) AS props`);
 function literal(v,key=''){if(v===null)return 'null';if(Array.isArray(v))return '['+v.map(x=>literal(x)).join(',')+']';if(typeof v==='number'||typeof v==='boolean')return String(v);const escaped=String(v).replaceAll('\\','\\\\').replaceAll("'","\\'");return ['startTime','createdAt','updatedAt','cancelledAt','generatedAt'].includes(key)?`datetime('${escaped}')`:`'${escaped}'`;}
 const props=p=>'{'+Object.entries(p).filter(([k])=>!['passwordHash','lock','tokenHash'].includes(k)).map(([k,v])=>`${k}:${literal(v,k)}`).join(',')+'}';
 writeFileSync('cypher/02-sample-model.cypher',`// Safe graph demonstration snapshot. No password hashes or sessions are exported.\n// For the complete application use Connect and import sample graph, which hashes demo-account passwords.\n// On a fresh database this file creates the model only; it does not create usable login credentials.\n// The app importer can subsequently initialize those credentials because this file has no seed-completion marker.\n// Screening dates below reflect the verified local sample. Adjust before a later demonstration.\n\n`+nodes.map(n=>`MERGE (n:${n.labels.join(':')} {id:${literal(n.props.id)}}) SET n += ${props(n.props)};`).join('\n')+'\n\n'+edges.map(e=>`MATCH (a:CineScope {id:${literal(e.source)}}),(b:CineScope {id:${literal(e.target)}}) MERGE (a)-[r:${e.type}]->(b) SET r += ${props(e.props)};`).join('\n')+'\n');
 const movieRows=await query(`MATCH (m:Movie:CineScope) RETURN m.id AS id,m.title AS title,m.year AS year,m.duration AS duration,m.rating AS sampleRating,[(m)-[:IN_GENRE]->(g:Genre)|g.name] AS genres,head([(m)-[:IN_LANGUAGE]->(l:Language)|l.name]) AS language ORDER BY id`);
 const columns=['id','title','year','duration','sampleRating','genres','language'];writeFileSync('data/movies.csv',[columns,...movieRows.map(m=>columns.map(k=>Array.isArray(m[k])?m[k].join('|'):m[k]))].map(r=>r.map(csvCell).join(',')).join('\r\n'));
 console.log(JSON.stringify({version,counts,relationships,constraints:constraints.length,availableSeats:available.length,topRecommendation:recommendation[0]?.movie.title},null,2));
}finally{await close();}
