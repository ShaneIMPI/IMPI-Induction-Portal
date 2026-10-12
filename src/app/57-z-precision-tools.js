/* ---------- precision tracing: exact snap to plan lines, loupe, ortho, crisp lines, symbol detection, venue layer ---------- */
IC.pencil='M4 20l1-4L16 5l3 3L8 19zM14 7l3 3';IC.ortho='M5 19V5h14M5 12h8M12 5v8';IC.venue='M3 20V9l9-5 9 5v11zM9 20v-6h6v6';

/* ----- crisp (sharpened) rendering of a scanned or PDF plan: white becomes transparent, lines get darker and fully opaque ----- */
function crispOf(L){
 if(L._cr&&L._cr.src===L.img)return L._cr.cn;
 var w=L.img.width,h=L.img.height,cn=document.createElement('canvas');cn.width=w;cn.height=h;
 var c=cn.getContext('2d',{willReadFrequently:true});c.fillStyle='#fff';c.fillRect(0,0,w,h);c.drawImage(L.img,0,0);
 var id;try{id=c.getImageData(0,0,w,h)}catch(e){L._cr={src:L.img,cn:L.img};return L.img}
 var d=id.data,i,r,g,b,mn,mx,a;
 for(i=0;i<d.length;i+=4){r=d[i];g=d[i+1];b=d[i+2];mn=r<g?(r<b?r:b):(g<b?g:b);mx=r>g?(r>b?r:b):(g>b?g:b);
  a=(255-mn-30)*3;if(a<=0){d[i+3]=0;continue}if(a>255)a=255;
  if(mx-mn<60){d[i]=r*.55;d[i+1]=g*.55;d[i+2]=b*.55}
  d[i+3]=a}
 c.putImageData(id,0,0);L._cr={src:L.img,cn:cn};return cn}

