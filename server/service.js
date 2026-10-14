import { randomBytes } from 'node:crypto';
import { query, transaction, rows } from './db.js';
import { AppError, fail, uid, tokenHash, passwordHash, passwordMatches, textField, emailField, idField, validateSeats } from './helpers.js';
import { movieProjection, recommendations, catalogue } from './queries.js';

export async function account(token) {
 if(!token) return null;
 const [row]=await query(`MATCH (s:CineSession {tokenHash:$hash})-[:FOR_USER]->(u:User:CineScope) WHERE s.expiresAt > datetime() RETURN u { .id,.name,.email,.demo } AS user`,{hash:tokenHash(token)});
 return row?.user || null;
}
export async function signIn(body, register=false) {
 const email=emailField(body.email);
 const password=textField(body.password,'Password',register?10:1,128);
 let user;
 if(register) {
  const name=textField(body.name,'Name',2,70);
  const [r]=await query(`CREATE (u:User:CineAccount:CineScope {id:$id,name:$name,email:$email,passwordHash:$hash,createdAt:datetime(),demo:false}) RETURN u { .id,.name,.email,.demo } AS user`,{id:uid('U'),name,email,hash:passwordHash(password)},true);
  user=r.user;
 } else {
  const [r]=await query(`MATCH (u:User:CineAccount {email:$email}) RETURN u { .id,.name,.email,.demo,.passwordHash } AS user`,{email});
  if(!r || !passwordMatches(password,r.user.passwordHash)) fail(401,'Email or password is incorrect.');
  const {passwordHash:_,...safe}=r.user; user=safe;
 }
 const token=randomBytes(32).toString('hex');
 await query(`MATCH (u:User:CineScope {id:$id}) CREATE (s:CineSession {tokenHash:$hash,expiresAt:datetime()+duration('P7D')}) CREATE (s)-[:FOR_USER]->(u)`,{id:user.id,hash:tokenHash(token)},true);
 return {user,token};
}
export async function signOut(token) { if(token) await query(`MATCH (s:CineSession {tokenHash:$hash}) DETACH DELETE s`,{hash:tokenHash(token)},true); }

