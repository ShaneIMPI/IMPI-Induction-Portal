/* ---------- perimeter lines with gaps, plus boom gates, sliding gates and stairs ---------- */
IC.perim='M4 7h6M14 7h6M4 7v10M20 7v10M4 17h6M14 17h6';IC.gap='M4 12h4M16 12h4M8 7v10M16 7v10';

/* A line can carry gaps: a list of segment numbers (segment i joins point i to point i+1) that are not fence. */
function lineRuns(o){
 var P=o.pts,n=P.length,closed=!!o.closed,segN=closed?n:n-1,gs={},i,runs=[],cur=null,gaps=[],any=false;
 (o.gaps||[]).forEach(function(g){if(g>=0&&g<segN){gs[g]=1;any=true}});
 if(!any)return {runs:[closed?P.concat([P[0]]):P],gaps:[],full:true};
 for(i=0;i<segN;i++){var a=P[i],b=P[(i+1)%n];
  if(gs[i]){if(cur){runs.push(cur);cur=null}gaps.push({i:i,a:a,b:b,len:Math.hypot(b.x-a.x,b.y-a.y)})}
  else{if(!cur)cur=[a];cur.push(b)}}
 if(cur)runs.push(cur);
 if(closed&&runs.length>1&&!gs[segN-1]&&!gs[0]){var last=runs.pop();runs[0]=last.concat(runs[0].slice(1))}
 return {runs:runs,gaps:gaps,full:false}}
function gapLen(o){var t=0;lineRuns(o).gaps.forEach(function(g){t+=g.len});return t}
/* keep the gap list correct when points are added to or removed from a line */
function gapArr(o){var n=o.pts.length,s0=o.closed?n:n-1,a=[],i;for(i=0;i<s0;i++)a.push(0);(o.gaps||[]).forEach(function(g){if(g>=0&&g<s0)a[g]=1});return a}
function gapSet(o,a){var g=[];a.forEach(function(v,i){if(v)g.push(i)});if(g.length)o.gaps=g;else delete o.gaps}
function gapsInsert(ga,mi){ga.splice(mi+1,0,ga[mi])}
function gapsRemove(o,ga,r){var n=o.pts.length,m;
 if(o.closed){if(r===0){m=ga[n-1]|ga[0];ga=ga.slice(1,n-1).concat([m])}else{m=ga[r-1]|ga[r];ga.splice(r-1,2,m)}}
 else{if(r===0)ga.shift();else if(r===n-1)ga.pop();else{m=ga[r-1]|ga[r];ga.splice(r-1,2,m)}}
 return ga}
function gapBase(o){var k=0;for(var i=0;i<S.objs.length;i++){var q=S.objs[i];if(q===o||q.id===o.id)break;if(q.t==='line'&&q.gaps&&q.gaps.length&&!q.hd)k+=lineRuns(q).gaps.length}return k}

/* the line wrapper: draws each run of fence, then the gap markers and any section lengths */
function drawLineObj(c,o,ic){
 if(o.gaps&&o.gaps.length&&o.pts&&o.pts.length>1){lineRuns(o).runs.forEach(function(r){drawLineObj0(c,Object.assign({},o,{pts:r,closed:false,gaps:null}),ic)})}
 else drawLineObj0(c,o,ic);
 if(!ic&&o.pts&&o.pts.length>1&&(o.segl||(o.gaps&&o.gaps.length)))lineExtras(c,o)}
