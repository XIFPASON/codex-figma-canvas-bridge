import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
test('canvas creates with loaded fonts, blocks cross-page edits, cleans failed creations and reports partial updates',async()=>{
  const nodes=new Map();let counter=0;const fonts=[];
  const page={id:'p',type:'PAGE',name:'Page',children:[],selection:[],appendChild(n){n.parent=this;if(!this.children.includes(n))this.children.push(n);}};
  function make(type){const n={id:String(++counter),type,name:'',width:100,height:100,x:0,y:0,characters:'',fontName:{family:'Inter',style:'Regular'},fontSize:12,resize(w,h){this.width=w;this.height=h;},remove(){page.children=page.children.filter(c=>c!==this);nodes.delete(this.id);},getStyledTextSegments(){return [];}};nodes.set(n.id,n);page.appendChild(n);return n;}
  const figma={root:{id:'doc',name:'Test'},fileKey:'key',currentPage:page,mixed:Symbol(),createFrame:()=>make('FRAME'),createText:()=>make('TEXT'),loadFontAsync:async f=>fonts.push(f),commitUndo(){},getNodeByIdAsync:async id=>nodes.get(id)};
  const built=await build({entryPoints:['src/canvas.ts'],bundle:true,write:false,format:'cjs'});
  const module={exports:{}};vm.runInNewContext(built.outputFiles[0].text,{module,exports:module.exports,figma});
  const run=module.exports.executeCanvas;
  const text=await run({op:'create',args:{type:'TEXT',props:{characters:'Hello',fontSize:24}}});
  assert.equal(text.node.characters,'Hello');assert.equal(fonts.length,1);
  const frame=await run({op:'create',args:{type:'FRAME',props:{width:375,height:812}}});
  assert.equal(frame.node.width,375);assert.ok(frame.node.x>100);
  const before=nodes.size;
  await assert.rejects(run({op:'create',args:{type:'FRAME',props:{width:-1}}}));assert.equal(nodes.size,before);
  await assert.rejects(run({op:'update',args:{id:frame.node.id,props:{name:'Changed',textAlignHorizontal:'LEFT'}}}),/partialChangesPossible/);
  const other=make('FRAME');other.parent={id:'other',type:'PAGE'};
  await assert.rejects(run({op:'update',args:{id:other.id,props:{name:'Wrong'}}}),/当前页面/);
});
