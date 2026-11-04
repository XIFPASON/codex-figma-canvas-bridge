import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {startReceiver} from '../scripts/receiver.mjs';
import {callCanvas} from '../scripts/canvas-cli.mjs';
test('bridge requires explicit connection, guards page identity, delivers once, returns CLI result',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'canvas-bridge-'));
  const r=await startReceiver({directory,port:0,token:'testing'});
  const request=async(route,method='GET',data)=>{
    const res=await fetch(`http://127.0.0.1:${r.port}/bridge/${route}`,{method,headers:{Authorization:'Bearer testing','Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
    return {status:res.status,data:await res.json()};
  };
  try{
    assert.equal((await request('status')).data.connected,false);
    assert.equal((await request('commands','POST',{op:'create'})).status,400);
    assert.equal((await request('connect','POST',{clientId:'a',context:{pageId:'p',documentName:'Demo'}})).status,200);
    assert.equal((await request('connect','POST',{clientId:'b',context:{pageId:'p'}})).status,400);
    assert.equal((await request('commands','POST',{clientId:'a',pageId:'wrong',op:'create'})).status,400);
    const pending=callCanvas({token:'testing',port:r.port,op:'get_selection'});
    let command;
    for(let i=0;i<30&&!command;i++){await new Promise(resolve=>setTimeout(resolve,20));command=(await request('poll?clientId=a')).data.command;}
    assert.ok(command);assert.equal(command.op,'get_selection');
    assert.equal((await request('poll?clientId=a')).data.command,null);
    assert.equal((await request(`commands/${command.id}/result`,'POST',{clientId:'wrong',ok:true})).status,400);
    await request(`commands/${command.id}/result`,'POST',{clientId:'a',ok:true,result:{nodes:[{id:'1:1'}]}});
    assert.deepEqual(await pending,{nodes:[{id:'1:1'}]});
    const queued=await request('commands','POST',{clientId:'a',pageId:'p',op:'create',args:{type:'FRAME'}});
    await request('disconnect','POST',{clientId:'a'});
    assert.equal((await request(`commands/${queued.data.id}`)).data.status,'expired');
  }finally{await new Promise(resolve=>r.server.close(resolve));await rm(directory,{recursive:true,force:true});}
});
