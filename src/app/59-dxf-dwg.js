/* ---------- AutoCAD DXF import / export ---------- */
var DXFU={1:0.0254,2:0.3048,3:1609.344,4:0.001,5:0.01,6:1,7:1000,10:0.9144,14:0.1,15:10};
function loadDxfLib(){return new Promise(function(res,rej){if(window.DxfParser)return res();var s=document.createElement('script');s.src='/vendor/dxf-parser.js';s.onload=function(){window.DxfParser?res():rej(new Error('The DXF reader did not load'))};s.onerror=function(){rej(new Error('The DXF reader did not load. Check your connection and try again'))};document.head.appendChild(s)})}
function dxfFlatten(dxf){
 var out={segs:[],txt:[],layers:{},off:{}},blocks=dxf.blocks||{},n=0,CAP=700000;
 try{var tl=(dxf.tables&&dxf.tables.layer&&dxf.tables.layer.layers)||{};Object.keys(tl).forEach(function(k){var q=tl[k];if(q&&(q.visible===false||q.frozen===true))out.off[k]=1})}catch(e){}
 function mul(A,B){return [A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]]}
 function ap(m,x,y){return {x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]}}
 function emit(l,pts,closed,m){if(pts.length<2||n>CAP)return;n++;out.layers[l]=(out.layers[l]||0)+1;out.segs.push({l:l,p:pts.map(function(q){return ap(m,q.x,q.y)}),c:!!closed})}
 function arc(cx,cy,r,a0,a1,step){while(a1<a0)a1+=2*Math.PI;var k=Math.max(4,Math.ceil((a1-a0)/(step||.12))),o=[];for(var i=0;i<=k;i++){var a=a0+(a1-a0)*i/k;o.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)})}return o}
 function bulgeSeg(p,q,b){var th=4*Math.atan(b),dx=q.x-p.x,dy=q.y-p.y,c=Math.hypot(dx,dy);if(c<1e-12)return [];var d=(c/2)*((1-b*b)/(2*b)),mx=(p.x+q.x)/2-dy/c*d,my=(p.y+q.y)/2+dx/c*d,a1=Math.atan2(p.y-my,p.x-mx),r=Math.hypot(p.x-mx,p.y-my),k=Math.max(3,Math.ceil(Math.abs(th)/.12)),o=[];for(var i=1;i<k;i++){var a=a1+th*i/k;o.push({x:mx+r*Math.cos(a),y:my+r*Math.sin(a)})}return o}
 function poly(vs,closed){var o=[];for(var i=0;i<vs.length;i++){var v=vs[i],w=vs[(i+1)%vs.length];o.push({x:v.x,y:v.y});if(v.bulge&&(i<vs.length-1||closed)&&Math.abs(v.bulge)>1e-9)bulgeSeg(v,w,v.bulge).forEach(function(q){o.push(q)})}return o}
 function clean(t){return String(t||'').replace(/\\P/g,'\n').replace(/\\[fFHWQTCcAa][^;]*;/g,'').replace(/\\[Ll]|\\[Oo]|\\~/g,' ').replace(/[{}]/g,'').replace(/%%[cC]/g,'Ø').replace(/%%[dD]/g,'°').replace(/%%[pP]/g,'±')}
 function walk(ents,m,depth,pl){
  if(!ents||depth>8)return;
  for(var i=0;i<ents.length;i++){var e=ents[i];if(!e||e.visible===false||e.inPaperSpace)continue;
   var ly=(e.layer==='0'&&pl)?pl:(e.layer||'0'),t=e.type;
   try{
   if(t==='LINE'&&e.vertices&&e.vertices.length>1)emit(ly,[e.vertices[0],e.vertices[1]],false,m);
   else if(t==='LWPOLYLINE'||t==='POLYLINE'){var vs=(e.vertices||[]).filter(function(v){return v&&isFinite(v.x)&&isFinite(v.y)});if(t==='POLYLINE'&&(e.threeDPolygonMesh||e.polyfaceMesh))continue;var cl=!!e.shape;emit(ly,poly(vs,cl),cl,m)}
   else if(t==='CIRCLE'&&e.center)emit(ly,arc(e.center.x,e.center.y,e.radius,0,2*Math.PI,.1),true,m);
   else if(t==='ARC'&&e.center)emit(ly,arc(e.center.x,e.center.y,e.radius,e.startAngle,e.endAngle),false,m);
   else if(t==='ELLIPSE'&&e.center&&e.majorAxisEndPoint){var mj=e.majorAxisEndPoint,r=e.axisRatio||1,s0=e.startAngle||0,s1=e.endAngle||0;if(Math.abs(s1-s0)<1e-9)s1=s0+2*Math.PI;while(s1<s0)s1+=2*Math.PI;var kk=Math.max(8,Math.ceil((s1-s0)/.1)),pp=[];for(var q=0;q<=kk;q++){var a=s0+(s1-s0)*q/kk;pp.push({x:e.center.x+Math.cos(a)*mj.x-Math.sin(a)*r*mj.y,y:e.center.y+Math.cos(a)*mj.y+Math.sin(a)*r*mj.x})}emit(ly,pp,Math.abs((s1-s0)-2*Math.PI)<1e-6,m)}
   else if(t==='SPLINE'){var sp=(e.fitPoints&&e.fitPoints.length>1)?e.fitPoints:e.controlPoints;if(sp&&sp.length>1)emit(ly,sp,!!e.closed,m)}
   else if((t==='SOLID'||t==='3DFACE')&&e.points&&e.points.length>=3){var P=e.points,o=t==='SOLID'&&P.length===4?[P[0],P[1],P[3],P[2]]:P;emit(ly,o,true,m)}
   else if(t==='TEXT'||t==='MTEXT'){var pos=e.startPoint||e.position,h=e.textHeight||e.height||0,tx=clean(e.text);if(pos&&h>0&&tx){var pw=ap(m,pos.x,pos.y),sc=Math.sqrt(Math.abs(m[0]*m[3]-m[1]*m[2]));out.txt.push({l:ly,x:pw.x,y:pw.y,h:h*sc,s:tx,r:(e.rotation||0)+Math.atan2(m[1],m[0])/D2R})}}
   else if(t==='INSERT'&&blocks[e.name]){var b=blocks[e.name],bp=b.position||{x:0,y:0},rot=(e.rotation||0)*D2R,sx=e.xScale||1,sy=e.yScale||1,c=Math.cos(rot),s=Math.sin(rot),ip=e.position||{x:0,y:0};
    var M=mul(mul([1,0,0,1,ip.x,ip.y],[c,s,-s,c,0,0]),mul([sx,0,0,sy,0,0],[1,0,0,1,-bp.x,-bp.y]));
    var cols=Math.max(1,e.columnCount||1),rows=Math.max(1,e.rowCount||1);
    for(var rr=0;rr<Math.min(rows,50);rr++)for(var cc=0;cc<Math.min(cols,50);cc++){var off=[1,0,0,1,0,0];if(cols>1||rows>1){var dx=(e.columnSpacing||0)*cc,dy=(e.rowSpacing||0)*rr;off=[1,0,0,1,dx*c-dy*s,dx*s+dy*c]}
     walk(b.entities,mul(m,mul(off,M)),depth+1,ly)}}
   else if(t==='DIMENSION'&&e.block&&blocks[e.block])walk(blocks[e.block].entities,m,depth+1,ly);
   }catch(err){}
  }
 }
 walk(dxf.entities,[1,0,0,1,0,0],0,null);
 out.capped=n>CAP;return out}