/* ----- exact snapping: junctions and line ends first, otherwise slide along the centre of the nearest line ----- */
function underlaySnap(p){
 var best=null,bs=1e18;
 S.layers.forEach(function(L){
  if(!L.vis||L.kind!=='plan'||L.op<.04)return;var M=layerMask(L);if(M.bad)return;
  var rr=rotv(p.x-L.x,p.y-L.y,-L.rot*D2R),ix=rr.x/L.mpp-.5,iy=rr.y/L.mpp-.5,
   r=Math.max(2,Math.min(44,Math.round(16/S.view.z/L.mpp))),W=M.w,H=M.h,D=M.m;
  var Lr=Math.max(5,Math.min(14,Math.round(.6/L.mpp))),DIRS=[[1,0],[0,1],[1,1],[1,-1]],LEN=[1,1,Math.SQRT2,Math.SQRT2];
  function dk(x,y){return x>=0&&y>=0&&x<W&&y<H&&D[y*W+x]===1}
  function ext(x,y,dx,dy,mx,gm){var n=0,k,cx=x,cy=y,gap=0;if(gm==null)gm=2;for(k=0;k<mx;k++){cx+=dx;cy+=dy;if(dk(cx,cy)){n=k+1;gap=0}else if(++gap>gm)break}return n}
    /* a junction needs two or more long runs, long compared with how thick the stroke is (a thick line is not a junction with itself) */
  function junction(x,y){var rs=[],q,T=1e9;for(q=0;q<4;q++){var l=(1+ext(x,y,DIRS[q][0],DIRS[q][1],32,0)+ext(x,y,-DIRS[q][0],-DIRS[q][1],32,0))*LEN[q];rs.push(l);if(l<T)T=l}
   var thr=Math.max(Lr,3*T),c=0;for(q=0;q<4;q++)if(rs[q]>=thr)c++;return c>=2}
  function toW(x,y){var v=rotv((x+.5)*L.mpp,(y+.5)*L.mpp,L.rot*D2R);return {x:L.x+v.x,y:L.y+v.y}}
  var x0=Math.round(ix),y0=Math.round(iy),found=null,fs=1e18,xx,yy;
  for(yy=y0-r;yy<=y0+r;yy++)for(xx=x0-r;xx<=x0+r;xx++){if(!dk(xx,yy))continue;var dd=Math.hypot(xx-ix,yy-iy);if(dd>r)continue;if(dd*.45>=fs)continue;var j=junction(xx,yy),sc=j?dd*.45:dd;if(sc<fs){fs=sc;found={x:xx,y:yy,j:j}}}
  if(!found)return;
  var pt,isJ=false;
  /* centre line of the dark run through (x,y) in direction q: a point on its centre, its unit vector and how far it runs each way */
  function cline(x,y,q){
   var vx=DIRS[q][0]/LEN[q],vy=DIRS[q][1]/LEN[q],nx=-vy,ny=vx,fw=ext(x,y,DIRS[q][0],DIRS[q][1],240)*LEN[q],bk=ext(x,y,-DIRS[q][0],-DIRS[q][1],240)*LEN[q];
   /* measure the thickness a little way along the line so a crossing line does not bias it */
   var sg=fw>=bk?1:-1,off=Math.min(Math.max(fw,bk)*.5,8),bx=Math.round(x+vx*sg*off),by=Math.round(y+vy*sg*off);if(!dk(bx,by)){bx=x;by=y}
   var t,lo=0,hi=0,gp=0;
   for(t=1;t<=12;t++){if(dk(Math.round(bx+nx*t),Math.round(by+ny*t))){hi=t;gp=0}else if(++gp>1)break}gp=0;
   for(t=1;t<=12;t++){if(dk(Math.round(bx-nx*t),Math.round(by-ny*t))){lo=t;gp=0}else if(++gp>1)break}
   var c0=(hi-lo)/2,cx=bx+nx*c0,cy=by+ny*c0;
   return {x:cx,y:cy,vx:vx,vy:vy,fw:fw,bk:bk,len:fw+bk+LEN[q],fs0:(x-cx)*vx+(y-cy)*vy}}
  var order=[0,1,2,3].map(function(q){return {q:q,l:(ext(found.x,found.y,DIRS[q][0],DIRS[q][1],240)+ext(found.x,found.y,-DIRS[q][0],-DIRS[q][1],240)+1)*LEN[q]}}).sort(function(a2,b2){return b2.l-a2.l});
  if(found.j&&order[1].l>=Lr*1.2){
   /* corner or crossing: intersect the centre lines of the two longest runs */
   var l1=cline(found.x,found.y,order[0].q),l2=cline(found.x,found.y,order[1].q),cr=l1.vx*l2.vy-l1.vy*l2.vx;
   if(Math.abs(cr)>.3){var dx0=l2.x-l1.x,dy0=l2.y-l1.y,tt=(dx0*l2.vy-dy0*l2.vx)/cr,ix2=l1.x+l1.vx*tt,iy2=l1.y+l1.vy*tt;
    if(Math.hypot(ix2-found.x,iy2-found.y)<=8){pt=toW(ix2,iy2);isJ=true}}
  }
  if(!pt&&found.j){
   var kk=3,sx=0,sy=0,n=0;for(yy=found.y-kk;yy<=found.y+kk;yy++)for(xx=found.x-kk;xx<=found.x+kk;xx++)if(dk(xx,yy)){sx+=xx;sy+=yy;n++}
   pt=toW(sx/n,sy/n);isJ=true}
  if(!pt){
   /* an ordinary line: centre across its thickness, then follow the pointer along it and stop at its ends */
   if(order[0].l>=Lr*1.5){
    var ln=cline(found.x,found.y,order[0].q),s0=(ix-ln.x)*ln.vx+(iy-ln.y)*ln.vy,sMin=ln.fs0-ln.bk,sMax=ln.fs0+ln.fw;
    if(s0<sMin){s0=sMin;isJ=true}else if(s0>sMax){s0=sMax;isJ=true}
    pt=toW(ln.x+ln.vx*s0,ln.y+ln.vy*s0)}
   else{var k2=2,sx2=0,sy2=0,n2=0;for(yy=found.y-k2;yy<=found.y+k2;yy++)for(xx=found.x-k2;xx<=found.x+k2;xx++)if(dk(xx,yy)){sx2+=xx;sy2+=yy;n2++}pt=toW(sx2/n2,sy2/n2)}
  }
  var dist=Math.hypot(pt.x-p.x,pt.y-p.y)*S.view.z*(isJ?.45:1);
  if(dist<bs){bs=dist;best={x:pt.x,y:pt.y,j:isJ}}});
 return best}

