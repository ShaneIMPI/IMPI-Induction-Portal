/* ---------- object creation ---------- */
function newId(){return S.nid++}
function addObj(o){snapH();o.id=newId();if(S.meta.only&&!o.lay)o.lay=S.meta.only;if(S.venueMode&&!S.meta.only&&o.t!=='dim'&&o.t!=='text')o.vn=1;S.objs.push(o);S.sel=o.id;changed(true);return o}
function makeAt(arm,p){
 var a=arm.split(':'),kind=a[0],k=a[1];
 if(kind==='item'){var L=LIBM[k],ob0={t:'rect',k:k,x:p.x,y:p.y,w:L.w,h:L.h,rot:0,label:L.lab||''};if(k==='cover')ob0.zl=-5;return ob0}
 if(kind==='sign'){return {t:'sign',k:k,x:p.x,y:p.y,s:1.2,rot:0}}
 if(kind==='door'){var D=DOORM[k];return {t:'door',k:k,x:p.x,y:p.y,w:D.w,rot:0,label:D.lab}}
}
function shiftObj(o,dx,dy){if(o.t==='dim'){o.a.x+=dx;o.a.y+=dy;o.b.x+=dx;o.b.y+=dy}else if(o.pts){o.pts.forEach(function(p){p.x+=dx;p.y+=dy})}else{o.x+=dx;o.y+=dy}}
function applyMove(o,or,dx,dy){if(o.t==='dim'){o.a={x:or.a.x+dx,y:or.a.y+dy};o.b={x:or.b.x+dx,y:or.b.y+dy}}else if(o.pts){o.pts=or.pts.map(function(q){return {x:q.x+dx,y:q.y+dy}})}else{o.x=or.x+dx;o.y=or.y+dy}}
function cloneObj(o,dx,dy){var n=JSON.parse(JSON.stringify(o));n.id=newId();shiftObj(n,dx,dy);return n}
function dupSel(){var a=selObjs();if(!a.length)return;snapH();var ids=[];a.forEach(function(o){var n=cloneObj(o,1,1);S.objs.push(n);ids.push(n.id)});setSel(ids);changed(true)}
function delSel(){var ids=selIds();if(!ids.length)return;snapH();S.objs=S.objs.filter(function(x){return ids.indexOf(x.id)<0});setSel([]);changed(true)}
var clip=[],pasteN=0;
function copySel(){var a=selObjs();if(!a.length)return;clip=JSON.parse(JSON.stringify(a));pasteN=0;toast(a.length+' copied. Paste with Ctrl+V or the Paste button')}
function pasteSel(){if(!clip.length){toast('Nothing copied yet');return}pasteN++;snapH();var ids=[];clip.forEach(function(c){var n=cloneObj(c,pasteN,pasteN);S.objs.push(n);ids.push(n.id)});setSel(ids);changed(true)}
function selectAll(){setSel(S.objs.filter(function(o){return vo(o)&&!o.lk}).map(function(o){return o.id}));renderSelbar();renderPanel();draw()}
function zOrder(mode){var a=selObjs();if(!a.length)return;snapH();var zs=S.objs.map(function(o){return o.zl||0}).concat([0]),mx=Math.max.apply(null,zs),mn=Math.min.apply(null,zs);
 a.forEach(function(o){if(mode==='front')o.zl=mx+1;else if(mode==='back')o.zl=mn-1;else if(mode==='up')o.zl=(o.zl||0)+1;else o.zl=(o.zl||0)-1});changed(true)}
function alignSel(m){
 var a=selObjs().filter(function(o){return !o.lk});if(a.length<2){toast('Select two or more objects');return}
 snapH();var B=a.map(boundsOf),u={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity},i;
 B.forEach(function(b){u.x0=Math.min(u.x0,b.x0);u.y0=Math.min(u.y0,b.y0);u.x1=Math.max(u.x1,b.x1);u.y1=Math.max(u.y1,b.y1)});
 if(m==='dh'||m==='dv'){
  var hz=m==='dh',lo=hz?'x0':'y0',hi=hz?'x1':'y1',idx=a.map(function(o,i){return i}).sort(function(p,q){return (B[p][lo]+B[p][hi])-(B[q][lo]+B[q][hi])}),sum=0;
  B.forEach(function(b){sum+=b[hi]-b[lo]});var n=a.length,gap=(B[idx[n-1]][hi]-B[idx[0]][lo]-sum)/Math.max(1,n-1),cur=B[idx[0]][hi];
  for(i=1;i<n-1;i++){var k=idx[i],t0=cur+gap,dd=t0-B[k][lo];if(hz)shiftObj(a[k],dd,0);else shiftObj(a[k],0,dd);cur=t0+(B[k][hi]-B[k][lo])}
 }else a.forEach(function(o,i){var b=B[i],dx=0,dy=0;
  if(m==='l')dx=u.x0-b.x0;else if(m==='r')dx=u.x1-b.x1;else if(m==='cx')dx=(u.x0+u.x1)/2-(b.x0+b.x1)/2;
  else if(m==='t')dy=u.y0-b.y0;else if(m==='b')dy=u.y1-b.y1;else if(m==='cy')dy=(u.y0+u.y1)/2-(b.y0+b.y1)/2;
  shiftObj(o,dx,dy)});
 changed(true);
}
function arraySel(){
 var o=getSel();if(!o||o.t==='dim'||o.t==='line'||o.t==='text'||o.t==='poly'){toast('Array works on items, zones, signs and doors');return}
 var d=dimsOf(o);
 ask('Array / repeat',[{l:'Columns (along width)',v:3,type:'number'},{l:'Rows (along depth)',v:2,type:'number'},{l:'Spacing between columns, centre to centre (m)',v:+(d.w+1).toFixed(2),type:'number',step:'any'},{l:'Spacing between rows, centre to centre (m)',v:+(d.h+1).toFixed(2),type:'number',step:'any'}],function(v){
  var cols=Math.max(1,parseInt(v[0])||1),rows=Math.max(1,parseInt(v[1])||1),dx=parseFloat(v[2])||d.w,dy=parseFloat(v[3])||d.h;
  if(cols*rows>50000){toast('That is over 50 000 copies. Try fewer.');return}
  snapH();var ids=[o.id];
  for(var r=0;r<rows;r++)for(var c=0;c<cols;c++){if(!r&&!c)continue;var n=JSON.parse(JSON.stringify(o));n.id=newId();var q=rotv(c*dx,r*dy,o.rot*D2R);n.x=o.x+q.x;n.y=o.y+q.y;S.objs.push(n);ids.push(n.id)}
  setSel(ids);changed(true);toast((cols*rows)+' items placed');
 },'Place');
}

