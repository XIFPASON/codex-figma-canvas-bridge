import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export async function callCanvas({token,port=3847,op,args={},timeout=70000}){
  const request=async(route,method='GET',body)=>{
    const r=await fetch(`http://127.0.0.1:${port}/bridge/${route}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    const d=await r.json();if(!r.ok)throw Error(d.error);return d;
  };
  const status=await request('status');if(op==='status')return status;
  if(!status.connected)throw Error('请在 Figma 插件中连接画布控制');
  const submitted=await request('commands','POST',{clientId:status.client.id,pageId:status.client.context.pageId,op,args});
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const c=await request(`commands/${submitted.id}`);
    if(c.status==='done')return c.result;
    if(['failed','expired','unknown'].includes(c.status))throw Error(JSON.stringify({commandId:c.id,status:c.status,error:c.error}));
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  throw Error(`命令 ${submitted.id} 等待超时，可能已执行。先查询结果或读取画布，勿自动重试。`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const argv=process.argv.slice(2),option=name=>{const i=argv.indexOf(name);return i<0?null:argv[i+1];};
    const connectionPath=option('--connection');
    const config=connectionPath?JSON.parse(await readFile(connectionPath,'utf8')):{token:process.env.FIGMA_BRIDGE_TOKEN};
    const input=option('--input');const command=input?JSON.parse(await readFile(input,'utf8')):{op:'status'};
    const result=await callCanvas({...config,...command,token:config.token});
    const output=option('--out');
    if(output&&result.base64){await writeFile(output,Buffer.from(result.base64,'base64'));delete result.base64;result.savedPath=path.resolve(output);}
    console.log(JSON.stringify(result,null,2));
  }catch(error){console.error(String(error.message||error));process.exitCode=1;}
}
