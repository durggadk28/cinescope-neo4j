import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { connect, configured, health } from './db.js';
import { seed } from './seed.js';
import { AppError, fail, csvCell } from './helpers.js';
import * as service from './service.js';
import { catalogue } from './queries.js';

const port=Number(process.env.PORT || 3000), publicDir=resolve('public');
const attempts=new Map();
function send(res,status,body,type='application/json; charset=utf-8') {
 res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
 res.end(type.startsWith('application/json')?JSON.stringify(body):body);
}
async function body(req) {
 if(!req.headers['content-type']?.startsWith('application/json')) fail(415,'Send JSON data.');
 let bytes=0,parts=[];for await(const part of req){bytes+=part.length;if(bytes>65536)fail(413,'Request too large.');parts.push(part);}
 try{return JSON.parse(Buffer.concat(parts).toString() || '{}');}catch{fail(400,'Invalid JSON.');}
}
function rateLimit(key,limit=20) {
 const now=Date.now(),previous=attempts.get(key);
 const current=!previous || previous.until<now?{count:0,until:now+60000}:previous;
 current.count++; attempts.set(key,current);if(current.count>limit)fail(429,'Too many attempts. Wait a minute and try again.');
}
export async function handleRequest(req,res,{hosted=false,origin,localSetup}={}) {
 try {
  const host=req.headers.host || '';
  if(hosted) { if(!origin || !origin.startsWith('https://') || host!==new URL(origin).host) fail(403,'Use the hosted application address.'); }
  else if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host)) fail(403,'Use the local application address.');
  const appOrigin=hosted?origin:`http://${host}`;
  const url=new URL(req.url,appOrigin),path=url.pathname;
  if(path.startsWith('/api/')) {
   if(!['GET','POST','PUT','DELETE'].includes(req.method)) fail(405,'Method not allowed.');
   if(req.method!=='GET' && req.headers.origin!==appOrigin) fail(403,'Requests must come from this local application.');
   const data=req.method!=='GET'?await body(req):{};
   if(path==='/api/health' && req.method==='GET') return send(res,200,{...await health(),hosted});
   if(path==='/api/setup' && req.method==='POST') {
    if(hosted)fail(404,'Database setup is available only on your local computer.');
    rateLimit('setup',10);if(configured())fail(409,'Database is already configured. Edit the local .env file and restart to change it.');
    await connect(data,true);if(localSetup)localSetup(data);return send(res,200,{message:'Connected to your local Neo4j database.'});
   }
   if(path==='/api/seed' && req.method==='POST' && hosted)fail(404,'Sample import is managed by the site owner.');
   if(path==='/api/seed' && req.method==='POST') return send(res,200,{...await seed(),message:'Sample graph is ready.'});
   if(!configured())fail(503,hosted?'The site database is not connected yet.':'Connect Neo4j on the setup screen first.');
   const token=(req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('cs_session='))?.slice(11);
   if(['/api/auth/login','/api/auth/register'].includes(path) && req.method==='POST') {
    rateLimit('auth',15); const result=await service.signIn(data,path.endsWith('register'));
    res.setHeader('Set-Cookie',`cs_session=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${hosted?'; Secure':''}`);
    return send(res,200,{user:result.user});
   }
   if(path==='/api/auth/logout' && req.method==='POST') {
    await service.signOut(token);res.setHeader('Set-Cookie',`cs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${hosted?'; Secure':''}`);return send(res,200,{message:'Signed out.'});
   }
   const user=await service.account(token);
   if(path==='/api/me' && req.method==='GET') return send(res,200,{user});
   if(!user)fail(401,'Sign in to continue.');
   if(path==='/api/movies' && req.method==='GET')return send(res,200,{movies:await service.movies(user)});
   if(path==='/api/shows' && req.method==='GET')return send(res,200,{shows:await service.shows(url.searchParams.get('movieId') || '')});
   const seatMatch=path.match(/^\/api\/shows\/(CS-[A-Za-z0-9-]+)\/seats$/);
   if(seatMatch && req.method==='GET')return send(res,200,{seats:await service.seats(seatMatch[1])});
   const movieMatch=path.match(/^\/api\/movies\/(CS-[A-Za-z0-9-]+)\/(rating|save)$/);
   if(movieMatch && req.method==='PUT')return send(res,200,await service[movieMatch[2]==='rating'?'rating':'saveMovie'](user,movieMatch[1],data));
   if(path==='/api/recommendations' && req.method==='GET')return send(res,200,{recommendations:await service.recommended(user)});
   if(path==='/api/recommendations/refresh' && req.method==='POST')return send(res,200,await service.refreshRecommendations(user));
   if(path==='/api/bookings' && req.method==='GET')return send(res,200,{bookings:await service.bookings(user)});
   if(path==='/api/bookings' && req.method==='POST')return send(res,201,await service.book(user,data));
   const cancelMatch=path.match(/^\/api\/bookings\/(CS-[A-Za-z0-9-]+)\/cancel$/);
   if(cancelMatch && req.method==='POST')return send(res,200,await service.cancel(user,cancelMatch[1]));
   if(path==='/api/insights' && req.method==='GET')return send(res,200,await service.insights(user));
   if(path==='/api/graph' && req.method==='GET')return send(res,200,await service.graph(user));
   if(path==='/api/studio' && req.method==='GET')return send(res,200,{queries:catalogue});
   const studioMatch=path.match(/^\/api\/studio\/([a-z]+)$/);
   if(studioMatch && req.method==='POST')return send(res,200,await service.studio(user,studioMatch[1],data));
   if(path==='/api/export' && req.method==='GET') {
    const data=await service.bookings(user);const fields=['id','title','startTime','seats','status','tickets','amount','paymentStatus'];
    const csv=[fields,...data.map(x=>fields.map(k=>Array.isArray(x.booking[k])?x.booking[k].join(' '):x.booking[k]))].map(row=>row.map(csvCell).join(',')).join('\r\n');
    res.setHeader('Content-Disposition','attachment; filename="cinescope-my-bookings.csv"');return send(res,200,csv,'text/csv; charset=utf-8');
   }
   fail(404,'API endpoint not found.');
  }
  if(req.method!=='GET')fail(405,'Method not allowed.');
  const target=path==='/'?'index.html':decodeURIComponent(path).slice(1);
  const file=resolve(publicDir,target);if(!file.startsWith(publicDir+'\\') && !file.startsWith(publicDir+'/'))fail(403,'Invalid file path.');
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}[extname(file)] || 'application/octet-stream';
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {send(res,200,await readFile(file),mime);} catch {fail(404,'File not found.');}
 } catch(e) {
  const status=e.status || (e.code?.includes('ConstraintValidationFailed')?409:e.code?.includes('Unauthorized')?401:500);
  const message=e.status?e.message:status===409?'That email or record already exists.':status===401?'Neo4j rejected the database username or password.':e.code?.includes('ServiceUnavailable')?'Neo4j is unavailable. Start the instance and retry.':'The database operation failed. Check your database connection and try again.';
  if(status===500)console.error('Operation failed:',e.code || e.name);
  if(!res.headersSent)send(res,status,{error:message});else res.end();
 }
}
