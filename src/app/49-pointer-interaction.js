/* ---------- pointer interaction ---------- */
var ptrs={},drag=null,pinch=null,spaceDown=false,lastTapT=0;
function rectOf(e){var r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
function setHint(t){var h=$('#hint');if(t){h.textContent=t;h.classList.add('on')}else h.classList.remove('on')}
function toolHint(){
 var t=S.tool,m={select:'',facept:'Tap the stage, structure or point the selected items should face',pan:'Drag to move around the plan',dim:'Drag from one point to another to measure',area:'Drag to draw a zone or tent footprint — size shows automatically',line:'Tap points to draw a fence or barrier, then tap Finish',poly:'Tap each corner of the zone. Tap the first point again, or Finish, to close it',marq:'Drag a box around objects to select them. Left to right = fully inside, right to left = touching',text:'Tap where the note should go',dogtap:'Tap the spot on the selected wall where the emergency dog-leg exit should go',gorigin:'Tap the corner where the stand grid should start (for example the top-left corner of the hall)',calib:S.calib?(S.calib.pts.length?'Tap the second point':'Tap the first point of a known distance'):'',layermove:'Drag to slide the image. Pinch to resize and twist it. Tap Done when lined up.',place:'Tap on the plan to place it'};
 setHint(m[t]||'');
}
function setTool(t,arm){
 if(t!=='line'&&S.lineStyle==='evac')S.lineStyle='fence';
 if((S.tool==='line'||S.tool==='poly')&&t!==S.tool)cancelLine();
 if(t!=='line'&&t!=='poly')S.pencil=false;
 if(t!=='line'){S.perim=false;S.gapNext=false}
 S.tool=t;S.arm=arm||null;if(t!=='calib')S.calib=t==='calib'?S.calib:null;if(t!=='layermove')S.mv=t==='layermove'?S.mv:null;
 $$('#tools .tool').forEach(function(b){b.classList.toggle('on',b.dataset.tool===t||(t==='place'&&b.dataset.tool==='select'&&false))});
 cv.style.cursor=t==='pan'||t==='layermove'?'grab':t==='select'?'default':'crosshair';
 $('#lineSel').classList.toggle('on',t==='line');if(t==='line')$('#lineSel').value=S.lineStyle||'fence';
 $('#doneBtn').textContent=t==='layermove'?'Done aligning':(t==='poly'?'Finish shape':'Finish line');$('#doneBtn').classList.toggle('on',((t==='line'||t==='poly')&&!!S.tmp&&S.tmp.pts.length>1)||t==='layermove');
 toolHint();syncPrec();if(S.tab==='lib')renderPanel();draw();
}
function cancelLine(){S.tmp=null;$('#doneBtn').classList.remove('on')}
function finishLine(){
 var t=S.tmp;if(!t||t.t!=='line'||t.pts.length<2){cancelLine();return}
 var pts=t.pts.map(function(p){return {x:p.x,y:p.y}});
 if(t.poly){if(pts.length<3){toast('A shape needs at least 3 corners');cancelLine();draw();return}
  var n=S.objs.filter(function(o){return o.t==='area'||o.t==='poly'}).length+1;S.tmp=null;var sn=S.siteNext;S.siteNext=false;addObj(sn?{t:'poly',pts:pts,col:'#12804a',fo:.05,site:1,label:'Event site'}:{t:'poly',pts:pts,col:ZCOL[0].c,label:'Zone '+n});$('#doneBtn').classList.remove('on');setTool('select');return}
 var o={t:'line',style:t.style,pts:pts,closed:!!t.closeIt};if(t.gaps&&t.gaps.length)o.gaps=t.gaps.slice();if(S.perim){o.perim=1;o.segl=1}S.perim=false;S.gapNext=false;if(t.style==='evac'){o.ev=1;o.man=1;o.keep=1;if(S.meta.only)o.lay=S.meta.only}S.tmp=null;addObj(o);$('#doneBtn').classList.remove('on');setTool('select');
}
cv.addEventListener('pointerdown',function(e){
 cv.setPointerCapture(e.pointerId);var p=rectOf(e);ptrs[e.pointerId]=p;var ids=Object.keys(ptrs);
 if(ids.length===2){drag=null;S.snapPt=null;var a=ptrs[ids[0]],b=ptrs[ids[1]];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),mx:(a.x+b.x)/2,my:(a.y+b.y)/2,view:{x:S.view.x,y:S.view.y,z:S.view.z}};
  if(S.tool==='layermove'&&S.mv){var LM=layer(S.mv);if(LM){var q0=s2w({x:pinch.mx,y:pinch.my}),pp=rotv(q0.x-LM.x,q0.y-LM.y,-LM.rot*D2R);pinch.layer={L:LM,mpp:LM.mpp,rot:LM.rot,a0:Math.atan2(b.y-a.y,b.x-a.x),px:pp.x/LM.mpp,py:pp.y/LM.mpp}}}
  return}
 if(ids.length>2)return;
 onDown(e,p);
});
cv.addEventListener('pointermove',function(e){
 var p=rectOf(e);if(ptrs[e.pointerId])ptrs[e.pointerId]=p;
 var ids=Object.keys(ptrs);
 if(pinch&&ids.length>=2){var a=ptrs[ids[0]],b=ptrs[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  if(pinch.layer){var P=pinch.layer,LP=P.L,f=d/Math.max(1,pinch.d),rt=P.rot+(Math.atan2(b.y-a.y,b.x-a.x)-P.a0)/D2R,nm=P.mpp*f,mw=s2w({x:mx,y:my}),of=rotv(P.px*nm,P.py*nm,rt*D2R);LP.mpp=nm;LP.rot=rt;LP.x=mw.x-of.x;LP.y=mw.y-of.y;if(LP.cal===true)LP.cal='eye';draw();return}
  var nz=Math.max(.0005,Math.min(20000,pinch.view.z*d/Math.max(1,pinch.d)));var wx=(pinch.mx-pinch.view.x)/pinch.view.z,wy=(pinch.my-pinch.view.y)/pinch.view.z;S.view.z=nz;S.view.x=mx-wx*nz;S.view.y=my-wy*nz;draw();return}
 S.hover=s2w(p);S.hp=p;S.hpt=e.pointerType==='touch';
 if(drag){onMove(e,p)}
 else{
  if((S.tool==='line'||S.tool==='poly')&&S.tmp){S.tmp.cur=orthoFix(snapW(S.hover));draw()}
  else if(S.tool==='calib'||S.tool==='dim'||S.tool==='area'||S.tool==='line'||S.tool==='poly'||S.tool==='gorigin'||S.arm){snapW(S.hover);draw()}
  else draw();
 }
});
function endPtr(e){
 var had=!!ptrs[e.pointerId];delete ptrs[e.pointerId];
 if(pinch){if(Object.keys(ptrs).length<2){var hadL=pinch.layer;pinch=null;if(hadL&&S.tab==='lay')renderPanel()}return}
 if(had&&drag)onUp(e);
}
cv.addEventListener('pointerup',endPtr);
cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('pointerleave',function(){S.hover=null;draw()});
cv.addEventListener('wheel',function(e){e.preventDefault();if(S.tool==='layermove'&&S.mv&&!e.shiftKey){var LL=layer(S.mv);if(LL){var wp=s2w(rectOf(e));scaleLayer(LL,Math.exp(-e.deltaY*.0016),wp.x,wp.y);if(LL.cal===true)LL.cal='eye';draw();return}}var p=rectOf(e),f=Math.exp(-e.deltaY*(e.ctrlKey?.01:.0016)),nz=Math.max(.0005,Math.min(20000,S.view.z*f)),w=s2w(p);S.view.z=nz;S.view.x=p.x-w.x*nz;S.view.y=p.y-w.y*nz;draw()},{passive:false});
cv.addEventListener('contextmenu',function(e){e.preventDefault()});

var lastHT=null;
function onDown(e,p){
 var w=s2w(p),t=S.tool,o;
 S.hover=w;S.hp=p;S.hpt=e.pointerType==='touch';if(S.hpt&&(S.pencil||t==='calib')){snapW(w);draw()}
 var panNow=(e.button===1||e.button===2||spaceDown||t==='pan');
 if(panNow){drag={k:'pan',sx:p.x,sy:p.y,vx:S.view.x,vy:S.view.y};return}
 if(t==='select'){
  o=getSel();
  if(o&&!o.lk){var h=hitHandle(o,p);if(h){snapH();
   if(h.id[0]==='m'&&(o.t==='line'||o.t==='poly')){var mi=+h.id.slice(1),PP=o.pts,pa=PP[mi],pb=PP[(mi+1)%PP.length];var gaI=o.t==='line'?gapArr(o):null;PP.splice(mi+1,0,{x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2});if(gaI){gapsInsert(gaI,mi);gapSet(o,gaI)}h={id:'v'+(mi+1)}}
   else if(h.id[0]==='v'){var nt=Date.now();if(lastHT&&lastHT.o===o.id&&lastHT.id===h.id&&nt-lastHT.t<450&&o.pts.length>(o.t==='poly'?3:2)){var rI=+h.id.slice(1),gaR=o.t==='line'?gapsRemove(o,gapArr(o),rI):null;o.pts.splice(rI,1);if(gaR)gapSet(o,gaR);lastHT=null;changed(true);toast('Point removed');return}lastHT={o:o.id,id:h.id,t:nt}}
   drag={k:'handle',h:h.id,o:o,orig:JSON.parse(JSON.stringify(o)),moved:false,sh:e.shiftKey};return}}
  var hit=hitTest(w);
  if(hit){
   if(e.shiftKey||e.ctrlKey||e.metaKey){var ids=selIds().slice(),ix=ids.indexOf(hit.id);if(ix>=0)ids.splice(ix,1);else ids.push(hit.id);setSel(ids);S.issues=[];renderSelbar();draw();if(S.tab==='sel'||S.tab==='obj')renderPanel();return}
   if(selIds().indexOf(hit.id)<0)setSel([hit.id]);
   var grp=selObjs().filter(function(x){return !x.lk}).map(function(x){return {o:x,orig:JSON.parse(JSON.stringify(x))}});
   snapH();drag={k:'move',o:hit,orig:JSON.parse(JSON.stringify(hit)),w0:w,moved:false,grp:grp};S.issues=[];renderSelbar();draw();if(S.tab==='sel'||S.tab==='obj')renderPanel();return}
  if(e.shiftKey){drag={k:'marq',a:w};S.tmp={t:'marq',a:w,b:w};return}
  drag={k:'pan',sx:p.x,sy:p.y,vx:S.view.x,vy:S.view.y,tapDesel:true,moved:false};return;
 }
 if(t==='marq'){drag={k:'marq',a:w};S.tmp={t:'marq',a:w,b:w};return}
 if(t==='place'){
  var sp=placePos(w,S.arm);var ob=makeAt(S.arm,sp);snapH();ob.id=newId();if(S.meta.only)ob.lay=S.meta.only;else if(S.venueMode)ob.vn=1;S.objs.push(ob);setSel([ob.id]);drag={k:'move',o:ob,orig:JSON.parse(JSON.stringify(ob)),w0:w,moved:false,fresh:true};draw();return;
 }
 if(t==='area'||t==='dim'){var q=snapW(w);drag={k:'draw',t:t,a:q};S.tmp={t:t,a:q,b:q};draw();return}
 if(t==='line'||t==='poly'){drag={k:'linetap',sx:p.x,sy:p.y};return}
 if(t==='text'){drag={k:'texttap',sx:p.x,sy:p.y,w:snapW(w,null,true)};return}
 if(t==='facept'){drag={k:'facepttap',sx:p.x,sy:p.y};return}
 if(t==='calib'){drag={k:'calibtap',sx:p.x,sy:p.y};return}
 if(t==='gorigin'){drag={k:'gotap',sx:p.x,sy:p.y};return}
 if(t==='dogtap'){drag={k:'dogtap',sx:p.x,sy:p.y};return}
 if(t==='layermove'){var L=S.layers.filter(function(l){return l.id===S.mv})[0];if(L)drag={k:'layer',L:L,w0:w,x0:L.x,y0:L.y};return}
}
function onMove(e,p){
 var w=s2w(p),d=drag;
 if(d.k==='pan'){var dx=p.x-d.sx,dy=p.y-d.sy;if(Math.abs(dx)+Math.abs(dy)>4)d.moved=true;S.view.x=d.vx+dx;S.view.y=d.vy+dy;draw();return}
 if(d.k==='move'){
  var dx2=w.x-d.w0.x,dy2=w.y-d.w0.y,g=S.grid;if(g>0){dx2=Math.round(dx2/g)*g;dy2=Math.round(dy2/g)*g}
  if(Math.abs(dx2)+Math.abs(dy2)>0||d.fresh)d.moved=true;
  if(d.fresh&&S.tool==='place'){var sp=placePos(w,S.arm);d.o.x=sp.x;d.o.y=sp.y}
  else (d.grp||[{o:d.o,orig:d.orig}]).forEach(function(q){applyMove(q.o,q.orig,dx2,dy2)});
  draw();return;
 }
 if(d.k==='handle'){
  var o2=d.o,or=d.orig,id=d.h,q=snapW(w,o2.id),z=S.view.z;d.moved=true;
  if(id==='rot'){var a=Math.atan2(w.y-o2.y,w.x-o2.x)/D2R+90;a=Math.round(a);var m=((a%360)+360)%360;[0,45,90,135,180,225,270,315,360].forEach(function(s){if(Math.abs(m-s)<3)m=s%360});o2.rot=m}
  else if(RS[id]&&(o2.t==='rect'||o2.t==='area')){
   var f=RS[id],l=toLocal(or,q),nw=or.w,nh=or.h,lockIt=or.lock||isCircle(or)||d.sh;
   if(f[0])nw=Math.max(.01,f[0]>0?l.x+or.w/2:or.w/2-l.x);
   if(f[1])nh=Math.max(.01,f[1]>0?l.y+or.h/2:or.h/2-l.y);
   if(lockIt){var kk=(f[0]&&f[1])?Math.max(nw/or.w,nh/or.h):(f[0]?nw/or.w:nh/or.h);nw=or.w*kk;nh=or.h*kk}
   var cx=f[0]?(f[0]>0?-or.w/2+nw/2:or.w/2-nw/2):0,cy=f[1]?(f[1]>0?-or.h/2+nh/2:or.h/2-nh/2):0,C=rotv(cx,cy,or.rot*D2R);
   o2.w=nw;o2.h=nh;o2.x=or.x+C.x;o2.y=or.y+C.y}
  else if(o2.t==='door'&&(id==='e'||id==='w')){var ld=toLocal(or,q),nw2=id==='e'?Math.max(.1,ld.x+or.w/2):Math.max(.1,or.w/2-ld.x),cx2=id==='e'?-or.w/2+nw2/2:or.w/2-nw2/2,C2=rotv(cx2,0,or.rot*D2R);o2.w=nw2;o2.x=or.x+C2.x;o2.y=or.y+C2.y}
  else if(o2.t==='sign'&&id==='se'){var ls=toLocal(or,w);o2.s=Math.max(.1,Math.round(2*Math.max(Math.abs(ls.x),Math.abs(ls.y))*100)/100)}
  else if(id==='off'){var mx=(or.a.x+or.b.x)/2,my=(or.a.y+or.b.y)/2,L=Math.hypot(or.b.x-or.a.x,or.b.y-or.a.y)||1,nx=-(or.b.y-or.a.y)/L,ny=(or.b.x-or.a.x)/L;o2.off=Math.round(((w.x-mx)*nx+(w.y-my)*ny)*z)}
  else if(id==='ts'){var lt=rotv(w.x-or.x,w.y-or.y,-(or.rot||0)*D2R),tb0=textBox(or);o2.size=Math.max(2,Math.round((or.size||14)*Math.max(.1,(lt.x*z-12)/(tb0.w/2))*10)/10)}
  else if(id==='p0')o2.a=q;else if(id==='p1')o2.b=q;
  else if(id[0]==='v'){o2.pts[+id.slice(1)]=q}
  draw();return;
 }
 if(d.k==='marq'){S.tmp.b=w;draw();return}
 if(d.k==='draw'){var q2=snapW(w);S.tmp.b=q2;draw();return}
 if(d.k==='layer'){d.L.x=d.x0+(w.x-d.w0.x);d.L.y=d.y0+(w.y-d.w0.y);draw();return}
 if((d.k==='linetap'&&S.pencil||d.k==='calibtap')&&e.pointerType==='touch'){S.hover=w;S.hp=p;S.hpt=true;var sq=snapW(w);if(d.k==='linetap'&&S.tmp&&S.tmp.pts&&S.tmp.pts.length)S.tmp.cur=orthoFix(sq);draw();return}
 if(d.k==='linetap'||d.k==='texttap'||d.k==='calibtap'||d.k==='gotap'||d.k==='dogtap'||d.k==='facepttap'){if(Math.hypot(p.x-d.sx,p.y-d.sy)>8){drag={k:'pan',sx:d.sx,sy:d.sy,vx:S.view.x-(p.x-d.sx)+(p.x-d.sx),vy:S.view.y,moved:true};drag.sx=p.x;drag.sy=p.y;drag.vx=S.view.x;drag.vy=S.view.y}}
}
function onUp(e){
 var d=drag;drag=null;S.snapPt=null;
 if(d.k==='pan'){if(d.tapDesel&&!d.moved){setSel([]);renderSelbar();draw();if(S.tab==='sel'||S.tab==='obj')renderPanel()}return}
 if(d.k==='move'){
  if(d.fresh){S.tool==='place'&&setTool('select');renderSelbar();changed(true);if(matchMedia('(max-width:820px)').matches)closePanel();return}
  if(!d.moved){hist.pop()}else{changed()}
  renderSelbar();if(S.tab==='sel'||S.tab==='obj')renderPanel();return;
 }
 if(d.k==='handle'){changed();if(S.tab==='sel'||S.tab==='obj')renderPanel();return}
 if(d.k==='draw'){
  var t=S.tmp;S.tmp=null;
  if(d.t==='area'){var w=Math.abs(t.b.x-t.a.x),h=Math.abs(t.b.y-t.a.y);if(w>.2&&h>.2){var n=S.objs.filter(function(o){return o.t==='area'}).length+1;addObj({t:'area',x:(t.a.x+t.b.x)/2,y:(t.a.y+t.b.y)/2,w:w,h:h,rot:0,col:ZCOL[0].c,label:'Tent '+String.fromCharCode(64+((n-1)%26)+1)});setTool('select')}else draw()}
  else{var L=Math.hypot(t.b.x-t.a.x,t.b.y-t.a.y);if(L>.05){addObj({t:'dim',a:t.a,b:t.b,off:0})}else draw()}
  return;
 }
 if(d.k==='marq'){var t0=S.tmp;S.tmp=null;
  if(t0){var x0=Math.min(t0.a.x,t0.b.x),x1=Math.max(t0.a.x,t0.b.x),y0=Math.min(t0.a.y,t0.b.y),y1=Math.max(t0.a.y,t0.b.y),cross=t0.b.x<t0.a.x;
   if(x1-x0<3/S.view.z&&y1-y0<3/S.view.z){if(!e.shiftKey)setSel([])}
   else{var ids=[];S.objs.forEach(function(o){if(!vo(o)||o.lk)return;var b=boundsOf(o),inside=b.x0>=x0&&b.x1<=x1&&b.y0>=y0&&b.y1<=y1,touch=b.x1>=x0&&b.x0<=x1&&b.y1>=y0&&b.y0<=y1;if(cross?touch:inside)ids.push(o.id)});setSel(ids);if(ids.length)toast(ids.length+' selected')}}
  if(S.tool==='marq')setTool('select');renderSelbar();renderPanel();draw();return}
 if(d.k==='layer'){draw();return}
 var p=rectOf(e);
 if(d.k==='linetap'){
  var q=orthoFix(snapW(s2w(p)));if(!S.tmp)S.tmp={t:'line',pts:[],style:S.lineStyle||'fence',cur:null,poly:S.tool==='poly'};
  if(S.tmp.poly&&S.tmp.pts.length>=3&&Math.hypot(S.tmp.pts[0].x-q.x,S.tmp.pts[0].y-q.y)<12/S.view.z){finishLine();return}
  var last=S.tmp.pts[S.tmp.pts.length-1];
  if(S.perim&&S.tool==='line'&&S.tmp.pts.length>=3&&Math.hypot(S.tmp.pts[0].x-q.x,S.tmp.pts[0].y-q.y)<12/S.view.z){
   if(S.gapNext){S.tmp.gaps=(S.tmp.gaps||[]);S.tmp.gaps.push(S.tmp.pts.length-1);S.gapNext=false}
   S.tmp.closeIt=true;finishLine();return}
  if(last&&Math.hypot(last.x-q.x,last.y-q.y)<1e-6){finishLine();return}
  if(S.gapNext&&S.tmp.pts.length>=1){(S.tmp.gaps=S.tmp.gaps||[]).push(S.tmp.pts.length-1);S.gapNext=false;syncPrec()}
  S.tmp.pts.push(q);S.snapPt=null;$('#doneBtn').classList.toggle('on',S.tmp.pts.length>1);draw();return;
 }
 if(d.k==='texttap'){var wp=d.w;ask('Add note / label',[{l:'Text',v:''}],function(v){if(v[0].trim())addObj({t:'text',x:wp.x,y:wp.y,text:v[0].trim(),size:14,rot:0});setTool('select')});return}
 if(d.k==='facepttap'){
  var fw=s2w(p),hit=hitTest(fw),tg=fw;if(hit&&hit.t!=='line'&&hit.t!=='dim'){if(hit.t==='poly'){var pb=boundsOf(hit);tg={x:(pb.x0+pb.x1)/2,y:(pb.y0+pb.y1)/2}}else tg={x:hit.x,y:hit.y}}
  var ids2=S.fpIds||[];S.fpIds=null;setTool('select');setSel(ids2);
  faceTo(function(o){if(hit&&hit.id===o.id)return null;return Math.atan2(tg.y-o.y,tg.x-o.x)/D2R});renderPanel();return}
 if(d.k==='gotap'){setGridOrigin(snapW(s2w(p),null,false));return}
 if(d.k==='dogtap'){dogTap(s2w(p));return}
 if(d.k==='calibtap'){
  var qq=snapW(s2w(p),null,false);S.calib.pts.push({x:qq.x,y:qq.y});toolHint();
  if(S.calib.pts.length===2){var a=S.calib.pts[0],b=S.calib.pts[1],dist=Math.hypot(b.x-a.x,b.y-a.y),L2=S.layers.filter(function(l){return l.id===S.calib.id})[0];
   if(dist<1e-6){S.calib.pts=[];draw();return}
   ask('Calibrate: real distance between the two points',[{l:'Real distance between the two points. Type 80600 mm, 80.6 m or 80.6. A plain number over 300 is read as millimetres, anything smaller as metres',v:''}],function(v){var real=parseDist(v[0]);if(!(real>0)){toast('Enter a distance such as 107900 mm or 107.9 m');S.calib.pts=[];toolHint();draw();return}
    var f=real/dist;L2.mpp*=f;L2.x=a.x+(L2.x-a.x)*f;L2.y=a.y+(L2.y-a.y)*f;L2.cal=true;S.calib=null;setTool('select');fitAll();renderPanel();toast('Scale set from '+(Math.round(real*1000)/1000)+' m — '+L2.name+' is now true to scale. Check it with Measure against another known distance.',7000)});
  }
  draw();return;
 }
}
$('#doneBtn').onclick=function(){if(S.tool==='layermove'){setTool('select');renderPanel()}else finishLine()};
window.addEventListener('keydown',function(e){
 var tag=(e.target&&e.target.tagName)||'';if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;
 if(e.code==='Space'){spaceDown=true;e.preventDefault()}
 var mod=e.ctrlKey||e.metaKey,k=(e.key||'').toLowerCase();
 if(mod&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
 if(mod&&k==='y'){e.preventDefault();redo();return}
 if(mod&&k==='d'){e.preventDefault();dupSel();return}
 if(mod&&k==='c'){e.preventDefault();copySel();return}
 if(mod&&k==='v'){e.preventDefault();pasteSel();return}
 if(mod&&k==='a'){e.preventDefault();selectAll();return}
 if(e.key==='Delete'||e.key==='Backspace'){delSel();return}
 if(e.key==='Escape'){cancelLine();S.calib=null;S.tmp=null;setTool('select');setSel([]);renderSelbar();renderPanel();return}
 if(e.key==='Enter'&&(S.tool==='line'||S.tool==='poly'))finishLine();
 var A=selObjs().filter(function(x){return !x.lk});
 if(A.length&&e.key.indexOf('Arrow')===0){var st=e.shiftKey?1:(S.grid||.1),dx=e.key==='ArrowLeft'?-st:e.key==='ArrowRight'?st:0,dy=e.key==='ArrowUp'?-st:e.key==='ArrowDown'?st:0;snapH();A.forEach(function(o){shiftObj(o,dx,dy)});e.preventDefault();changed()}
});
window.addEventListener('keyup',function(e){if(e.code==='Space')spaceDown=false});