function lineExtras(c,o){
 var rn=lineRuns(o),base=o.id?gapBase(o):0;
 function ang(dx,dy){var a=Math.atan2(dy,dx);if(a>Math.PI/2)a-=Math.PI;if(a<-Math.PI/2)a+=Math.PI;return a}
 c.save();
 rn.gaps.forEach(function(g,k){if(g.len<1e-6)return;
  var ux=(g.b.x-g.a.x)/g.len,uy=(g.b.y-g.a.y)/g.len,nx=-uy,ny=ux,t=Math.max(px(6),.35);
  c.strokeStyle='#9a3412';c.lineWidth=px(1.4);c.setLineDash([]);c.beginPath();
  [g.a,g.b].forEach(function(p){c.moveTo(p.x-nx*t,p.y-ny*t);c.lineTo(p.x+nx*t,p.y+ny*t)});c.stroke();
  c.setLineDash([px(3),px(3)]);c.strokeStyle='rgba(154,52,18,.55)';c.beginPath();c.moveTo(g.a.x,g.a.y);c.lineTo(g.b.x,g.b.y);c.stroke();c.setLineDash([]);
  if(g.len*R.z/R.u>28){var mx=(g.a.x+g.b.x)/2+nx*px(11),my=(g.a.y+g.b.y)/2+ny*px(11);txt(c,'G'+(base+k+1)+'  '+fm(g.len),mx,my,10,{col:'#9a3412',bold:true,rot:ang(ux,uy)})}});
 if(o.segl){rn.runs.forEach(function(r){for(var i=0;i<r.length-1;i++){var a=r[i],b=r[i+1],L=Math.hypot(b.x-a.x,b.y-a.y);if(L<1e-6||L*R.z/R.u<34)continue;
  var ux=(b.x-a.x)/L,uy=(b.y-a.y)/L;txt(c,fm(L),(a.x+b.x)/2-uy*px(10),(a.y+b.y)/2+ux*px(10),9,{col:'#33444f',rot:ang(ux,uy)})}})}
 c.restore()}

/* ---------- perimeter tool ---------- */
function togglePerim(){
 if(S.perim&&S.tool==='line'){S.perim=false;S.gapNext=false;setTool('select');syncPrec();toast('Perimeter off');return}
 S.traceSnap=true;syncTrace();S.lineStyle='fence';setTool('line');S.perim=true;S.gapNext=false;$('#lineSel').value='fence';syncPrec();draw();
 toast('Perimeter: tap along the existing fence. Where the fence stops, press Gap, then tap where it starts again. Tap the first point to close the loop, or Finish.',9000)}
function toggleGap(){
 if(S.tool!=='line'){togglePerim()}
 S.gapNext=!S.gapNext;syncPrec();draw();toast(S.gapNext?'Gap: tap where the fence starts again. The stretch in between is left open and measured.':'Gap cancelled',4500)}
function tmpGaps(t,P){var g=(t.gaps||[]).slice();if(S.gapNext&&t.cur&&P.length>=2)g.push(P.length-2);return g}

/* ---------- boom gate, sliding gate, stairs ---------- */
function siteItem(c,o,L,s,w,h,lw){
 var hx=w/2,hy=h/2,i;
 c.lineWidth=lw;c.strokeStyle=INK;c.lineJoin='round';
 if(s==='boom'){
  var hw=Math.min(.55,w*.2);c.fillStyle='#cfd6dc';c.fillRect(-hx,-hy,hw,h);c.strokeRect(-hx,-hy,hw,h);
  var al=w-hw-.25,ah=Math.min(.16,h*.3),n=Math.max(2,Math.round(al/.4)),sw=al/n;
  for(i=0;i<n;i++){c.fillStyle=i%2?'#ffffff':'#d32f2f';c.fillRect(-hx+hw+i*sw,-ah/2,sw,ah)}
  c.lineWidth=lw*.8;c.strokeRect(-hx+hw,-ah/2,al,ah);
  c.fillStyle='#cfd6dc';c.lineWidth=lw;c.fillRect(hx-.22,-hy*.55,.22,h*.55);c.strokeRect(hx-.22,-hy*.55,.22,h*.55);
  c.fillStyle='#22313d';c.beginPath();c.arc(-hx+hw/2,0,Math.min(.1,h*.15),0,TAU);c.fill();
 }else if(s==='sgate'){
  /* closed leaf over the left half, the open position shown dashed on the right, rail beneath */
  var lf=w/2,th=Math.min(.14,h*.4);
  c.fillStyle='#fff';c.fillRect(-hx,-th/2,lf,th);c.strokeRect(-hx,-th/2,lf,th);
  c.lineWidth=lw*.6;var bars=Math.max(2,Math.round(lf/.18));c.beginPath();for(i=1;i<bars;i++){var bxp=-hx+lf*i/bars;c.moveTo(bxp,-th/2);c.lineTo(bxp,th/2)}c.stroke();
  c.lineWidth=lw;c.fillStyle='#8a97a1';c.fillRect(-hx-.06,-hy,.12,h);c.fillRect(hx-.06,-hy,.12,h);c.fillRect(-.06,-hy,.12,h);
  c.save();c.setLineDash([lw*3,lw*2]);c.strokeStyle='#5b6b78';c.lineWidth=lw*.8;c.strokeRect(0.1,-th/2,lf-.1,th);c.setLineDash([]);c.restore();
  var ay=hy*.75;c.strokeStyle='#e8590c';c.lineWidth=lw;c.beginPath();c.moveTo(-hx+lf*.5,ay);c.lineTo(hx-lf*.25,ay);c.stroke();
  var ah2=Math.min(.22,lf*.1);c.fillStyle='#e8590c';c.beginPath();c.moveTo(hx-lf*.25,ay);c.lineTo(hx-lf*.25-ah2,ay-ah2*.6);c.lineTo(hx-lf*.25-ah2,ay+ah2*.6);c.closePath();c.fill();
 }else if(s==='stairs'){
  c.fillStyle='#f3f4f6';c.fillRect(-hx,-hy,w,h);c.strokeRect(-hx,-hy,w,h);
  var nt=Math.max(3,Math.round(h/.28)),st=h/nt;c.lineWidth=lw*.55;c.beginPath();for(i=1;i<nt;i++){c.moveTo(-hx,-hy+st*i);c.lineTo(hx,-hy+st*i)}c.stroke();
  c.lineWidth=lw;c.strokeStyle='#5b6b78';c.beginPath();c.moveTo(-hx+.05,-hy);c.lineTo(-hx+.05,hy);c.moveTo(hx-.05,-hy);c.lineTo(hx-.05,hy);c.stroke();
  var ar=Math.min(w*.18,h*.12,.4);c.strokeStyle='#e8590c';c.fillStyle='#e8590c';c.lineWidth=lw*1.4;c.beginPath();c.moveTo(0,hy-h*.12);c.lineTo(0,-hy+h*.16);c.stroke();
  c.beginPath();c.moveTo(0,-hy+h*.1);c.lineTo(-ar,-hy+h*.1+ar*1.2);c.lineTo(ar,-hy+h*.1+ar*1.2);c.closePath();c.fill()}}

