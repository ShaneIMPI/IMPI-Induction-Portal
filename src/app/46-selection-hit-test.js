/* ---------- selection / hit test ---------- */
function selIds(){if(S.ms&&S.ms.length>1&&S.ms.indexOf(S.sel)>=0)return S.ms;return S.sel!=null?[S.sel]:[]}
function selObjs(){var ids=selIds();return S.objs.filter(function(o){return ids.indexOf(o.id)>=0})}
function getSel(){var a=selObjs();return a.length===1?a[0]:null}
function setSel(ids){var u=[];ids.forEach(function(i){if(u.indexOf(i)<0)u.push(i)});if(u.length>1){S.ms=u;S.sel=u[u.length-1]}else{S.ms=[];S.sel=u.length?u[0]:null}}
function selOutline(o){
 if(o.t==='dim')return {pts:[o.a,o.b],closed:false};
 if(o.t==='line')return {pts:o.pts,closed:!!o.closed};
 if(o.t==='poly')return {pts:o.pts,closed:true};
 if(o.t==='text'){var tb=textBox(o),z=S.view.z,hw=tb.w/2/z+4/z,hh=tb.h/2/z+3/z,r=(o.rot||0)*D2R;return {pts:[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(function(q){var v=rotv(q[0],q[1],r);return {x:o.x+v.x,y:o.y+v.y}}),closed:true}}
 return {pts:corners(o),closed:true};
}
function boundsOf(o){var b=null;selOutline(o).pts.forEach(function(p){if(!b)b={x0:p.x,y0:p.y,x1:p.x,y1:p.y};else{b.x0=Math.min(b.x0,p.x);b.y0=Math.min(b.y0,p.y);b.x1=Math.max(b.x1,p.x);b.y1=Math.max(b.y1,p.y)}});return b}

function hitObj(o,p){
 var tol=10/S.view.z,d,l,i;
 if(o.t==='dim'){return ptSeg(p,o.a,o.b).d<tol}
 if(o.t==='line'||o.t==='poly'){var P=(o.closed||o.t==='poly')?o.pts.concat([o.pts[0]]):o.pts;for(i=0;i<P.length-1;i++)if(ptSeg(p,P[i],P[i+1]).d<tol)return true;return false}
 if(o.t==='text'){var tb=textBox(o),z=S.view.z;l=rotv(p.x-o.x,p.y-o.y,-(o.rot||0)*D2R);return Math.abs(l.x)<tb.w/2/z+tol/2&&Math.abs(l.y)<tb.h/2/z+tol/2}
 l=toLocal(o,p);d=dimsOf(o);
 if(o.t==='area'){
  if(o.sh==='ellipse'){var ea=d.w/2,eb=d.h/2,er=Math.sqrt((l.x/ea)*(l.x/ea)+(l.y/eb)*(l.y/eb));return Math.abs(er-1)*Math.min(ea,eb)<tol}
  var ex=Math.abs(Math.abs(l.x)-d.w/2),ey=Math.abs(Math.abs(l.y)-d.h/2),inX=Math.abs(l.x)<=d.w/2+tol,inY=Math.abs(l.y)<=d.h/2+tol;return (inX&&inY)&&(ex<tol||ey<tol)}
 return Math.abs(l.x)<=Math.max(d.w/2,tol)&&Math.abs(l.y)<=Math.max(d.h/2,tol);
}
function hitTest(p){var L=ordered();for(var i=L.length-1;i>=0;i--){var o=L[i];if(!o.lk&&hitObj(o,p))return o}return null}
function hitHandle(o,sp){var H=handlesFor(o);for(var i=0;i<H.length;i++){var s=w2s(H[i].p);if(Math.hypot(s.x-sp.x,s.y-sp.y)<(matchMedia('(pointer:coarse)').matches?22:14))return H[i]}return null}
function snapPts(ex){
 var P=[];S.objs.forEach(function(o){if(o.id===ex||!vo(o))return;
  if(o.t==='dim'){P.push(o.a,o.b)}else if(o.t==='line'||o.t==='poly'){o.pts.forEach(function(p){P.push(p)})}else if(o.t==='text'){}
  else{var K=corners(o);K.forEach(function(k){P.push(k)});for(var i=0;i<4;i++)P.push({x:(K[i].x+K[(i+1)%4].x)/2,y:(K[i].y+K[(i+1)%4].y)/2});P.push({x:o.x,y:o.y})}});
 return P;
}
function setSnap(v){S.grid=v;var sel=$('#snapSel');if(!sel)return;var val=String(v);if(![].some.call(sel.options,function(op){return op.value===val})){var op=document.createElement('option');op.value=val;op.textContent='Snap '+v+' m';sel.insertBefore(op,sel.querySelector('[value=custom]'))}sel.value=val}
function placePos(w,arm){
 var g=+S.meta.gridMod,a=(arm||'').split(':'),L=a[0]==='item'?LIBM[a[1]]:null;
 if(g>0&&L&&L.c==='Exhibition'&&L.s==='stand'){var gx=+S.meta.gx||0,gy=+S.meta.gy||0;S.snapPt=null;return {x:gx+Math.round((w.x-L.w/2-gx)/g)*g+L.w/2,y:gy+Math.round((w.y-L.h/2-gy)/g)*g+L.h/2}}
 return snapW(w);
}
function numPlan(st,op){
 var info=st.map(function(o){var cr=corners(o),x0=1e12,y0=1e12,x1=-1e12,y1=-1e12;cr.forEach(function(p){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y)});return {o:o,x:x0,y:y0}});
 var md=Math.min.apply(null,st.map(function(o){return Math.min(o.w,o.h)}))||1,gm=+S.meta.gridMod||0,tol=Math.max(.3,Math.min(md/2,gm?gm/2:md/2));
 var gk=op.axis==='row'?'y':'x',ik=op.axis==='row'?'x':'y';
 var s=info.slice().sort(function(a,b){return a[gk]-b[gk]}),groups=[],cur=null,last=0;
 s.forEach(function(q){if(cur&&q[gk]-last<=tol)cur.push(q);else{cur=[q];groups.push(cur)}last=q[gk]});
 if(op.gRev)groups.reverse();
 var out=[],cnt=op.n0,pad=function(v){var t=String(v);while(t.length<op.pad)t='0'+t;return t};
 groups.forEach(function(g,gi){g.sort(function(a,b){return a[ik]-b[ik]});if(op.iRev)g.reverse();
  var gl=op.lab==='letters'?colName(op.g0+gi):String(op.g0+gi);if(op.restart)cnt=op.n0;
  g.forEach(function(q,j){var it=op.item==='letters'?colName(cnt-1):pad(cnt);cnt++;out.push({o:q.o,label:op.pre+(op.lab==='none'?'':gl+op.sep)+it})})});
 return {list:out,groups:groups.length}}