export async function movies(user) {
 return query(`MATCH (m:Movie:CineScope) OPTIONAL MATCH (u:User:CineScope {id:$userId}) OPTIONAL MATCH (u)-[r:RATED]->(m) RETURN ${movieProjection} AS movie, coalesce(r.stars,0) AS myRating, EXISTS { MATCH (u)-[:SAVED]->(m) } AS saved ORDER BY m.rating DESC,m.title`,{userId:user?.id || ''});
}
export async function shows(movieId='') {
 return query(`MATCH (s:Show:CineScope)-[:SCREENING_OF]->(m:Movie),(s)-[:USES_SCREEN]->(sc:Screen)<-[:HAS_SCREEN]-(t:Theatre)
 WHERE $movieId='' OR m.id=$movieId
 RETURN s { .id,.ticketPrice,startTime:toString(s.startTime),movieId:m.id,title:m.title,screenId:sc.id,screen:sc.name,theatre:t.name,city:t.city,
 available:size([(sc)-[:HAS_SEAT]->(seat:Seat) WHERE NOT EXISTS { MATCH (b:Booking:CineScope {status:'CONFIRMED'})-[:FOR_SHOW]->(s) MATCH (b)-[:BOOKED_SEAT]->(seat) } | seat]),capacity:sc.capacity } AS show ORDER BY s.startTime`,{movieId});
}
export async function seats(showId) {
 idField(showId);
 const result=await query(`MATCH (s:Show:CineScope {id:$id})-[:USES_SCREEN]->(sc:Screen)-[:HAS_SEAT]->(seat:Seat)
 RETURN seat { .id,.number,.row,.column,.type,booked:EXISTS { MATCH (b:Booking:CineScope {status:'CONFIRMED'})-[:FOR_SHOW]->(s) MATCH (b)-[:BOOKED_SEAT]->(seat) } } AS seat ORDER BY seat.row,seat.column`,{id:showId});
 if(!result.length) fail(404,'Show not found.'); return result;
}
export async function rating(user,movieId,body) {
 idField(movieId);
 const stars=body.stars;
 if(!Number.isInteger(stars) || stars<0 || stars>5) fail(400,'Rating must be a whole number from 1 to 5, or 0 to remove it.');
 const cypher=stars?`MATCH (u:User:CineScope {id:$userId}),(m:Movie:CineScope {id:$movieId}) MERGE (u)-[r:RATED]->(m) SET r.stars=$stars,r.updatedAt=datetime() RETURN m.title AS title`:`MATCH (u:User:CineScope {id:$userId}),(m:Movie:CineScope {id:$movieId}) OPTIONAL MATCH (u)-[r:RATED]->(m) DELETE r RETURN m.title AS title`;
 await transaction(true,async tx=>{
  await tx.run(`MATCH (u:User:CineScope {id:$id}) SET u.lock=coalesce(u.lock,0)+1`,{id:user.id});
  const r=await tx.run(cypher,{userId:user.id,movieId,stars}); if(!r.records.length) fail(404,'Movie not found.');
 });
 return {message:stars?'Your rating was saved.':'Your rating was removed.',trace:[{query:cypher,params:{userId:user.id,movieId,stars}}]};
}
export async function saveMovie(user,movieId,body) {
 idField(movieId); if(typeof body.saved!=='boolean') fail(400,'Saved must be true or false.');
 const cypher=body.saved?`MATCH (u:User:CineScope {id:$userId}),(m:Movie:CineScope {id:$movieId}) MERGE (u)-[r:SAVED]->(m) ON CREATE SET r.createdAt=datetime() RETURN m.title AS title`:`MATCH (u:User:CineScope {id:$userId}),(m:Movie:CineScope {id:$movieId}) OPTIONAL MATCH (u)-[r:SAVED]->(m) DELETE r RETURN m.title AS title`;
 await transaction(true,async tx=>{
  await tx.run(`MATCH (u:User:CineScope {id:$id}) SET u.lock=coalesce(u.lock,0)+1`,{id:user.id});
  if(!(await tx.run(cypher,{userId:user.id,movieId})).records.length) fail(404,'Movie not found.');
 });
 return {message:body.saved?'Added to your watchlist.':'Removed from your watchlist.',trace:[{query:cypher,params:{userId:user.id,movieId}}]};
}
export async function recommended(user) { return query(recommendations,{userId:user.id}); }
export async function refreshRecommendations(user) {
 const cypher=`MATCH (u:User:CineScope {id:$userId}) OPTIONAL MATCH (u)-[old:RECOMMENDED]->(:Movie) DELETE old WITH DISTINCT u UNWIND $items AS row MATCH (m:Movie:CineScope {id:row.id}) CREATE (u)-[:RECOMMENDED {score:row.score,reason:row.reason,generatedAt:datetime()}]->(m)`;
 const result=await transaction(true, async tx=>{
  await tx.run(`MATCH (u:User:CineScope {id:$id}) SET u.lock=coalesce(u.lock,0)+1`,{id:user.id});
  const results=rows(await tx.run(recommendations,{userId:user.id}));
  const items=results.map(r=>({id:r.movie.id,score:r.score,reason:r.matchingGenres.length?`Shared genres: ${r.matchingGenres.join(', ')}; similar viewers: ${r.similarViewers}`:'Catalogue rating fallback'}));
  await tx.run(cypher,{userId:user.id,items});return {results,items};
 });
 return {message:'Recommendation snapshot saved.',recommendations:result.results,trace:[{query:cypher,params:{userId:user.id,items:result.items}}]};
}
export async function bookings(user) {
 return query(`MATCH (u:User:CineScope {id:$id})-[:BOOKED]->(b:Booking)-[:FOR_SHOW]->(s:Show)-[:SCREENING_OF]->(m:Movie)
 MATCH (s)-[:USES_SCREEN]->(sc:Screen)<-[:HAS_SCREEN]-(t:Theatre) OPTIONAL MATCH (b)-[:BOOKED_SEAT]->(seat:Seat)
 WITH b,s,m,sc,t,collect(seat.number) AS seatNumbers
 RETURN b { .id,.status,.tickets,.amount,.paymentStatus,.paymentMethod,createdAt:toString(b.createdAt),startTime:toString(s.startTime),title:m.title,movieId:m.id,theatre:t.name,screen:sc.name,seats:seatNumbers } AS booking ORDER BY b.createdAt DESC`,{id:user.id});
}
export async function book(user,body) {
 const showId=idField(body.showId), seatIds=validateSeats(body.seatIds), bookingId=uid('B');
 const cypher=`MATCH (u:User:CineScope {id:$userId}),(s:Show:CineScope {id:$showId}) CREATE (b:Booking:CineScope {id:$bookingId,status:'CONFIRMED',tickets:$tickets,amount:$amount,createdAt:datetime(),paymentMethod:'DEMO',paymentStatus:'SIMULATED_PAID'}) CREATE (u)-[:BOOKED]->(b) CREATE (b)-[:FOR_SHOW]->(s) WITH b UNWIND $seatIds AS seatId MATCH (seat:Seat:CineScope {id:seatId}) CREATE (b)-[:BOOKED_SEAT]->(seat)`;
 const params=await transaction(true,async tx=>{
  // Serialize availability checks for this show before reading any seat state.
  const lock=await tx.run(`MATCH (s:Show:CineScope {id:$id}) SET s.lock=coalesce(s.lock,0)+1 RETURN s.ticketPrice AS price, s.startTime > datetime() AS future`,{id:showId});
  if(!lock.records.length) fail(404,'Show not found.');
  if(!lock.records[0].get('future')) fail(409,'This show has already started.');
  const valid=await tx.run(`MATCH (s:Show:CineScope {id:$id})-[:USES_SCREEN]->(:Screen)-[:HAS_SEAT]->(seat:Seat) WHERE seat.id IN $seatIds AND NOT EXISTS { MATCH (b:Booking:CineScope {status:'CONFIRMED'})-[:FOR_SHOW]->(s) MATCH (b)-[:BOOKED_SEAT]->(seat) } RETURN count(DISTINCT seat) AS available`,{id:showId,seatIds});
  if(valid.records[0].get('available').toNumber()!==seatIds.length) fail(409,'One or more seats are no longer available. Please choose again.');
  const params={userId:user.id,showId,bookingId,seatIds,tickets:seatIds.length,amount:rows(lock)[0].price*seatIds.length};
  await tx.run(cypher,params);return params;
 });
 return {message:'Booking confirmed. Payment is simulated; no money was charged.',bookingId,trace:[{query:cypher,params}]};
}
export async function cancel(user,bookingId) {
 idField(bookingId);
 const cypher=`MATCH (u:User:CineScope {id:$userId})-[:BOOKED]->(b:Booking:CineScope {id:$bookingId}) SET b.status='CANCELLED',b.paymentStatus='SIMULATED_REFUND',b.cancelledAt=datetime() RETURN b.id AS id`;
 await transaction(true,async tx=>{
  const pointer=await tx.run(`MATCH (:User:CineScope {id:$userId})-[:BOOKED]->(b:Booking:CineScope {id:$bookingId})-[:FOR_SHOW]->(s:Show) RETURN s.id AS showId`,{userId:user.id,bookingId});
  if(!pointer.records.length) fail(404,'Booking not found.');
  await tx.run(`MATCH (s:Show:CineScope {id:$id}) SET s.lock=coalesce(s.lock,0)+1`,{id:pointer.records[0].get('showId')});
  const current=await tx.run(`MATCH (b:Booking:CineScope {id:$id})-[:FOR_SHOW]->(s:Show) RETURN b.status AS status,s.startTime > datetime() AS future`,{id:bookingId});
  if(current.records[0].get('status')!=='CONFIRMED') fail(409,'This booking is already cancelled.');
  if(!current.records[0].get('future')) fail(409,'A booking cannot be cancelled after the show starts.');
  await tx.run(cypher,{userId:user.id,bookingId});
 });
 return {message:'Booking cancelled and seats released. Refund is simulated.',trace:[{query:cypher,params:{userId:user.id,bookingId}}]};
}
export async function insights(user) {
 const [r]=await query(`MATCH (u:User:CineScope {id:$id})
 RETURN size([(u)-[:RATED]->(m:Movie) | m]) AS rated,
 size([(u)-[:SAVED]->(m:Movie) | m]) AS saved,
 size([(u)-[:BOOKED]->(b:Booking) WHERE b.status='CONFIRMED' | b]) AS confirmed,
 reduce(total=0,b IN [(u)-[:BOOKED]->(b:Booking) WHERE b.status='CONFIRMED' | b] | total+b.amount) AS amount`,{id:user.id});
 const genres=await query(`MATCH (:User:CineScope {id:$id})-[r:RATED]->(:Movie)-[:IN_GENRE]->(g:Genre) RETURN g.name AS genre,count(r) AS films,round(avg(r.stars),1) AS average ORDER BY films DESC,genre`,{id:user.id});
 return {...r,genres};
}
export async function graph(user) {
 // Catalogue connections plus ONLY the signed-in user's interactions. Explicit property projections.
 const edges=await query(`MATCH (m:Movie:CineScope)-[r:IN_GENRE|IN_LANGUAGE]->(n:CineScope) RETURN m.id AS source,n.id AS target,type(r) AS type
 UNION ALL MATCH (u:User:CineScope {id:$id})-[r:RATED|SAVED|RECOMMENDED]->(m:Movie:CineScope) RETURN u.id AS source,m.id AS target,type(r) AS type`,{id:user.id});
 const nodes=await query(`MATCH (n:CineScope) WHERE n:Movie OR n:Genre OR n:Language OR n.id=$id RETURN n.id AS id,coalesce(n.title,n.name) AS name,CASE WHEN n:Movie THEN 'Movie' WHEN n:Genre THEN 'Genre' WHEN n:Language THEN 'Language' ELSE 'User' END AS type`,{id:user.id});
 return {nodes,edges,truncated:false};
}
export async function studio(user,id,body) {
 const entry=catalogue.find(q=>q.id===id);if(!entry) fail(404,'Query not found.');
 const params={userId:user.id,showId:body.showId? idField(body.showId):'CS-SH401'};
 const start=performance.now(); const result=await query(entry.query,params);
 return {title:entry.title,query:entry.query,params,rows:result,milliseconds:Math.round(performance.now()-start)};
}
