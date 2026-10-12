/* ---------- auto-trace venue: turns an imported plan into an editable empty shell (outline + walls) ---------- */
function atGrid(L){
 var M=layerMask(L);if(M.bad)return null;
 var w=M.w,h=M.h,B=Math.max(1,Math.ceil(Math.sqrt(w*h/5e6)));
 if(B===1)return {w:w,h:h,m:M.m,B:1,ps:L.mpp};
 var gw=Math.ceil(w/B),gh=Math.ceil(h/B),g=new Uint8Array(gw*gh),x,y;
 for(y=0;y<h;y++){var gy=((y/B)|0)*gw,ry=y*w;for(x=0;x<w;x++)if(M.m[ry+x])g[gy+((x/B)|0)]=1}
 return {w:gw,h:gh,m:g,B:B,ps:L.mpp*B}}
/* connected components; returns labels (1..n) and a bounding box + pixel count for each */
function atLabel(m,w,h,c8){
 var lab=new Int32Array(w*h),q=new Int32Array(w*h),bb=[null],n=0,i,x,y,qh,qt,p,px0,py0,k,nx,ny,b;
 for(i=0;i<m.length;i++){if(!m[i]||lab[i])continue;
  n++;b=[w,h,-1,-1,0];bb.push(b);qh=0;qt=0;q[qt++]=i;lab[i]=n;
  while(qh<qt){p=q[qh++];px0=p%w;py0=(p/w)|0;b[4]++;if(px0<b[0])b[0]=px0;if(py0<b[1])b[1]=py0;if(px0>b[2])b[2]=px0;if(py0>b[3])b[3]=py0;
   for(k=0;k<(c8?8:4);k++){nx=px0+AT_DX[k];ny=py0+AT_DY[k];if(nx<0||ny<0||nx>=w||ny>=h)continue;var ni=ny*w+nx;if(m[ni]&&!lab[ni]){lab[ni]=n;q[qt++]=ni}}}}
 return {lab:lab,n:n,bb:bb}}
var AT_DX=[1,0,-1,0,1,1,-1,-1],AT_DY=[0,1,0,-1,1,-1,1,-1];
function atMorph(m,w,h,r,dil){
 var t=new Uint8Array(w*h),o=new Uint8Array(w*h),pre=new Int32Array(Math.max(w,h)+1),x,y,a,b,s;
 for(y=0;y<h;y++){var row=y*w;pre[0]=0;for(x=0;x<w;x++)pre[x+1]=pre[x]+m[row+x];
  for(x=0;x<w;x++){a=x-r<0?0:x-r;b=x+r>=w?w-1:x+r;s=pre[b+1]-pre[a];t[row+x]=dil?(s>0?1:0):(s===b-a+1?1:0)}}
 for(x=0;x<w;x++){pre[0]=0;for(y=0;y<h;y++)pre[y+1]=pre[y]+t[y*w+x];
  for(y=0;y<h;y++){a=y-r<0?0:y-r;b=y+r>=h?h-1:y+r;s=pre[b+1]-pre[a];o[y*w+x]=dil?(s>0?1:0):(s===b-a+1?1:0)}}
 return o}
/* the pixels of the region that touches the page edge through empty space */
function atExterior(D,w,h){
 var ext=new Uint8Array(w*h),q=new Int32Array(w*h),qh=0,qt=0,i,x,y;
 function push(i){if(!D[i]&&!ext[i]){ext[i]=1;q[qt++]=i}}
 for(x=0;x<w;x++){push(x);push((h-1)*w+x)}for(y=0;y<h;y++){push(y*w);push(y*w+w-1)}
 while(qh<qt){i=q[qh++];x=i%w;y=(i/w)|0;if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w)}
 return ext}
/* square tracing of the outer boundary of one labelled region; returns pixel centres in order */
function atTrace(lab,k,w,h,sx,sy){
 var x=sx,y=sy,dir=0,DX=[1,0,-1,0],DY=[0,1,0,-1],path=[],cap=w*h*4,it=0;
 function ins(x,y){return x>=0&&y>=0&&x<w&&y<h&&lab[y*w+x]===k}
 /* dir: 0 east, 1 south, 2 west, 3 north. Arrive at the start pixel heading east. */
 do{
  if(ins(x,y)){path.push([x,y]);dir=(dir+3)&3}else dir=(dir+1)&3;
  x+=DX[dir];y+=DY[dir];it++;
 }while(!(x===sx&&y===sy&&dir===0&&it>1)&&it<cap);
 return path}
