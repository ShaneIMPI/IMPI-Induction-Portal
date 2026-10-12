/* ---------- automatic evacuation routes ---------- */
function evClear(){var n=0;S.objs=S.objs.filter(function(o){if(o.ev&&!o.keep&&!o.man&&(!S.meta.only||o.lay===S.meta.only)){n++;return false}return true});return n}
function genEvac(){
 var vis=S.objs.filter(function(o){return !o.hd&&!o.ev&&(!S.meta.only||o.lay===S.meta.only)});
 var ex=vis.filter(function(o){return o.t==='door'&&(o.k==='exit'||o.k==='eexit'||(o.k==='entrance'&&S.meta.evEntr!==false))});
 if(!ex.length)ex=vis.filter(function(o){return o.t==='sign'&&(o.k==='exit_run'||o.k==='exit_run_r'||o.k==='exit_box'||o.k==='exit_sign')});
 if(!ex.length){toast('Place Exit, Emergency exit or Entrance doors first (Library → Doors), then generate',6000);return}
 var as=vis.filter(function(o){return o.t==='sign'&&o.k==='assembly'});
 var OR=vis.filter(function(o){
  if(o.t==='area'||o.t==='poly')return o.site?false:'zone';
  if(o.t==='rect'){var L=LIBM[o.k];if(!L)return false;if(L.c==='Exhibition')return L.s==='stand'||o.k==='lounge';return ['tent','bedouin','snow','stage','stall'].indexOf(L.s)>=0}
  return false});
 var structs=OR.filter(function(o){return o.t==='rect'});
 OR=OR.filter(function(o){if(o.t==='rect')return true;var b=boundsOf(o);return !structs.some(function(q){return q.x>=b.x0&&q.x<=b.x1&&q.y>=b.y0&&q.y<=b.y1})});
 var planMode=S.meta.evPlan!==false&&!S.meta.only&&S.layers.some(function(L){return L.vis&&L.kind==='plan'&&L.op>=.04});
 if(!OR.length&&!planMode){toast('Place zones, tents, stages or stands first so there is somewhere to evacuate from',6000);return}
 var capped=OR.length>150;if(capped)OR=OR.slice(0,150);
 var bb=null;vis.forEach(function(o){var b=boundsOf(o);if(!b)return;if(!bb)bb={x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y1};else{bb.x0=Math.min(bb.x0,b.x0);bb.y0=Math.min(bb.y0,b.y0);bb.x1=Math.max(bb.x1,b.x1);bb.y1=Math.max(bb.y1,b.y1)}});
 if(!bb)return;var pad=6,X0=bb.x0-pad,Y0=bb.y0-pad,W=bb.x1-bb.x0+2*pad,H=bb.y1-bb.y0+2*pad;
 var cs=Math.max(.5,Math.ceil(Math.max(W,H)/320*10)/10),nx=Math.ceil(W/cs),ny=Math.ceil(H/cs),N=nx*ny,blk=new Uint8Array(N),i,j;
 function cx(x){return Math.min(nx-1,Math.max(0,Math.floor((x-X0)/cs)))}
 function cy(y){return Math.min(ny-1,Math.max(0,Math.floor((y-Y0)/cs)))}
 function wx(ix){return X0+(ix+.5)*cs}function wy(iy){return Y0+(iy+.5)*cs}
 vis.forEach(function(o){
  if(o.t==='rect'&&!(LIBM[o.k]||{}).ps&&!/^netting/.test(o.k)&&o.k.indexOf('deck')!==0&&(LIBM[o.k]||{}).s!=='truss'){var d=dimsOf(o),cr=corners(o),xa=Infinity,xb=-Infinity,ya=Infinity,yb=-Infinity;cr.forEach(function(p){xa=Math.min(xa,p.x);xb=Math.max(xb,p.x);ya=Math.min(ya,p.y);yb=Math.max(yb,p.y)});
   for(j=cy(ya);j<=cy(yb);j++)for(i=cx(xa);i<=cx(xb);i++){var l=toLocal(o,{x:wx(i),y:wy(j)});if(Math.abs(l.x)<=d.w/2+.15&&Math.abs(l.y)<=d.h/2+.15)blk[j*nx+i]=1}}
  else if(o.t==='line'&&['fence','wall','barrier','shade','shadeb','drape','plain','thin','brick','shell'].indexOf(o.style||'fence')>=0){
   var P=o.closed?o.pts.concat([o.pts[0]]):o.pts;
   for(var k=0;k<P.length-1;k++){if(o.gaps&&o.gaps.indexOf(k)>=0)continue;var L2=Math.hypot(P[k+1].x-P[k].x,P[k+1].y-P[k].y),n=Math.max(1,Math.ceil(L2/(cs*.3)));for(var q=0;q<=n;q++){var t=q/n;blk[cy(P[k].y+(P[k+1].y-P[k].y)*t)*nx+cx(P[k].x+(P[k+1].x-P[k].x)*t)]=1}}}
 });
 if(planMode)S.layers.forEach(function(L){
  if(!L.vis||L.kind!=='plan'||L.op<.04)return;var M=layerMask(L);if(M.bad)return;
  var cr=Math.cos(L.rot*D2R),sr=Math.sin(L.rot*D2R),mp=L.mpp,D=M.m,W2=M.w,H2=M.h,xx,yy,wxp,wyp,ci,cj;
  for(yy=0;yy<H2;yy++){var row=yy*W2,py=(yy+.5)*mp;for(xx=0;xx<W2;xx++){if(!D[row+xx])continue;var px2=(xx+.5)*mp;wxp=L.x+px2*cr-py*sr;wyp=L.y+px2*sr+py*cr;ci=Math.floor((wxp-X0)/cs);cj=Math.floor((wyp-Y0)/cs);if(ci>=0&&cj>=0&&ci<nx&&cj<ny)blk[cj*nx+ci]=1}}});
 vis.forEach(function(o){if(o.t!=='door')return;var r=Math.max((o.w||3)/2,1)+cs*.8;
  for(j=cy(o.y-r);j<=cy(o.y+r);j++)for(i=cx(o.x-r);i<=cx(o.x+r);i++)if(Math.hypot(wx(i)-o.x,wy(j)-o.y)<=r)blk[j*nx+i]=0});

 /* clearance (distance to nearest obstacle) so routes prefer the middle of aisles */
 var clr=new Float64Array(N),M=new Float32Array(N);
 for(i=0;i<N;i++)clr[i]=blk[i]?0:1e9;
 for(j=0;j<ny;j++)for(i=0;i<nx;i++){var cc=j*nx+i;if(!clr[cc])continue;var v=clr[cc];
  v=Math.min(v,i>0?clr[cc-1]+1:1,j>0?clr[cc-nx]+1:1,(i>0&&j>0)?clr[cc-nx-1]+1.414:1.414,(i<nx-1&&j>0)?clr[cc-nx+1]+1.414:1.414);clr[cc]=v}
 for(j=ny-1;j>=0;j--)for(i=nx-1;i>=0;i--){var cc2=j*nx+i;if(!clr[cc2])continue;var v2=clr[cc2];
  v2=Math.min(v2,i<nx-1?clr[cc2+1]+1:1,j<ny-1?clr[cc2+nx]+1:1,(i<nx-1&&j<ny-1)?clr[cc2+nx+1]+1.414:1.414,(i>0&&j<ny-1)?clr[cc2+nx-1]+1.414:1.414);clr[cc2]=v2}
 for(i=0;i<N;i++)M[i]=1+2.4*Math.max(0,1-clr[i]*cs/3.5);
 function heapPush(h,d,v){h.push([d,v]);var k=h.length-1;while(k>0){var p=(k-1)>>1;if(h[p][0]<=h[k][0])break;var t=h[p];h[p]=h[k];h[k]=t;k=p}}
 function heapPop(h){var top=h[0],last=h.pop();if(h.length){h[0]=last;var k=0;for(;;){var l=2*k+1,r=l+1,m=k;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===k)break;var t=h[m];h[m]=h[k];h[k]=t;k=m}}return top}
 var DX=[1,-1,0,0,1,1,-1,-1],DY=[0,0,1,-1,1,-1,1,-1];
 function field(src){
  var dist=new Float64Array(N).fill(Infinity),par=new Int32Array(N).fill(-1),h=[];
  src.forEach(function(c){blk[c]=0;dist[c]=0;heapPush(h,0,c)});
  while(h.length){var e=heapPop(h),d=e[0],c=e[1];if(d>dist[c])continue;var x=c%nx,y=(c-x)/nx;
   for(var k=0;k<8;k++){var x2=x+DX[k],y2=y+DY[k];if(x2<0||y2<0||x2>=nx||y2>=ny)continue;var c2=y2*nx+x2;if(blk[c2])continue;
    if(k>=4&&(blk[y*nx+x2]||blk[y2*nx+x]))continue;
    var nd=d+(k<4?1:2.2)*(M[c]+M[c2])/2;if(nd<dist[c2]-1e-9){dist[c2]=nd;par[c2]=c;heapPush(h,nd,c2)}}}
  return {d:dist,p:par}}
 function los(a,b){var L=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(L/(cs*.35)));for(var q=0;q<=n;q++){var t=q/n;if(blk[cy(a.y+(b.y-a.y)*t)*nx+cx(a.x+(b.x-a.x)*t)])return false}return true}
 function cp(c){return {x:wx(c%nx),y:wy(Math.floor(c/nx))}}
 /* simplify a chain of cells to a few corner points (Douglas-Peucker, never cutting through an obstacle) */
 function simp(cells){var P=cells.map(cp);if(P.length<3)return P;var keep=new Uint8Array(P.length);keep[0]=keep[P.length-1]=1;var tol=Math.max(cs*.6,.4);
  (function dp(a,b){if(b<=a+1)return;var md=-1,mi=-1;for(var k=a+1;k<b;k++){var ax=P[a].x,ay=P[a].y,bx=P[b].x,by=P[b].y,dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy)||1,d=Math.abs((P[k].x-ax)*dy-(P[k].y-ay)*dx)/L;if(d>md){md=d;mi=k}}
   if(md>tol||!los(P[a],P[b])){keep[mi]=1;dp(a,mi);dp(mi,b)}})(0,P.length-1);
  return P.filter(function(_,k){return keep[k]})}
 function walkC(F,c){var r=[],g=0;while(c>=0&&g++<6000){r.push(c);c=F.p[c]}return r}
 function nearestReach(F,x,y){var ix=cx(x),iy=cy(y);for(var r=0;r<70;r++){var best=-1,bd=Infinity;
   for(var yy=iy-r;yy<=iy+r;yy++)for(var xx=ix-r;xx<=ix+r;xx++){if(Math.max(Math.abs(xx-ix),Math.abs(yy-iy))!==r)continue;if(xx<0||yy<0||xx>=nx||yy>=ny)continue;var c=yy*nx+xx;if(blk[c]||!isFinite(F.d[c]))continue;var dd=Math.hypot(wx(xx)-x,wy(yy)-y);if(dd<bd){bd=dd;best=c}}
   if(best>=0)return best}return -1}
 function plen(pts){var L=0;for(var k=0;k<pts.length-1;k++)L+=Math.hypot(pts[k+1].x-pts[k].x,pts[k+1].y-pts[k].y);return L}
 var exList=ex.map(function(o){return {o:o,c:cy(o.y)*nx+cx(o.x)}});
 var Fs=exList.map(function(e){return field([e.c])}),m=exList.length;
 /* where each structure can be left from: clear cells just outside its edge (or inside a zone) */
 function candsOf(o){
  var res=[],bnd=boundsOf(o),mg=[cs*1.6+.15,3.5,7],t,ii,jj;
  for(t=0;t<3&&!res.length;t++){
   var x0=cx(bnd.x0-mg[t]-1),x1=cx(bnd.x1+mg[t]+1),y0=cy(bnd.y0-mg[t]-1),y1=cy(bnd.y1+mg[t]+1);
   for(jj=y0;jj<=y1;jj++)for(ii=x0;ii<=x1;ii++){var c=jj*nx+ii;if(blk[c])continue;var p={x:wx(ii),y:wy(jj)},ok=false;
    if(o.t==='rect'){var d=dimsOf(o),l=toLocal(o,p);ok=Math.abs(l.x)<=d.w/2+mg[t]&&Math.abs(l.y)<=d.h/2+mg[t]}
    else if(o.t==='poly'){ok=inPoly(p,o.pts)}
    else{var d2=dimsOf(o),l2=toLocal(o,p);ok=Math.abs(l2.x)<=d2.w/2&&Math.abs(l2.y)<=d2.h/2}
    if(ok){var any=false;for(var e=0;e<m;e++)if(isFinite(Fs[e].d[c])){any=true;break}if(any)res.push(c)}}
   if(o.t!=='rect')break}
  if(res.length>3000){var st=Math.ceil(res.length/3000);res=res.filter(function(_,k){return k%st===0})}
  return res}
 var org=[],skipped=0;
 /* group touching stands/tents into blocks (max ~24 m) so a block gets one route, not one per stand */
 var grp=OR.map(function(o){var b=boundsOf(o);return {m:[o],b:{x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y1},blockable:o.t==='rect'}});
 for(var gi=0;gi<grp.length;gi++){if(!grp[gi])continue;var chg=true;
  while(chg){chg=false;for(var gj=gi+1;gj<grp.length;gj++){var A=grp[gi],B=grp[gj];if(!B||!A.blockable||!B.blockable)continue;
   if(B.b.x0>A.b.x1+.8||A.b.x0>B.b.x1+.8||B.b.y0>A.b.y1+.8||A.b.y0>B.b.y1+.8)continue;
   var nb={x0:Math.min(A.b.x0,B.b.x0),y0:Math.min(A.b.y0,B.b.y0),x1:Math.max(A.b.x1,B.b.x1),y1:Math.max(A.b.y1,B.b.y1)};
   if(nb.x1-nb.x0>24||nb.y1-nb.y0>24)continue;A.m=A.m.concat(B.m);A.b=nb;grp[gj]=null;chg=true}}}
 grp=grp.filter(Boolean);
 grp.forEach(function(G){var cs0={},cands=[];G.m.forEach(function(o){candsOf(o).forEach(function(c){if(!cs0[c]){cs0[c]=1;cands.push(c)}})});var o=G.m[0];if(!cands.length){skipped++;return}
  var de=[],ce=[];for(var e=0;e<m;e++){var bd=Infinity,bc=-1;for(var k=0;k<cands.length;k++){var dv=Fs[e].d[cands[k]];if(dv<bd){bd=dv;bc=cands[k]}}de.push(bd);ce.push(bc)}
  var best=0;for(var e2=1;e2<m;e2++)if(de[e2]<de[best])best=e2;
  if(!isFinite(de[best])){skipped++;return}
  org.push({o:o,de:de,ce:ce,as:best,n:G.m.length})});
 /* imported plan: people are anywhere on the floor, so run routes along its aisles, far ends first */
 if(planMode){
  var bnds=vis.filter(function(o){return (o.t==='line'&&o.closed&&o.pts&&o.pts.length>2)||(o.t==='poly'&&!o.site)||o.t==='area'}),inB=new Uint8Array(N);
  if(!bnds.length){toast('Trace the hall outline first (Line / fence → Plain black line, closed, or a Zone) so the generator knows where the floor is',8000);if(!org.length)return}
  else{
   bnds.forEach(function(o){var P=o.t==='area'?corners(o):o.pts,b=boundsOf(o);if(!b)return;for(j=cy(b.y0);j<=cy(b.y1);j++)for(i=cx(b.x0);i<=cx(b.x1);i++){if(inPoly({x:wx(i),y:wy(j)},P))inB[j*nx+i]=1}});
   var DV={few:12,normal:8,many:5}[S.meta.evDen||'normal'],rC=Math.max(2,Math.round(DV/cs)),cov=new Uint8Array(N),cand=[],nseed=0,seedCells=[],dmin=function(c){var q=Infinity;for(var e5=0;e5<m;e5++)if(Fs[e5].d[c]<q)q=Fs[e5].d[c];return q};
   for(j=1;j<ny-1;j++)for(i=1;i<nx-1;i++){var c=j*nx+i;if(!inB[c]||blk[c])continue;var ck=clr[c]*cs;if(ck<.6||ck>5)continue;
    var rdg=(clr[c]>=clr[c-1]&&clr[c]>=clr[c+1]&&(clr[c]>clr[c-1]||clr[c]>clr[c+1]))||(clr[c]>=clr[c-nx]&&clr[c]>=clr[c+nx]&&(clr[c]>clr[c-nx]||clr[c]>clr[c+nx]));if(!rdg)continue;
    var dd=dmin(c);if(isFinite(dd))cand.push([dd,c])}
   cand.sort(function(p,q){return q[0]-p[0]});
   function bestExit(c){var be=0;for(var e=1;e<m;e++)if(Fs[e].d[c]<Fs[be].d[c])be=e;return be}
   function cover(c0){var e=bestExit(c0),q=[],dep=new Map(),c=c0,g=0;while(c>=0&&g++<6000){if(!cov[c]){cov[c]=1}q.push(c);dep.set(c,0);c=Fs[e].p[c]}
    var h=0;while(h<q.length){var cc=q[h++],dp=dep.get(cc);if(dp>=rC)continue;var x=cc%nx,y=(cc-x)/nx;for(var k=0;k<4;k++){var x2=x+DX[k],y2=y+DY[k];if(x2<0||y2<0||x2>=nx||y2>=ny)continue;var c2=y2*nx+x2;if(blk[c2]||dep.has(c2))continue;dep.set(c2,dp+1);cov[c2]=1;q.push(c2)}}}
   cand.forEach(function(p){var c=p[1];if(cov[c])return;seedCells.push(c);cover(c)});
   /* open halls have no aisles: add one approach line per exit if nothing already leads there */
   var bw=1e9;bnds.forEach(function(o){var bq=boundsOf(o);bw=Math.min(bw,bq.x1-bq.x0,bq.y1-bq.y0)});var AP=Math.max(8,Math.min(18,.3*bw));
   for(var e7=0;e7<m;e7++){var bc=-1,bk=-1,ox=exList[e7].o.x,oy=exList[e7].o.y;
    for(j=0;j<ny;j++)for(i=0;i<nx;i++){var c7=j*nx+i;if(!inB[c7]||blk[c7]||!isFinite(Fs[e7].d[c7])||clr[c7]*cs<.6)continue;var dq=Math.hypot(wx(i)-ox,wy(j)-oy);if(Math.abs(dq-AP)>2.5)continue;
     var nearest=true;for(var e8=0;e8<m;e8++)if(Fs[e8].d[c7]<Fs[e7].d[c7]-1e-9){nearest=false;break}if(!nearest)continue;if(clr[c7]>bk){bk=clr[c7];bc=c7}}
    if(bc>=0&&!cov[bc]){seedCells.push(bc);cover(bc)}}
   seedCells.forEach(function(s){var de=[],ce=[],best=0;for(var e6=0;e6<m;e6++){de.push(Fs[e6].d[s]);ce.push(s);if(de[e6]<de[best])best=e6}org.push({o:{t:'seed'},de:de,ce:ce,as:best,n:1,seed:1});nseed++});
   if(!nseed)toast('No open floor found inside the outline. Check the plan is calibrated and the outline is closed.',7000)}}
 /* share the people out so every exit is used */
 var useAll=S.meta.evAll!==false;
 if(useAll&&org.length>1){
  var load=new Array(m).fill(0),cap=Math.max(2,Math.ceil(1.4*org.length/m));
  org.forEach(function(g){g.as=-1});
  org.slice().sort(function(p,q){return Math.min.apply(null,p.de)-Math.min.apply(null,q.de)}).forEach(function(g){
   var rk=g.de.map(function(d,e){return {e:e,d:d}}).filter(function(q){return isFinite(q.d)}).sort(function(p,q){return p.d-q.d});
   var pick=rk.filter(function(q){return load[q.e]<cap})[0]||rk[0];g.as=pick.e;load[pick.e]++});
  for(var e3=0;e3<m;e3++){if(load[e3]>0)continue;
   var bg=null,br=Infinity;org.forEach(function(g){if(load[g.as]<2||!isFinite(g.de[e3]))return;var rg=g.de[e3]-g.de[g.as];if(rg<br){br=rg;bg=g}});
   if(bg){load[bg.as]--;bg.as=e3;load[e3]++}}}
 /* build one route tree per exit and draw each branch once, ending on the trunk it joins */
 var routes=[],used={},longest=0,legs=0;
 for(var e4=0;e4<m;e4++){var mine=org.filter(function(g){return g.as===e4});if(!mine.length)continue;
  var F=Fs[e4],vis2={},kids={},starts={};
  mine.forEach(function(g){var s=g.ce[e4];starts[s]=1;var c=s;while(c>=0){if(vis2[c])break;vis2[c]=1;var p=F.p[c];if(p>=0)kids[p]=(kids[p]||0)+1;c=p}});
  var order=Object.keys(starts).map(Number).sort(function(a,b){return F.d[b]-F.d[a]}),done={};
  order.forEach(function(s){var cells=[],c=s,g=0;while(c>=0&&g++<6000){cells.push(c);if(done[c])break;done[c]=1;c=F.p[c]}
   var pts=[],seg=[cells[0]];
   function flush(){if(seg.length){var sp=simp(seg);if(pts.length)sp.shift();pts=pts.concat(sp)}}
   for(var k=1;k<cells.length;k++){seg.push(cells[k]);var cc3=cells[k];if(k<cells.length-1&&((kids[cc3]||0)>=2||starts[cc3])){flush();seg=[cc3]}}
   flush();
   if(cells[cells.length-1]===exList[e4].c)pts[pts.length-1]={x:exList[e4].o.x,y:exList[e4].o.y};
   if(pts.length<2||(plen(pts)<3&&mine.length>1&&org.length>6))return;
   routes.push({pts:pts});longest=Math.max(longest,plen(pts)+0)});
  used[exList[e4].c]=exList[e4].o}
 if(as.length){var aSrc=as.map(function(o){return cy(o.y)*nx+cx(o.x)}),F2=field(aSrc),aCell={};as.forEach(function(o,ix){aCell[aSrc[ix]]=o});
  Object.keys(used).forEach(function(c){var eo=used[c],sc=nearestReach(F2,eo.x,eo.y);if(sc<0)return;var cells=walkC(F2,sc),ao=aCell[cells[cells.length-1]];if(!ao)return;
   var pts=simp(cells);pts[pts.length-1]={x:ao.x,y:ao.y};pts.unshift({x:eo.x,y:eo.y});routes.push({pts:pts,leg:1});legs++})}
 snapH();evClear();
 routes.forEach(function(rt){var o={t:'line',style:'evac',pts:rt.pts.map(function(q){return {x:Math.round(q.x*100)/100,y:Math.round(q.y*100)/100}}),ev:1,closed:false};o.id=newId();if(S.meta.only)o.lay=S.meta.only;S.objs.push(o)});
 S.meta.evac=true;syncEvac();changed(true);
 var nu=Object.keys(used).length;
 toast(org.filter(function(g){return !g.seed}).reduce(function(a,g){return a+g.n},0)+' structure/zone(s)'+(planMode?' + '+org.filter(function(g){return g.seed}).length+' aisle point(s)':'')+' in '+org.length+' group(s) routed to '+nu+' of '+m+' exit(s)'+(legs?', '+legs+' run(s) on to assembly':(as.length?'':'. Add an Assembly point sign to extend routes to it'))+'. Longest run '+Math.round(longest)+' m.'+(nu<m?' '+(m-nu)+' exit(s) unused: too few areas or blocked.':'')+(skipped?' '+skipped+' area(s) had no clear path (blocked or fully enclosed).':'')+(capped?' First 150 areas used.':''),9000);
}
function setEvac(on){S.meta.evac=on;syncEvac();S.sel=null;S.ms=[];saveLocal();renderPanel();renderSelbar();draw();toast(on?'Emergency evacuation plan':'Operational plan',2000)}
function syncEvac(){syncLay();var ea=$('#evAll'),ee=$('#evEntr'),ep=$('#evPlan'),ed=$('#evDen');if(ep){ep.checked=S.meta.evPlan!==false;ep.onchange=function(){S.meta.evPlan=ep.checked;saveLocal()}}if(ed){ed.value=S.meta.evDen||'normal';ed.onchange=function(){S.meta.evDen=ed.value;saveLocal()}}if(ea){ea.checked=S.meta.evAll!==false;ea.onchange=function(){S.meta.evAll=ea.checked;saveLocal()}}if(ee){ee.checked=S.meta.evEntr!==false;ee.onchange=function(){S.meta.evEntr=ee.checked;saveLocal()}}var b=$('#evBar');if(b)b.classList.toggle('on',!!S.meta.evac);$$('#tools [data-act=evac]').forEach(function(x){x.classList.toggle('on',!!S.meta.evac)})}
function setView(id){
 S.meta.only=id||null;S.sel=null;S.ms=[];renderViewSel();renderSelbar();if(S.meta.only)fitAll();saveLocal();renderPanel();draw();
 toast(id?'Showing internals of '+layoutOf(id).name+' only':'Showing the whole plan')}
