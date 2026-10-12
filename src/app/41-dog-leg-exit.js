/* ---------- dog-leg emergency exit in a wall ---------- */
function dogTap(w){
 var L=S.objs.filter(function(x){return x.id===S.dogId})[0];if(!L||L.t!=='line'){setTool('select');return}
 var P=L.closed?L.pts.concat([L.pts[0]]):L.pts,best=1e9,bi=-1,bt=0,i;
 for(i=0;i<P.length-1;i++){var ax=P[i].x,ay=P[i].y,dx=P[i+1].x-ax,dy=P[i+1].y-ay,l2=dx*dx+dy*dy;if(l2<1e-9)continue;var t=Math.max(0,Math.min(1,((w.x-ax)*dx+(w.y-ay)*dy)/l2)),d=Math.hypot(ax+dx*t-w.x,ay+dy*t-w.y);if(d<best){best=d;bi=i;bt=t}}
 if(bi<0||best>Math.max(2,12/S.view.z)){toast('Tap on the wall line itself');return}
 var m=$('#modal');
 m.innerHTML='<div class="mbox" role="dialog" aria-label="Dog-leg exit"><h3>Dog-leg emergency exit</h3>'+
 '<label>Use<select id="dl_p"><option value="b">Building / hall wall (narrow passage, short runs)</option><option value="f">Festival fence line (wide passage, long runs)</option></select></label>'+
 '<label>Corners<select id="dl_c"><option value="q">Square, 90° turns (like a built passage)</option><option value="a">Angled, 45° (diagonal jog)</option></select></label>'+
 '<label>Passage width (m) — clear width people walk through<input id="dl_w" type="number" step="0.1" min="0.8" value="1.5"></label>'+
 '<label>Straight run out of the wall (m)<input id="dl_a" type="number" step="0.1" min="0" value="1"></label>'+
 '<label>Sideways jog / dog-leg offset (m)<input id="dl_j" type="number" step="0.1" min="0.5" value="1.5"></label>'+
 '<label>Straight run after the jog (m)<input id="dl_b" type="number" step="0.1" min="0" value="1"></label>'+
 '<label>Passage leaves the wall<select id="dl_s"><option value="1">Outwards (away from the middle of the hall / the side you tapped)</option><option value="-1">The other side</option></select></label>'+
 '<label>Jog goes towards<select id="dl_d"><option value="1">End of the line</option><option value="-1">Start of the line</option></select></label>'+
 '<label>Door / gate at the end<select id="dl_x"><option value="eexit">Emergency exit</option><option value="exit">Exit</option><option value="entrance">Entrance</option><option value="0">None (open passage)</option></select></label>'+
 '<div class="mrow"><button class="btn" id="mc">Cancel</button><button class="btn pri" id="mo">Cut dog-leg</button></div></div>';
 m.classList.add('on');
 $('#dl_p').onchange=function(){var f=this.value==='f',v=f?{w:3,a:3,j:3,b:3}:{w:1.5,a:1,j:1.5,b:1};$('#dl_w').value=v.w;$('#dl_a').value=v.a;$('#dl_j').value=v.j;$('#dl_b').value=v.b};
 function close(){m.classList.remove('on');m.innerHTML=''}
 $('#mc').onclick=function(){close();setTool('select')};
 $('#mo').onclick=function(){
  var wd=Math.max(.8,+$('#dl_w').value||1.5),da=Math.max(0,+$('#dl_a').value||0),jg=Math.max(.5,+$('#dl_j').value||1.5),db=Math.max(0,+$('#dl_b').value||0),fl=+$('#dl_s').value,jd=+$('#dl_d').value,dk=$('#dl_x').value,dr=dk!=='0',sq=$('#dl_c').value==='q';close();
  if(sq&&da<.5)da=.5;
  var a=P[bi],b=P[bi+1],sl=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/sl,uy=(b.y-a.y)/sl,hw=wd/2;
  if(sl<wd+.05){toast('That wall section is shorter than the opening — tap a longer section');setTool('select');return}
  var s0=Math.max(hw,Math.min(sl-hw,bt*sl)),cx=a.x+ux*s0,cy=a.y+uy*s0,A={x:cx-ux*hw,y:cy-uy*hw},B={x:cx+ux*hw,y:cy+uy*hw};
  var nx=-uy,ny=ux,side=1;
  if(L.closed){var mx=0,my=0;L.pts.forEach(function(q){mx+=q.x;my+=q.y});mx/=L.pts.length;my/=L.pts.length;side=((cx-mx)*nx+(cy-my)*ny)>=0?1:-1}
  else{var sd=(w.x-cx)*nx+(w.y-cy)*ny;side=Math.abs(sd)>.15?(sd>0?1:-1):1}
  side*=fl;var mxv=nx*side,myv=ny*side,ju=jd;
  /* centre line of the passage */
  var C=[{x:cx,y:cy}],c1={x:cx+mxv*da,y:cy+myv*da};if(da>0)C.push(c1);else c1=C[0];
  var c2=sq?{x:c1.x+ux*ju*jg,y:c1.y+uy*ju*jg}:{x:c1.x+mxv*jg+ux*ju*jg,y:c1.y+myv*jg+uy*ju*jg};C.push(c2);
  var c3={x:c2.x+mxv*db,y:c2.y+myv*db};if(db>0)C.push(c3);else c3=c2;
  function off(sg){var out=[],n=C.length;for(var k=0;k<n;k++){var d1=k>0?norm2(C[k].x-C[k-1].x,C[k].y-C[k-1].y):null,d2=k<n-1?norm2(C[k+1].x-C[k].x,C[k+1].y-C[k].y):null,n1=d1?{x:-d1.y,y:d1.x}:null,n2=d2?{x:-d2.y,y:d2.x}:null,nn;
    if(n1&&n2){var bx=n1.x+n2.x,by=n1.y+n2.y,bl=Math.hypot(bx,by);bx/=bl;by/=bl;var cs=bx*n1.x+by*n1.y;nn={x:bx*hw/cs,y:by*hw/cs}}else{var q=n1||n2;nn={x:q.x*hw,y:q.y*hw}}
    out.push({x:C[k].x+nn.x*sg,y:C[k].y+nn.y*sg})}return out}
  function norm2(x,y){var l=Math.hypot(x,y)||1;return {x:x/l,y:y/l}}
  var w1=off(1),w2=off(-1);
  if(Math.hypot(w1[0].x-A.x,w1[0].y-A.y)>Math.hypot(w2[0].x-A.x,w2[0].y-A.y)){var tmp=w1;w1=w2;w2=tmp}
  /* split the wall */
  function mk(pts,extra){var o={t:'line',pts:pts,style:L.style||'fence',closed:false};['col','wt','lay','z','zl','hd','lk'].forEach(function(k){if(L[k]!==undefined)o[k]=L[k]});o.id=newId();if(extra)for(var k in extra)o[k]=extra[k];return o}
  snapH();
  var made=[],idx=S.objs.indexOf(L),lab=L.label?{label:L.label,lm:L.lm,ls:L.ls,lc:L.lc}:null;
  if(L.closed){var q=[B];for(i=bi+1;i<P.length-1;i++)q.push(P[i]);for(i=0;i<=bi;i++)q.push(P[i]);q.push(A);made.push(mk(q,lab))}
  else{var f=L.pts.slice(0,bi+1);f.push(A);var g=[B].concat(L.pts.slice(bi+1));made.push(mk(f,lab));made.push(mk(g,null))}
  made.push(mk(w1,null));made.push(mk(w2,null));
  S.objs.splice(idx,1);made.forEach(function(o){S.objs.push(o)});
  var sel=made[0].id;
  if(dr){var fdx=c3.x-C[C.length-2].x,fdy=c3.y-C[C.length-2].y,fl2=Math.hypot(fdx,fdy)||1;fdx/=fl2;fdy/=fl2;var rot=Math.atan2(-fdx,fdy)/D2R;
   var dd={t:'door',k:dk,x:c3.x,y:c3.y,w:wd,rot:rot,label:DOORM[dk].lab};dd.id=newId();if(S.meta.only)dd.lay=S.meta.only;S.objs.push(dd);sel=dd.id}
  S.sel=sel;S.ms=[];setTool('select');changed(true);toast('Dog-leg cut in — drag its points to fine-tune, or Undo to remove it');
 };
 m.onkeydown=function(e){if(e.key==='Escape'){close();setTool('select')}};
}