function atRdp(P,eps,closed){
 var n=P.length;if(n<4)return P.slice();
 var f=0,i,d,md=-1,a=P[0];for(i=1;i<n;i++){d=Math.hypot(P[i][0]-a[0],P[i][1]-a[1]);if(d>md){md=d;f=i}}
 function run(S,E){ /* iterative Douglas-Peucker on P[S..E] (E may equal n for the wrap) */
  var keep={},st=[[S,E]];keep[S]=1;keep[E]=1;
  while(st.length){var s=st.pop(),p0=P[s[0]%n],p1=P[s[1]%n],dx=p1[0]-p0[0],dy=p1[1]-p0[1],L=Math.hypot(dx,dy),mx=-1,mi=-1,j;
   for(j=s[0]+1;j<s[1];j++){var q=P[j%n],dd=L<1e-9?Math.hypot(q[0]-p0[0],q[1]-p0[1]):Math.abs(dy*(q[0]-p0[0])-dx*(q[1]-p0[1]))/L;if(dd>mx){mx=dd;mi=j}}
   if(mx>eps&&mi>0){keep[mi]=1;st.push([s[0],mi]);st.push([mi,s[1]])}}
  return keep}
 var k1=run(0,f),k2=run(f,n),out=[],idx={};
 Object.keys(k1).forEach(function(k){idx[+k%n]=1});Object.keys(k2).forEach(function(k){idx[+k%n]=1});
 for(i=0;i<n;i++)if(idx[i])out.push(P[i]);return out}
/* make near-horizontal and near-vertical edges exactly horizontal and vertical, then drop duplicate and collinear points */
function atOrtho(P,tolDeg){
 var n=P.length,i,t=Math.tan(tolDeg*Math.PI/180),Q=P.map(function(p){return [p[0],p[1]]});
 var kind=[];for(i=0;i<n;i++){var a=Q[i],b=Q[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1];kind.push(Math.abs(dy)<=Math.abs(dx)*t?'h':Math.abs(dx)<=Math.abs(dy)*t?'v':'d')}
 for(i=0;i<n;i++){if(kind[i]==='h'){var a2=Q[i],b2=Q[(i+1)%n],my=(a2[1]+b2[1])/2;a2[1]=my;b2[1]=my}}
 for(i=0;i<n;i++){if(kind[i]==='v'){var a3=Q[i],b3=Q[(i+1)%n],mx=(a3[0]+b3[0])/2;a3[0]=mx;b3[0]=mx}}
 var R=[];Q.forEach(function(p){var l=R[R.length-1];if(!l||Math.hypot(p[0]-l[0],p[1]-l[1])>1e-6)R.push(p)});
 if(R.length>1&&Math.hypot(R[0][0]-R[R.length-1][0],R[0][1]-R[R.length-1][1])<1e-6)R.pop();
 var again=true;while(again&&R.length>3){again=false;for(i=0;i<R.length;i++){var p0=R[(i+R.length-1)%R.length],p1=R[i],p2=R[(i+1)%R.length];
  if(Math.abs((p1[0]-p0[0])*(p2[1]-p0[1])-(p1[1]-p0[1])*(p2[0]-p0[0]))<1e-6){R.splice(i,1);again=true;break}}}
 return R}
function atRuns(m,w,h,minLen,horiz){
 var o=new Uint8Array(w*h),a,b,s,e,k;
 if(horiz){for(a=0;a<h;a++){var row=a*w;b=0;while(b<w){if(m[row+b]){s=b;while(b<w&&m[row+b])b++;if(b-s>=minLen)for(k=s;k<b;k++)o[row+k]=1}else b++}}}
 else{for(a=0;a<w;a++){b=0;while(b<h){if(m[b*w+a]){s=b;while(b<h&&m[b*w+a])b++;if(b-s>=minLen)for(k=s;k<b;k++)o[k*w+a]=1}else b++}}}
 return o}