/* ----- ortho: lock the segment being drawn to the plan's own axes ----- */
function planAxis(){var a=0;S.layers.some(function(L){if(L.vis&&L.kind==='plan'){a=L.rot||0;return true}});return a*D2R}
function orthoFix(q){
 if(!S.ortho||!S.tmp||!S.tmp.pts||!S.tmp.pts.length)return q;
 var l=S.tmp.pts[S.tmp.pts.length-1],th=planAxis(),v=rotv(q.x-l.x,q.y-l.y,-th);
 if(Math.abs(v.x)>=Math.abs(v.y))v.y=0;else v.x=0;
 var w=rotv(v.x,v.y,th);return {x:l.x+w.x,y:l.y+w.y}}

/* ----- loupe: a magnified view next to the pointer so the exact pixel being snapped to can be seen ----- */
function loupeOn(){
 if(S.loupe===false)return false;
 if(!(S.calib||TRACE_TOOLS[S.tool]||S.arm)||!S.hover)return false;
 if(!S.layers.some(function(L){return L.vis&&L.kind==='plan'}))return false;
 return !!(S.pencil||S.calib||S.hpt)}
function drawLoupe(){
 if(!loupeOn())return;
 var tgt=S.snapPt||S.hover,hp=S.hp||w2s(S.hover),R=64,k=4,cw=cv.clientWidth,chh=cv.clientHeight,touch=!!S.hpt;
 var cx=hp.x+(touch?0:92),cy=hp.y-(touch?116:92);
 if(cy-R<4)cy=hp.y+(touch?116:92);if(cx+R>cw-4)cx=hp.x-(touch?0:92);if(cx-R<4)cx=R+4;if(cy+R>chh-4)cy=chh-R-4;
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.clip();ctx.fillStyle='#fff';ctx.fillRect(cx-R,cy-R,2*R,2*R);
 var s=w2s(tgt);ctx.translate(cx,cy);ctx.scale(k,k);ctx.translate(-s.x,-s.y);ctx.translate(S.view.x,S.view.y);ctx.scale(S.view.z,S.view.z);
 S.layers.forEach(function(L){drawLayer(ctx,L)});
 ctx.restore();
 ctx.save();ctx.lineWidth=3;ctx.strokeStyle='#12202b';ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.stroke();
 ctx.lineWidth=1.5;ctx.strokeStyle='#e8590c';ctx.beginPath();ctx.moveTo(cx-R+8,cy);ctx.lineTo(cx-7,cy);ctx.moveTo(cx+7,cy);ctx.lineTo(cx+R-8,cy);ctx.moveTo(cx,cy-R+8);ctx.lineTo(cx,cy-7);ctx.moveTo(cx,cy+7);ctx.lineTo(cx,cy+R-8);ctx.stroke();
 ctx.beginPath();ctx.arc(cx,cy,3,0,TAU);ctx.fillStyle=S.snapPt?'#e8590c':'#12202b';ctx.fill();ctx.restore()}

/* ----- pencil / ortho / venue toolbar actions ----- */
function syncPrec(){
 $$('#tools [data-act=pencil]').forEach(function(x){x.classList.toggle('on',!!S.pencil&&(S.tool==='line'||S.tool==='poly'))});
 $$('#tools [data-act=perim]').forEach(function(x){x.classList.toggle('on',!!S.perim&&S.tool==='line')});
 $$('#tools [data-act=gap]').forEach(function(x){x.classList.toggle('on',!!S.gapNext)});
 $$('#tools [data-act=ortho]').forEach(function(x){x.classList.toggle('on',!!S.ortho)});
 $$('#tools [data-act=venue]').forEach(function(x){x.classList.toggle('on',!!S.venueMode)})}
