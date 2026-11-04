import {build} from 'esbuild';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve('output/community');await mkdir(output,{recursive:true});
const skill=await readFile('skill/figma-export-to-code/SKILL.md','utf8');
const html=await readFile('src/community.html','utf8');
const ui=await build({entryPoints:['src/community-ui.ts'],bundle:true,minify:true,write:false,target:'es2020',define:{__SKILL__:JSON.stringify(skill)}});
await writeFile(path.join(output,'ui.html'),html.replace('/* BUNDLE */',ui.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')));
await build({entryPoints:['src/code.ts'],bundle:true,minify:true,outfile:path.join(output,'code.js'),target:'es2020'});
const manifest={name:'Design Handoff Exporter',api:'1.0.0',main:'code.js',ui:'ui.html',editorType:['figma'],documentAccess:'dynamic-page',networkAccess:{allowedDomains:['none']}};
const id=process.env.FIGMA_PLUGIN_ID;
if(id){if(!/^\d+$/.test(id))throw Error('FIGMA_PLUGIN_ID must be the numeric ID assigned by Figma');manifest.id=id;}
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
await copyFile('node_modules/fflate/LICENSE',path.join(output,'THIRD-PARTY-LICENSE.txt'));
for(const file of ['LICENSE','NOTICE','THIRD_PARTY.md'])await copyFile(file,path.join(output,file));
console.log(`Community candidate: ${output}\n${id?'Figma plugin ID applied.':'No Figma plugin ID provided. Use your Figma-assigned ID before publishing; do not use the development placeholder.'}`);
