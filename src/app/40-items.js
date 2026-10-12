/* ---------- items ---------- */
var FRSH={stage:1,screen:1,stall:1,stand:1,tent:1,wc:1},FRKEY={bar:1,foh:1,regdesk:1,faid:1,joc:1,toilet:1,toilet_wb:1,trailer_abl:1,trailer_acc:1,storage:1};
var SIDEANG={n:-90,e:0,s:90,w:180};
function frontSide(o){if(o.fr!==undefined)return o.fr;var L=LIBM[o.k]||{};return (FRSH[L.s]||FRKEY[o.k])?'s':'none'}
function drawFront(c,o,L,w,h,lw){
 if(S.meta.showFront===false)return;var f=frontSide(o);if(!f||f==='none')return;
 c.save();c.strokeStyle='#e8590c';c.lineWidth=Math.min(lw*3.2,Math.min(w,h)*.25);c.lineCap='butt';c.beginPath();
 if(f==='s'){c.moveTo(-w/2,h/2);c.lineTo(w/2,h/2)}else if(f==='n'){c.moveTo(-w/2,-h/2);c.lineTo(w/2,-h/2)}else if(f==='e'){c.moveTo(w/2,-h/2);c.lineTo(w/2,h/2)}else{c.moveTo(-w/2,-h/2);c.lineTo(-w/2,h/2)}
 c.stroke();c.restore()}
/* box truss: drawn to scale (tw = truss width in metres), double rails + zig-zag bracing + corner/joint towers */
/* stanchions / rope-and-pole barriers: posts at every corner and at a set spacing, rope or belt hung between them (open, never a wall) */
var ROPEK={
 stanchion:{post:'#aab4bc',edge:'#2b3540',rope:'#b42318',sp:2,sag:0,rw:2.2,pr:1},
 velvet:{post:'#c9a227',edge:'#6b5410',rope:'#8e1b2d',sp:2,sag:0,rw:3.4,pr:1.15},
 belt:{post:'#22313d',edge:'#0b1218',rope:'#1c3a5e',sp:2.2,sag:0,rw:2.6,pr:1},
 ropepole:{post:'#8a5a2b',edge:'#4a2f14',rope:'#d9c9a0',sp:2.5,sag:0,rw:2.4,pr:.9}};
function ropePoles(c,pts,st,o){
 var K=ROPEK[st]||ROPEK.stanchion,sp=o.sp>0?+o.sp:K.sp,rope=o.col||K.rope,wt=o.wt||1,i,j,posts=[],segs=[];
 for(i=0;i<pts.length-1;i++){var a=pts[i],b=pts[i+1],L=Math.hypot(b.x-a.x,b.y-a.y);if(L<1e-6)continue;var n=Math.max(1,Math.round(L/sp));
  segs.push({a:a,b:b,n:n,L:L});for(j=(i===0?0:1);j<=n;j++)posts.push({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n})}
 c.save();c.lineCap='round';c.lineJoin='round';
 c.strokeStyle=rope;c.lineWidth=Math.max(px(K.rw*wt),.025);
 segs.forEach(function(s){var dx=(s.b.x-s.a.x)/s.L,dy=(s.b.y-s.a.y)/s.L,nx=-dy,ny=dx,step=s.L/s.n;
  for(var k=0;k<s.n;k++){var p0={x:s.a.x+dx*step*k,y:s.a.y+dy*step*k},p1={x:p0.x+dx*step,y:p0.y+dy*step},sg=Math.min(K.sag*step,step*.18);
   c.beginPath();c.moveTo(p0.x,p0.y);if(sg>0)c.quadraticCurveTo((p0.x+p1.x)/2+nx*sg,(p0.y+p1.y)/2+ny*sg,p1.x,p1.y);else c.lineTo(p1.x,p1.y);c.stroke()}});
 var pr=Math.max(px(2.8*K.pr),.07*K.pr);c.fillStyle=K.post;c.strokeStyle=K.edge;c.lineWidth=Math.max(px(.9),.01);
 posts.forEach(function(q){c.beginPath();c.arc(q.x,q.y,pr,0,TAU);c.fill();c.stroke();c.fillStyle=K.edge;c.beginPath();c.arc(q.x,q.y,pr*.38,0,TAU);c.fill();c.fillStyle=K.post});
 c.restore();return posts.length}