/* ---------- clear project: a blank sheet for the next redraw ---------- */
function clearProject(){
 snapH();var m=S.meta;
 S.objs=[];S.layers=[];S.sel=null;S.issues=[];S.tmp=null;S.perim=false;S.gapNext=false;S.pencil=false;
 m.title='SITE & FLOOR PLAN';m.event='[EVENT NAME]';m.venue='[VENUE]';m.client='[CLIENT]';m.date=today();m.rev='A';m.drawn='[DRAWN BY]';m.ref='FP-'+today().replace(/-/g,'')+'-001';
 m.tstart='';m.tend='';m.attend=0;m.certCap=0;m.siteArea=0;delete m.dens;m.only=null;m.layouts=[];m.evac=false;m.north=0;m.scale='auto';m.extent='content';m.mode='outdoor';m.gridMod=0;m.gx=0;m.gy=0;
 if(S.cloud){S.cloud.planId=null;S.cloud.rev=null}
 if(typeof syncEvac==='function')syncEvac();if(typeof renderViewSel==='function')renderViewSel();
 setTool('select');changed(true);fitAll();toast('Project cleared. Blank sheet ready.')}
function armClear(k){S.clrArm=k;renderPanel();setTimeout(function(){if(S.clrArm===k){S.clrArm=null;if(S.tab==='sheet')renderPanel()}},6000)}