function togglePencil(){
 if(S.pencil&&S.perim&&S.tool==='line'){S.pencil=false;syncPrec();toast('Pencil off');return}
 if(S.pencil&&(S.tool==='line'||S.tool==='poly')){S.pencil=false;setTool('select');syncPrec();toast('Pencil off');return}
 S.traceSnap=true;syncTrace();var pm=S.perim;setTool('line');S.perim=pm;S.pencil=true;S.lineStyle=S.lineStyle&&S.lineStyle!=='evac'?S.lineStyle:'wall';$('#lineSel').value=S.lineStyle;syncPrec();draw();
 toast('Pencil: tap along the plan lines, they snap exactly. A magnifier shows the point. Use Shape for buildings, Ortho for straight walls, Venue to mark it permanent.',7000)}
function toggleOrtho(){S.ortho=!S.ortho;syncPrec();toast(S.ortho?'Ortho on: lines run along the plan\'s own horizontal and vertical':'Ortho off',3500)}

/* ----- venue (permanent) objects ----- */
function venueCount(){return S.objs.filter(function(o){return o.vn}).length}
function venueModal(){
 var n=venueCount(),nl=S.objs.filter(function(o){return o.vn&&o.lk}).length,sel=selObjs().length,
 h='<h3>Venue (permanent features)</h3><p class="note">Mark walls, buildings, fire equipment and exit signs as part of the <b>venue</b>. Then lock them, save the plan as the venue, and start each event from it so only event-specific work is left to edit.</p>'
 +'<label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="vn_mode"'+(S.venueMode?' checked':'')+'> Everything I draw or place now is part of the venue</label>'
 +'<p class="note" style="margin:8px 0"><b>'+n+'</b> venue object'+(n===1?'':'s')+' ('+nl+' locked), '+(S.objs.length-n)+' event object'+(S.objs.length-n===1?'':'s')+'.</p>'
 +'<div class="btns"><button class="btn sm" data-vn="mark"'+(sel?'':' disabled')+'>Mark selected as venue</button><button class="btn sm" data-vn="unmark"'+(sel?'':' disabled')+'>Mark selected as event</button></div>'
 +'<div class="btns"><button class="btn sm" data-vn="lock"'+(n?'':' disabled')+'>'+(n&&nl===n?'Unlock venue objects':'Lock venue objects')+'</button></div>'
 +'<h4>Start a new event on this venue</h4><p class="note">Keeps the venue objects and the background plan; removes everything else and clears the event details. Save this venue first (Sheet tab → Save to cloud). The new event saves as a separate plan.</p>'
 +'<div class="btns"><button class="btn sm pri" data-vn="newev"'+(n?'':' disabled')+'>Start new event from this venue</button></div>'
 +'<h4>Venue library (cloud)</h4><p class="note">Save the traced and checked venue once. It is stored by venue name with its objects locked, and every event at that venue starts from it.</p><div class="btns"><button class="btn sm pri" data-vn="savev"'+(n?'':' disabled')+'>Save as venue</button><button class="btn sm" data-vn="openv">Start new event from a saved venue…</button></div>';
 box(h);var m=$('#modal');
 m.onclick=function(e){var b=e.target.closest('[data-vn]');if(!b)return;var a=b.dataset.vn;
  if(a==='mark'||a==='unmark'){snapH();selObjs().forEach(function(o){if(a==='mark')o.vn=1;else{delete o.vn}});changed(true);venueModal();return}
  if(a==='lock'){snapH();var lock=!(n&&nl===n);S.objs.forEach(function(o){if(o.vn){if(lock)o.lk=1;else delete o.lk}});changed(true);S.sel=null;renderSelbar();venueModal();return}
  if(a==='savev'){m.classList.remove('on');m.innerHTML='';cloudSaveVenue();return}
  if(a==='openv'){m.classList.remove('on');m.innerHTML='';cloudVenuePick();return}
  if(a==='newev'){if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='Click again to confirm: removes event objects';return}venueNewEvent();m.classList.remove('on');m.innerHTML='';return}};
 var c=$('#vn_mode');if(c)c.onchange=function(){S.venueMode=c.checked;syncPrec();toast(S.venueMode?'Venue mode on: new objects are marked as venue':'Venue mode off',3500)}}
