import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {readFile,mkdtemp,writeFile,access,rm} from 'node:fs/promises';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

test('portable design survives binary encoding and companion extraction; unsafe paths are rejected',async()=>{
  const output=await build({entryPoints:['src/portable.ts'],bundle:true,write:false,format:'cjs',platform:'node'});
  const context={exports:{},module:{exports:{}},TextDecoder,btoa,Uint8Array};
  vm.runInNewContext(output.outputFiles[0].text,context);
  const bytes=new Uint8Array([137,80,0,255,128,10]);
  const enc=value=>new TextEncoder().encode(JSON.stringify(value));
  const bundle=context.module.exports.createPortable({'design.json':enc({schemaVersion:'1.0.0',roots:[{name:'中文'}]}),'manifest.json':enc({schemaVersion:'1.0.0',fileCount:3,assets:[],previews:[{path:'preview.png'}]}),'preview.png':bytes});
  assert.deepEqual(Buffer.from(bundle.resources['preview.png'].data,'base64'),Buffer.from(bytes));
  const skill=await readFile('skill/figma-export-to-code/SKILL.md','utf8');
  const script=skill.match(/```python\r?\n([\s\S]*?)```/)[1];
  const temp=await mkdtemp(path.join(os.tmpdir(),'design-portable-'));
  try{
    const helper=path.join(temp,'extract.py'),source=path.join(temp,'design.figma.json'),destination=path.join(temp,'decoded');
    await writeFile(helper,script);await writeFile(source,JSON.stringify(bundle));
    await promisify(execFile)('python',['-X','utf8',helper,source,destination]);
    assert.deepEqual(await readFile(path.join(destination,'preview.png')),Buffer.from(bytes));
    assert.equal(JSON.parse(await readFile(path.join(destination,'design.json'),'utf8')).roots[0].name,'中文');
    await assert.rejects(promisify(execFile)('python',['-X','utf8',helper,source,destination]));
    bundle.resources['assets/../../escape.svg']={encoding:'base64',byteLength:1,data:'YQ=='};bundle.manifest.fileCount++;
    await writeFile(source,JSON.stringify(bundle));
    const invalid=path.join(temp,'invalid');
    await assert.rejects(promisify(execFile)('python',['-X','utf8',helper,source,invalid]));
    await assert.rejects(access(invalid));
    await assert.rejects(access(path.join(temp,'escape.svg')));
  }finally{await rm(temp,{recursive:true,force:true});}
});