function renderViewSel(){
 var el=$('#viewSel');if(!el)return;var L=S.meta.layouts||[];
 el.innerHTML='<option value="">Whole plan</option>'+L.map(function(l){return '<option value="'+l.id+'">Internals: '+esc(l.name)+'</option>'}).join('')+'<option value="__new">+ New internal layout…</option>';
 el.value=S.meta.only||'';el.classList.toggle('on',true);syncLay()}
function faceTo(angFn){
 var T=selObjs().filter(function(o){return o.t==='rect'});if(!T.length){toast('Select structures first');return}
 snapH();T.forEach(function(o){var a=angFn(o);if(a==null||isNaN(a))return;var sd=frontSide(o);if(sd==='none'){o.fr='s';sd='s'}o.rot=(((a-SIDEANG[sd])%360)+360)%360});
 changed(true);toast(T.length+' structure(s) turned so the orange front edge faces that way')}
function canHost(o){return !!o&&(o.t==='rect'||o.t==='area'||o.t==='poly'||(o.t==='line'&&o.closed))}
function layoutForObj(o){
 if(!canHost(o)){toast('Select a tent, zone, shape or closed outline first');return}
 var ex=(S.meta.layouts||[]).filter(function(l){return l.src===o.id})[0];if(ex){setView(ex.id);return}
 var nm=((o.label||'')+'').trim()||objName(o);
 ask('Internal layout of this structure',[{l:'Layout name (e.g. VIP tent, Main marquee)',v:nm}],function(v){
  var name=(v[0]||'').trim();if(!name)return;var b=boundsOf(o),id='L'+Date.now().toString(36);
  snapH();S.meta.layouts=S.meta.layouts||[];S.meta.layouts.push({id:id,name:name,src:o.id,gx:b.x0,gy:b.y0});o.lay=id;
  S.meta.only=id;S.sel=null;S.ms=[];renderViewSel();fitAll();saveLocal();renderPanel();renderSelbar();draw();changed(true);
  toast('Internal layout of '+name+'. Everything you add now belongs to it; the grid starts at its corner.',6000)},'Create');
}
async function exportAllLayouts(kind){
 var L=S.meta.layouts||[];if(!L.length){toast('No internal layouts yet');return}
 var keep=S.meta.only;toast('Rendering '+L.length+' layout sheets…',30000);
 var safe=function(x){return String(x||'').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')};
 var base=safe(S.meta.event||'plan')+'_'+S.meta.ref+'_Rev'+S.meta.rev;
 try{
  if(kind==='pdf'){var jsPDF=window.jspdf&&window.jspdf.jsPDF;if(!jsPDF)throw new Error('PDF library did not load. Try PNG export.');var pdf=null;
   for(var i=0;i<L.length;i++){S.meta.only=L[i].id;var r=await renderSheet(),ori=r.P.w>=r.P.h?'landscape':'portrait';
    if(!pdf)pdf=new jsPDF({orientation:ori,unit:'mm',format:[r.P.w,r.P.h]});else pdf.addPage([r.P.w,r.P.h],ori);
    pdf.addImage(r.canvas.toDataURL('image/jpeg',.93),'JPEG',0,0,r.P.w,r.P.h,undefined,'FAST')}
   pdf.setProperties({title:(S.meta.event||'')+' – internal layouts',author:S.meta.company,subject:'Ref '+S.meta.ref});
   await download(base+'_internal_layouts.pdf',pdf.output('blob'))}
  else{for(var k=0;k<L.length;k++){S.meta.only=L[k].id;var r2=await renderSheet();var bl=await new Promise(function(res){r2.canvas.toBlob(res,'image/png')});await download(base+'_'+safe(L[k].name)+'.png',bl)}}
  toast(L.length+' internal layout sheet(s) saved')
 }catch(err){toast(err.message||'Export failed',5000)}
 finally{S.meta.only=keep;renderViewSel();draw()}
}
function syncLay(){var b=$('#layBar');if(!b)return;var lo=S.meta.only?layoutOf(S.meta.only):null;b.classList.toggle('on',!!lo);if(lo)$('#layName').textContent='Internal layout: '+lo.name;var ev=$('#evBar');b.style.top=(ev&&ev.classList.contains('on'))?'64px':'12px'}
function newLayout(){
 var sel=selObjs();
 ask('New internal layout',[{l:'Name (e.g. VIP tent, Main marquee)',v:'Layout '+(((S.meta.layouts||[]).length)+1)}],function(v){
  var nm=(v[0]||'').trim();if(!nm)return;S.meta.layouts=S.meta.layouts||[];var id='L'+Date.now().toString(36);S.meta.layouts.push({id:id,name:nm});
  if(sel.length){snapH();sel.forEach(function(o){o.lay=id})}
  S.meta.only=id;S.sel=null;S.ms=[];renderViewSel();fitAll();saveLocal();renderPanel();draw();changed(true);
  toast(sel.length?'Layout created with the selected outline. Draw everything inside it.':'Layout created. Draw the outline with Line / fence → Plain black line, then build inside.',5000)},'Create');
}
function vo(o){return !o.hd&&(!o.ev||S.meta.evac)&&(!S.meta.only||o.lay===S.meta.only)}
function ordered(){return S.objs.map(function(o,i){return [o,i]}).filter(function(p){return vo(p[0])}).sort(function(x,y){return ((x[0].zl||0)-(y[0].zl||0))||((PRI[x[0].t]||0)-(PRI[y[0].t]||0))||(x[1]-y[1])}).map(function(p){return p[0]})}
var EVC='#0a8f3c',EVKEEP=/^(exit_run|exit_run_r|exit_box|exit_sign|assembly|first_aid|fire_ext|hose_reel|hydrant|call_point)$/;
function evKeep(o){return o.ev||(o.t==='rect'&&o.k==='cover')||o.t==='door'||(o.t==='sign'&&EVKEEP.test(o.k))}
function drawObjs(c){ordered().forEach(function(o){if(S.meta.evac&&!evKeep(o)){c.save();c.globalAlpha=.27;drawObj(c,o);c.restore()}else drawObj(c,o)})}
function evArrows(c,pts,col){
 var tot=0,i,seg=[];for(i=0;i<pts.length-1;i++){var l=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y);seg.push(l);tot+=l}
 if(tot<=0)return;var a=px(7),sp=px(95),d=Math.min(sp/2,tot/2),marks=[];
 for(;d<tot-a*1.5;d+=sp)marks.push(d);marks.push(tot);
 c.fillStyle=col;c.strokeStyle='#fff';c.lineWidth=px(.8);
 marks.forEach(function(m){var acc=0,k=0;while(k<seg.length-1&&acc+seg[k]<m){acc+=seg[k];k++}
  var t=seg[k]>0?(m-acc)/seg[k]:1,p={x:pts[k].x+(pts[k+1].x-pts[k].x)*t,y:pts[k].y+(pts[k+1].y-pts[k].y)*t},ux=(pts[k+1].x-pts[k].x)/(seg[k]||1),uy=(pts[k+1].y-pts[k].y)/(seg[k]||1),tip=m>=tot?0:a*.5;
  c.beginPath();c.moveTo(p.x+ux*(a*.9+tip),p.y+uy*(a*.9+tip));c.lineTo(p.x-ux*a*.7-uy*a*.8+ux*tip,p.y-uy*a*.7+ux*a*.8+uy*tip);c.lineTo(p.x-ux*a*.7+uy*a*.8+ux*tip,p.y-uy*a*.7-ux*a*.8+uy*tip);c.closePath();c.fill();c.stroke()})
}
function colName(i){var t='';i=Math.floor(i);do{t=String.fromCharCode(65+i%26)+t;i=Math.floor(i/26)-1}while(i>=0);return t}
function drawModuleGrid(c,vb,m,pass){
 var g=+m.gridMod||0,mn=m.gridMinor===undefined?1:+m.gridMinor,show=m.gridShow!==false;
 var lo=m.only?layoutOf(m.only):null,ppu=R.z/R.u,gx=lo&&lo.gx!==undefined?lo.gx:(+m.gx||0),gy=lo&&lo.gy!==undefined?lo.gy:(+m.gy||0),i,j;
 function lines(step,stroke,lw,skipMult){
  if(!(step>0)||step*ppu<(R.u===1?6:7))return;
  var i0=Math.ceil((vb.x0-gx)/step),i1=Math.floor((vb.x1-gx)/step),j0=Math.ceil((vb.y0-gy)/step),j1=Math.floor((vb.y1-gy)/step);
  if(i1-i0>2500||j1-j0>2500)return;
  c.save();c.strokeStyle=stroke;c.lineWidth=px(lw);c.beginPath();
  for(i=i0;i<=i1;i++){if(skipMult&&Math.abs(i*step/skipMult-Math.round(i*step/skipMult))<1e-6)continue;c.moveTo(gx+i*step,vb.y0);c.lineTo(gx+i*step,vb.y1)}
  for(j=j0;j<=j1;j++){if(skipMult&&Math.abs(j*step/skipMult-Math.round(j*step/skipMult))<1e-6)continue;c.moveTo(vb.x0,gy+j*step);c.lineTo(vb.x1,gy+j*step)}
  c.stroke();c.restore()}
 if(pass==='lines'){
  var major=g>0?g:(mn>0?mn*5:0);
  if(show&&mn>0&&major>mn+1e-9)lines(mn,'rgba(28,107,176,.24)',.6,major);
  else if(show&&mn>0&&!(g>0))lines(mn,'rgba(28,107,176,.24)',.6,0);
  if(g>0)lines(g,'rgba(28,107,176,.62)',1,0);else if(show&&mn>0)lines(major,'rgba(28,107,176,.42)',.9,0);
  return}
 if(!(g>0)||m.gridLabels===false||g*ppu<22)return;
 var i0=Math.ceil((vb.x0-gx)/g),i1=Math.floor((vb.x1-gx)/g),j0=Math.ceil((vb.y0-gy)/g),j1=Math.floor((vb.y1-gy)/g);
 var o={col:'#1c6bb0',bold:true},sz=Math.min(12,Math.max(8,g*ppu*.3));
 for(i=Math.max(0,i0-1);i<=i1;i++){var cxm=gx+(i+.5)*g;if(cxm<vb.x0||cxm>vb.x1)continue;txt(c,colName(i),cxm,vb.y0+px(9),sz,o);txt(c,colName(i),cxm,vb.y1-px(9),sz,o)}
 for(j=Math.max(0,j0-1);j<=j1;j++){var cym=gy+(j+.5)*g;if(cym<vb.y0||cym>vb.y1)continue;txt(c,String(j+1),vb.x0+px(9),cym,sz,o);txt(c,String(j+1),vb.x1-px(9),cym,sz,o)}
}
function drawLayer(c,L){
 if(!L.vis)return;c.save();c.translate(L.x,L.y);c.rotate(L.rot*D2R);c.scale(L.mpp,L.mpp);c.globalAlpha=L.op;c.globalCompositeOperation=L.blend||'source-over';c.imageSmoothingQuality='high';c.drawImage(L.crisp&&L.kind==='plan'?crispOf(L):L.img,0,0);c.restore();
}