function trussDraw(c,pts,tw,ink,legs){
 var W0=Math.max(tw,px(4)),ed=px(1.1),Wi=Math.max(W0-2*ed,px(.5)),hw=(W0-2*ed)/2,i,n=pts.length;
 c.save();c.setLineDash([]);c.lineJoin='miter';c.lineCap='butt';
 c.strokeStyle=ink;c.lineWidth=W0;c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(i=1;i<n;i++)c.lineTo(pts[i].x,pts[i].y);c.stroke();
 c.strokeStyle='#fff';c.lineWidth=Wi;c.stroke();
 c.strokeStyle=ink;c.lineWidth=px(.7);c.beginPath();
 for(i=0;i<n-1;i++){var a=pts[i],b=pts[i+1],l=Math.hypot(b.x-a.x,b.y-a.y);if(l<1e-6)continue;var ux=(b.x-a.x)/l,uy=(b.y-a.y)/l,nx=-uy,ny=ux,sp=Math.max(W0,px(5)),cnt=Math.min(3000,Math.max(1,Math.round(l/sp))),st=l/cnt;
  for(var j=0;j<cnt;j++){var d0=j*st,d1=(j+1)*st,sg=j%2?1:-1;c.moveTo(a.x+ux*d0+nx*hw*sg,a.y+uy*d0+ny*hw*sg);c.lineTo(a.x+ux*d1-nx*hw*sg,a.y+uy*d1-ny*hw*sg)}}
 c.stroke();
 if(legs!==false){var S2=Math.max(tw*1.7,px(7)),h2=S2/2,seen={};
  for(i=0;i<n;i++){var k=Math.round(pts[i].x*1000)+','+Math.round(pts[i].y*1000);if(seen[k])continue;seen[k]=1;var q=pts[i];
   c.fillStyle='#d7dde2';c.strokeStyle=ink;c.lineWidth=px(1.2);c.fillRect(q.x-h2,q.y-h2,S2,S2);c.strokeRect(q.x-h2,q.y-h2,S2,S2);
   c.lineWidth=px(.7);c.beginPath();c.moveTo(q.x-h2,q.y-h2);c.lineTo(q.x+h2,q.y+h2);c.moveTo(q.x+h2,q.y-h2);c.lineTo(q.x-h2,q.y+h2);c.stroke()}}
 c.restore()}
