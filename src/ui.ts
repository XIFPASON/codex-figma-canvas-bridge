import { zipSync, strToU8 } from 'fflate';
const button = document.querySelector<HTMLButtonElement>('#export')!;
const sync = document.querySelector<HTMLButtonElement>('#sync')!;
const token = document.querySelector<HTMLInputElement>('#token')!;
let mode: 'zip' | 'sync' = 'zip';
let activeToken = '';
let bridgeConnected=false;
function updateButtons() { button.disabled=running || bridgeConnected || !valid;sync.disabled=running || bridgeConnected || !valid; }
async function request(route:string,method:string,body?:Uint8Array) {
  const response=await fetch(`http://localhost:3847${route}`,{method,headers:{Authorization:`Bearer ${activeToken}`,...(body?{'Content-Type':'application/octet-stream'}:{})},body:body as BodyInit | undefined,signal:AbortSignal.timeout(60000)});
  const data=await response.json();
  if(!response.ok)throw Error(data.error || `HTTP ${response.status}`);
  return data;
}
const status = document.querySelector<HTMLElement>('#status')!;
const download = document.querySelector<HTMLAnchorElement>('#download')!;
let files: Record<string, Uint8Array> = {};
let url: string | undefined;
let running = false;
let valid = false;
function start(nextMode:'zip'|'sync') {
  if(running) return;
  if(nextMode==='sync' && !token.value.trim()){status.textContent='请填写接收服务终端显示的连接码';return;}
  mode=nextMode;activeToken=token.value.trim();
  if(mode==='sync')parent.postMessage({pluginMessage:{type:'save-settings',token:activeToken}},'*');
  running=true;updateButtons();download.hidden=true;files={};
  status.textContent='正在读取设计与资源…';
  parent.postMessage({ pluginMessage: { type:'export', scale:Number(document.querySelector<HTMLSelectElement>('#scale')!.value),components:document.querySelector<HTMLInputElement>('#components')!.checked } }, '*');
}
button.onclick=()=>start('zip');
sync.onclick=()=>start('sync');
parent.postMessage({pluginMessage:{type:'load-settings'}},'*');
window.onmessage = async event => {
  const m = event.data.pluginMessage;
  if(!m) return;
  if(m.type==='bridge-context'){contextResolver?.(m.context);return;}
  if(m.type==='bridge-result'){resultResolvers.get(m.id)?.(m);return;}
  if(m.type==='settings') token.value=m.token;
  if(m.type==='selection') {
    const allowed = ['FRAME','COMPONENT','COMPONENT_SET','INSTANCE','GROUP','SECTION'];
    valid=m.nodes.length>0 && m.nodes.every((n:any)=>allowed.includes(n.type));
    document.querySelector('#selection')!.textContent=m.nodes.length ? m.nodes.map((n:any)=>`${n.name} · ${n.type}`).join('\n') : '请在画布中选择 Frame 或组件';
    updateButtons();
  }
  if(m.type==='file') files[m.path]=new Uint8Array(m.bytes);
  if(m.type==='json') files[m.path]=strToU8(m.text);
  if(m.type==='progress') status.textContent=m.text;
  if(m.type==='error') { files={};status.textContent=m.text;running=false;updateButtons(); }
  if(m.type==='complete') {
    try {
      if(mode==='sync') {
        const session=await request('/sessions','POST');
        const entries=Object.entries(files);
        for(const [i,[path,bytes]] of entries.entries()) {
          status.textContent=`正在同步文件 ${i+1} / ${entries.length}…`;
          await request(`/sessions/${session.id}?path=${encodeURIComponent(path)}`,'PUT',bytes);
        }
        const result=await request(`/sessions/${session.id}/complete`,'POST');
        status.textContent=`已同步 ${result.fileCount} 个文件到：\n${result.path}\n${m.warnings.length?`${m.warnings.length} 条警告，见 manifest.json`:''}`;
        return;
      }
      status.textContent='正在打包 ZIP…';
      const zip=zipSync(files,{level:0});
      if(url) URL.revokeObjectURL(url);
      url=URL.createObjectURL(new Blob([zip as BlobPart],{type:'application/zip'}));
      download.href=url;download.download=m.name;download.hidden=false;
      status.textContent=`导出完成，共 ${Object.keys(files).length} 个文件。\n${m.warnings.length ? `${m.warnings.length} 条警告，见 manifest.json` : '未发现资源读取错误'}`;
    } catch(e) { status.textContent=mode==='sync'?`同步失败：${String(e)}\n请检查接收服务和连接码，可点击同步重试。`:`打包失败：${String(e)}，请减少选区`; }
    finally {files={};running=false;updateButtons();}
  }
};