function venueNewEvent(){
 snapH();var keep=S.objs.filter(function(o){return o.vn});
 S.objs=keep;S.sel=null;
 S.meta.layouts=(S.meta.layouts||[]).filter(function(l){return S.objs.some(function(o){return o.id===l.src})});S.meta.only=null;
 ['event','title','client','date','rev','tstart','tend','attend','ref','certCap','siteArea'].forEach(function(k){if(k==='rev')S.meta.rev='A';else if(k==='attend'||k==='certCap'||k==='siteArea')S.meta[k]=0;else S.meta[k]=''});
 if(S.cloud){S.cloud.planId=null;S.cloud.rev=null}
 changed(true);renderSelbar();renderPanel();draw();toast('New event started on the venue. Add the event-specific work now. It saves as a new plan.',6000)}

/* ----- detect the coloured safety markers on a plan (red = fire equipment, green = exits, yellow = electrical) ----- */
function detectSymbols(L){
 var w=L.img.width,h=L.img.height,cn=document.createElement('canvas');cn.width=w;cn.height=h;
 var c=cn.getContext('2d',{willReadFrequently:true});c.fillStyle='#fff';c.fillRect(0,0,w,h);c.drawImage(L.img,0,0);
 var d;try{d=c.getImageData(0,0,w,h).data}catch(e){return null}
 var cls=new Uint8Array(w*h),i,j,r,g,b;
 for(i=0,j=0;i<cls.length;i++,j+=4){r=d[j];g=d[j+1];b=d[j+2];
  if(r>165&&g<105&&b<105&&r-g>90)cls[i]=1;
  else if(g>110&&r<115&&b<140&&g-r>60&&g-b>25)cls[i]=2;
  else if(r>205&&g>175&&b<120&&r-b>110)cls[i]=3}
 var seen=new Uint8Array(w*h),stack=new Int32Array(w*h>>1||1),out=[],big=[],mpp=L.mpp;
 for(i=0;i<cls.length;i++){
  if(!cls[i]||seen[i])continue;
  var k=cls[i],sp=0,x0=1e9,y0=1e9,x1=-1,y1=-1,n=0,sx=0,sy=0;stack[sp++]=i;seen[i]=1;
  while(sp){var q=stack[--sp],qx=q%w,qy=(q-qx)/w;n++;sx+=qx;sy+=qy;if(qx<x0)x0=qx;if(qx>x1)x1=qx;if(qy<y0)y0=qy;if(qy>y1)y1=qy;
   /* 8-neighbours, bridging 1-pixel gaps made by the white glyph inside a symbol */
   for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++){if(!dx&&!dy)continue;if(Math.abs(dx)+Math.abs(dy)>3)continue;var nx=qx+dx,ny=qy+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;var ni=ny*w+nx;if(cls[ni]===k&&!seen[ni]){seen[ni]=1;if(sp<stack.length)stack[sp++]=ni}}}
  var bw=(x1-x0+1)*mpp,bh=(y1-y0+1)*mpp,mx=Math.max(bw,bh),mn=Math.min(bw,bh),fill=n/((x1-x0+1)*(y1-y0+1));
  if(k===1&&mx>6){big.push({x0:x0,y0:y0,x1:x1,y1:y1});continue}
  var okk=false;
  if(k===1)okk=mx>=.35&&mx<=2.6&&mn/mx>=.5&&fill>=.4;
  else if(k===2)okk=mx>=.3&&mx<=3.2&&fill>=.3&&n>=6;
  else okk=mx>=.35&&mx<=2.6&&fill>=.25&&n>=8;
  if(okk)out.push({k:k,x:sx/n,y:sy/n,bw:bw,bh:bh})}
 /* ignore anything inside a big red frame (the legend box on a page) */
 out=out.filter(function(o){return !big.some(function(B){return o.x>=B.x0-4&&o.x<=B.x1+4&&o.y>=B.y0-4&&o.y<=B.y1+4})});
 /* merge neighbours of the same colour (an exit arrow and its EXIT label are one exit) */
 var md=1.8/mpp,res=[];
 out.forEach(function(o){var m=res.filter(function(r2){return r2.k===o.k&&Math.hypot(r2.x-o.x,r2.y-o.y)<md})[0];
  if(m){m.x=(m.x*m.n+o.x)/(m.n+1);m.y=(m.y*m.n+o.y)/(m.n+1);m.n++}else res.push({k:o.k,x:o.x,y:o.y,n:1})});
 return res.map(function(o){var v=rotv((o.x+.5)*L.mpp,(o.y+.5)*L.mpp,L.rot*D2R);return {k:o.k,x:L.x+v.x,y:L.y+v.y}})}

