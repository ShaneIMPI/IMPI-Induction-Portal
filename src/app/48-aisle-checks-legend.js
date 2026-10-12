/* ---------- aisle checks & legend ---------- */
function checkAisles(){
 var min=+S.meta.minAisle||2,items=S.objs.filter(function(o){return o.t==='rect'&&vo(o)}),out=[],i,j;
 var polys=items.map(function(o){return {o:o,P:polyOf(o),r:Math.hypot(o.w,o.h)/2}});
 for(i=0;i<polys.length;i++)for(j=i+1;j<polys.length;j++){
  var A=polys[i],B=polys[j];if(Math.hypot(A.o.x-B.o.x,A.o.y-B.o.y)-A.r-B.r>min)continue;
  var g=polyGap(A.P,B.P);if(g&&g.d>0.05&&g.d<min)out.push({a:g.a,b:g.b,d:g.d,n:(A.o.label||LIBM[A.o.k].n)+' ↔ '+(B.o.label||LIBM[B.o.k].n)});
  if(out.length>=250)break;
 }
 out.sort(function(a,b){return a.d-b.d});S.issues=out;draw();renderPanel();
 toast(out.length?out.length+' gap'+(out.length>1?'s':'')+' under '+fm(min):'No gaps under '+fm(min)+' between items');
}
function legendData(){
 var L=[],cnt={},i,objs=S.objs.filter(function(o){return vo(o)});
 objs.forEach(function(o){var key=null;if(o.t==='rect')key='r:'+o.k;else if(o.t==='sign')key='s:'+o.k;else if(o.t==='door')key='d:'+o.k;if(key){cnt[key]=cnt[key]||{n:0,w:0};cnt[key].n++}});
 objs.filter(function(o){return o.t==='area'||o.t==='poly'}).forEach(function(o){L.push({g:'Zones',t:'area',col:o.col||'#5b6770',name:o.label||'Zone',q:Math.round(o.t==='poly'?Math.abs(polyArea(o.pts)):areaSqm(o)).toLocaleString('en-ZA')+' m²'})});
 var rg={},ro=[],cats=['Exhibition','Tents','Stage & AV','Furniture','Services','Site & access','Custom'];
 function sz1(v){return (+v.toFixed(1)).toString()}
 objs.forEach(function(o){if(o.t!=='rect'||o.k==='cover')return;var l=LIBM[o.k];if(!l)return;
  var changed=Math.abs(o.w-l.w)>.05||Math.abs(o.h-l.h)>.05,key=o.k+'|'+(l.c==='Exhibition'?'':(o.label||''))+'|'+o.w.toFixed(1)+'|'+o.h.toFixed(1);
  if(!rg[key]){var base=(l.c==='Exhibition'?'':o.label)||(changed?l.n.replace(/\s*\(.*\)/,'').replace(/\s*\d+(\.\d+)?\s*×\s*\d+(\.\d+)?/,'').trim():l.n);
   rg[key]={g:l.c||'Custom',t:'rect',k:o.k,name:((l.c==='Exhibition'?'':o.label)||changed)?base+'  '+sz1(o.w)+' × '+sz1(o.h)+' m':base,n:0};ro.push(rg[key])}
  rg[key].n++});
 ro.sort(function(x,y){return cats.indexOf(x.g)-cats.indexOf(y.g)||x.name.localeCompare(y.name)});
 ro.forEach(function(e){L.push({g:e.g,t:'rect',k:e.k,name:e.name,q:'×'+e.n})});
 SIGNS.forEach(function(s){if(cnt['s:'+s.k])L.push({g:'Safety',t:'sign',k:s.k,name:s.n,q:'×'+cnt['s:'+s.k].n})});
 DOORS.forEach(function(d){if(cnt['d:'+d.k])L.push({g:'Access',t:'door',k:d.k,name:d.n,q:'×'+cnt['d:'+d.k].n})});
 LINES.forEach(function(ln){var tot=0,n=0;objs.forEach(function(o){if(o.t==='line'&&(o.style||'fence')===ln.k){tot+=lineLen(o);n++}});if(n)L.push({g:'Lines',t:'line',k:ln.k,name:ln.n,q:Math.round(tot)+' m'})});

 objs.filter(function(o){return o.t==='line'&&o.perim&&o.pts&&o.pts.length>1}).forEach(function(o,pi){
  var rn=lineRuns(o),all=lineLenAll(o),fl=lineLen(o),nm=(LINES.filter(function(l){return l.k===(o.style||'fence')})[0]||{n:'Fence'}).n,base=gapBase(o);
  L.push({g:'Perimeter',t:'line',k:o.style||'fence',name:'Perimeter '+(pi+1)+' — '+nm+' (fenced)',q:(Math.round(fl*10)/10)+' m'});
  if(rn.gaps.length){rn.gaps.forEach(function(g,k){L.push({g:'Perimeter',t:'line',k:'thin',name:'Gap G'+(base+k+1)+' (open)',q:(Math.round(g.len*10)/10)+' m'})});
   L.push({g:'Perimeter',t:'line',k:'thin',name:'Total gaps',q:(Math.round(gapLen(o)*10)/10)+' m'});
   L.push({g:'Perimeter',t:'line',k:'thin',name:'Total perimeter incl. gaps',q:(Math.round(all*10)/10)+' m'})}
  if(o.closed&&o.pts.length>=3)L.push({g:'Perimeter',t:'line',k:'thin',name:'Area enclosed',q:Math.round(Math.abs(polyArea(o.pts))).toLocaleString('en-ZA')+' m²'})});
 return L;
}
function allLib(){return LIB.concat(S.custom)}
function iconDraw(c,e,cx,cy,box,u){
 c.save();c.translate(cx,cy);var o,gw=1,gh=1;
 if(e.t==='rect'){var l=LIBM[e.k];gw=l.w;gh=l.h;o={t:'rect',k:e.k,x:0,y:0,w:l.w,h:l.h,rot:0,label:''}}
 else if(e.t==='sign'){o={t:'sign',k:e.k,x:0,y:0,s:1,rot:0}}
 else if(e.t==='door'){gw=3;gh=1.4;o={t:'door',k:e.k,x:0,y:0,w:3,rot:0,label:''}}
 else if(e.t==='line'){gw=3;gh=1;o={t:'line',pts:[{x:-1.5,y:0},{x:1.5,y:0}],style:e.k}}
 else{gw=2;gh=1.4;o={t:'area',x:0,y:0,w:2,h:1.4,rot:0,col:e.col,label:'',nodim:true}}
 var sc=box/Math.max(gw,gh);c.scale(sc,sc);var sv=R;R={z:sc,u:u};drawObj(c,o,true);R=sv;c.restore();
}
function refreshLegend(){var el=$('#legBox');if(!el)return;var L=legendData();el.innerHTML=L.length?'':'<p class="note">Nothing placed yet. The legend builds itself as you add items.</p>';
 L.forEach(function(e){var d=document.createElement('div');d.className='leg';var cn=document.createElement('canvas');cn.width=60;cn.height=48;d.appendChild(cn);var sp=document.createElement('span');sp.textContent=e.name;d.appendChild(sp);var q=document.createElement('i');q.textContent=e.q;d.appendChild(q);el.appendChild(d);var c=cn.getContext('2d');iconDraw(c,e,30,24,40,1)})}

