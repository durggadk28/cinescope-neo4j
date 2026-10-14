import {readLocalConfig} from '../server/local-config.js';
// Explicitly reschedules only the 12 synthetic sample shows. Also moves their sample booking showtimes.
import {initialize,query,close} from '../server/db.js';
await initialize({local:readLocalConfig()});
try {
 const shows=Array.from({length:12},(_,i)=>({id:`CS-SH${401+i}`,day:Math.floor(i/3),hour:14+i%3*3}));
 await query(`WITH CASE WHEN date({timezone:'Asia/Kolkata'}) < date('2026-10-20') THEN date('2026-10-20') ELSE date({timezone:'Asia/Kolkata'})+duration('P1D') END AS firstDay
 UNWIND $shows AS row MATCH (s:Show:CineScope {id:row.id}) SET s.lock=coalesce(s.lock,0)+1,
 s.startTime=datetime({date:firstDay+duration({days:row.day}),time:localtime({hour:toInteger(row.hour),minute:30}),timezone:'Asia/Kolkata'})`,{shows},true);
 console.log('The 12 sample shows now begin on 20 October 2026 or tomorrow, whichever is later.');
}finally{await close();}
