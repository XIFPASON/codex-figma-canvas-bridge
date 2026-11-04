const keys = `name x y rotation opacity visible locked fills strokes strokeWeight strokeAlign cornerRadius topLeftRadius topRightRadius bottomLeftRadius bottomRightRadius effects clipsContent layoutMode layoutWrap paddingTop paddingRight paddingBottom paddingLeft itemSpacing counterAxisSpacing primaryAxisAlignItems counterAxisAlignItems primaryAxisSizingMode counterAxisSizingMode layoutSizingHorizontal layoutSizingVertical layoutGrow layoutAlign layoutPositioning fontSize textAlignHorizontal textAlignVertical textAutoResize lineHeight letterSpacing paragraphSpacing textCase textDecoration`.split(' ');
const readKeys = ['id','type','width','height','characters','fontName','boundVariables','componentProperties','variantProperties','absoluteBoundingBox',...keys];
function plain(v:any):any {if(typeof v==='symbol')return {mixed:true};if(Array.isArray(v))return v.map(plain);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).map(k=>[k,plain(v[k])]));return v;}
export function context(){return {documentId:figma.root.id,documentName:figma.root.name,fileKey:figma.fileKey||null,pageId:figma.currentPage.id,pageName:figma.currentPage.name};}
async function lookup(id:string):Promise<any>{const n=await figma.getNodeByIdAsync(id);if(!n)throw Error('图层不存在');let p:any=n;while(p&&p.type!=='PAGE')p=p.parent;if(p?.id!==figma.currentPage.id)throw Error('图层不属于当前页面，请先切换到目标页面');return n;}
function serialize(n:any,depth:number,budget:{count:number}):any{
  if(++budget.count>3000)throw Error('图层过多，请缩小选区或读取深度');
  const out:any={};for(const key of readKeys)if(key in n)out[key]=plain(n[key]);
  if(n.parent)out.parentId=n.parent.id;
  if('children'in n){out.childCount=n.children.length;if(depth>0)out.children=n.children.map((c:any)=>serialize(c,depth-1,budget));}
  if(n.type==='TEXT')out.textSegments=plain(n.getStyledTextSegments(['fontName','fontSize','fills','lineHeight','letterSpacing']));
  return out;
}
async function apply(n:any,props:any){
  if(!props||typeof props!=='object'||Array.isArray(props))throw Error('props 必须是对象');
  for(const key of Object.keys(props))if(![...keys,'width','height','characters','fontName'].includes(key))throw Error(`不支持属性 ${key}`);
  if(n.type==='TEXT'||'fontName'in props||'characters'in props){
    if(n.type!=='TEXT')throw Error('文字属性只能用于 TEXT');
    const fonts=props.fontName?[props.fontName]:n.fontName===figma.mixed?n.getRangeAllFontNames(0,n.characters.length):[n.fontName];
    for(const font of fonts)await figma.loadFontAsync(font);
    if(props.fontName)n.fontName=props.fontName;
    if('characters'in props)n.characters=props.characters;
  }
  if('width'in props||'height'in props){const w=props.width??n.width,h=props.height??n.height;if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)throw Error('尺寸必须为正数');n.resize(w,h);}
  for(const key of keys)if(key in props){if(!(key in n))throw Error(`${n.type} 不支持 ${key}`);n[key]=props[key];}
}
export async function executeCanvas(command:any){
  const {op,args={}}=command;
  let created:any=null,mutated:string[]=[];
  const budget={count:0},depth=Math.max(0,Math.min(6,args.depth??2));
  try{
    if(op==='get_document')return {context:context(),nodes:figma.currentPage.children.map(n=>serialize(n,0,budget))};
    if(op==='get_selection')return {context:context(),nodes:figma.currentPage.selection.map(n=>serialize(n,depth,budget))};
    if(op==='get_node')return {context:context(),node:serialize(await lookup(args.id),depth,budget)};
    if(op==='screenshot'){
      const n=await lookup(args.id);const scale=Math.min(args.scale===2?2:1,4096/Math.max(n.width,n.height,1));
      const bytes=await n.exportAsync({format:'PNG',constraint:{type:'SCALE',value:scale}});
      if(bytes.length>24*1024*1024)throw Error('截图过大，请缩小选区');
      return {nodeId:n.id,scale,mimeType:'image/png',base64:figma.base64Encode(bytes)};
    }
    if(op==='select'){
      const nodes=await Promise.all((args.ids||[]).map(lookup));figma.currentPage.selection=nodes;figma.viewport.scrollAndZoomIntoView(nodes);return {selectedNodeIds:nodes.map(n=>n.id)};
    }
    if(op==='create'){
      const factories:any={FRAME:()=>figma.createFrame(),RECTANGLE:()=>figma.createRectangle(),ELLIPSE:()=>figma.createEllipse(),TEXT:()=>figma.createText(),COMPONENT:()=>figma.createComponent()};
      const parent=args.parentId?await lookup(args.parentId):figma.currentPage;
      if(!('appendChild'in parent))throw Error('目标父节点不能容纳子节点');
      if(args.type==='SVG')created=figma.createNodeFromSvg(String(args.svg||''));
      else if(factories[args.type])created=factories[args.type]();else throw Error('不支持的图层类型');
      parent.appendChild(created);
      if(parent===figma.currentPage){created.x=figma.currentPage.children.filter(n=>n.id!==created.id).reduce((max,n)=>Math.max(max,n.x+n.width),0)+80;created.y=0;}
      await apply(created,args.props||{});
      figma.commitUndo();return {createdNodeIds:[created.id],node:serialize(created,0,budget)};
    }
    if(op==='update'){
      const n=await lookup(args.id);mutated.push(n.id);await apply(n,args.props||{});figma.commitUndo();return {mutatedNodeIds:mutated,node:serialize(n,0,budget)};
    }
    if(op==='clone'){
      const n=await lookup(args.id);created=n.clone();await apply(created,args.props||{x:n.x+n.width+24});figma.commitUndo();return {createdNodeIds:[created.id],node:serialize(created,0,budget)};
    }
    if(op==='reparent'){
      const n=await lookup(args.id),p=await lookup(args.parentId);if(!('appendChild'in p))throw Error('父节点不可容纳子节点');
      mutated.push(n.id);p.appendChild(n);figma.commitUndo();return {mutatedNodeIds:mutated,parentId:p.id};
    }
    if(op==='set_image'){
      const n=await lookup(args.id);if(!('fills'in n))throw Error('图层不支持图片填充');
      const bytes=figma.base64Decode(args.base64);if(bytes.length>16*1024*1024)throw Error('图片超过16MB');
      const image=figma.createImage(bytes);mutated.push(n.id);n.fills=[{type:'IMAGE',imageHash:image.hash,scaleMode:args.scaleMode||'FILL'}];figma.commitUndo();return {mutatedNodeIds:mutated,imageHash:image.hash};
    }
    throw Error(`不支持操作 ${op}`);
  }catch(error){if(created){created.remove();created=null;}if(mutated.length)figma.commitUndo();throw Error(JSON.stringify({message:String(error),mutatedNodeIds:mutated,partialChangesPossible:mutated.length>0}));}
}
