import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startReceiver} from '../scripts/receiver.mjs';

test('local receiver authenticates, rejects unsafe paths, publishes only complete snapshots',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'figma-receiver-'));
  const receiver=await startReceiver({directory,port:0,token:'test-token'});
  async function req(route,method='POST',body,token='test-token') {
    return fetch(`http://127.0.0.1:${receiver.port}${route}`,{method,headers:{Authorization:`Bearer ${token}`},body});
  }
  try {
    assert.equal((await req('/sessions','POST',undefined,'wrong')).status,401);
    const {id}=await(await req('/sessions')).json();
    const upload=(name,value)=>req(`/sessions/${id}?path=${encodeURIComponent(name)}`,'PUT',value);
    assert.equal((await upload('../outside.svg','bad')).status,400);
    assert.equal((await upload('assets/..\\outside.svg','bad')).status,400);
    assert.equal((await req(`/sessions/${id}/complete`)).status,400);
    assert.ok(!(await readdir(directory)).includes('latest.json'));
    assert.equal((await upload('design.json',JSON.stringify({schemaVersion:'1.0.0',roots:[{id:'1'}]}))).status,200);
    assert.equal((await upload('manifest.json',JSON.stringify({schemaVersion:'1.0.0',fileCount:3,assets:[],previews:[{path:'preview.png'}]}))).status,200);
    assert.equal((await upload('preview.png',new Uint8Array([137,80,78,71]))).status,200);
    const response=await req(`/sessions/${id}/complete`);
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.fileCount,3);
    const pointer=JSON.parse(await readFile(path.join(directory,'latest.json'),'utf8'));
    assert.equal(pointer.path,result.path);
    assert.deepEqual([...await readFile(path.join(result.path,'preview.png'))],[137,80,78,71]);
    assert.equal((await req(`/sessions/${id}/complete`)).status,404);
  }finally {
    await new Promise(resolve=>receiver.server.close(resolve));
    await rm(directory,{recursive:true,force:true});
  }
});