function dxfExtents(fl,sel){
 var xs=[],ys=[],x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 fl.segs.forEach(function(s){if(!sel[s.l])return;s.p.forEach(function(q){if(q.x<x0)x0=q.x;if(q.x>x1)x1=q.x;if(q.y<y0)y0=q.y;if(q.y>y1)y1=q.y});var m=s.p[(s.p.length/2)|0];xs.push(m.x);ys.push(m.y)});
 if(!isFinite(x0))return null;
 var r={x0:x0,x1:x1,y0:y0,y1:y1,trim:false};if(xs.length<20)return r;
 xs.sort(function(a,b){return a-b});ys.sort(function(a,b){return a-b});var k=xs.length,lo=Math.floor(k*.005),hi=Math.min(k-1,Math.ceil(k*.995));
 var tx0=xs[lo],tx1=xs[hi],ty0=ys[lo],ty1=ys[hi],sx=tx1-tx0,sy=ty1-ty0;
 if((x1-x0)>3*Math.max(sx,1e-9)||(y1-y0)>3*Math.max(sy,1e-9)){var px=sx*.05+1e-9,py=sy*.05+1e-9;r={x0:Math.max(x0,tx0-px),x1:Math.min(x1,tx1+px),y0:Math.max(y0,ty0-py),y1:Math.min(y1,ty1+py),trim:true}}
 return r}
