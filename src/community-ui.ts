import {strToU8} from 'fflate';
import {createPortable} from './portable';
declare const __SKILL__: string;
const button=document.querySelector<HTMLButtonElement>('#export')!;
const download=document.querySelector<HTMLAnchorElement>('#download')!;
const status=document.querySelector<HTMLElement>('#status')!;
let running=false,valid=false,url:string|undefined;
let files:Record<string,Uint8Array>={};
function update(){button.disabled=running||!valid;}
button.onclick=()=>{
  if(running||!valid)return;
  running=true;files={};download.hidden=true;update();status.textContent='Reading layers and exporting assets…';
  parent.postMessage({pluginMessage:{type:'export',scale:Number(document.querySelector<HTMLSelectElement>('#scale')!.value),components:document.querySelector<HTMLInputElement>('#components')!.checked}},'*');
};
document.querySelector<HTMLButtonElement>('#skill')!.onclick=()=>{
  const skillUrl=URL.createObjectURL(new Blob([__SKILL__],{type:'text/markdown;charset=utf-8'}));
  const a=document.createElement('a');a.href=skillUrl;a.download='SKILL.md';a.click();
  setTimeout(()=>URL.revokeObjectURL(skillUrl),60000);
};
window.onmessage=event=>{
  const m=event.data.pluginMessage;if(!m)return;
  if(m.type==='selection'){
    valid=m.nodes.length>0&&m.nodes.every((n:any)=>['FRAME','COMPONENT','COMPONENT_SET','INSTANCE','GROUP','SECTION'].includes(n.type));
    document.querySelector('#selection')!.textContent=m.nodes.length?m.nodes.map((n:any)=>`${n.name} · ${n.type}`).join('\n'):'Select a frame to start.';update();
  }
  if(m.type==='file')files[m.path]=new Uint8Array(m.bytes);
  if(m.type==='json')files[m.path]=strToU8(m.text);
  if(m.type==='progress')status.textContent='Exporting design layers…';
  if(m.type==='error'){status.textContent=`Export could not finish. Select a smaller frame and retry.\n${m.text}`;files={};running=false;update();}
  if(m.type==='complete'){
    try{
      status.textContent='Preparing offline design file…';
      const bundle=createPortable(files);
      if(url)URL.revokeObjectURL(url);
      url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'}));
      download.href=url;download.download=m.name.replace(/\.zip$/,'.figma.json');download.hidden=false;
      status.textContent=`Ready. Save your file below.\n${m.warnings.length?`${m.warnings.length} asset warnings are recorded in manifest.warnings.`:'All requested resources were read successfully.'}`;
      download.click();
    }catch{status.textContent='Could not prepare this export. Select a smaller frame and retry.';}
    finally{files={};running=false;update();}
  }
};
window.addEventListener('beforeunload',()=>{if(url)URL.revokeObjectURL(url);});
