import { Readable } from 'node:stream';
import { initialize, configured } from '../../server/db.js';
import { handleRequest } from '../../server/http.js';
let initialization;
export default async function handler(request) {
 if(!initialization)initialization=initialize({hosted:true}).finally(()=>{if(!configured())initialization=undefined;});
 await initialization;
 const url=new URL(request.url);
 const req=request.body?Readable.fromWeb(request.body):Readable.from([]);
 req.method=request.method;
 req.url=url.pathname+url.search;
 req.headers=Object.fromEntries(request.headers);
 req.headers.host=url.host;
 let status=200,responseBody='';
 const headers=new Headers();
 const res={headersSent:false,
  setHeader(name,value){headers.set(name,value);},
  writeHead(code,values){status=code;for(const [name,value] of Object.entries(values))headers.set(name,value);this.headersSent=true;},
  end(value=''){responseBody=value;}
 };
 await handleRequest(req,res,{hosted:true,origin:url.origin});
 return new Response(responseBody,{status,headers});
}
export const config={path:'/api/*'};