var _dwgLib=null;
async function dwgToDxf(f){
 if(!_dwgLib){var m=await import('/vendor/libredwg/dist/libredwg-web.js');_dwgLib=await m.LibreDwg.create('/vendor/libredwg/wasm')}
 var buf=await f.arrayBuffer(),ver=String.fromCharCode.apply(null,new Uint8Array(buf,0,6));
 if(!/^AC10/.test(ver))throw new Error('That does not look like a DWG file');
 var out=_dwgLib.dwg_write_dxf(buf);if(!out||!out.length)throw new Error('Could not convert that DWG. In AutoCAD choose Save As, AutoCAD 2010 DXF, and import the DXF instead');
 return new TextDecoder('utf-8').decode(out)}
async function importDxf(){
 pickFile('.dxf,.dwg',async function(f){
  var isDwg=/\.dwg$/i.test(f.name);
  try{
   toast('Reading '+f.name+(isDwg?' (converting DWG, this can take a moment)':'')+'…',60000);await loadDxfLib();var txt;
   if(isDwg){txt=await dwgToDxf(f)}else txt=await f.text();
   if(/^\s*AutoCAD Binary DXF/.test(txt.slice(0,60)))throw new Error('That is a binary DXF. In AutoCAD choose Save As → AutoCAD 2010 DXF (ASCII).');
   var C=window.DxfParser.default||window.DxfParser,dxf=new C().parseSync(txt);if(!dxf||!dxf.entities)throw new Error('No drawing found in that file');
   var fl=dxfFlatten(dxf);if(isDwg)fl.off={};if(!fl.segs.length)throw new Error('I found no lines to read in that DXF (hatches, 3D solids and images are not read). Try exporting a 2D DXF.');
   dxfDialog(f,dxf,fl);
  }catch(e){toast(e.message||'Could not read that DXF',7000)}
 })}