function atDistPoly(P,x,y){var d=Infinity,i;for(i=0;i<P.length;i++){var a=P[i],b=P[(i+1)%P.length],dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy,t=L2<1e-9?0:Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/L2)),q=Math.hypot(x-(a[0]+dx*t),y-(a[1]+dy*t));if(q<d)d=q}return d}
/* the whole job. Everything is worked out in grid pixels, then converted to world metres. */
function traceVenue(L,o){
 o=o||{};var G=atGrid(L);if(!G)return null;
 var w=G.w,h=G.h,ps=G.ps,m=new Uint8Array(G.m),i,j,res={outlines:[],walls:[],stats:{}};
 var perM=1/ps;
 /* 1. drop specks, text and the page frame */
 var C=atLabel(m,w,h,true),minComp=Math.max(3,1.2*perM),dropped=0;
 var keepC=new Uint8Array(C.n+1);
 for(i=1;i<=C.n;i++){var b=C.bb[i],bw=b[2]-b[0]+1,bh=b[3]-b[1]+1;
  if(Math.max(bw,bh)<minComp){dropped++;continue}
  if(bw>=w*.85&&bh>=h*.85){continue}
  keepC[i]=1}
 for(i=0;i<m.length;i++)if(m[i]&&!keepC[C.lab[i]])m[i]=0;
 C=null;
 var W=function(px,py){var v=rotv((px+.5)*ps,(py+.5)*ps,L.rot*D2R);return {x:L.x+v.x,y:L.y+v.y}};
 var polys=[];
 /* 2. the outline: close doorways, fill the inside, give the closing back */
 if(o.outline!==false){
  var r=Math.max(1,Math.round((o.close>0?o.close:1.2)/2*perM));
  var D=atMorph(m,w,h,r,true),ext=atExterior(D,w,h),F=new Uint8Array(w*h);
  for(i=0;i<F.length;i++)F[i]=ext[i]?0:1;
  var ro=Math.max(0,Math.round((o.smooth>=0?o.smooth:6)/2*perM));
  var E=atMorph(F,w,h,r+ro,false);if(ro>0)E=atMorph(E,w,h,ro,true);D=null;ext=null;F=null;
  var R=atLabel(E,w,h,true),big=0;for(i=1;i<=R.n;i++)if(R.bb[i][4]>big)big=R.bb[i][4];
  var minA=Math.max(20*perM*perM,big*.12),order=[];for(i=1;i<=R.n;i++)if(R.bb[i][4]>=minA)order.push(i);
  order.sort(function(a,b){return R.bb[b][4]-R.bb[a][4]});
  order.slice(0,6).forEach(function(k){
   var b=R.bb[k],sx=-1,sy=b[1];for(var x=b[0];x<=b[2];x++)if(R.lab[sy*w+x]===k){sx=x;break}
   if(sx<0)return;
   var path=atTrace(R.lab,k,w,h,sx,sy);if(path.length<8)return;
   var S=atRdp(path,Math.max(1.5,.12*perM),true),Q=atOrtho(S,4);if(Q.length<3)return;
   polys.push(Q);res.outlines.push({pts:Q.map(function(p){return W(p[0],p[1])})})});
  R=null;E=null}
 /* 3. internal walls: long straight runs, thin enough to be a line */
 if(o.walls!==false){
  var minLen=Math.max(4,(o.minWall>0?o.minWall:3)*perM),maxThick=Math.max(3,.7*perM),segs=[];
  [true,false].forEach(function(hz){
   var mk=atRuns(m,w,h,minLen,hz),K=atLabel(mk,w,h,true);
   for(var k=1;k<=K.n;k++){var b=K.bb[k],th=hz?b[3]-b[1]+1:b[2]-b[0]+1,ln=hz?b[2]-b[0]+1:b[3]-b[1]+1;
    if(th>maxThick||ln<minLen||th<(o.heavy>0?o.heavy*perM:0))continue;
    segs.push({h:hz,c:hz?(b[1]+b[3]+1)/2:(b[0]+b[2]+1)/2,a:hz?b[0]:b[1],b:(hz?b[2]:b[3])+1,th:th})}});
  /* keep to the inside of the building when one was found, and ignore long dashed lines (structural grid) */
  var inPoly=function(P,x,y){var c=false,i,j;for(i=0,j=P.length-1;i<P.length;j=i++){if((P[i][1]>y)!==(P[j][1]>y)&&x<(P[j][0]-P[i][0])*(y-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c}return c};
  if(polys.length){var bx0=1e9,by0=1e9,bx1=-1e9,by1=-1e9,ex=25*perM;polys.forEach(function(P){P.forEach(function(q){bx0=Math.min(bx0,q[0]);by0=Math.min(by0,q[1]);bx1=Math.max(bx1,q[0]);by1=Math.max(by1,q[1])})});
   segs=segs.filter(function(s){var mx=s.h?(s.a+s.b)/2:s.c,my=s.h?s.c:(s.a+s.b)/2;
    if(o.heavy>0)return mx>=bx0-ex&&mx<=bx1+ex&&my>=by0-ex&&my<=by1+ex;   /* heavy lines only: the whole structure, including annexes beside the main building */
    return polys.some(function(P){return inPoly(P,mx,my)})})}
  var dashDrop=0;
  [true,false].forEach(function(hz){
   var A=segs.filter(function(s){return s.h===hz}).sort(function(a,b){return a.c-b.c||a.a-b.a}),grp=[],cur=[];
   A.forEach(function(s){if(cur.length&&Math.abs(s.c-cur[0].c)>Math.max(2,.15*perM)){grp.push(cur);cur=[]}cur.push(s)});if(cur.length)grp.push(cur);
   grp.forEach(function(g){if(g.length<3)return;g.sort(function(a,b){return a.a-b.a});
    var gaps=[],i2;for(i2=1;i2<g.length;i2++)gaps.push(g[i2].a-g[i2-1].b);
    var med=gaps.slice().sort(function(a,b){return a-b})[gaps.length>>1];
    var reg=gaps.filter(function(x){return x>=.3*perM&&Math.abs(x-med)<=med*.35}).length;
    if(reg>=2&&reg>=gaps.length*.6){g.forEach(function(s){s.dash=1;dashDrop++})}})});
  segs=segs.filter(function(s){return !s.dash});res.stats.dashed=dashDrop;
  /* skip anything that is just the outline again */
  var tolO=Math.max(3,.5*perM);
  if(polys.length)segs=segs.filter(function(s){var p1=s.h?[s.a,s.c]:[s.c,s.a],p2=s.h?[s.b,s.c]:[s.c,s.b],pm=s.h?[(s.a+s.b)/2,s.c]:[s.c,(s.a+s.b)/2],near=0;
   polys.forEach(function(P){if(atDistPoly(P,p1[0],p1[1])<=tolO&&atDistPoly(P,p2[0],p2[1])<=tolO&&atDistPoly(P,pm[0],pm[1])<=tolO)near=1});return !near});
  /* double-line walls become one centre line */
  var pair=Math.max(3,.6*perM);
  [true,false].forEach(function(hz){
   var L1=segs.filter(function(s){return s.h===hz}).sort(function(a,b){return a.c-b.c}),used={};
   for(var a=0;a<L1.length;a++){if(used[a])continue;
    for(var b=a+1;b<L1.length&&L1[b].c-L1[a].c<=pair;b++){if(used[b])continue;
     var ov=Math.min(L1[a].b,L1[b].b)-Math.max(L1[a].a,L1[b].a),sh=Math.min(L1[a].b-L1[a].a,L1[b].b-L1[b].a);
     if(ov>=sh*.6&&L1[b].c-L1[a].c>L1[a].th*.6){L1[a]={h:hz,c:(L1[a].c+L1[b].c)/2,a:Math.min(L1[a].a,L1[b].a),b:Math.max(L1[a].b,L1[b].b),th:L1[a].th};used[b]=1}}}
   var keep=L1.filter(function(s,i2){return !used[i2]});segs=segs.filter(function(s){return s.h!==hz}).concat(keep)});
  /* join collinear pieces separated by a pixel or two */
  var gapJ=Math.max(2,.12*perM),cl=Math.max(2,.1*perM);
  [true,false].forEach(function(hz){
   var L2=segs.filter(function(s){return s.h===hz}).sort(function(a,b){return a.c-b.c||a.a-b.a}),out2=[];
   L2.forEach(function(s){var l=out2[out2.length-1];if(l&&Math.abs(l.c-s.c)<=cl&&s.a-l.b<=gapJ){l.b=Math.max(l.b,s.b);l.c=(l.c+s.c)/2}else out2.push({h:hz,c:s.c,a:s.a,b:s.b,th:s.th})});
   segs=segs.filter(function(s){return s.h!==hz}).concat(out2)});
  /* square the corners and T-junctions: pull an end onto a wall that crosses it */
  var reach=Math.max(3,.4*perM);
  segs.forEach(function(s){['a','b'].forEach(function(end){var tgt=null,bd=reach+1;
   segs.forEach(function(t){if(t.h===s.h)return;var along=s[end];
    if(Math.abs(t.c-along)<=reach&&s.c>=t.a-reach&&s.c<=t.b+reach){var d=Math.abs(t.c-along);if(d<bd){bd=d;tgt=t}}});
   if(tgt)s[end]=tgt.c})});
  segs=segs.filter(function(s){return s.b-s.a>=minLen*.6});
  if(segs.length>800){res.stats.tooMany=segs.length;segs.sort(function(a,b){return (b.b-b.a)-(a.b-a.a)});segs=segs.slice(0,800)}
  segs.forEach(function(s){var A=s.h?W(s.a-.5,s.c-.5):W(s.c-.5,s.a-.5),B2=s.h?W(s.b-.5,s.c-.5):W(s.c-.5,s.b-.5);res.walls.push({a:A,b:B2})})}
 res.stats.dropped=dropped;res.stats.px=w+'x'+h;return res}
function autoTraceModal(L){
 if(L.cal!==true){toast('Calibrate this plan first so the shell is traced to scale.',5000);return}
 var sx='style="border:1px solid var(--ln);background:var(--pn2);border-radius:8px;padding:8px;color:var(--ink);width:100%;min-height:38px"',m=$('#modal');
 m.innerHTML='<div class="mbox" role="dialog" aria-label="Auto-trace the venue"><h3>Auto-trace the venue</h3><p class="note">Builds the bare venue from this plan: the outer outline and the long straight walls, as editable venue lines. Furniture, text and small symbols are ignored. Nothing is lost: it is one Undo. Works best on clean plans. If the outline grabs too much, raise &ldquo;Ignore attachments&rdquo; or lower &ldquo;Bridge openings&rdquo;, then drag any corner to fine-tune. On a scanned plan, untick Internal walls.</p>'
  +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="at_o" checked style="min-height:0"> Outer outline of the building(s)</label>'
  +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="at_w" checked style="min-height:0"> Internal walls (long straight lines)</label>'
  +'<div style="display:flex;gap:8px"><label style="flex:1">Ignore attachments narrower than (m)<input id="at_sm" type="number" value="6" min="0" step="0.5" '+sx+'></label></div><div style="display:flex;gap:8px"><label style="flex:1">Shortest wall to keep (m)<input id="at_ml" type="number" value="3" min="0.5" step="0.5" '+sx+'></label><label style="flex:1">Bridge openings up to (m)<input id="at_cl" type="number" value="1.2" min="0.2" step="0.1" '+sx+'></label></div>'
  +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="at_h" checked style="min-height:0"> Heavy lines only for walls (skips event stands and furniture drawn in thin lines)</label>'
  +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="at_f" checked style="min-height:0"> Fade the plan afterwards so the traced shell stands out</label>'
  +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="at_v" checked style="min-height:0"> Mark it as the venue (permanent, kept when you clear the event)</label>'
  +'<div class="mrow"><button class="btn" id="mc">Cancel</button><button class="btn pri" id="mo">Trace it</button></div></div>';
 m.classList.add('on');
 $('#mc').onclick=function(){m.classList.remove('on');m.innerHTML=''};
 $('#mo').onclick=function(){
  var op={outline:$('#at_o').checked,walls:$('#at_w').checked,minWall:parseFloat($('#at_ml').value)||3,close:parseFloat($('#at_cl').value)||1.2,smooth:parseFloat($('#at_sm').value),heavy:$('#at_h').checked?0.2:0,fade:$('#at_f').checked,vn:$('#at_v').checked};
  m.classList.remove('on');m.innerHTML='';toast('Tracing the plan…',4000);
  setTimeout(function(){var r;try{r=traceVenue(L,op)}catch(e){toast('The plan could not be traced: '+e.message,7000);return}
   if(!r){toast('This image cannot be read in this browser.',6000);return}
   var n=applyTrace(L,r,op);
   if(!n)toast('No outline or walls were found. Try a smaller shortest wall, or a bigger opening bridge.',7000);
   else toast('Traced '+r.outlines.length+' outline'+(r.outlines.length===1?'':'s')+' and '+r.walls.length+' wall'+(r.walls.length===1?'':'s')+'. Check it, then edit like any lines. Undo removes it all.'+(r.stats.tooMany?' (Kept the longest 800 of '+r.stats.tooMany+' wall pieces.)':''),9000)},60)}}
function applyTrace(L,r,op){
 var n=0;snapH();
 r.outlines.forEach(function(p){var ob={t:'line',style:'wall',pts:p.pts,closed:true,id:newId()};if(op.vn)ob.vn=1;S.objs.push(ob);n++});
 r.walls.forEach(function(s){var ob={t:'line',style:'wall',pts:[s.a,s.b],closed:false,id:newId()};if(op.vn)ob.vn=1;S.objs.push(ob);n++});
 if(n&&op.fade)L.op=Math.min(L.op,.3);
 changed(true);renderSelbar();draw();return n}