function autoNumber(){
 var all=S.objs.filter(function(o){return o.t==='rect'&&/^stand/.test(o.k||'')&&vo(o)});
 if(!all.length){toast('No stands on the plan yet');return}
 var sel=selObjs().filter(function(o){return o.t==='rect'&&/^stand/.test(o.k||'')});
 var m=$('#modal');
 var sx='style="border:1px solid var(--ln);background:var(--pn2);border-radius:8px;padding:8px;min-height:38px;color:var(--ink)"';
 m.innerHTML='<div class="mbox" role="dialog" aria-label="Number the stands"><h3>Number the stands</h3>'
 +'<label>Which stands<select id="nm_sc" '+sx+'><option value="all">All stands ('+all.length+')</option>'+(sel.length?'<option value="sel"'+(sel.length>1?' selected':'')+'>Selected stands only ('+sel.length+')</option>':'')+'</select></label>'
 +'<label>Method<select id="nm_me" '+sx+'><option value="lr">Lettered rows: A1, A2 … then B1, B2 …</option><option value="lc">Lettered columns: A1, A2 … then B1, B2 …</option><option value="nr">Numbered rows: 1-1, 1-2 … then 2-1 …</option><option value="nc">Numbered columns: 1-1, 1-2 … then 2-1 …</option><option value="cr">Continuous, row by row: 1, 2, 3 …</option><option value="cc">Continuous, column by column: 1, 2, 3 …</option></select></label>'
 +'<div style="display:flex;gap:8px"><label style="flex:1"><span id="nm_ga">First row is</span><select id="nm_g" '+sx+'></select></label><label style="flex:1"><span id="nm_ia">Number from</span><select id="nm_i" '+sx+'></select></label></div>'
 +'<div style="display:flex;gap:8px"><label style="flex:1">Prefix (optional)<input id="nm_pre" value=""></label><label style="flex:1">Separator<select id="nm_sep" '+sx+'><option value="">None (A1)</option><option value="-">Dash (A-1)</option><option value=".">Dot (A.1)</option><option value=" ">Space (A 1)</option></select></label></div>'
 +'<div style="display:flex;gap:8px"><label style="flex:1"><span id="nm_g0a">First letter</span><input id="nm_g0" value="A"></label><label style="flex:1">Start number<input id="nm_n0" type="number" value="1" step="1" min="1"></label><label style="flex:1">Digits<select id="nm_pad" '+sx+'><option value="1">1</option><option value="2">01</option><option value="3">001</option></select></label></div>'
 +'<label style="flex-direction:row;align-items:center;gap:8px"><input id="nm_rs" type="checkbox" checked style="min-height:0"> Restart the numbers in each row/column</label>'
 +'<div id="nm_pv" class="note" style="margin:2px 0 8px;color:var(--ink)"></div>'
 +'<div class="mrow"><button class="btn" id="mc">Cancel</button><button class="btn pri" id="mo">Number them</button></div></div>';
 m.classList.add('on');
 function opt(a){return a.map(function(x){return '<option value="'+x[0]+'">'+x[1]+'</option>'}).join('')}
 function ops(){var me=$('#nm_me').value,ax=(me==='lr'||me==='nr'||me==='cr')?'row':'col',lab=(me==='lr'||me==='lc')?'letters':(me==='nr'||me==='nc')?'numbers':'none';
  return {axis:ax,lab:lab,me:me}}
 function rebuild(){var o=ops(),g=$('#nm_g'),i=$('#nm_i'),gp=g.value,ip=i.value;
  if(o.axis==='row'){g.innerHTML=opt([['t','Top row'],['b','Bottom row']]);i.innerHTML=opt([['l','Left'],['r','Right']]);$('#nm_ga').textContent=o.lab==='none'?'Start at':'First row is';$('#nm_ia').textContent='Number from'}
  else{g.innerHTML=opt([['l','Left column'],['r','Right column']]);i.innerHTML=opt([['t','Top'],['b','Bottom']]);$('#nm_ga').textContent=o.lab==='none'?'Start at':'First column is';$('#nm_ia').textContent='Number from'}
  if(gp&&g.querySelector('option[value="'+gp+'"]'))g.value=gp;if(ip&&i.querySelector('option[value="'+ip+'"]'))i.value=ip;
  $('#nm_g0a').textContent=o.lab==='numbers'?'First row/col number':'First letter';
  if(o.lab==='letters'&&!/^[A-Za-z]+$/.test($('#nm_g0').value))$('#nm_g0').value='A';if(o.lab==='numbers'&&!/^\d+$/.test($('#nm_g0').value))$('#nm_g0').value='1';
  $('#nm_g0').disabled=o.lab==='none';$('#nm_rs').disabled=o.lab==='none'}
 function cfg(){var o=ops(),g0=$('#nm_g0').value.trim(),gi=1;
  if(o.lab==='letters'){var t=(g0||'A').toUpperCase().replace(/[^A-Z]/g,'')||'A';gi=0;for(var k=0;k<t.length;k++)gi=gi*26+(t.charCodeAt(k)-64);gi-=1}else gi=Math.max(0,parseInt(g0,10)||1);
  return {axis:o.axis,lab:o.lab,gRev:$('#nm_g').value==='b'||$('#nm_g').value==='r',iRev:$('#nm_i').value==='r'||$('#nm_i').value==='b',pre:$('#nm_pre').value.trim(),sep:o.lab==='none'?'':$('#nm_sep').value,g0:gi,n0:Math.max(1,parseInt($('#nm_n0').value,10)||1),pad:parseInt($('#nm_pad').value,10)||1,restart:o.lab==='none'?false:$('#nm_rs').checked,item:'numbers'}}
 function target(){return $('#nm_sc').value==='sel'?sel:all}
 function pv(){if(!$('#nm_pv'))return;var P=numPlan(target(),cfg());$('#nm_pv').textContent='Preview: '+P.list.slice(0,8).map(function(x){return x.label}).join(', ')+(P.list.length>8?' … '+P.list[P.list.length-1].label:'')+'   ('+P.groups+(cfg().axis==='row'?' rows':' columns')+', '+P.list.length+' stands)'}
 rebuild();
 var meSel=$('#nm_me');meSel.onchange=function(){rebuild();var o=ops();$('#nm_sep').value=o.lab==='numbers'?'-':'';pv()};
 ['nm_sc','nm_g','nm_i','nm_pre','nm_sep','nm_g0','nm_n0','nm_pad','nm_rs'].forEach(function(id){var e=$('#'+id);e.oninput=pv;e.onchange=pv});
 pv();
 function close(){m.classList.remove('on');m.innerHTML=''}
 $('#mc').onclick=close;
 $('#mo').onclick=function(){var cf=cfg(),P=numPlan(target(),cf);close();snapH();P.list.forEach(function(x){x.o.label=x.label});changed(true);toast(P.list.length+' stands numbered in '+P.groups+(cf.axis==='row'?' rows':' columns')+'. Add the stand names later under Sheet > Stand names.',6000)};
 m.onkeydown=function(e){if(e.key==='Escape')close()};
}
function snapW(p,ex,noObj){
 S.snapPt=null;S.snapJ=false;
 if(!noObj){var best=null,bd=14/S.view.z;snapPts(ex).forEach(function(q){var d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bd){bd=d;best=q}});if(best){S.snapPt={x:best.x,y:best.y};return {x:best.x,y:best.y}}
  if(S.traceSnap!==false&&TRACE_TOOLS[S.tool]){var u=underlaySnap(p);if(u){S.snapPt={x:u.x,y:u.y};S.snapJ=u.j;return {x:u.x,y:u.y}}}}
 if(S.grid>0)return {x:Math.round(p.x/S.grid)*S.grid,y:Math.round(p.y/S.grid)*S.grid};
 return p;
}