function drawItem(c,o,ic){
 var L=LIBM[o.k]||{s:'plain'},w=o.w,h=o.h,s=L.s,lw=px(1.3*(o.sw||1)),i,m=Math.min(w,h);
 c.lineWidth=lw;c.strokeStyle=INK;c.lineJoin='round';
 function bx(fill){c.fillStyle=o.fc||fill;c.beginPath();c.rect(-w/2,-h/2,w,h);c.fill();c.stroke()}
 if(s==='table'){var bh=h*.17,g=h*.11,th=h-2*(bh+g);c.fillStyle='#b99d7a';c.fillRect(-w/2,-h/2,w,bh);c.strokeRect(-w/2,-h/2,w,bh);c.fillRect(-w/2,h/2-bh,w,bh);c.strokeRect(-w/2,h/2-bh,w,bh);c.fillStyle='#e0cfb4';c.fillRect(-w/2,-th/2,w,th);c.strokeRect(-w/2,-th/2,w,th)}
 else if(s==='round'){var r=m/2,n=L.seats||10,ring=r*.82,cr=r*.14;c.fillStyle='#b99d7a';for(i=0;i<n;i++){var a=i/n*TAU;c.beginPath();c.arc(Math.cos(a)*ring,Math.sin(a)*ring,cr,0,TAU);c.fill();c.stroke()}c.fillStyle='#e0cfb4';c.beginPath();c.arc(0,0,r*.62,0,TAU);c.fill();c.stroke()}
 else if(s==='cocktail'){var r2=m/2;c.fillStyle='#e0cfb4';c.beginPath();c.arc(0,0,r2,0,TAU);c.fill();c.stroke();c.lineWidth=lw*.6;c.beginPath();c.moveTo(-r2*.5,0);c.lineTo(r2*.5,0);c.moveTo(0,-r2*.5);c.lineTo(0,r2*.5);c.stroke()}
 else if(s==='umbrella'){var r3=m/2;c.fillStyle='rgba(247,226,170,.88)';c.beginPath();c.arc(0,0,r3,0,TAU);c.fill();c.stroke();c.lineWidth=lw*.6;c.beginPath();for(i=0;i<8;i++){var a2=i/8*TAU;c.moveTo(0,0);c.lineTo(Math.cos(a2)*r3,Math.sin(a2)*r3)}c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(0,0,Math.max(r3*.08,px(1.5)),0,TAU);c.fill();c.stroke()}
 else if(s==='truss'){var tw=Math.min(.3,m/2),lp;if(m<=.5){lp=[{x:-w/2+tw/2,y:0},{x:w/2-tw/2,y:0}]}else{var ix=w/2-tw/2,iy=h/2-tw/2;lp=[{x:-ix,y:-iy},{x:ix,y:-iy},{x:ix,y:iy},{x:-ix,y:iy},{x:-ix,y:-iy}]}trussDraw(c,lp,tw,o.fc?o.fc:INK,o.legs!==false)}
 else if(s==='boom'||s==='sgate'||s==='stairs'){siteItem(c,o,L,s,w,h,lw)}
 else if(s==='octagon'||s==='ring'||s==='rstage'){arenaItem(c,o,L,s,w,h,lw)}
 else if(s==='ropebox'){var rk=L.rp||'velvet',hx=w/2,hy=h/2,gp=Math.min(1.2,w*.3),rpts=[{x:-gp/2,y:hy},{x:-hx,y:hy},{x:-hx,y:-hy},{x:hx,y:-hy},{x:hx,y:hy},{x:gp/2,y:hy}];c.fillStyle=o.fc||'rgba(255,248,225,.55)';c.fillRect(-hx,-hy,w,h);ropePoles(c,rpts,rk,{});
 }
 else if(s==='tent'){bx('#fbfaf5');var q=m*.05;c.lineWidth=lw*.6;c.strokeRect(-w/2+q,-h/2+q,w-2*q,h-2*q);c.strokeStyle='#8a97a1';c.beginPath();c.moveTo(-w/2,-h/2);c.lineTo(w/2,h/2);c.moveTo(w/2,-h/2);c.lineTo(-w/2,h/2);c.stroke()}
 else if(s==='gazebo'){bx('#f6f3ea');var gb=Math.max(1,Math.round(Math.max(w,h)/m)),bw=w>=h?w/gb:w,bh2=w>=h?h:h/gb,gq=m*.05;c.lineWidth=lw*.6;c.strokeStyle='#8a97a1';c.beginPath();for(i=0;i<gb;i++){var bx0=w>=h?-w/2+i*bw:-w/2,by0=w>=h?-h/2:-h/2+i*bh2;c.moveTo(bx0,by0);c.lineTo(bx0+bw,by0+bh2);c.moveTo(bx0+bw,by0);c.lineTo(bx0,by0+bh2)}c.stroke();c.strokeStyle=INK;c.lineWidth=lw*.8;c.strokeRect(-w/2+gq,-h/2+gq,w-2*gq,h-2*gq);c.fillStyle=INK;var gr=Math.max(m*.04,px(1.8));for(i=0;i<=gb;i++)for(var j=0;j<2;j++){var gx=w>=h?-w/2+i*bw:-w/2+j*w,gy=w>=h?-h/2+j*h:-h/2+i*bh2;c.fillRect(gx-gr,gy-gr,2*gr,2*gr)}}
 else if(s==='bedouin'){bx('#f0e2c4');var q2=m*.1;c.lineWidth=lw*.7;c.setLineDash([px(6),px(4)]);c.strokeRect(-w/2+q2,-h/2+q2,w-2*q2,h-2*q2);c.setLineDash([]);c.fillStyle=INK;[[-1,-1],[1,-1],[1,1],[-1,1],[0,0]].forEach(function(p){c.beginPath();c.arc(p[0]*(w/2-q2),p[1]*(h/2-q2),Math.max(m*.022,px(1.6)),0,TAU);c.fill()})}
 else if(s==='snow'){bx('#e8f0e0');c.strokeStyle='#8a97a1';c.lineWidth=lw*.6;c.beginPath();c.moveTo(-w/2,-h/2);c.lineTo(w/2,h/2);c.moveTo(w/2,-h/2);c.lineTo(-w/2,h/2);c.stroke();c.strokeStyle=INK;c.lineWidth=lw;c.beginPath();c.arc(0,0,m*.12,0,TAU);c.fillStyle='#fff';c.fill();c.stroke()}
 else if(s==='stage'){bx('#34424e');c.save();c.beginPath();c.rect(-w/2,-h/2,w,h);c.clip();c.strokeStyle='rgba(255,255,255,.14)';c.lineWidth=lw*.8;var st=px(9);c.beginPath();for(var x=-w/2-h;x<w/2+h;x+=st){c.moveTo(x,h/2);c.lineTo(x+h,-h/2)}c.stroke();c.restore()}
 else if(s==='netting'){var nd=L.dk;c.fillStyle=o.fc||(nd?'rgba(30,30,30,.22)':'rgba(120,170,120,.18)');c.beginPath();c.rect(-w/2,-h/2,w,h);c.fill();c.save();c.beginPath();c.rect(-w/2,-h/2,w,h);c.clip();c.strokeStyle=nd?'rgba(20,20,20,.6)':'rgba(60,120,70,.55)';c.lineWidth=lw*.5;var ns=px(6);c.beginPath();for(var nxx=-w/2-h;nxx<w/2+h;nxx+=ns){c.moveTo(nxx,h/2);c.lineTo(nxx+h,-h/2);c.moveTo(nxx,-h/2);c.lineTo(nxx+h,h/2)}c.stroke();c.restore();c.strokeStyle=nd?'#222':'#4f7f58';c.lineWidth=lw*.9;c.setLineDash([px(7),px(3)]);c.strokeRect(-w/2,-h/2,w,h);c.setLineDash([])}
 else if(s==='cover'){c.fillStyle=o.fc||'#ffffff';c.fillRect(-w/2,-h/2,w,h);if(R.u===1){c.save();c.strokeStyle='rgba(120,130,140,.7)';c.lineWidth=px(1);c.setLineDash([px(5),px(4)]);c.strokeRect(-w/2,-h/2,w,h);c.restore()}}
 else if(s==='screen'){c.fillStyle='#111';c.beginPath();c.rect(-w/2,-h/2,w,h);c.fill();c.stroke()}
 else if(s==='stall'){bx('#fde8d2');c.lineWidth=lw*.7;c.beginPath();c.moveTo(-w/2,h*.22);c.lineTo(w/2,h*.22);c.stroke()}
 else if(s==='wc'){bx('#d6e6f4');if(!ic&&!o.label&&m*R.z/R.u>16)txt(c,'WC',0,0,Math.min(11,m*R.z/R.u*.5),{halo:false,col:'#12202b',rot:-o.rot*D2R})}
 else if(s==='vehicle'){c.fillStyle='#f6f6f6';rr(c,-w/2,-h/2,w,h,m*.14);c.fill();c.stroke();c.fillStyle='#c9d6df';c.fillRect(w*.18,-h/2+m*.1,w*.16,h-m*.2);c.strokeRect(w*.18,-h/2+m*.1,w*.16,h-m*.2)}
 else if(s==='stand'){bx('#f6f9fd');var q3=Math.min(m*.06,.25);c.lineWidth=lw*.6;c.strokeStyle='#7d93a8';c.setLineDash([px(5),px(3)]);c.strokeRect(-w/2+q3,-h/2+q3,w-2*q3,h-2*q3);c.setLineDash([])}
 else if(s==='column'){bx('#44525e');c.strokeStyle='#fff';c.lineWidth=lw*.8;c.beginPath();c.moveTo(-w/2,-h/2);c.lineTo(w/2,h/2);c.moveTo(w/2,-h/2);c.lineTo(-w/2,h/2);c.stroke()}
 else if(s==='deck'){c.fillStyle=o.fc||'#d8c19b';c.beginPath();c.rect(-w/2,-h/2,w,h);c.fill();
  if(1.22>px(3)){c.save();c.beginPath();c.rect(-w/2,-h/2,w,h);c.clip();c.strokeStyle='rgba(120,90,50,.55)';c.lineWidth=lw*.45;c.beginPath();var dx;for(dx=-w/2+1.22;dx<w/2-.01;dx+=1.22){c.moveTo(dx,-h/2);c.lineTo(dx,h/2)}for(dx=-h/2+1.22;dx<h/2-.01;dx+=1.22){c.moveTo(-w/2,dx);c.lineTo(w/2,dx)}c.stroke();c.restore()}
  c.strokeStyle='#5c4524';c.lineWidth=lw*1.1;c.strokeRect(-w/2,-h/2,w,h)}
 else if(s==='dome'){c.fillStyle=o.fc||'rgba(251,250,245,.62)';c.beginPath();c.rect(-w/2,-h/2,w,h);c.fill();c.stroke();
  c.strokeStyle='#8a97a1';c.lineWidth=lw*.7;c.beginPath();c.moveTo(-w/2,-h/2);c.lineTo(w/2,h/2);c.moveTo(w/2,-h/2);c.lineTo(-w/2,h/2);c.stroke();
  c.setLineDash([px(6),px(4)]);c.beginPath();c.arc(0,0,m/2*.96,0,TAU);c.stroke();c.setLineDash([]);
  c.fillStyle='#fff';c.strokeStyle=INK;c.lineWidth=lw;c.beginPath();c.arc(0,0,Math.max(m*.05,px(2)),0,TAU);c.fill();c.stroke();
  c.fillStyle=INK;var fs=Math.max(m*.03,px(2));[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(p){c.fillRect(p[0]*w/2-fs*(p[0]>0?1:0),p[1]*h/2-fs*(p[1]>0?1:0),fs,fs)})}
 else if(s==='wcwb'){var tw0=Math.min(h,w*.66);c.fillStyle='#d6e6f4';c.beginPath();c.rect(-w/2,-h/2,tw0,h);c.fill();c.stroke();c.fillStyle='#eef3f7';c.beginPath();c.rect(-w/2+tw0,-h/2,w-tw0,h);c.fill();c.stroke();
  var bc=-w/2+tw0+(w-tw0)/2,bm=Math.min(w-tw0,h)*.34;c.fillStyle='#fff';c.lineWidth=lw*.7;c.beginPath();c.ellipse(bc,h*.05,bm*.95,bm*.7,0,0,TAU);c.fill();c.stroke();c.fillStyle=INK;c.beginPath();c.arc(bc,-h/2+h*.14,Math.max(bm*.12,px(1.2)),0,TAU);c.fill();
  if(!ic&&!o.label&&tw0*R.z/R.u>16)txt(c,'WC',-w/2+tw0/2,0,Math.min(11,tw0*R.z/R.u*.5),{halo:false,col:'#12202b',rot:-o.rot*D2R})}
 else if(s==='basin'){bx('#eef3f7');var nb=Math.max(1,Math.round(w/.6)),bw=w/nb;c.lineWidth=lw*.7;for(i=0;i<nb;i++){var bc2=-w/2+bw*(i+.5);c.fillStyle='#fff';c.beginPath();c.ellipse(bc2,h*.06,bw*.34,h*.3,0,0,TAU);c.fill();c.stroke();c.fillStyle=INK;c.beginPath();c.arc(bc2,-h/2+h*.14,Math.max(Math.min(bw,h)*.06,px(1)),0,TAU);c.fill()}}
 else if(s==='urinal'){var ru=m/2,nu=L.seats||4;c.fillStyle='#d6e6f4';c.beginPath();c.arc(0,0,ru*.62,0,TAU);c.fill();c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(0,0,ru*.28,0,TAU);c.fill();c.lineWidth=lw*.7;c.stroke();
  c.fillStyle='#b9d0e6';for(i=0;i<nu;i++){var au=i/nu*TAU-Math.PI/2;c.save();c.translate(Math.cos(au)*ru*.74,Math.sin(au)*ru*.74);c.rotate(au);c.beginPath();c.rect(-ru*.12,-ru*.16,ru*.24,ru*.32);c.fill();c.stroke();c.restore()}
  c.setLineDash([px(4),px(3)]);c.lineWidth=lw*.5;c.beginPath();c.arc(0,0,ru,0,TAU);c.stroke();c.setLineDash([])}
 else if(s==='abltrailer'){bx('#e9eef2');var nc=L.cub||0;c.lineWidth=lw*.7;
  if(L.acc){var aw=w*.5;c.beginPath();c.moveTo(-w/2+aw,-h/2);c.lineTo(-w/2+aw,h/2);c.stroke();
   var im2=SIGIMG.disabled,isz=Math.min(aw,h)*.4;if(im2&&im2.complete&&im2.naturalWidth)c.drawImage(im2,-w/2+aw/2-isz/2,-h/2+h*.12,isz,isz);
   c.fillStyle='#d6e6f4';c.beginPath();c.rect(-w/2+aw*.62,h*.18,aw*.3,h*.28);c.fill();c.stroke();c.fillStyle='#fff';c.beginPath();c.ellipse(-w/2+aw*.18,h*.28,aw*.1,h*.1,0,0,TAU);c.fill();c.stroke();
   var rem=w-aw,n2=2,cw2=rem/n2;for(i=0;i<n2;i++){var x0=-w/2+aw+i*cw2;if(i>0){c.beginPath();c.moveTo(x0,-h/2);c.lineTo(x0,h/2);c.stroke()}c.fillStyle='#d6e6f4';c.beginPath();c.rect(x0+cw2*.3,-h/2+h*.1,cw2*.4,h*.3);c.fill();c.stroke()}}
  else{var cw=w/nc;for(i=0;i<nc;i++){var x1=-w/2+i*cw;if(i>0){c.beginPath();c.moveTo(x1,-h/2);c.lineTo(x1,h/2);c.stroke()}c.fillStyle='#d6e6f4';c.beginPath();c.rect(x1+cw*.3,-h/2+h*.1,cw*.4,h*.3);c.fill();c.stroke()}}
  c.strokeStyle='#7d93a8';c.lineWidth=lw*.5;c.setLineDash([px(4),px(3)]);c.beginPath();c.moveTo(-w/2,h*.2);c.lineTo(w/2,h*.2);c.stroke();c.setLineDash([])}
 else if(s==='img'){var im=L.im;if(im&&im.complete){c.drawImage(im,-w/2,-h/2,w,h)}else{bx('#eee')}}
 else{bx(L.f||'#e6ebef')}
 drawFront(c,o,L,w,h,lw);
 var lab=o.label;
 if(s==='stand'&&!ic)standLabels(c,o,w,h);
 else if(!ic&&lab){labelBox(c,o,lab,w,h,{dark:(s==='stage'||s==='screen'),max:16}); }
}
function areaPath(c,o){c.beginPath();if(o.sh==='ellipse')c.ellipse(0,0,o.w/2,o.h/2,0,0,TAU);else c.rect(-o.w/2,-o.h/2,o.w,o.h)}
function areaSqm(o){return o.sh==='ellipse'?Math.PI*o.w*o.h/4:o.w*o.h}
function drawArea(c,o,ic){
 var col=o.col||'#5b6770',w=o.w,h=o.h,ell=o.sh==='ellipse';
 c.save();c.translate(o.x,o.y);c.rotate(o.rot*D2R);
 c.fillStyle=hexA(col,o.fo==null?.12:o.fo);areaPath(c,o);c.fill();
 c.strokeStyle=col;c.lineWidth=px(2.2*(o.sw||1));c.lineJoin='miter';areaPath(c,o);c.stroke();
 if(!ell){c.strokeStyle=hexA(col,.55);c.lineWidth=px(.9);var q=px(4);if(w>q*6&&h>q*6)c.strokeRect(-w/2+q,-h/2+q,w-2*q,h-2*q)}
 if(!ic&&o.label){
  var k=ell?.72:1,sub=fmt(w)+' × '+fmt(h)+' m  ·  '+Math.round(areaSqm(o)).toLocaleString('en-ZA')+' m²';
  labelBox(c,o,o.label,w*k,h*k,{sub:o.nodim?null:sub,max:16});
 }
 c.restore();
 if(!ic&&!o.nodim){var K=corners(o);dimLine(c,K[0],K[1],-15);dimLine(c,K[3],K[0],-15)}
}
function drawPoly(c,o,ic){
 var P=o.pts;if(!P||P.length<2)return;var col=o.col||'#5b6770',i;
 c.save();c.beginPath();c.moveTo(P[0].x,P[0].y);for(i=1;i<P.length;i++)c.lineTo(P[i].x,P[i].y);c.closePath();
 c.fillStyle=hexA(col,o.fo==null?.12:o.fo);c.fill();c.strokeStyle=col;c.lineWidth=px(2.2*(o.sw||1));c.lineJoin='miter';c.stroke();c.restore();
 if(P.length<3||ic)return;
 var sgn=polyArea(P)>0?-1:1,best=-1,bi=0;
 if(!o.nodim){for(i=0;i<P.length;i++){var a=P[i],b=P[(i+1)%P.length],l=Math.hypot(b.x-a.x,b.y-a.y);if(l*R.z/R.u>46)dimLine(c,a,b,15*sgn)}}
 for(i=0;i<P.length;i++){var a2=P[i],b2=P[(i+1)%P.length],l2=Math.hypot(b2.x-a2.x,b2.y-a2.y);if(l2>best){best=l2;bi=i}}
 if(o.label){
  var A=Math.abs(polyArea(P)),cen=polyCentroid(P),e1=P[bi],e2=P[(bi+1)%P.length],ang=Math.atan2(e2.y-e1.y,e2.x-e1.x),ch=chordThrough(P,cen.x,cen.y,ang);
  if(ch>0){c.save();c.translate(cen.x,cen.y);c.rotate(ang);
   labelBox(c,{rot:ang/D2R,lm:o.lm,ls:o.ls,lc:o.lc},o.label,ch*.94,Math.max(.1,A/ch)*.94,{sub:o.nodim?null:Math.round(A).toLocaleString('en-ZA')+' m²',max:16});c.restore()}
 }
}
function drawDoor(c,o,ic){
 var d=DOORM[o.k]||DOORM.exit,col=o.col||d.col,w=o.w,h=o.th||.6;
 c.save();c.translate(o.x,o.y);c.rotate(o.rot*D2R);
 c.fillStyle='#fff';c.fillRect(-w/2,-h/2,w,h);c.fillStyle=hexA(col,.2);c.fillRect(-w/2,-h/2,w,h);
 c.strokeStyle=col;c.lineWidth=px(2.4);c.beginPath();c.moveTo(-w/2,-h/2);c.lineTo(-w/2,h/2);c.moveTo(w/2,-h/2);c.lineTo(w/2,h/2);c.stroke();
 c.lineWidth=px(1);c.setLineDash([px(5),px(3)]);c.beginPath();c.moveTo(-w/2,0);c.lineTo(w/2,0);c.stroke();c.setLineDash([]);
 var as=Math.min(w*.3,Math.max(px(12),1.1));c.fillStyle=col;c.beginPath();c.moveTo(0,h/2+as*1.25);c.lineTo(-as*.55,h/2+as*.1);c.lineTo(as*.55,h/2+as*.1);c.closePath();c.fill();
 if(!ic&&o.lm!=='off'){var av=w*R.z/R.u,rot=(o.rot||0)*D2R,rel=(o.lm==='up')?-rot:normAng(rot)-rot,lbl=o.label||d.lab,sz=+o.ls>0?+o.ls:11;
  if(av>26||+o.ls>0){if(!(+o.ls>0))while(sz>7&&tw(c,lbl,sz,true)>av*1.5)sz--;
   var ca=Math.cos(rel),sa=Math.sin(rel),gy=-(h/2+px(sz+3)),gy2=gy-px(sz+2);
   txt(c,lbl,0,gy,sz,{col:o.lc||col,bold:true,rot:rel});txt(c,fm(w),0,gy2,Math.max(7,sz-1),{col:'#33444f',rot:rel})}}
 c.restore();
}
function drawLineObj0(c,o,ic){
 var P=o.pts;if(!P||P.length<2)return;var st=o.style||'fence',sdef='#2e7d32';if(st==='shadeb'){st='shade';sdef='#1b1b1b'}
 if(st==='truss'){trussDraw(c,o.closed?P.concat([P[0]]):P,o.tw>0?+o.tw:.3,o.col||INK,o.legs!==false);return}
 if(ROPEK[st]){ropePoles(c,o.closed?P.concat([P[0]]):P,st,o);return}
 c.save();c.lineJoin='round';c.lineCap='butt';
 var pts=o.closed?P.concat([P[0]]):P,wt=o.wt||1;
 if(st==='barrier'){c.strokeStyle=o.col||'#e8590c';c.lineWidth=px(3.6*wt);c.setLineDash([px(9),px(4)])}
 else if(st==='wall'){c.strokeStyle=o.col||INK;c.lineWidth=px(4*wt)}
 else if(st==='tape'){c.strokeStyle=o.col||'#b42318';c.lineWidth=px(2*wt);c.setLineDash([px(2),px(4)])}
 else if(st==='drape'){c.strokeStyle=o.col||'#141414';c.lineWidth=px(5*wt);c.lineCap='butt'}
 else if(st==='shade'){c.strokeStyle=hexA(o.col||sdef,.32);c.lineWidth=px(9*wt)}
 else if(st==='plain'){c.strokeStyle=o.col||'#000';c.lineWidth=px(1.6*wt)}
 else if(st==='thin'){c.strokeStyle=o.col||'#000';c.lineWidth=px(.6*wt)}
 else if(st==='brick'){c.strokeStyle=o.col||INK;c.lineWidth=px(5.2*wt);c.lineJoin='miter';c.lineCap='square'}
 else if(st==='shell'){c.strokeStyle=o.col||INK;c.lineWidth=px(3.4*wt);c.lineJoin='miter';c.lineCap='butt'}
 else if(st==='evac'){c.strokeStyle=o.col||EVC;c.lineWidth=px(3*wt);c.lineCap='round';if(o.alt)c.setLineDash([px(9),px(6)])}
 else{c.strokeStyle=o.col||INK;c.lineWidth=px(1.4*wt)}
 c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(var i=1;i<pts.length;i++)c.lineTo(pts[i].x,pts[i].y);c.stroke();c.setLineDash([]);
 if(st==='evac')evArrows(c,pts,o.col||EVC);
 if(st==='brick'||st==='shell'){
  var bk=st==='brick',W0=px((bk?5.2:3.4)*wt),ed=px(bk?1.1:.9),ink=o.col||INK,Wi=Math.max(W0-2*ed,px(.5)),hw2=Wi/2;
  c.setLineDash([]);c.strokeStyle='#fff';c.lineWidth=Wi;c.lineCap='butt';c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(var bi=1;bi<pts.length;bi++)c.lineTo(pts[bi].x,pts[bi].y);c.stroke();
  c.strokeStyle=ink;c.lineWidth=px(.8);c.beginPath();
  for(bi=0;bi<pts.length-1;bi++){var ba=pts[bi],bb2=pts[bi+1],bl=Math.hypot(bb2.x-ba.x,bb2.y-ba.y);if(bl<1e-6)continue;var ux=(bb2.x-ba.x)/bl,uy=(bb2.y-ba.y)/bl,nx=-uy,ny=ux;
   var gap=bk?px(4.5):1,cnt=Math.floor(bl/gap);if(!bk&&gap<px(4))cnt=0;if(bk&&cnt>4000)cnt=4000;
   for(var bj=(bk?0:1);bj<=cnt;bj++){var d0=bk?bj*gap+gap*.5:bj*gap;if(d0>=bl-1e-6)break;var qx=ba.x+ux*d0,qy=ba.y+uy*d0;
    if(bk){c.moveTo(qx-nx*hw2,qy-ny*hw2);c.lineTo(qx+nx*hw2+ux*hw2*1.6,qy+ny*hw2+uy*hw2*1.6)}
    else{c.moveTo(qx-nx*hw2,qy-ny*hw2);c.lineTo(qx+nx*hw2,qy+ny*hw2)}}}
  c.stroke();
 }
 if(st==='drape'){var hw3=px(2.1*wt),dg=px(3.4);c.strokeStyle='rgba(255,255,255,.38)';c.lineWidth=px(.8);c.beginPath();for(i=0;i<pts.length-1;i++){var da=pts[i],db=pts[i+1],dl=Math.hypot(db.x-da.x,db.y-da.y);if(dl<1e-6)continue;var ux3=(db.x-da.x)/dl,uy3=(db.y-da.y)/dl,cn=Math.min(4000,Math.floor(dl/dg));for(var qq=1;qq<=cn;qq++){var dp={x:da.x+ux3*qq*dg,y:da.y+uy3*qq*dg},wob=(qq%2?1:.55)*hw3;c.moveTo(dp.x-uy3*wob,dp.y+ux3*wob);c.lineTo(dp.x+uy3*wob,dp.y-ux3*wob)}}c.stroke()}
 if(st==='shade'){var sc=o.col||sdef;c.strokeStyle=sc;c.lineWidth=px(2*wt);c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(i=1;i<pts.length;i++)c.lineTo(pts[i].x,pts[i].y);c.stroke();
  c.lineWidth=px(1*wt);for(i=0;i<pts.length-1;i++){var sa=pts[i],sb=pts[i+1],sl=Math.hypot(sb.x-sa.x,sb.y-sa.y);if(sl<1e-6)continue;var sx=(sb.x-sa.x)/sl,sy=(sb.y-sa.y)/sl,st2=px(9),sn=Math.max(1,Math.floor(sl/st2)),th=px(4.5);c.beginPath();for(var q=0;q<=sn;q++){var pp={x:sa.x+sx*sl*q/sn,y:sa.y+sy*sl*q/sn};c.moveTo(pp.x-sy*th,pp.y+sx*th);c.lineTo(pp.x+sy*th,pp.y-sx*th)}c.stroke()}}
 if(st==='fence'){c.lineWidth=px(1.2*wt);var gap=px(14);
  for(i=0;i<pts.length-1;i++){var a=pts[i],b=pts[i+1],l=Math.hypot(b.x-a.x,b.y-a.y);if(l<1e-6)continue;var ux=(b.x-a.x)/l,uy=(b.y-a.y)/l,t=px(7);
   var n=Math.max(1,Math.floor(l/gap));c.beginPath();for(var j=0;j<=n;j++){var p={x:a.x+ux*(l*j/n),y:a.y+uy*(l*j/n)};c.moveTo(p.x-uy*t*.5-ux*t*.5,p.y+ux*t*.5-uy*t*.5);c.lineTo(p.x+uy*t*.5+ux*t*.5,p.y-ux*t*.5+uy*t*.5);c.moveTo(p.x-uy*t*.5+ux*t*.5,p.y+ux*t*.5+uy*t*.5);c.lineTo(p.x+uy*t*.5-ux*t*.5,p.y-ux*t*.5-uy*t*.5)}c.stroke()}}
 c.restore();
 if(o.label&&!ic&&o.lm!=='off'){var bl=0,bi2=0,bb;for(i=0;i<pts.length-1;i++){bb=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y);if(bb>bl){bl=bb;bi2=i}}
  if(bl>0){var A2=pts[bi2],B2=pts[bi2+1],an=Math.atan2(B2.y-A2.y,B2.x-A2.x);if(o.lm==='up')an=0;else an=normAng(an);var sz3=+o.ls>0?+o.ls:11;if(!(+o.ls>0))while(sz3>7&&tw(c,o.label,sz3,true)>bl*R.z/R.u*.95)sz3--;
   if(+o.ls>0||tw(c,o.label,sz3,true)<=bl*R.z/R.u*.97){var up={x:Math.sin(an),y:-Math.cos(an)};txt(c,o.label,(A2.x+B2.x)/2+up.x*px(7),(A2.y+B2.y)/2+up.y*px(7),sz3,{rot:an,bold:true,col:o.lc||'#12202b'})}}}
}