function dxfDialog(f,dxf,fl){
 var names=Object.keys(fl.layers).sort(),sel={},iu=dxf.header&&dxf.header['$INSUNITS'],uf=DXFU[iu],all={};names.forEach(function(k){all[k]=1});
 var ex0=dxfExtents(fl,all),span=ex0?Math.max(ex0.x1-ex0.x0,ex0.y1-ex0.y0):0;
 if(!uf)uf=span>2000?0.001:1;
 names.forEach(function(k){sel[k]=!fl.off[k]&&!/^defpoints$/i.test(k)});
 var UO=[['0.001','Millimetres'],['0.01','Centimetres'],['1','Metres'],['0.0254','Inches'],['0.3048','Feet']],m=$('#modal');
 var h='<div class="mbox" role="dialog" aria-label="Import AutoCAD drawing" style="max-width:560px;max-height:88vh;overflow:auto"><h3>Import AutoCAD drawing</h3><p class="note"><b>'+esc(f.name)+'</b> · '+fl.segs.length.toLocaleString('en-ZA')+' lines/shapes'+(fl.txt.length?' · '+fl.txt.length+' text items':'')+(fl.capped?' · very large, partly read':'')+'</p>';
 h+='<label>Drawing units<select id="dx_u">'+UO.map(function(o){return '<option value="'+o[0]+'"'+(Math.abs(+o[0]-uf)<1e-9?' selected':'')+'>'+o[1]+(Math.abs(+o[0]-uf)<1e-9&&DXFU[iu]?' (from the file)':'')+'</option>'}).join('')+'</select></label><p class="note" id="dx_sz"></p>';
 h+='<label>Bring it in as<select id="dx_m"><option value="u">Background underlay, to scale (recommended: trace and edit over it)</option><option value="e">Editable lines (every line becomes a thin line you can move, restyle or delete)</option><option value="b">Both</option></select></label>';
 h+='<div style="margin:8px 0 4px;font-size:13px;color:#5b6b78">Layers to bring in <a href="#" id="dx_all">all</a> · <a href="#" id="dx_none">none</a></div><div style="max-height:200px;overflow:auto;border:1px solid #d6dde2;border-radius:8px;padding:6px 10px">'+names.map(function(k,i){return '<label style="flex-direction:row;align-items:center;gap:8px;margin:2px 0;font-size:13px"><input type="checkbox" data-dxl="'+i+'"'+(sel[k]?' checked':'')+'> '+esc(k)+' <span style="color:#5b6b78">('+fl.layers[k]+')</span>'+(fl.off[k]?' <i style="color:#b45309">off/frozen</i>':'')+'</label>'}).join('')+'</div>';
 h+='<div class="mrow"><button class="btn" id="mc">Cancel</button><button class="btn pri" id="mo">Import</button></div></div>';
 m.innerHTML=h;m.classList.add('on');
 function close(){m.classList.remove('on');m.innerHTML=''}
 function sync(){var u=+$('#dx_u').value,e=dxfExtents(fl,sel),el=$('#dx_sz');if(!e){el.textContent='No layers selected';return}
  var w=(e.x1-e.x0)*u,hh=(e.y1-e.y0)*u;el.innerHTML='Drawing size at these units: <b>'+w.toFixed(1)+' × '+hh.toFixed(1)+' m</b>'+(e.trim?' <span style="color:#b45309">(stray far-away objects ignored)</span>':'')+((w>1500||hh>1500||Math.max(w,hh)<3)?' <span style="color:#c62828"> — that looks wrong: check the units</span>':'')}
 $('#dx_u').onchange=sync;
 $$('[data-dxl]',m).forEach(function(c){c.onchange=function(){sel[names[+c.dataset.dxl]]=c.checked;sync()}});
 $('#dx_all').onclick=function(e){e.preventDefault();names.forEach(function(k){sel[k]=true});$$('[data-dxl]',m).forEach(function(c){c.checked=true});sync()};
 $('#dx_none').onclick=function(e){e.preventDefault();names.forEach(function(k){sel[k]=false});$$('[data-dxl]',m).forEach(function(c){c.checked=false});sync()};
 $('#mc').onclick=close;
 $('#mo').onclick=function(){var u=+$('#dx_u').value,mode=$('#dx_m').value;close();try{doImportDxf(f,fl,sel,u,mode)}catch(e){toast(e.message||'Import failed',7000)}};
 sync()}