/* ---------- exhibition stand: name top-left, size bottom-left, number bottom-right ---------- */
function standLabels(c,o,w,h){
 var ppu=R.z/R.u,wp=w*ppu,hp=h*ppu,rot=(o.rot||0)*D2R,rel=normAng(rot)-rot,flip=Math.cos(rel)<0?-1:1,
  num=String(o.label||'').trim(),nm=String(o.sname||'').trim(),sz=+(w.toFixed(1))+'x'+(+(h.toFixed(1))),
  pad=5,col=o.lc||'#12202b',m=Math.min(wp,hp);
 if(m<26||o.lm==='off')return;
 var big=Math.max(8,Math.min(+o.ls>0?+o.ls:15,m*.2)),small=Math.max(7,Math.min(10,m*.14)),i,y;
 function at(px0,py0,t,size,al,bold){txt(c,t,flip*px(px0),flip*px(py0),size,{rot:rel,col:col,bold:bold,align:al,halo:false})}
 /* bottom row */
 var rowY=hp/2-pad-big*.55;
 if(num)at(wp/2-pad,rowY,num,big,'right',true);
 if(wp>tw(c,num||'',big,true)+tw(c,sz,small,false)+pad*3)at(-wp/2+pad,hp/2-pad-small*.6,sz,small,'left',false);
 /* name, wrapped, top-left */
 if(nm){var availH=hp-pad*2-big*1.4-2,availW=wp-pad*2,fs,L,ok=false;
  for(fs=Math.min(big*1.05,18);fs>=7;fs-=.5){L=wrapAt(c,nm.toUpperCase(),fs,availW,false);var widest=0;L.forEach(function(l){widest=Math.max(widest,tw(c,l,fs,false))});if(widest<=availW&&L.length*fs*1.15<=availH){ok=true;break}}
  if(ok){y=-hp/2+pad+fs*.6;L.forEach(function(l){at(-wp/2+pad,y,l,fs,'left',false);y+=fs*1.15})}}}

