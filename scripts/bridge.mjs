import {randomUUID} from 'node:crypto';
export const operations=['get_document','get_selection','get_node','screenshot','select','create','update','clone','reparent','set_image'];
export function createBridge(){
  let client=null;const commands=new Map();
  const online=()=>client&&Date.now()-client.seen<20000;
  function expire(){for(const c of commands.values())if(['queued','dispatched'].includes(c.status)&&Date.now()>c.deadline){c.status=c.status==='queued'?'expired':'unknown';c.error='命令超时；已派发的命令可能已执行，先读取画布确认，不能盲目重试';}}
  return async function route(req,url,body,reply){
    if(!url.pathname.startsWith('/bridge/'))return false;
    expire();
    const data=async()=>JSON.parse((await body(req,36*1024*1024)).toString()||'{}');
    if(req.method==='GET'&&url.pathname==='/bridge/status'){reply(200,{connected:Boolean(online()),client:online()?{id:client.id,context:client.context}:null});return true;}
    if(req.method==='POST'&&url.pathname==='/bridge/connect'){
      const d=await data();if(typeof d.clientId!=='string'||!d.context?.pageId)throw Error('连接缺少画布身份');
      if(online()&&client.id!==d.clientId)throw Error('已有其他插件连接，请先断开');
      for(const c of commands.values())if(c.status==='queued')c.status='expired';else if(c.status==='dispatched')c.status='unknown';
      client={id:d.clientId,context:d.context,seen:Date.now()};reply(200,{ok:true});return true;
    }
    if(req.method==='POST'&&url.pathname==='/bridge/disconnect'){
      const d=await data();if(client?.id!==d.clientId)throw Error('插件身份不符');
      for(const c of commands.values())if(c.status==='queued')c.status='expired';else if(c.status==='dispatched')c.status='unknown';
      client=null;reply(200,{ok:true});return true;
    }
    if(req.method==='POST'&&url.pathname==='/bridge/commands'){
      const d=await data();if(!online())throw Error('插件未连接或已离线');
      if(d.clientId!==client.id||d.pageId!==client.context.pageId)throw Error('画布身份不匹配，请重新读取 bridge/status');
      if(!operations.includes(d.op))throw Error('不支持的操作');
      if([...commands.values()].some(c=>['queued','dispatched'].includes(c.status)))throw Error('已有命令执行中，请等待完成');
      if(commands.size>=10){for(const [id,c]of commands)if(!['queued','dispatched'].includes(c.status))commands.delete(id);}
      const id=randomUUID();commands.set(id,{id,clientId:client.id,pageId:d.pageId,op:d.op,args:d.args||{},status:'queued',deadline:Date.now()+60000});reply(200,{id});return true;
    }
    if(req.method==='GET'&&url.pathname==='/bridge/poll'){
      if(!client||url.searchParams.get('clientId')!==client.id)throw Error('插件身份不符');client.seen=Date.now();
      const c=[...commands.values()].find(c=>c.status==='queued');if(c)c.status='dispatched';reply(200,{command:c||null});return true;
    }
    const match=url.pathname.match(/^\/bridge\/commands\/([a-f0-9-]+)(\/result)?$/);
    const c=match&&commands.get(match[1]);
    if(c&&req.method==='GET'&&!match[2]){reply(200,c);return true;}
    if(c&&req.method==='POST'&&match[2]){
      const d=await data();if(d.clientId!==c.clientId||!['dispatched','unknown'].includes(c.status))throw Error('结果身份或状态不符');
      c.status=d.ok?'done':'failed';c.result=d.result;c.error=d.error;reply(200,{ok:true});return true;
    }
    reply(404,{error:'命令不存在'});return true;
  };
}
