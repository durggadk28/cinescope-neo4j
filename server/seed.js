import { movies } from '../data/movies.js';
import { transaction, rows, schema } from './db.js';
import { passwordHash } from './helpers.js';

export async function seed() {
 await schema();
 const hash = passwordHash('CinemaDemo2026!');
 return transaction(true, async tx => {
  const marker = await tx.run(`MERGE (d:CineScope:DemoDataset {id:'CS-DATASET-v1'}) ON CREATE SET d.complete=false SET d.lock=coalesce(d.lock,0)+1 RETURN d.complete AS complete`);
  if(marker.records[0].get('complete')) return {alreadySeeded:true};
  await tx.run(`UNWIND $movies AS row MERGE (m:Movie:CineScope {id:row.id})
   SET m.title=row.title, m.year=row.year, m.duration=row.duration, m.rating=row.rating,
       m.director=row.director, m.description=row.description, m.color=row.color, m.art=row.art, m.tagline=row.tagline
   WITH m,row UNWIND row.genres AS name
   MERGE (g:Genre:CineScope {id:'CS-G-'+replace(name,' ','-')}) SET g.name=name
   MERGE (m)-[:IN_GENRE]->(g)
   WITH DISTINCT m,row MERGE (l:Language:CineScope {id:'CS-L-'+row.language}) SET l.name=row.language
   MERGE (m)-[:IN_LANGUAGE]->(l)`, {movies});
  await tx.run(`UNWIND $users AS row MERGE (u:User:CineAccount:CineScope {id:row.id})
   SET u.name=row.name,u.email=row.email,u.passwordHash=$hash,u.demo=true,u.createdAt=datetime()`, {hash,users:[
   {id:'CS-U101',name:'Arun Kumar',email:'arun@example.com'},
   {id:'CS-U102',name:'Priya Sharma',email:'priya@example.com'},
   {id:'CS-U103',name:'Rahul Das',email:'rahul@example.com'},
   {id:'CS-U104',name:'Meera Nair',email:'meera@example.com'}]});
  await tx.run(`UNWIND $theatres AS row MERGE (t:Theatre:CineScope {id:row.id}) SET t.name=row.name,t.city='Chennai',t.state='Tamil Nadu'`, {theatres:[{id:'CS-T201',name:'PVR Chennai'},{id:'CS-T202',name:'INOX Chennai'}]});
  await tx.run(`UNWIND $screens AS row MATCH (t:Theatre:CineScope {id:row.theatre}) MERGE (sc:Screen:CineScope {id:row.id}) SET sc.name=row.name,sc.capacity=48 MERGE (t)-[:HAS_SCREEN]->(sc)
   WITH sc UNWIND ['A','B','C','D','E','F'] AS letter UNWIND range(1,8) AS num
   MERGE (seat:Seat:CineScope {id:sc.id+'-'+letter+toString(num)}) SET seat.number=letter+toString(num),seat.row=letter,seat.column=num,seat.type=CASE WHEN letter IN ['E','F'] THEN 'Premium' ELSE 'Regular' END MERGE (sc)-[:HAS_SEAT]->(seat)`, {screens:[{id:'CS-SC301',theatre:'CS-T201',name:'Screen 1'},{id:'CS-SC302',theatre:'CS-T201',name:'Screen 2'},{id:'CS-SC303',theatre:'CS-T202',name:'Screen 1'}]});
  const shows=Array.from({length:12},(_,i)=>({id:`CS-SH${401+i}`,movie:movies[i].id,screen:`CS-SC${301+i%3}`,price:200+(i%4)*50,day:1+Math.floor(i/3),hour:14+(i%3)*3}));
  await tx.run(`WITH CASE WHEN date({timezone:'Asia/Kolkata'}) < date('2026-10-20') THEN date('2026-10-20') ELSE date({timezone:'Asia/Kolkata'})+duration('P1D') END AS firstDay
   UNWIND $shows AS row MATCH (m:Movie:CineScope {id:row.movie}),(sc:Screen:CineScope {id:row.screen})
   MERGE (s:Show:CineScope {id:row.id}) SET s.ticketPrice=row.price,s.startTime=datetime({date:firstDay+duration({days:row.day-1}),time:localtime({hour:toInteger(row.hour),minute:30}),timezone:'Asia/Kolkata'})
   MERGE (s)-[:SCREENING_OF]->(m) MERGE (s)-[:USES_SCREEN]->(sc)`, {shows});
  await tx.run(`UNWIND $ratings AS row MATCH (u:User:CineScope {id:row.u}),(m:Movie:CineScope {id:row.m}) MERGE (u)-[r:RATED]->(m) SET r.stars=row.stars,r.updatedAt=datetime()`, {ratings:[
   {u:'CS-U101',m:'CS-M101',stars:5},{u:'CS-U101',m:'CS-M102',stars:4},
   {u:'CS-U102',m:'CS-M101',stars:5},{u:'CS-U102',m:'CS-M105',stars:5},{u:'CS-U102',m:'CS-M107',stars:4},
   {u:'CS-U103',m:'CS-M104',stars:5},{u:'CS-U103',m:'CS-M113',stars:5},{u:'CS-U103',m:'CS-M117',stars:4},
   {u:'CS-U104',m:'CS-M109',stars:5},{u:'CS-U104',m:'CS-M110',stars:4},{u:'CS-U104',m:'CS-M114',stars:5}]});
  await tx.run(`UNWIND $bookings AS row MATCH (u:User:CineScope {id:row.u}),(s:Show:CineScope {id:row.show})
   MERGE (b:Booking:CineScope {id:row.id}) SET b.status=row.status,b.tickets=size(row.seats),b.amount=s.ticketPrice*size(row.seats),b.createdAt=datetime(),b.paymentMethod='DEMO',b.paymentStatus=CASE WHEN row.status='CANCELLED' THEN 'SIMULATED_REFUND' ELSE 'SIMULATED_PAID' END
   MERGE (u)-[:BOOKED]->(b) MERGE (b)-[:FOR_SHOW]->(s)
   WITH b,row UNWIND row.seats AS seatId MATCH (seat:Seat:CineScope {id:seatId}) MERGE (b)-[:BOOKED_SEAT]->(seat)`, {bookings:[
   {id:'CS-B501',u:'CS-U101',show:'CS-SH401',status:'CONFIRMED',seats:['CS-SC301-A1','CS-SC301-A2']},
   {id:'CS-B502',u:'CS-U102',show:'CS-SH402',status:'CONFIRMED',seats:['CS-SC302-C4']},
   {id:'CS-B503',u:'CS-U103',show:'CS-SH401',status:'CANCELLED',seats:['CS-SC301-A3']}]});
  await tx.run(`MATCH (u:User:CineScope {id:'CS-U101'}),(m:Movie:CineScope {id:'CS-M106'}) MERGE (u)-[r:SAVED]->(m) SET r.createdAt=datetime()`);
  await tx.run(`MATCH (d:DemoDataset:CineScope {id:'CS-DATASET-v1'}) SET d.complete=true,d.seededAt=datetime()`);
  return {alreadySeeded:false};
 });
}
