import { build } from 'esbuild';
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
await mkdir('skill/figma-local-canvas/scripts',{recursive:true});
await copyFile('scripts/canvas-cli.mjs','skill/figma-local-canvas/scripts/canvas-cli.mjs');
await mkdir('dist', { recursive: true });
await build({entryPoints:['src/code.ts'],bundle:true,outfile:'dist/code.js',target:'es2020'});
const ui = await build({entryPoints:['src/ui.ts'],bundle:true,write:false,target:'es2020'});
const html = await readFile('src/ui.html','utf8');
await writeFile('dist/ui.html',html.replace('/* BUNDLE */',ui.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')));
