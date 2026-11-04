import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
test('bridge button connects when iframe crypto.randomUUID is unavailable',async()=>{
  const elements=new Map();
  const get=selector=>{if(!elements.has(selector))elements.set(selector,{value:selector==='#token'?'test-token':'1',checked:true,textContent:'',disabled:false,hidden:false});return elements.get(selector);};
  const window={};let connectedPayload;
  const context={window,document:{querySelector:get},crypto:{},TextEncoder,TextDecoder,Uint8Array,setTimeout,clearTimeout,AbortSignal,URL,Blob,queueMicrotask,
    parent:{postMessage(message){if(message.pluginMessage.type==='bridge-start')queueMicrotask(()=>window.onmessage({data:{pluginMessage:{type:'bridge-context',context:{pageId:'p',documentName:'Demo',pageName:'Page'}}}}));}},
    fetch:async(url,options)=>{
      if(url.endsWith('/connect')){connectedPayload=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true})};}
      return new Promise(()=>{});
    }
  };
  const built=await build({entryPoints:['src/ui.ts'],bundle:true,write:false});
  vm.runInNewContext(built.outputFiles[0].text,context);
  assert.equal(typeof get('#bridge').onclick,'function');
  await get('#bridge').onclick();
  assert.equal(connectedPayload.context.pageId,'p');
  assert.match(connectedPayload.clientId,/^plugin-/);
  assert.match(get('#bridge-status').textContent,/已连接/);
  assert.equal(get('#bridge').textContent,'断开画布控制');
});
