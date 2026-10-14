import {createServer} from 'node:http';
import {initialize,close} from './db.js';
import {handleRequest} from './http.js';
import {readLocalConfig,saveLocalConfig} from './local-config.js';
const port=Number(process.env.PORT || 3000);
await initialize({local:readLocalConfig()});
const server=createServer((req,res)=>handleRequest(req,res,{localSetup:saveLocalConfig}));
server.listen(port,'127.0.0.1',()=>console.log(`CineScope is ready at http://localhost:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{server.close();await close();process.exit(0);});
