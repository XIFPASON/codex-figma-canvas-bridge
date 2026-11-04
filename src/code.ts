import { safeName, imageExtension } from './shared';
import {context,executeCanvas} from './canvas';
let bridgeEnabled=false;

figma.showUI(__html__, { width: 440, height: 650, themeColors: true });
let busy = false;
const fields = `id name type visible locked x y width height rotation relativeTransform absoluteTransform absoluteBoundingBox absoluteRenderBounds opacity blendMode isMask maskType clipsContent fills strokes strokeWeight strokeTopWeight strokeRightWeight strokeBottomWeight strokeLeftWeight strokeAlign strokeCap strokeJoin dashPattern effects cornerRadius topLeftRadius topRightRadius bottomLeftRadius bottomRightRadius cornerSmoothing constraints layoutMode layoutWrap layoutSizingHorizontal layoutSizingVertical primaryAxisSizingMode counterAxisSizingMode primaryAxisAlignItems counterAxisAlignItems counterAxisAlignContent itemSpacing counterAxisSpacing paddingTop paddingRight paddingBottom paddingLeft layoutAlign layoutGrow layoutPositioning minWidth maxWidth minHeight maxHeight itemReverseZIndex strokesIncludedInLayout layoutGrids gridRowCount gridColumnCount gridRowGap gridColumnGap gridRowSizes gridColumnSizes gridRowSpan gridColumnSpan gridRowAnchorIndex gridColumnAnchorIndex gridChildHorizontalAlign gridChildVerticalAlign characters fontName fontSize fontWeight textAlignHorizontal textAlignVertical textAutoResize textTruncation maxLines lineHeight letterSpacing paragraphSpacing paragraphIndent listSpacing textCase textDecoration hyperlink hasMissingFont fills fillStyleId strokeStyleId effectStyleId textStyleId gridStyleId boundVariables explicitVariableModes resolvedVariableModes componentProperties componentPropertyDefinitions componentPropertyReferences variantProperties reactions overflowDirection exportSettings vectorPaths`.split(' ');
function plain(value: any): any {
  if (typeof value === 'symbol') return { mixed: true };
  if (value === undefined || typeof value === 'function') return undefined;
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(value)) result[key] = plain(value[key]);
    return result;
  }
  return value;
}
function selection() {
  figma.ui.postMessage({ type: 'selection', nodes: figma.currentPage.selection.map(n => ({ id: n.id, name: n.name, type: n.type })) });
}
figma.on('selectionchange', selection);
selection();
figma.ui.onmessage = async message => {
  if(message.type==='bridge-start'){bridgeEnabled=true;figma.ui.postMessage({type:'bridge-context',context:context()});return;}
  if(message.type==='bridge-stop'){bridgeEnabled=false;return;}
  if(message.type==='bridge-command'){
    if(busy){figma.ui.postMessage({type:'bridge-result',id:message.command.id,ok:false,error:'插件正在执行其他操作'});return;}
    try{
      if(!bridgeEnabled)throw Error('画布控制未启用');
      if(message.command.pageId!==figma.currentPage.id)throw Error('当前页面已改变，请重新连接');
      busy=true;const result=await executeCanvas(message.command);
      figma.ui.postMessage({type:'bridge-result',id:message.command.id,ok:true,result});
    }catch(error){figma.ui.postMessage({type:'bridge-result',id:message.command.id,ok:false,error:String(error)});}
    finally{busy=false;}
    return;
  }
  if (message.type === 'load-settings') {
    figma.ui.postMessage({ type: 'settings', token: await figma.clientStorage.getAsync('receiver-token') || '' });
    return;
  }
  if (message.type === 'save-settings') {
    await figma.clientStorage.setAsync('receiver-token', String(message.token || ''));
    return;
  }
  if (message.type !== 'export' || busy) return;
  busy = true;
  const warnings: string[] = [];
  let fileCount = 0, totalBytes = 0;
  const assets: any[] = [], previews: any[] = [];
  const variables: Record<string, any> = {}, collections: Record<string, any> = {}, styles: Record<string, any> = {};
  const imageHashes = new Set<string>(), variableIds = new Set<string>(), styleIds = new Set<string>();
  const warn = (scope: string, error: unknown) => warnings.push(`${scope}: ${String(error)}`);
  function send(path: string, bytes: Uint8Array) {
    totalBytes += bytes.length;
    if (totalBytes > 250 * 1024 * 1024) throw new Error('导出超过 250 MB，请分批选择 Frame');
    fileCount++;
    figma.ui.postMessage({ type: 'file', path, bytes });
  }
  function json(path: string, data: any) {
    // Plugin sandbox has no TextEncoder; encoding is performed in UI.
    fileCount++;
    figma.ui.postMessage({ type: 'json', path, text: JSON.stringify(data, null, 2) });
  }
  function refs(value: any) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'VARIABLE_ALIAS') variableIds.add(value.id);
    if (value.type === 'IMAGE' && value.imageHash) imageHashes.add(value.imageHash);
    for (const v of Object.values(value)) refs(v);
  }
  async function render(node: SceneNode, path: string, format: 'PNG' | 'SVG', scale = 1): Promise<boolean> {
    try {
      const bytes = format === 'PNG'
        ? await node.exportAsync({ format, constraint: { type: 'SCALE', value: scale } })
        : await node.exportAsync({ format, svgOutlineText: true, svgIdAttribute: true });
      send(path, bytes);
      return true;
    } catch (e) { warn(`${node.id} ${path}`, e); return false; }
  }
  let count = 0;
  async function walk(node: SceneNode, root = false): Promise<any> {
    count++;
    if (count > 30000) throw new Error('超过 30000 图层，请分批导出');
    if (count % 25 === 0) figma.ui.postMessage({ type: 'progress', text: `已读取 ${count} 个图层…` });
    const data: any = {};
    for (const key of new Set(fields)) {
      try { if (key in node) data[key] = plain((node as any)[key]); }
      catch (e) { warn(`${node.id}.${key}`, e); }
    }
    if (node.type === 'TEXT') {
      try { data.textSegments = plain(node.getStyledTextSegments(['fontName','fontSize','fontWeight','fills','textStyleId','fillStyleId','lineHeight','letterSpacing','textCase','textDecoration','hyperlink'])); }
      catch(e) { warn(`${node.id}.textSegments`, e); }
    }
    if (node.type === 'INSTANCE') {
      try {
        const main = await node.getMainComponentAsync();
        if (main) data.mainComponent = { id: main.id, key: main.key, name: main.name, remote: main.remote, componentSet: main.parent?.type === 'COMPONENT_SET' ? { id: main.parent.id, name: main.parent.name } : null };
      } catch(e) { warn(`${node.id}.mainComponent`, e); }
    }
    refs(data);
    for (const key of ['fillStyleId','strokeStyleId','effectStyleId','textStyleId','gridStyleId']) if (typeof data[key] === 'string' && data[key]) styleIds.add(data[key]);
    for (const segment of data.textSegments || []) for (const key of ['textStyleId','fillStyleId']) if (segment[key]) styleIds.add(segment[key]);
    const stem = `${safeName(node.name)}-${node.id.replace(/[^a-zA-Z0-9_-]/g,'-')}`;
    const vector = ['VECTOR','BOOLEAN_OPERATION','STAR','POLYGON','ELLIPSE','LINE'].includes(node.type);
    if (node.visible && vector) {
      const path = `assets/${stem}.svg`;
      if (await render(node,path,'SVG')) { data.svgAsset = path; assets.push({path,nodeId:node.id,kind:'svg'}); }
    }
    const hasImage = Array.isArray(data.fills) && data.fills.some((p: any) => p.type === 'IMAGE');
    if (node.visible && hasImage) {
      const path = `assets/${stem}-rendered.png`;
      if (await render(node,path,'PNG')) { data.renderedAsset = path; assets.push({path,nodeId:node.id,kind:'rendered-image'}); }
    }
    if (message.components && !root && node.visible && ['COMPONENT','INSTANCE','COMPONENT_SET'].includes(node.type)) {
      const path = `previews/${stem}.png`;
      if (await render(node,path,'PNG')) { data.preview = path; previews.push({path,nodeId:node.id,scale:1}); }
    }
    if ('children' in node) {
      data.children = [];
      for (const child of node.children) data.children.push(await walk(child));
    }
    return data;
  }
  try {
    const selected = [...figma.currentPage.selection];
    const selectedIds = new Set(selected.map(n => n.id));
    const roots = selected.filter(n => { let p = n.parent; while(p) { if(selectedIds.has(p.id)) return false; p=p.parent; } return true; });
    if (!roots.length || roots.some(n => !['FRAME','COMPONENT','COMPONENT_SET','INSTANCE','GROUP','SECTION'].includes(n.type))) throw new Error('请选择 Frame、组件、实例、Group 或 Section');
    figma.ui.postMessage({ type: 'start' });
    const trees = [];
    for (const [i, node] of roots.entries()) {
      const tree = await walk(node, true);
      const path = i === 0 ? 'preview.png' : `previews/root-${i + 1}.png`;
      const requestedScale = message.scale === 2 ? 2 : 1;
      const scale = Math.min(requestedScale, 8192 / Math.max(node.width,node.height,1));
      if (!(await render(node,path,'PNG',scale))) throw new Error(`主预览导出失败：${node.name}，请缩小导出范围`);
      previews.push({ path,nodeId:node.id,scale });
      tree.preview = path;
      trees.push(tree);
    }
    for (const hash of imageHashes) {
      try {
        const image = figma.getImageByHash(hash);
        if (!image) throw new Error('图片不可访问');
        const bytes = await image.getBytesAsync();
        const path = `assets/image-${hash}.${imageExtension(bytes)}`;
        send(path,bytes); assets.push({path,imageHash:hash,kind:'original-image'});
      } catch(e) { warn(`image ${hash}`,e); }
    }
    for (const id of variableIds) {
      try {
        const v = await figma.variables.getVariableByIdAsync(id);
        if (!v) throw new Error('变量不可访问');
        variables[id] = {id:v.id,name:v.name,key:v.key,remote:v.remote,resolvedType:v.resolvedType,variableCollectionId:v.variableCollectionId,valuesByMode:plain(v.valuesByMode),scopes:plain(v.scopes),description:v.description,codeSyntax:plain(v.codeSyntax)};
        refs(variables[id].valuesByMode);
        if (!collections[v.variableCollectionId]) {
          const c = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
          if(c) collections[c.id] = {id:c.id,name:c.name,modes:plain(c.modes),defaultModeId:c.defaultModeId,remote:c.remote};
        }
      } catch(e) {warn(`variable ${id}`,e);}
    }
    for (const id of styleIds) {
      try {
        const s = await figma.getStyleByIdAsync(id);
        if(!s) throw new Error('样式不可访问');
        const result: any = {};
        for (const key of ['id','key','name','type','remote','description','paints','effects','fontName','fontSize','lineHeight','letterSpacing','paragraphSpacing','textCase','textDecoration','layoutGrids']) if(key in s) result[key] = plain((s as any)[key]);
        styles[id]=result;
      }catch(e){warn(`style ${id}`,e);}
    }
    const fonts = new Map<string,any>();
    function collect(n:any) { for(const s of n.textSegments || []) if(s.fontName) fonts.set(JSON.stringify(s.fontName),s.fontName); for(const c of n.children || []) collect(c); }
    trees.forEach(collect);
    json('design.json',{schemaVersion:'1.0.0',coordinateSystem:'x/y relative to parent; absoluteTransform in document coordinates',page:{id:figma.currentPage.id,name:figma.currentPage.name},roots:trees,variables,collections,styles});
    json('manifest.json',{schemaVersion:'1.0.0',exporterVersion:'0.1.0',createdAt:new Date().toISOString(),documentName:figma.root.name,roots:roots.map(n=>({id:n.id,name:n.name})),nodeCount:count,assets,previews,fonts:[...fonts.values()],warnings,limitations:['Font binaries are not exported. Install licensed fonts separately.','Only selected subtrees and accessible referenced metadata are included.','Prototype destinations outside the selection may not be included.'],fileCount:fileCount+1});
    figma.ui.postMessage({type:'complete',name:`figma-export-${safeName(roots[0].name)}.zip`,warnings});
  } catch(e) { figma.ui.postMessage({type:'error',text:String(e)}); }
  finally {busy=false;}
};