function doImportDxf(f,fl,sel,u,mode){
 var ex=dxfExtents(fl,sel);if(!ex)throw new Error('Select at least one layer');
 var Wm=(ex.x1-ex.x0)*u,Hm=(ex.y1-ex.y0)*u;if(!(Wm>0)||!(Hm>0))throw new Error('The drawing has no size at those units');
 var ox=0,oy=0;if(S.layers.length||S.objs.length){var vb=viewBounds();ox=(vb.x0+vb.x1)/2-Wm/2;oy=(vb.y0+vb.y1)/2-Hm/2}
 var nm=f.name.replace(/\.[^.]+$/,''),segs=fl.segs.filter(function(s){return sel[s.l]});
 function inside(s){for(var i=0;i<s.p.length;i++){var q=s.p[i];if(q.x>=ex.x0&&q.x<=ex.x1&&q.y>=ex.y0&&q.y<=ex.y1)return true}return false}
 segs=segs.filter(inside);
 if(mode==='e'||mode==='b'){if(segs.length>6000)throw new Error(segs.length.toLocaleString('en-ZA')+' lines is too many to edit one by one. Untick the layers you do not need (furniture, hatching, text) or bring it in as an underlay.')}
 snapH();
 if(mode==='u'||mode==='b'){
  var pxm=Math.min(5200/Math.max(Wm,Hm),400),W=Math.max(50,Math.ceil(Wm*pxm)),H=Math.max(50,Math.ceil(Hm*pxm)),cn=document.createElement('canvas');cn.width=W;cn.height=H;var c=cn.getContext('2d');
  c.fillStyle='#fff';c.fillRect(0,0,W,H);c.scale(pxm,pxm);c.strokeStyle='#111';c.lineWidth=Math.max(1.5/pxm,.01);c.lineJoin='round';
  c.beginPath();segs.forEach(function(s){s.p.forEach(function(q,i){var x=(q.x-ex.x0)*u,y=(ex.y1-q.y)*u;if(i)c.lineTo(x,y);else c.moveTo(x,y)});if(s.c)c.closePath()});c.stroke();
  c.fillStyle='#333';c.textBaseline='alphabetic';
  fl.txt.forEach(function(t){if(!sel[t.l])return;var hp=t.h*u*pxm;if(hp<5||t.x<ex.x0||t.x>ex.x1||t.y<ex.y0||t.y>ex.y1)return;c.save();c.translate((t.x-ex.x0)*u,(ex.y1-t.y)*u);c.rotate(-t.r*D2R);c.font=(t.h*u)+'px Arial,sans-serif';t.s.split('\n').slice(0,12).forEach(function(ln,i){c.fillText(ln,0,i*t.h*u*1.25)});c.restore()});
  S.layers.push({id:S.nl++,name:'DXF: '+nm,kind:'plan',img:cn,mpp:1/pxm,pdfLong:0,pdfScale:null,x:ox,y:oy,rot:0,op:.85,blend:'multiply',cal:true,vis:true})}
 if(mode==='e'||mode==='b'){
  segs.forEach(function(s){var pts=s.p.map(function(q){return {x:Math.round((ox+(q.x-ex.x0)*u)*1000)/1000,y:Math.round((oy+(ex.y1-q.y)*u)*1000)/1000}});var o={t:'line',style:'thin',pts:pts,closed:s.c&&pts.length>2,id:newId()};if(S.meta.only)o.lay=S.meta.only;S.objs.push(o)})}
 S.dismissed=true;S.tab=(mode==='e')?'obj':'lay';updateWelcome();fitTo({x0:ox,y0:oy,x1:ox+Wm,y1:oy+Hm},.1);changed(true);renderPanel();draw();
 toast('Imported to scale: '+Wm.toFixed(1)+' × '+Hm.toFixed(1)+' m'+(mode==='u'?'. Trace over it, or tick "Edit this plan" in the Images tab.':'.'),6000);
 if(matchMedia('(max-width:820px)').matches)openPanel()}

var DXFCOL={fence:8,barrier:30,wall:7,tape:1,shade:3,shadeb:250,drape:250,plain:7,thin:7,brick:7,shell:7,evac:3,truss:9,stanchion:1,velvet:1,belt:5,ropepole:30};
var DXFW={truss:.3,wall:.2,brick:.23,shell:.04};
function exportDxf(){
 var objs=S.objs.filter(vo);if(!objs.length){toast('Draw something first');return}
 ask('Export for AutoCAD (DXF)',[{l:'Units in the drawing: type mm (AutoCAD default) or m',v:'mm'}],function(v){
  var k=/^m(eters?|etres?)?$/i.test((v[0]||'').trim())?1:1000,iu=k===1?6:4;
  try{var r=buildDxf(objs,k,iu);download(((S.meta.event||'plan').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'plan')+'_'+S.meta.ref+'_Rev'+S.meta.rev+'.dxf',new Blob([r.txt],{type:'application/dxf'}));toast('DXF exported ('+r.n+' items). Open it in AutoCAD, BricsCAD or LibreCAD. Units: '+(k===1?'metres':'millimetres')+'.',6000)}catch(e){toast('DXF export failed: '+e.message,6000)}
 },'Export')}
