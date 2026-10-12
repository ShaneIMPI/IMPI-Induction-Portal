/* ---------- main render ---------- */
var raf=0;
function draw(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;_draw()})}
function gridStep(){var z=S.view.z,steps=[.01,.05,.1,.25,.5,1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,50000],i=0;while(i<steps.length-1&&steps[i]*z<14)i++;return steps[i]}
function _draw(){
 var W=cv.clientWidth,H=cv.clientHeight;ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='#e9edec';ctx.fillRect(0,0,W,H);
 var hasBase=S.layers.some(function(l){return l.vis});
 var g=gridStep(),z=S.view.z,x0=-S.view.x/z,y0=-S.view.y/z,x1=(W-S.view.x)/z,y1=(H-S.view.y)/z;
 if(!hasBase){ctx.fillStyle='#f7f9f9';ctx.fillRect(0,0,W,H)}
 ctx.lineWidth=1;var i,a;
 var major=g*5;
 for(i=Math.floor(x0/g);i<=x1/g;i++){a=i*g;var sx=Math.round(a*z+S.view.x)+.5;ctx.strokeStyle=(Math.abs(a/major-Math.round(a/major))<1e-6)?'rgba(40,70,95,.28)':'rgba(40,70,95,.12)';ctx.beginPath();ctx.moveTo(sx,0);ctx.lineTo(sx,H);ctx.stroke()}
 for(i=Math.floor(y0/g);i<=y1/g;i++){a=i*g;var sy=Math.round(a*z+S.view.y)+.5;ctx.strokeStyle=(Math.abs(a/major-Math.round(a/major))<1e-6)?'rgba(40,70,95,.28)':'rgba(40,70,95,.12)';ctx.beginPath();ctx.moveTo(0,sy);ctx.lineTo(W,sy);ctx.stroke()}
 ctx.save();ctx.translate(S.view.x,S.view.y);ctx.scale(z,z);R={z:z,u:1};
 if(!S.meta.only)S.layers.forEach(function(L){drawLayer(ctx,L)});
 drawModuleGrid(ctx,viewBounds(),S.meta,'lines');drawObjs(ctx);drawTmp(ctx);drawModuleGrid(ctx,viewBounds(),S.meta,'labels');
 var ML=S.tool==='layermove'&&S.mv?layer(S.mv):null;if(ML){ctx.save();ctx.translate(ML.x,ML.y);ctx.rotate(ML.rot*D2R);ctx.strokeStyle='#e8590c';ctx.lineWidth=2/z;ctx.setLineDash([8/z,5/z]);ctx.strokeRect(0,0,ML.img.width*ML.mpp,ML.img.height*ML.mpp);ctx.restore()}
 ctx.restore();
 drawOverlay();
 var cs=g>=1?g+' m':Math.round(g*100)+' cm';
 $('#status').textContent='Grid '+cs+'  ·  '+(S.hover?('x '+S.hover.x.toFixed(2)+'  y '+S.hover.y.toFixed(2)+' m  ·  '):'')+'zoom '+Math.round(z*100)/100+' px/m';
}
function drawTmp(c){
 var t=S.tmp;if(!t)return;
 if(t.t==='area'){var o={t:'area',x:(t.a.x+t.b.x)/2,y:(t.a.y+t.b.y)/2,w:Math.abs(t.b.x-t.a.x),h:Math.abs(t.b.y-t.a.y),rot:0,col:'#e8590c',label:''};if(o.w>0&&o.h>0)drawArea(c,o)}
 else if(t.t==='dim'){dimLine(c,t.a,t.b,0,null,'#e8590c')}
 else if(t.t==='marq'){c.save();c.strokeStyle='#e8590c';c.fillStyle='rgba(232,89,12,.08)';c.lineWidth=px(1.4);c.setLineDash([px(6),px(4)]);c.fillRect(t.a.x,t.a.y,t.b.x-t.a.x,t.b.y-t.a.y);c.strokeRect(t.a.x,t.a.y,t.b.x-t.a.x,t.b.y-t.a.y);c.restore()}
 else if(t.t==='line'&&t.pts.length){var P=t.pts.slice();if(t.cur)P.push(t.cur);if(P.length>2&&t.poly)drawPoly(c,{pts:P,col:'#e8590c',nodim:true});else if(P.length>1)drawLineObj(c,{pts:P,style:t.style||'fence',gaps:tmpGaps(t,P),segl:S.perim?1:0});c.save();c.fillStyle='#e8590c';t.pts.forEach(function(p){c.beginPath();c.arc(p.x,p.y,px(4),0,TAU);c.fill()});
  if(t.cur){var L=0,Q=t.pts.concat([t.cur]);for(var i=0;i<Q.length-1;i++)L+=Math.hypot(Q[i+1].x-Q[i].x,Q[i+1].y-Q[i].y);var l=Q[Q.length-1];txt(c,fm(L),l.x,l.y-px(14),12,{col:'#e8590c',bold:true})}c.restore()}
}
var RS={nw:[-1,-1],n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0]};
function handlesFor(o){
 var H=[],d,z=S.view.z,k,i;
 if(o.t==='rect'||o.t==='area'){d=dimsOf(o);H.push({id:'rot',p:toWorld(o,0,-d.h/2-26/z),b:toWorld(o,0,-d.h/2)});
  ['nw','ne','se','sw','n','e','s','w'].forEach(function(id){k=RS[id];H.push({id:id,p:toWorld(o,k[0]*d.w/2,k[1]*d.h/2)})})}
 else if(o.t==='door'){d=dimsOf(o);H.push({id:'rot',p:toWorld(o,0,-d.h/2-26/z),b:toWorld(o,0,-d.h/2)});H.push({id:'e',p:toWorld(o,d.w/2,0)});H.push({id:'w',p:toWorld(o,-d.w/2,0)})}
 else if(o.t==='sign'){d=dimsOf(o);H.push({id:'rot',p:toWorld(o,0,-d.h/2-26/z),b:toWorld(o,0,-d.h/2)});H.push({id:'se',p:toWorld(o,d.w/2,d.h/2)})}
 else if(o.t==='dim'){var mx=(o.a.x+o.b.x)/2,my=(o.a.y+o.b.y)/2,L=Math.hypot(o.b.x-o.a.x,o.b.y-o.a.y)||1,nx=-(o.b.y-o.a.y)/L,ny=(o.b.x-o.a.x)/L,of=(o.off||0)/z;H.push({id:'p0',p:o.a});H.push({id:'p1',p:o.b});H.push({id:'off',p:{x:mx+nx*of,y:my+ny*of}})}
 else if(o.t==='line'||o.t==='poly'){o.pts.forEach(function(p,i){H.push({id:'v'+i,p:p})});var n=o.pts.length,cl=o.closed||o.t==='poly';for(i=0;i<(cl?n:n-1);i++){var a=o.pts[i],b=o.pts[(i+1)%n];H.push({id:'m'+i,p:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}})}}
 else if(o.t==='text'){var tb=textBox(o),r=(o.rot||0)*D2R,q1=rotv(0,-(tb.h/2+26)/z,r),q2=rotv((tb.w/2+12)/z,0,r),qb=rotv(0,-tb.h/2/z,r);H.push({id:'rot',p:{x:o.x+q1.x,y:o.y+q1.y},b:{x:o.x+qb.x,y:o.y+qb.y}});H.push({id:'ts',p:{x:o.x+q2.x,y:o.y+q2.y}})}
 return H;
}
function drawOverlay(){
 ctx.setTransform(DPR,0,0,DPR,0,0);
 var o=getSel(),i;
 drawLoupe();
 if(S.snapPt){var sp=w2s(S.snapPt);ctx.strokeStyle='#e8590c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sp.x,sp.y,7,0,TAU);ctx.stroke();if(S.snapJ){ctx.fillStyle='rgba(232,89,12,.4)';ctx.fill()}}
 if(S.calib){ctx.fillStyle='#e8590c';ctx.strokeStyle='#fff';ctx.lineWidth=2;S.calib.pts.forEach(function(p){var s=w2s(p);ctx.beginPath();ctx.arc(s.x,s.y,7,0,TAU);ctx.fill();ctx.stroke()});
  if(S.calib.pts.length===1&&S.hover){var a=w2s(S.calib.pts[0]),b=w2s(S.hover);ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([])}}
 if(S.issues&&S.issues.length){S.issues.forEach(function(it){var a=w2s(it.a),b=w2s(it.b);ctx.strokeStyle='#d32f2f';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#d32f2f';ctx.beginPath();ctx.arc(a.x,a.y,3.5,0,TAU);ctx.arc(b.x,b.y,3.5,0,TAU);ctx.fill();
  var mx=(a.x+b.x)/2,my=(a.y+b.y)/2,t=fm(it.d);ctx.font=fontStr(12,true);var w=ctx.measureText(t).width+10;ctx.fillStyle='#d32f2f';ctx.fillRect(mx-w/2,my-18,w,16);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,mx,my-10)})}
 var all=selObjs();
 if(all.length){
  ctx.strokeStyle='#e8590c';ctx.lineWidth=1.6;ctx.setLineDash([6,4]);
  all.forEach(function(q){var ol=selOutline(q);ctx.beginPath();ol.pts.forEach(function(p,i){var sp2=w2s(p);if(i)ctx.lineTo(sp2.x,sp2.y);else ctx.moveTo(sp2.x,sp2.y)});if(ol.closed)ctx.closePath();ctx.stroke()});
  ctx.setLineDash([]);
  if(all.length>1){var gb=null;all.forEach(function(q){var b=boundsOf(q);if(!gb)gb={x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y1};else{gb.x0=Math.min(gb.x0,b.x0);gb.y0=Math.min(gb.y0,b.y0);gb.x1=Math.max(gb.x1,b.x1);gb.y1=Math.max(gb.y1,b.y1)}});var g0=w2s({x:gb.x0,y:gb.y0}),g1=w2s({x:gb.x1,y:gb.y1});ctx.strokeStyle='#1c6bb0';ctx.lineWidth=1.2;ctx.strokeRect(g0.x-4,g0.y-4,g1.x-g0.x+8,g1.y-g0.y+8)}
  else if(!o.lk){
   handlesFor(o).forEach(function(h){var s=w2s(h.p);ctx.fillStyle='#fff';ctx.strokeStyle='#e8590c';ctx.lineWidth=2;ctx.beginPath();
    if(h.id==='rot'){var bs=w2s(h.b);ctx.moveTo(bs.x,bs.y);ctx.lineTo(s.x,s.y);ctx.stroke();ctx.beginPath();ctx.arc(s.x,s.y,8,0,TAU)}
    else if(h.id[0]==='m'){ctx.moveTo(s.x,s.y-5);ctx.lineTo(s.x+5,s.y);ctx.lineTo(s.x,s.y+5);ctx.lineTo(s.x-5,s.y);ctx.closePath()}
    else if(h.id[0]==='v'||h.id==='p0'||h.id==='p1'||h.id==='off'){ctx.arc(s.x,s.y,7,0,TAU)}
    else{ctx.rect(s.x-6,s.y-6,12,12)}
    ctx.fill();ctx.stroke()});
  }
 }
}

