import {readLocalConfig} from '../server/local-config.js';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync,writeFileSync } from 'node:fs';
import { initialize,query,close } from '../server/db.js';
import { seed } from '../server/seed.js';
import { tokenHash } from '../server/helpers.js';
const adapterMode=process.env.TEST_NETLIFY_ADAPTER==='1';
const base=process.env.TEST_BASE_URL||(adapterMode?'https://cinescope.test':'http://localhost:3000');
const netlifyHandler=adapterMode?(await import('../netlify/functions/api.mjs')).default:null;
const sendFetch=(url,options)=>adapterMode?netlifyHandler(new Request(url,options)):fetch(url,options);
const prefix=`CS-TEST-${randomBytes(5).toString('hex')}`;
const checks=[],createdUsers=[],sessions=[];
async function request(path,method='GET',body,cookie){const r=await sendFetch(base+'/api'+path,{method,headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function check(name,fn){await fn();checks.push({name,passed:true});console.log('PASS',name);}
let failed;
await initialize({local:readLocalConfig()});
try{
 await check('Neo4j is connected',async()=>assert.equal((await request('/health')).data.connected,true));
 await check('Sample import is idempotent',async()=>{const [a]=await query('MATCH (n:CineScope) RETURN count(n) AS n');assert.equal((await seed()).alreadySeeded,true);const [b]=await query('MATCH (n:CineScope) RETURN count(n) AS n');assert.equal(a.n,b.n);});
 const users=[];
 await check('Registration and persisted password hashes',async()=>{for(const suffix of ['a','b']){const email=`${prefix.toLowerCase()}-${suffix}@example.com`;const r=await request('/auth/register','POST',{name:`Verifier ${suffix}`,email,password:'LiveVerification2026!'});assert.equal(r.status,200);createdUsers.push(r.data.user.id);sessions.push(r.cookie.slice(11));users.push(r);const [stored]=await query('MATCH (u:CineScope {id:$id}) RETURN u.passwordHash AS hash',{id:r.data.user.id});assert.notEqual(stored.hash,'LiveVerification2026!');assert.ok(stored.hash.includes(':'));assert.equal(JSON.stringify(r.data).includes('passwordHash'),false);}});
 const a=users[0].cookie,b=users[1].cookie;
 await check('All workspace reads and CSV export succeed',async()=>{for(const path of ['/shows','/shows/CS-SH401/seats','/bookings','/insights'])assert.equal((await request(path,'GET',undefined,a)).status,200,path);const r=await sendFetch(base+'/api/export',{headers:{Cookie:a}});assert.equal(r.status,200);assert.ok((await r.text()).includes('paymentStatus'));});
 await check('Anonymous API access is rejected',async()=>assert.equal((await request('/movies')).status,401));
 await check('Movie catalogue reads from Neo4j',async()=>{const r=await request('/movies','GET',undefined,a);assert.equal(r.status,200);assert.equal(r.data.movies.length,18);assert.equal(r.data.movies.find(m=>m.movie.id==='CS-M103').movie.title,'Avatar');});
 await check('Rating create update and delete persist',async()=>{for(const stars of [4,5,0]){const r=await request('/movies/CS-M118/rating','PUT',{stars},a);assert.equal(r.status,200);const movie=(await request('/movies','GET',undefined,a)).data.movies.find(m=>m.movie.id==='CS-M118');assert.equal(movie.myRating,stars);}});
 await check('Watchlists stay private and can be removed',async()=>{assert.equal((await request('/movies/CS-M118/save','PUT',{saved:true},a)).status,200);const mine=(await request('/movies','GET',undefined,a)).data.movies.find(m=>m.movie.id==='CS-M118');const other=(await request('/movies','GET',undefined,b)).data.movies.find(m=>m.movie.id==='CS-M118');assert.equal(mine.saved,true);assert.equal(other.saved,false);assert.equal((await request('/movies/CS-M118/save','PUT',{saved:false},a)).status,200);});
 await check('Recommendations exclude rated films and provide reasons',async()=>{await request('/movies/CS-M101/rating','PUT',{stars:5},a);const r=await request('/recommendations','GET',undefined,a);assert.equal(r.status,200);assert.ok(r.data.recommendations.length);assert.ok(r.data.recommendations.every(x=>x.movie.id!=='CS-M101'));assert.ok(r.data.recommendations[0].matchingGenres.length);assert.equal((await request('/recommendations/refresh','POST',{},a)).status,200);});
 const showId=prefix+'-SHOW',seat1=prefix+'-SEAT1',seat2=prefix+'-SEAT2',screenId=prefix+'-SCREEN';
 await query(`MATCH (m:Movie:CineScope {id:'CS-M101'}),(t:Theatre:CineScope {id:'CS-T201'}) CREATE (sc:Screen:CineScope:CineTest {id:$screenId,name:'Isolated verification screen',capacity:2}) CREATE (t)-[:HAS_SCREEN]->(sc) CREATE (s:Show:CineScope:CineTest {id:$showId,ticketPrice:200,startTime:datetime()+duration('P1D')}) CREATE (s)-[:USES_SCREEN]->(sc) CREATE (s)-[:SCREENING_OF]->(m) WITH sc UNWIND $seats AS row CREATE (seat:Seat:CineScope:CineTest {id:row.id,number:row.number,row:'A',column:row.column,type:'Regular'}) CREATE (sc)-[:HAS_SEAT]->(seat)`,{screenId,showId,seats:[{id:seat1,number:'A1',column:1},{id:seat2,number:'A2',column:2}]},true);
 let bookingId,winner,loser;
 await check('Concurrent requests cannot double-book one seat',async()=>{const results=await Promise.all([request('/bookings','POST',{showId,seatIds:[seat1]},a),request('/bookings','POST',{showId,seatIds:[seat1]},b)]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);const index=results.findIndex(r=>r.status===201);bookingId=results[index].data.bookingId;winner=index===0?a:b;loser=index===0?b:a;const [row]=await query(`MATCH (b:Booking:CineScope {status:'CONFIRMED'})-[:FOR_SHOW]->(:Show {id:$id}) MATCH (b)-[:BOOKED_SEAT]->(:Seat {id:$seat}) RETURN count(b) AS n`,{id:showId,seat:seat1});assert.equal(row.n,1);});
 await check('Users cannot cancel another account booking',async()=>assert.equal((await request(`/bookings/${bookingId}/cancel`,'POST',{},loser)).status,404));
 await check('Duplicate and wrong-screen seats are rejected',async()=>{assert.equal((await request('/bookings','POST',{showId,seatIds:[seat2,seat2]},a)).status,400);assert.equal((await request('/bookings','POST',{showId,seatIds:['CS-SC301-A1']},a)).status,409);});
 await check('Cancellation releases seats and retains history',async()=>{assert.equal((await request(`/bookings/${bookingId}/cancel`,'POST',{},winner)).status,200);const r=await request(`/shows/${showId}/seats`,'GET',undefined,a);assert.equal(r.data.seats.find(x=>x.seat.id===seat1).seat.booked,false);assert.equal((await request(`/bookings/${bookingId}/cancel`,'POST',{},winner)).status,409);});
 await check('Booking rejects a show that has started',async()=>{await query('MATCH (s:Show:CineScope {id:$id}) SET s.startTime=datetime()-duration("PT1M")',{id:showId},true);assert.equal((await request('/bookings','POST',{showId,seatIds:[seat2]},a)).status,409);});
 await check('Graph responses do not expose private account fields',async()=>{const r=await request('/graph','GET',undefined,a);assert.equal(r.status,200);const json=JSON.stringify(r.data);for(const forbidden of ['passwordHash','tokenHash','NEO4J_PASSWORD',users[1].data.user.id])assert.equal(json.includes(forbidden),false);});
 await check('Every curated Cypher query executes',async()=>{const queries=(await request('/studio','GET',undefined,a)).data.queries;assert.equal(queries.length,10);for(const q of queries){const r=await request('/studio/'+q.id,'POST',{},a);assert.equal(r.status,200,q.id+' '+JSON.stringify(r.data));}});
 await check('Arbitrary Cypher is not accepted as a studio action',async()=>assert.equal((await request('/studio/arbitrary','POST',{query:'MATCH (n) DETACH DELETE n'},a)).status,404));
 await check('Cross-origin writes are rejected',async()=>{const r=await sendFetch(base+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com',Cookie:a},body:'{}'});assert.equal(r.status,403);});
 await check('Session revocation prevents further access',async()=>{assert.equal((await request('/auth/logout','POST',{},a)).status,200);assert.equal((await request('/movies','GET',undefined,a)).status,401);});
}catch(e){failed=e;console.error('FAIL',e.message);process.exitCode=1;}
finally{
 // Remove only disposable records created by this verification run, never the sample graph.
 for(const userId of createdUsers){await query(`MATCH (u:CineScope {id:$id}) OPTIONAL MATCH (u)-[:BOOKED]->(b:Booking) WITH u,collect(b) AS bookings FOREACH (b IN bookings | DETACH DELETE b) DETACH DELETE u`,{id:userId},true);}
 await query('MATCH (n:CineTest) WHERE n.id STARTS WITH $prefix DETACH DELETE n',{prefix},true);
 for(const token of sessions)await query('MATCH (s:CineSession {tokenHash:$hash}) DETACH DELETE s',{hash:tokenHash(token)},true);
 await close();mkdirSync('reports',{recursive:true});writeFileSync(process.env.TEST_EVIDENCE_PATH||(adapterMode?'reports/netlify-adapter-verification.json':'reports/verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),checks,passed:checks.length,failed:failed?failed.message:null},null,2));
 console.log(`Completed ${checks.length} live checks. Disposable fixtures removed.`);
}