var DET_MAP={1:{n:'Red markers (fire equipment)',def:'fire_ext'},2:{n:'Green markers (exits)',def:'exit_sign'},3:{n:'Yellow markers (electrical / DB)',def:'warn_elec'}};
function detectModal(L){
 if(L.cal!==true){toast('Calibrate this plan first, so the markers can be sized and placed to scale.',5000);return}
 toast('Scanning the plan for coloured markers…',3000);
 setTimeout(function(){
  var res=detectSymbols(L);if(!res){toast('This image cannot be scanned in this browser.',5000);return}
  var cnt={1:0,2:0,3:0};res.forEach(function(o){cnt[o.k]++});
  if(!res.length){toast('No red, green or yellow safety markers were found on this plan.',6000);return}
  var h='<h3>Safety markers found on the plan</h3><p class="note">Pick what each colour should become. Items are placed at the marker positions; nothing is placed until you press Place. Check the result afterwards: a red marker may be a hose reel rather than an extinguisher, and a legend box on the page is ignored.</p>';
  [1,2,3].forEach(function(k){if(!cnt[k])return;
   h+='<div class="row2" style="align-items:end"><label class="fld">'+DET_MAP[k].n+': <b>'+cnt[k]+'</b><select data-dk="'+k+'"><option value="">Do not place</option>'+SIGNS.map(function(s){return '<option value="'+s.k+'"'+(s.k===DET_MAP[k].def?' selected':'')+'>'+esc(s.n)+'</option>'}).join('')+'</select></label></div>'});
  h+='<label class="fld" style="flex-direction:row;align-items:center;gap:8px;margin-top:8px"><input type="checkbox" id="dt_vn"'+' checked'+'> Mark them as part of the venue (permanent)</label><div class="btns"><button class="btn pri" data-dt="go">Place them</button></div>';
  box(h);var m=$('#modal');
  m.onclick=function(e){var b=e.target.closest('[data-dt]');if(!b)return;
   var map={};$$('[data-dk]',m).forEach(function(s){map[s.dataset.dk]=s.value});var vn=$('#dt_vn').checked,np=0;
   snapH();res.forEach(function(o){var kk=map[o.k];if(!kk)return;var ob={t:'sign',k:kk,x:o.x,y:o.y,s:1.2,rot:0};ob.id=newId();if(vn)ob.vn=1;S.objs.push(ob);np++});
   m.classList.remove('on');m.innerHTML='';changed(true);renderSelbar();draw();toast(np+' item'+(np===1?'':'s')+' placed from the plan. Move or delete any that are wrong.',6000)};
 },60)}
