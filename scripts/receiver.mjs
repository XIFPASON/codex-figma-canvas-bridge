import http from 'node:http';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,readFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chooseFolder} from './choose-folder.mjs';
import {createBridge} from './bridge.mjs';

export async function startReceiver({directory,port=3847,token=randomBytes(24).toString('hex')}={}) {
  const target=path.resolve(directory || 'design/figma');
  await mkdir(target,{recursive:true});
  const sessions=new Map();
  const bridge=createBridge();
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, PUT, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Private-Network':'true'};
  async function body(req,limit) {
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('请求超过大小限制');chunks.push(chunk);}
    return Buffer.concat(chunks);
  }
  const server=http.createServer(async(req,res)=>{
    const reply=(code,value)=>{res.writeHead(code,{...cors,'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    if(req.method==='OPTIONS'){res.writeHead(204,cors);res.end();return;}
    const supplied=Buffer.from(req.headers.authorization || '');
    const expected=Buffer.from(`Bearer ${token}`);
    if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)){reply(401,{error:'连接码错误'});return;}
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      if(await bridge(req,url,body,reply))return;
      if(req.method==='POST' && url.pathname==='/sessions') {
        if(sessions.size>=4)throw Error('已有太多未完成同步，请稍后重试');
        const id=randomUUID();const folder=path.join(target,`.incoming-${id}`);
        await mkdir(folder);sessions.set(id,{folder,bytes:0,count:0,paths:new Set(),created:Date.now()});
        reply(200,{id});return;
      }
      const match=url.pathname.match(/^\/sessions\/([a-f0-9-]+)(\/complete)?$/);
      const session=match && sessions.get(match[1]);
      if(!session){reply(404,{error:'同步会话不存在'});return;}
      if(req.method==='PUT' && !match[2]) {
        const name=url.searchParams.get('path') || '';
        if(!/^(design\.json|manifest\.json|preview\.png|(?:assets|previews)\/[^/\\\x00-\x1f<>:"|?*]+\.(?:png|jpg|webp|gif|bin|svg))$/.test(name) || name.split('/').some(p=>p==='..'||p.endsWith('.')||p.endsWith(' ')))throw Error('不允许的文件路径');
        if(session.paths.has(name))throw Error('重复文件');
        const bytes=await body(req,64*1024*1024);
        if(session.bytes+bytes.length>300*1024*1024 || session.count>=50000)throw Error('同步超过总大小或文件数量限制');
        const dest=path.join(session.folder,...name.split('/'));
        await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'});
        session.bytes+=bytes.length;session.count++;session.paths.add(name);
        reply(200,{ok:true});return;
      }
      if(req.method==='POST' && match[2]) {
        const manifest=JSON.parse(await readFile(path.join(session.folder,'manifest.json'),'utf8'));
        const design=JSON.parse(await readFile(path.join(session.folder,'design.json'),'utf8'));
        if(manifest.schemaVersion!=='1.0.0'||design.schemaVersion!=='1.0.0'||!Array.isArray(design.roots)||!design.roots.length||manifest.fileCount!==session.count)throw Error('设计包不完整或版本不支持');
        const required=['preview.png',...(manifest.assets||[]).map(a=>a.path),...(manifest.previews||[]).map(a=>a.path)];
        if(required.some(p=>!session.paths.has(p)))throw Error('缺少预览或资源文件');
        const name=`design-${new Date().toISOString().replace(/[:.]/g,'-')}-${match[1].slice(0,8)}`;
        const destination=path.join(target,name);
        await rename(session.folder,destination);sessions.delete(match[1]);
        const pointer=path.join(target,`.latest-${match[1]}.json`);
        await writeFile(pointer,JSON.stringify({path:destination,createdAt:new Date().toISOString()},null,2));
        await rename(pointer,path.join(target,'latest.json'));
        reply(200,{ok:true,path:destination,fileCount:session.count});return;
      }
      reply(405,{error:'不支持的请求'});
    }catch(error){reply(400,{error:String(error.message || error)});}
  });
  const cleanup=setInterval(async()=>{
    for(const [id,s]of sessions)if(Date.now()-s.created>15*60*1000){sessions.delete(id);await rm(s.folder,{recursive:true,force:true}).catch(()=>{});}
  },60000);cleanup.unref();server.on('close',()=>clearInterval(cleanup));
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,token,directory:target,port:server.address().port};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const option=process.argv.indexOf('--dir');
  if(option!==-1 && !process.argv[option+1])throw Error('--dir 需要提供目录');
  try {
    const directory=option===-1?fileURLToPath(new URL('../design/figma/',import.meta.url)):process.argv[option+1];
    if(!directory)console.log('已取消选择，未启动接收服务。');
    else {
      const receiver=await startReceiver({directory});
      const connection=path.join(receiver.directory,'.figma-bridge.json');
      await writeFile(connection,JSON.stringify({token:receiver.token,port:receiver.port},null,2),{mode:0o600});
      console.log(`本地接收服务：http://localhost:${receiver.port}\n保存目录：${receiver.directory}\n插件连接码：${receiver.token}\n保持此窗口运行，按 Ctrl+C 停止。`);
      console.log(`Codex 连接配置：${connection}\n画布控制需在插件中点击“连接并允许画布编辑”。`);
    }
  } catch(error) {
    console.error(`启动失败：${error.code==='EADDRINUSE'?'接收服务已在运行，请使用原窗口，或关闭后重新选择位置。':error.message}`);
    process.exitCode=1;
  }
}
