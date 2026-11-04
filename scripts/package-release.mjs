import {mkdir,readFile,writeFile,copyFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

if(process.platform!=='win32'||process.arch!=='x64')throw Error('Release must be built on Windows x64');
const version=JSON.parse(await readFile('package.json','utf8')).version;
const runtimeVersion=process.version;
const licensePath=`licenses/Node-${runtimeVersion}-LICENSE.txt`;
const nodeLicense=await readFile(licensePath,'utf8');
if(!nodeLicense.includes('Node.js')||!nodeLicense.includes('Permission'))throw Error('Node license missing or invalid');
const output=path.resolve('output/releases');await mkdir(output,{recursive:true});
const staging=await mkdtemp(path.join(os.tmpdir(),'figma-release-'));
const name=`Codex-Design-Exporter-${version}-Windows-x64`;
const folder=path.join(staging,name);await mkdir(folder);
async function copy(source,dest=source){const target=path.join(folder,dest);await mkdir(path.dirname(target),{recursive:true});await copyFile(source,target);}
try {
  for(const source of ['manifest.json','dist/code.js','dist/ui.html','scripts/receiver.mjs','scripts/bridge.mjs','scripts/canvas-cli.mjs','scripts/choose-folder.mjs','scripts/choose-folder.ps1','scripts/install-skill.ps1','skill/figma-export-to-code/SKILL.md','skill/figma-local-canvas/SKILL.md'])await copy(source);
  await copy(process.execPath,'runtime/node.exe');
  await copy('scripts/canvas-cli.mjs','skill/figma-local-canvas/scripts/canvas-cli.mjs');
  await copy(licensePath,'licenses/Node-LICENSE.txt');
  await copy('node_modules/fflate/LICENSE','licenses/fflate-LICENSE.txt');
  await writeFile(path.join(folder,'start-receiver.cmd'),'@echo off\r\ncd /d "%~dp0"\r\n"%~dp0runtime\\node.exe" "%~dp0scripts\\receiver.mjs"\r\nif errorlevel 1 pause\r\n');
  await writeFile(path.join(folder,'install-skill.cmd'),'@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\install-skill.ps1"\r\npause\r\n');
  await writeFile(path.join(folder,'package.json'),JSON.stringify({name:'codex-design-exporter-portable',version,private:true,type:'module'},null,2));
  await copy('DISTRIBUTION.md','使用说明.md');
  for(const file of ['LICENSE','NOTICE','THIRD_PARTY.md'])await copy(file);
  await writeFile(path.join(folder,'release.json'),JSON.stringify({version,platform:'win32',arch:'x64',runtimeVersion,builtAt:new Date().toISOString()},null,2));
  const smokeCode=`import {startReceiver} from './scripts/receiver.mjs';
    const r=await startReceiver({directory:process.argv[1],port:0});
    try {
      const response=await fetch('http://127.0.0.1:'+r.port+'/sessions',{method:'POST',headers:{Authorization:'Bearer '+r.token}});
      if(!response.ok||!(await response.json()).id)throw Error('Packaged receiver failed');
      console.log('Packaged runtime and authenticated receiver smoke test passed');
    }finally{await new Promise(resolve=>r.server.close(resolve));}`;
  const smoke=await promisify(execFile)(path.join(folder,'runtime/node.exe'),['--input-type=module','--eval',smokeCode,path.join(staging,'smoke-data')],{cwd:folder,windowsHide:true,timeout:30000});
  console.log(smoke.stdout.trim());
  const files={};
  async function add(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await add(full);else files[path.relative(staging,full).replaceAll('\\','/')]=new Uint8Array(await readFile(full));}}
  await add(folder);
  const zip=zipSync(files,{level:6});
  const verified=unzipSync(zip);
  if(Object.keys(verified).length!==Object.keys(files).length)throw Error('Archive entry count mismatch');
  for(const [file,data]of Object.entries(files))if(!Buffer.from(data).equals(Buffer.from(verified[file])))throw Error(`Archive verification failed: ${file}`);
  const dest=path.join(output,`${name}.zip`);await writeFile(dest,zip);
  const checksum=createHash('sha256').update(zip).digest('hex');
  await writeFile(`${dest}.sha256`,`${checksum}  ${path.basename(dest)}\n`);
  console.log(JSON.stringify({archive:dest,files:Object.keys(files).length,bytes:zip.length,sha256:checksum},null,2));
}finally {await rm(staging,{recursive:true,force:true});}