function buildDxf(objs,k,iu){
 var hc=0x200,used={},ents=[],X0=Infinity,Y0=Infinity,X1=-Infinity,Y1=-Infinity,n=0;
 function H(){return (hc++).toString(16).toUpperCase()}
 function fx(x){return +(x*k).toFixed(4)}function fy(y){return +(-y*k).toFixed(4)}
 function bb(x,y){var a=fx(x),b=fy(y);if(a<X0)X0=a;if(a>X1)X1=a;if(b<Y0)Y0=b;if(b>Y1)Y1=b}
 function lay(name,col){if(!used[name])used[name]=col||7;return name}
 function head(type,layer,sub){return '  0\n'+type+'\n  5\n'+H()+'\n330\n17\n100\nAcDbEntity\n  8\n'+layer+'\n100\n'+sub+'\n'}
 function pl(layer,pts,closed,w){if(pts.length<2)return;n++;pts.forEach(function(p){bb(p.x,p.y)});var s=head('LWPOLYLINE',layer,'AcDbPolyline')+' 90\n'+pts.length+'\n 70\n'+(closed?1:0)+'\n'+(w>0?' 43\n'+(+(w*k).toFixed(4))+'\n':'');pts.forEach(function(p){s+=' 10\n'+fx(p.x)+'\n 20\n'+fy(p.y)+'\n'});ents.push(s)}
 function ln(layer,a,b){n++;bb(a.x,a.y);bb(b.x,b.y);ents.push(head('LINE',layer,'AcDbLine')+' 10\n'+fx(a.x)+'\n 20\n'+fy(a.y)+'\n 30\n0.0\n 11\n'+fx(b.x)+'\n 21\n'+fy(b.y)+'\n 31\n0.0\n')}
 function ci(layer,x,y,r){n++;bb(x-r,y-r);bb(x+r,y+r);ents.push(head('CIRCLE',layer,'AcDbCircle')+' 10\n'+fx(x)+'\n 20\n'+fy(y)+'\n 30\n0.0\n 40\n'+(+(r*k).toFixed(4))+'\n')}
 function tx(layer,x,y,h,s,rotDeg){if(!s)return;n++;bb(x,y);ents.push(head('TEXT',layer,'AcDbText')+' 10\n'+fx(x)+'\n 20\n'+fy(y)+'\n 30\n0.0\n 40\n'+(+(h*k).toFixed(4))+'\n  1\n'+String(s).replace(/[\r\n]+/g,' ')+'\n 50\n'+(+(-(rotDeg||0)).toFixed(3))+'\n100\nAcDbText\n')}
 var CAT={Exhibition:'FPS-STANDS',Tents:'FPS-TENTS','Stage & AV':'FPS-STAGE-AV',Furniture:'FPS-FURNITURE',Services:'FPS-SERVICES',Custom:'FPS-CUSTOM','Plan editing':null};
 objs.forEach(function(o){
  if(o.t==='rect'){var L=LIBM[o.k]||{},ln0=CAT[L.c||'Custom'];if(ln0===null||o.k==='cover')return;var ly=lay(ln0||'FPS-CUSTOM',({'FPS-TENTS':5,'FPS-STAGE-AV':6,'FPS-STANDS':4,'FPS-FURNITURE':2,'FPS-SERVICES':3})[ln0]||7);
   if(/^(round|cocktail|umbrella|urinal)$/.test(L.s)&&Math.abs(o.w-o.h)<1e-6)ci(ly,o.x,o.y,o.w/2);else pl(ly,corners(o),true,0);
   if(o.label)tx(lay('FPS-LABELS',7),o.x-Math.min(o.w*.4,String(o.label).length*.14),o.y,Math.max(.15,Math.min(.5,Math.min(o.w,o.h)*.16)),o.label,0)}
  else if(o.t==='area'){var ly2=lay('FPS-ZONES',8),P=[];if(o.sh==='ellipse'){for(var i=0;i<64;i++){var a=i/64*TAU,q=rotv(Math.cos(a)*o.w/2,Math.sin(a)*o.h/2,(o.rot||0)*D2R);P.push({x:o.x+q.x,y:o.y+q.y})}}else P=corners(o);pl(ly2,P,true,0);if(o.label){tx('FPS-LABELS',o.x-String(o.label).length*.12,o.y,.4,o.label,0);lay('FPS-LABELS',7)}}
  else if(o.t==='poly'){pl(lay('FPS-ZONES',8),o.pts,true,0);if(o.label){var cen=polyCentroid(o.pts);tx('FPS-LABELS',cen.x-String(o.label).length*.12,cen.y,.4,o.label,0);lay('FPS-LABELS',7)}}
  else if(o.t==='line'){var st=o.style||'fence',ly3=lay('FPS-'+st.toUpperCase(),DXFCOL[st]||7);if(o.gaps&&o.gaps.length){lineRuns(o).runs.forEach(function(r){pl(ly3,r,false,DXFW[st]||0)})}else pl(ly3,o.pts,!!o.closed,DXFW[st]||0)}
  else if(o.t==='door'){var th=o.th||.6,ly4=lay('FPS-DOORS',3);pl(ly4,corners({x:o.x,y:o.y,rot:o.rot||0,w:o.w,h:th,t:'x'}),true,0);tx('FPS-LABELS',o.x-.6,o.y-th,.25,o.label||(DOORM[o.k]||{}).lab||'',0);lay('FPS-LABELS',7)}
  else if(o.t==='sign'){var ly5=lay('FPS-SIGNS',6),sz=Math.max(.3,o.s||1)/(/^exit/.test(o.k)?1:2);pl(ly5,corners({x:o.x,y:o.y,rot:o.rot||0,w:sz,h:sz*(/^exit/.test(o.k)?.42:1),t:'x'}),true,0);tx('FPS-SIGNS',o.x-sz/2,o.y+sz*.8,.2,String(o.k).replace(/_/g,' ').toUpperCase(),0)}
  else if(o.t==='text'){tx(lay('FPS-TEXT',7),o.x,o.y,Math.max(.2,.06*(o.size||14)),o.text,o.rot||0)}
  else if(o.t==='dim'){var ly6=lay('FPS-DIMS',1);ln(ly6,o.a,o.b);var dd=Math.hypot(o.b.x-o.a.x,o.b.y-o.a.y);tx(ly6,(o.a.x+o.b.x)/2,(o.a.y+o.b.y)/2-.2,.3,(o.label||dd.toFixed(2)+' m'),Math.atan2(o.b.y-o.a.y,o.b.x-o.a.x)/D2R)}
 });
 var m=S.meta,ix=isFinite(X0)?X0/k:0,iy=isFinite(Y0)?-Y0/k:0;
 [m.event,(m.venue||'')+'  ·  '+(m.date||''),'Ref '+m.ref+'  Rev '+m.rev+'  ·  Drawn in IMPI FloorPlan Studio. Drawing units: '+(k===1?'metres':'millimetres')].forEach(function(s,i){if(s)tx(lay('FPS-INFO',7),ix,iy+2+i*1.1,.7,s,0)});
 var L2=Object.keys(used),tpl=DXF_TPL;
 tpl=tpl.replace(/(\$INSUNITS\n 70\n)\d+/,'$1'+iu).replace(/(\$HANDSEED\n  5\n)[0-9A-F]+/,'$1'+(hc+64).toString(16).toUpperCase());
 if(isFinite(X0))tpl=tpl.replace(/\$EXTMIN\n 10\n[^\n]+\n 20\n[^\n]+\n 30\n[^\n]+/,'$EXTMIN\n 10\n'+X0+'\n 20\n'+Y0+'\n 30\n0.0').replace(/\$EXTMAX\n 10\n[^\n]+\n 20\n[^\n]+\n 30\n[^\n]+/,'$EXTMAX\n 10\n'+X1+'\n 20\n'+Y1+'\n 30\n0.0');
 var key='  2\nLAYER\n  5\n1\n330\n0\n100\nAcDbSymbolTable\n 70\n',ki=tpl.indexOf(key);if(ki<0)throw new Error('template');
 var cm=tpl.slice(ki+key.length).match(/^(\d+)/),cnt=+cm[1],after=ki+key.length+cm[1].length,endt=tpl.indexOf('ENDTAB',after),lt=endt-4;
 var ltxt=L2.map(function(nm){return '  0\nLAYER\n  5\n'+H()+'\n330\n1\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n  2\n'+nm+'\n 70\n0\n 62\n'+used[nm]+'\n  6\nContinuous\n370\n-3\n390\n13\n'}).join('');
 tpl=tpl.slice(0,ki+key.length)+(cnt+L2.length)+tpl.slice(after,endt-4)+ltxt+tpl.slice(endt-4);
 var es='  2\nENTITIES\n  0\nENDSEC';if(tpl.indexOf(es)<0)throw new Error('template');
 tpl=tpl.replace(es,'  2\nENTITIES\n'+ents.join('')+'  0\nENDSEC');
 tpl=tpl.replace(/(\$HANDSEED\n  5\n)[0-9A-F]+/,'$1'+(hc+64).toString(16).toUpperCase());
 return {txt:tpl,n:n}}

