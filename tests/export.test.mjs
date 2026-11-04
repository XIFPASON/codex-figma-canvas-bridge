import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {zipSync,unzipSync,strToU8} from 'fflate';

async function run({failPreview=false}={}) {
  const messages=[];
  const bytes=new Uint8Array([137,80,78,71]);
  const text={id:'2:1',name:'Title',type:'TEXT',visible:true,characters:'你好',fontName:Symbol('mixed'),getStyledTextSegments:()=>[{characters:'你好',fontName:{family:'Inter',style:'Regular'},fontSize:16}]};
  const image={id:'2:2',name:'Photo',type:'RECTANGLE',visible:true,fills:[{type:'IMAGE',imageHash:'abc',scaleMode:'FILL'}],exportAsync:async()=>bytes};
  const icon={id:'2:3',name:'../Icon',type:'VECTOR',visible:true,exportAsync:async()=>bytes};
  const root={id:'1:1',name:'Checkout',type:'FRAME',visible:true,width:400,height:800,children:[text,image,icon],boundVariables:{fills:[{type:'VARIABLE_ALIAS',id:'v1'}]},exportAsync:async()=>{if(failPreview)throw Error('preview blocked');return bytes;}};
  for(const child of root.children)child.parent=root;
  const figma={showUI(){},on(){},currentPage:{id:'p',name:'Page',selection:[root,image]},root:{name:'Document'},ui:{postMessage:m=>messages.push(m)},getImageByHash:()=>({getBytesAsync:async()=>bytes}),variables:{getVariableByIdAsync:async id=>({id,name:id,key:id,resolvedType:'COLOR',variableCollectionId:'c',valuesByMode:{mode:id==='v1'?{type:'VARIABLE_ALIAS',id:'v2'}:{r:1,g:0,b:0}}}),getVariableCollectionByIdAsync:async()=>({id:'c',name:'Colors',modes:[{modeId:'mode',name:'Light'}],defaultModeId:'mode'})}};
  const result=await build({entryPoints:['src/code.ts'],bundle:true,write:false,platform:'neutral'});
  vm.runInNewContext(result.outputFiles[0].text,{figma,__html__:'',Uint8Array});
  await figma.ui.onmessage({type:'export',components:true,scale:1});
  return messages;
}
test('exports selected tree, actual assets, mixed fonts and transitive variables without mutations',async()=>{
  const messages=await run();
  assert.equal(messages.at(-1).type,'complete');
  const design=JSON.parse(messages.find(m=>m.path==='design.json').text);
  assert.equal(design.roots.length,1);
  assert.equal(design.roots[0].children[0].fontName.mixed,true);
  assert.ok(design.variables.v2);
  const manifest=JSON.parse(messages.find(m=>m.path==='manifest.json').text);
  assert.equal(manifest.fonts[0].family,'Inter');
  assert.ok(manifest.assets.some(a=>a.imageHash==='abc' && a.path.endsWith('.png')));
  assert.equal(manifest.warnings.length,0);
  const files=Object.fromEntries(messages.filter(m=>m.type==='file'||m.type==='json').map(m=>[m.path,m.type==='json'?strToU8(m.text):m.bytes]));
  const restored=unzipSync(zipSync(files));
  assert.ok(restored['preview.png']);
  assert.equal(Object.keys(restored).length,manifest.fileCount);
  assert.ok(Object.keys(restored).every(p=>!p.split('/').includes('..')));
});
test('failed main preview prevents success and reports error',async()=>{
  const messages=await run({failPreview:true});
  assert.equal(messages.at(-1).type,'error');
  assert.ok(!messages.some(m=>m.type==='complete'));
});