const bridgeButton=document.querySelector<HTMLButtonElement>('#bridge')!;
const bridgeStatus=document.querySelector<HTMLElement>('#bridge-status')!;
let contextResolver:((value:any)=>void)|undefined;
const resultResolvers=new Map<string,(value:any)=>void>();
let bridgeToken='';
// Figma UI iframes may not expose secure-context-only crypto.randomUUID.
// This ID identifies a plugin instance; authentication uses the separate server token.
const clientId=typeof globalThis.crypto?.randomUUID==='function'
  ? globalThis.crypto.randomUUID()
  : `plugin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
async function bridgeRequest(route:string,method='GET',data?:any){
  const response=await fetch(`http://localhost:3847/bridge/${route}`,{method,headers:{Authorization:`Bearer ${bridgeToken}`,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok)throw Error(result.error);return result;
}
async function stopBridge(){
  bridgeConnected=false;parent.postMessage({pluginMessage:{type:'bridge-stop'}},'*');
  try{await bridgeRequest('disconnect','POST',{clientId});}catch{}
  bridgeButton.textContent='连接并允许画布编辑';updateButtons();
}
bridgeButton.onclick=async()=>{
  if(bridgeConnected){await stopBridge();bridgeStatus.textContent='已断开画布控制';return;}
  if(running){bridgeStatus.textContent='正在导出，请完成后再连接画布';return;}
  bridgeToken=token.value.trim();if(!bridgeToken){bridgeStatus.textContent='请先填写连接码';return;}
  bridgeButton.disabled=true;
  bridgeStatus.textContent='正在连接画布…';
  try{
    const canvasContext=await new Promise<any>((resolve,reject)=>{
      const timer=setTimeout(()=>{contextResolver=undefined;reject(Error('插件响应超时'));},5000);
      contextResolver=value=>{clearTimeout(timer);contextResolver=undefined;resolve(value);};
      parent.postMessage({pluginMessage:{type:'bridge-start'}},'*');
    });
    await bridgeRequest('connect','POST',{clientId,context:canvasContext});
    parent.postMessage({pluginMessage:{type:'save-settings',token:bridgeToken}},'*');
    bridgeConnected=true;updateButtons();bridgeButton.textContent='断开画布控制';
    bridgeStatus.textContent=`已连接：${canvasContext.documentName} / ${canvasContext.pageName}`;
    void pollBridge();
  }catch(error){parent.postMessage({pluginMessage:{type:'bridge-stop'}},'*');bridgeStatus.textContent=String(error);}
  finally{bridgeButton.disabled=false;}
};
async function pollBridge(){
  try{
    while(bridgeConnected){
      const {command}=await bridgeRequest(`poll?clientId=${encodeURIComponent(clientId)}`);
      if(!bridgeConnected)break;
      if(command){
        bridgeStatus.textContent=`执行：${command.op}`;
        const result=await new Promise<any>((resolve,reject)=>{
          const timer=setTimeout(()=>{resultResolvers.delete(command.id);reject(Error('执行结果未知，请检查画布后重新连接'));},55000);
          resultResolvers.set(command.id,value=>{clearTimeout(timer);resultResolvers.delete(command.id);resolve(value);});
          parent.postMessage({pluginMessage:{type:'bridge-command',command}},'*');
        });
        await bridgeRequest(`commands/${command.id}/result`,'POST',{clientId,...result});
        bridgeStatus.textContent=result.ok?`完成：${command.op}`:`失败：${result.error}`;
      }
      await new Promise(resolve=>setTimeout(resolve,750));
    }
  }catch(error){await stopBridge();bridgeStatus.textContent=String(error);}
}
