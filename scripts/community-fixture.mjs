import {readFile,mkdir,writeFile} from 'node:fs/promises';
const html=await readFile('output/community/ui.html','utf8');
const preview='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const mock=`<script>
window.addEventListener('message',e=>{
  if(e.data.pluginMessage?.type!=='export')return;
  const send=m=>window.postMessage({pluginMessage:m},'*');
  send({type:'start'});
  send({type:'json',path:'design.json',text:JSON.stringify({schemaVersion:'1.0.0',roots:[{id:'demo',name:'Checkout',width:375,height:812,preview:'preview.png',children:[]}]})});
  send({type:'json',path:'manifest.json',text:JSON.stringify({schemaVersion:'1.0.0',fileCount:3,assets:[],previews:[{path:'preview.png',nodeId:'demo',scale:1}],warnings:[]})});
  send({type:'file',path:'preview.png',bytes:Uint8Array.from(atob('${preview}'),c=>c.charCodeAt(0))});
  send({type:'complete',name:'figma-export-Checkout.zip',warnings:[]});
});
window.addEventListener('load',()=>window.postMessage({pluginMessage:{type:'selection',nodes:[{id:'demo',name:'Checkout',type:'FRAME'}]}},'*'));
</script>`;
await mkdir('output/community-qa',{recursive:true});
await writeFile('output/community-qa/fixture.html',html.replace('<div class="mark"',`${mock}<div class="mark"`));