/* ---------- stand names: fill in after the stands are numbered ---------- */
function natCmp(a,b){return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'})}
function standNamesModal(){
 var st=S.objs.filter(function(o){return o.t==='rect'&&/^stand/.test(o.k||'')&&vo(o)});
 if(!st.length){toast('No stands on the plan yet');return}
 st.sort(function(a,b){return natCmp(a.label||'~',b.label||'~')||(a.y-b.y)||(a.x-b.x)});
 var m=$('#modal'),inS='style="border:1px solid var(--ln);background:var(--pn2);border-radius:8px;padding:7px;color:var(--ink);width:100%;min-height:36px"';
 m.innerHTML='<div class="mbox" role="dialog" aria-label="Stand names" style="width:min(560px,100%)"><h3>Stand names</h3><p class="note">Type the exhibitor name next to each stand number. Leave blank for none. Tap a number to see that stand on the plan.</p>'
  +'<div style="max-height:52vh;overflow:auto;border:1px solid var(--ln);border-radius:8px">'+st.map(function(o,i){return '<div style="display:flex;gap:8px;align-items:center;padding:4px 8px;border-bottom:1px solid var(--ln)"><button class="btn sm" data-sn="'+i+'" style="min-width:64px">'+esc(o.label||'(no no.)')+'</button><span style="font-size:12px;color:var(--mut);min-width:44px">'+fmt(o.w)+'x'+fmt(o.h)+'</span><input data-nm="'+i+'" value="'+esc(o.sname||'')+'" placeholder="Stand name" '+inS+'></div>'}).join('')+'</div>'
  +'<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px">Paste a list of names (one per line, in stand-number order)</summary><textarea id="sn_paste" rows="5" '+inS+'></textarea><div class="mrow"><button class="btn sm" id="sn_fill">Fill names from list</button></div></details>'
  +'<div class="mrow"><button class="btn" id="mc">Cancel</button><button class="btn pri" id="mo">Save names</button></div></div>';
 m.classList.add('on');
 function close(){m.classList.remove('on');m.innerHTML=''}
 $('#mc').onclick=close;
 m.onclick=function(e){var b=e.target.closest('[data-sn]');if(b){var o=st[+b.dataset.sn],bb=boundsOf(o);setSel([o.id]);try{fitTo(bb,.8)}catch(x){}draw()}};
 $('#sn_fill').onclick=function(){var L=$('#sn_paste').value.split(/\r?\n/).map(function(x){return x.trim()});var ins=$$('[data-nm]',m);ins.forEach(function(inp,i){if(i<L.length&&L[i])inp.value=L[i]})};
 $('#mo').onclick=function(){snapH();var n=0;$$('[data-nm]',m).forEach(function(inp){var o=st[+inp.dataset.nm],v=inp.value.trim();if(v){if(o.sname!==v)n++;o.sname=v}else if(o.sname){delete o.sname;n++}});close();changed(true);toast(n+' stand name'+(n===1?'':'s')+' saved')};
}

/* ---------- fight cage, ring and round stage (top view, footprint = platform) ---------- */
function arenaItem(c,o,L,s,w,h,lw){
 var hx=w/2,hy=h/2,i;c.lineWidth=lw;c.strokeStyle=INK;c.lineJoin='round';
 if(s==='rstage'){
  c.fillStyle='#d9dee3';c.beginPath();c.ellipse(0,0,hx,hy,0,0,TAU);c.fill();c.stroke();
  c.lineWidth=lw*.6;c.strokeStyle='#8a97a1';c.setLineDash([lw*3,lw*2]);c.beginPath();c.ellipse(0,0,hx*.86,hy*.86,0,0,TAU);c.stroke();c.setLineDash([]);return}
 /* platform */
 c.fillStyle='#e3e7ea';c.fillRect(-hx,-hy,w,h);c.strokeRect(-hx,-hy,w,h);
 var cg=Math.min(L.cg||w*.85,Math.min(w,h)*.99);
 if(s==='octagon'){
  var a=cg/2,k=a*Math.tan(Math.PI/8),P=[[k,-a],[a,-k],[a,k],[k,a],[-k,a],[-a,k],[-a,-k],[-k,-a]];
  c.fillStyle='#f4f5f6';c.beginPath();P.forEach(function(p,j){j?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])});c.closePath();c.fill();
  /* cage fence: heavy outline with two door gaps (top and bottom flats) */
  c.lineWidth=lw*2.4;c.strokeStyle='#22313d';c.beginPath();
  for(i=0;i<8;i++){var p1=P[i],p2=P[(i+1)%8];
   if(i===0||i===4){var mx=(p1[0]+p2[0])/2,my=(p1[1]+p2[1])/2,g=Math.min(.55,Math.abs(p2[0]-p1[0])*.28),dx=(p2[0]-p1[0])/Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),dy=(p2[1]-p1[1])/Math.hypot(p2[0]-p1[0],p2[1]-p1[1]);
    c.moveTo(p1[0],p1[1]);c.lineTo(mx-dx*g,my-dy*g);c.moveTo(mx+dx*g,my+dy*g);c.lineTo(p2[0],p2[1])}
   else{c.moveTo(p1[0],p1[1]);c.lineTo(p2[0],p2[1])}}
  c.stroke();
  c.lineWidth=lw*.6;c.strokeStyle='#5b6b78';c.setLineDash([lw*2,lw*2]);c.beginPath();P.forEach(function(p,j){j?c.lineTo(p[0]*.93,p[1]*.93):c.moveTo(p[0]*.93,p[1]*.93)});c.closePath();c.stroke();c.setLineDash([]);
  c.fillStyle='#22313d';P.forEach(function(p){c.beginPath();c.arc(p[0],p[1],Math.max(.07,cg*.012),0,TAU);c.fill()});
  c.lineWidth=lw*.7;c.strokeStyle='#5b6b78';c.beginPath();c.arc(0,0,cg*.18,0,TAU);c.stroke();return}
 /* ring: ropes square inset on the platform, coloured corner posts, steps at the neutral corners */
 var r=cg/2;c.fillStyle='#f4f5f6';c.fillRect(-r,-r,cg,cg);
 c.lineWidth=lw*1.6;c.strokeStyle='#c62828';c.strokeRect(-r,-r,cg,cg);
 c.lineWidth=lw*.7;c.strokeStyle='#1e57a8';c.strokeRect(-r*.97,-r*.97,cg*.97,cg*.97);
 var cols=['#c62828','#ffffff','#1e57a8','#ffffff'],cs=[[-r,-r],[r,-r],[r,r],[-r,r]],ps=Math.max(.12,cg*.03);
 cs.forEach(function(q,j){c.fillStyle=cols[j];c.lineWidth=lw;c.strokeStyle=INK;c.fillRect(q[0]-ps,q[1]-ps,2*ps,2*ps);c.strokeRect(q[0]-ps,q[1]-ps,2*ps,2*ps)});
 c.fillStyle='#8a97a1';c.lineWidth=lw*.8;c.strokeStyle=INK;var st=Math.min(.9,(hx-r)*1.2);
 [[r,-r],[-r,r]].forEach(function(q){var sx=q[0]>0?q[0]+(hx-r)*.1:q[0]-(hx-r)*.1-st;c.fillRect(sx,q[1]-st/2,st,st);c.strokeRect(sx,q[1]-st/2,st,st)})}
