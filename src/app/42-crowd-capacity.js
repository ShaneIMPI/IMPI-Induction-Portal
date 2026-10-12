/* ---------- crowd & capacity ---------- */
var DENS=[
 {k:'sdense',n:'Standing, dense (concert / front of stage)',d:0.5},
 {k:'sgen',n:'Standing, general / hospitality',d:1},
 {k:'seat',n:'Seated at tables (counts table seats)',d:1.5},
 {k:'rows',n:'Seated in rows / theatre',d:0.6},
 {k:'exh',n:'Exhibition floor (open area, net of stands)',d:2},
 {k:'open',n:'Open ground / circulation',d:1}
];
function dOf(k){var v=(S.meta.dens||{})[k];if(v>0)return v;for(var i=0;i<DENS.length;i++)if(DENS[i].k===k)return DENS[i].d;return 1}
function isUnit(o){
 if(!o||o.hd||o.ev||o.site)return false;
 if(o.lay){var ly=layoutOf(o.lay);if(!ly||ly.src!==o.id)return false}
 if(o.t==='area'||o.t==='poly')return true;
 if(o.t==='rect'){var l=LIBM[o.k];return !!l&&l.c==='Tents'&&l.s!=='stall'}
 return false}
function unitGross(o){return o.t==='poly'?Math.abs(polyArea(o.pts)):(o.t==='area'?areaSqm(o):o.w*o.h)}
function isOpenStruct(o){if(!o)return false;if(o.opn===true||o.opn===false)return o.opn;var l=LIBM[o.k];return !!(l&&l.opn)}
function siteBoundary(){
 var best=null,o,P;
 S.objs.forEach(function(q){if(q.site&&!q.hd&&!q.ev&&(q.t==='poly'||q.t==='area'||(q.t==='line'&&q.closed))&&!best)best=q});
 if(best){o=best;P=selOutline(o).pts;var ar=o.t==='area'?areaSqm(o):Math.abs(polyArea(o.pts));return {o:o,P:P,area:ar,src:'site',name:o.label||'Event site'}}
 var pa=0,per=null;S.objs.forEach(function(q){if(q.t==='line'&&q.closed&&q.pts&&q.pts.length>2&&q.style!=='evac'&&!q.hd&&!q.ev&&!q.lay){var a=Math.abs(polyArea(q.pts));if(a>pa){pa=a;per=q}}});
 if(per)return {o:per,P:per.pts,area:pa,src:'line',name:'Closed perimeter line'};
 return null}
function exitDoors(){var en=S.meta.evEntr!==false;return S.objs.filter(function(d){return d.t==='door'&&!d.hd&&!d.ev&&(d.k==='exit'||d.k==='eexit'||(d.k==='entrance'&&en))})}
function crowdUnit(o){
 var ly=(S.meta.layouts||[]).filter(function(l){return l.src===o.id})[0],
  items=ly?S.objs.filter(function(q){return q.lay===ly.id&&q.id!==o.id&&q.t==='rect'&&q.k!=='cover'&&(LIBM[q.k]||{}).s!=='truss'&&!q.hd}):[];
 var gross=unitGross(o),fp=0,seats=0;items.forEach(function(q){fp+=q.w*q.h;var l=LIBM[q.k];if(l&&l.seats)seats+=l.seats});
 var net=Math.max(0,gross-fp),use=o.use||'sgen',d=o.dens>0?+o.dens:dOf(use),cap,how;
 if(o.pax>0){cap=Math.round(o.pax);how='fixed'}
 else if(use==='seat'&&seats>0){cap=seats;how='seats'}
 else{cap=Math.floor(net/d);how='area'}
 var b=boundsOf(o),ex=exitDoors().filter(function(e){return e.x>=b.x0-1.5&&e.x<=b.x1+1.5&&e.y>=b.y0-1.5&&e.y<=b.y1+1.5}),ew=0;ex.forEach(function(e){ew+=e.w||0});
 var nm=o.label||(LIBM[o.k]&&LIBM[o.k].n)||(o.t==='poly'?'Zone':'Area');
 return {o:o,name:nm,gross:gross,net:net,seats:seats,hasLay:!!ly,use:use,d:d,cap:cap,how:how,ew:ew,nex:ex.length,opn:isOpenStruct(o)}
}
function crowdAll(){
 var m=S.meta,us=S.objs.filter(function(o){return isUnit(o)&&!o.nc}).map(crowdUnit),att=+m.attend||0,flow=+m.flow||82,T=+m.evT||8,ex=exitDoors(),exW=0;
 ex.forEach(function(e){exW+=e.w||0});
 var site=siteBoundary(),open=null,warn=[];
 if(site){
  var SP=site.P,pa=site.area,occ=0,cin=function(b){var cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;return inPoly({x:cx,y:cy},SP)};
  var us2=us.filter(function(u){return cin(boundsOf(u.o))});
  /* structures inside the site take floor space; one nested inside a larger one is not subtracted twice */
  us2.forEach(function(u){var b=boundsOf(u.o),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;if(us2.some(function(v){if(v===u||v.gross<=u.gross)return false;var c=boundsOf(v.o);return cx>=c.x0&&cx<=c.x1&&cy>=c.y0&&cy<=c.y1}))return;occ+=u.gross});
  S.objs.forEach(function(q){if(q.t!=='rect'||q.hd||q.lay||q.k==='cover'||/^netting/.test(q.k||'')||(q.k||'').indexOf('deck')===0||(LIBM[q.k]||{}).s==='truss'||(LIBM[q.k]||{}).ps||isUnit(q))return;
   if(!inPoly({x:q.x,y:q.y},SP))return;
   if(us.some(function(u){var b=boundsOf(u.o);return q.x>=b.x0&&q.x<=b.x1&&q.y>=b.y0&&q.y<=b.y1}))return;occ+=q.w*q.h});
  var dd=dOf('open'),oa=Math.max(0,pa-occ);open={area:pa,free:oa,occ:occ,d:dd,cap:Math.floor(oa/dd),src:site.src,name:site.name}}
 else if(+m.siteArea>0){
  /* no drawn boundary (venue has its own fencing): use the typed-in site area, less every structure's floor space */
  var occ2=0;us.forEach(function(u){var b=boundsOf(u.o),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;if(us.some(function(v){if(v===u||v.gross<=u.gross)return false;var c=boundsOf(v.o);return cx>=c.x0&&cx<=c.x1&&cy>=c.y0&&cy<=c.y1}))return;occ2+=u.gross});
  var d2=dOf('open'),pa2=+m.siteArea,oa2=Math.max(0,pa2-occ2);open={area:pa2,free:oa2,occ:occ2,d:d2,cap:Math.floor(oa2/d2),src:'typed',name:'Event site (area entered)'}}
 else if(att>0||us.length)warn.push('Open ground is NOT counted: no event site area is set. Type the venue\'s total event area (m²) in Crowd & capacity or the Sheet tab, or draw a boundary. You do not have to draw existing fencing.');
 if(open&&open.occ>=open.area)warn.push('The event area ('+cfmt(open.area)+' m²) is no bigger than the floor space of the structures on it ('+cfmt(open.occ)+' m²), so NO open ground is counted. The area is probably too small: enter the whole fenced event area, not just part of it.');
 us.forEach(function(u){var b=boundsOf(u.o),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;us.forEach(function(v){if(v===u||u.gross>=v.gross)return;var c=boundsOf(v.o);if(cx>=c.x0&&cx<=c.x1&&cy>=c.y0&&cy<=c.y1)warn.push('"'+u.name+'" sits inside "'+v.name+'": both are counted. Tick "Leave out of the crowd calculation" on one of them if that is double counting.')})});
 var tot=us.reduce(function(a,u){return a+u.cap},0)+(open?open.cap:0),calc=tot,cert=+m.certCap||0;
 if(cert>0&&tot>cert)tot=cert;
 return {calc:calc,cert:cert,capped:cert>0&&calc>cert,units:us,open:open,total:tot,att:att,flow:flow,T:T,exW:exW,nEx:ex.length,evTime:(att>0&&exW>0)?att/(exW*flow):null,reqW:att>0?att/(flow*T):0,over:att>0&&tot>0&&att>tot,warn:warn}
}
function cfmt(n){return Math.round(n).toLocaleString('en-ZA')}
function crowdLines(){
 var m=S.meta,L=[],RED='#c62828';
 if(m.only){var ly=layoutOf(m.only),host=ly&&S.objs.filter(function(o){return o.id===ly.src})[0];if(!host||!isUnit(host))return L;
  var u=crowdUnit(host);L.push(['Floor area',cfmt(u.gross)+' m²']);L.push(['Usable (net of layout)',cfmt(u.net)+' m²']);if(u.seats)L.push(['Seats in layout',cfmt(u.seats)]);
  L.push(['Capacity of this structure',cfmt(u.cap)+' people']);L.push(['Basis',u.how==='seats'?'table seating':u.how==='fixed'?'fixed headcount':u.d+' m² per person']);
  if(u.nex)L.push(['Exit width',(Math.round(u.ew*10)/10)+' m ('+u.nex+')']);return L}
 var C=crowdAll();if(!C.units.length&&!C.open&&!C.att)return L;
 if(C.att>0)L.push(['Expected attendance',cfmt(C.att)]);
 L.push(['Planned capacity',cfmt(C.total)+(C.att>0?(C.over?'  OVER':'  OK'):''),C.over?RED:null]);
 C.units.slice(0,6).forEach(function(u){L.push(['   '+u.name,cfmt(u.cap)])});
 if(C.units.length>6)L.push(['   + '+(C.units.length-6)+' more structures','']);
 if(C.open)L.push(['   Open ground (est.)',cfmt(C.open.cap)]);
 else if(C.att>0)L.push(['   Open ground','not counted: no site area set','#c62828']);
 if(C.capped)L.push(['   Calculated '+cfmt(C.calc)+', limited to venue certificate','']);
 if(C.exW>0){L.push(['Exits ('+C.nEx+')',(Math.round(C.exW*10)/10)+' m wide']);
  if(C.att>0){var ok=C.evTime<=C.T;L.push(['Clearance time',(C.evTime<10?C.evTime.toFixed(1):Math.round(C.evTime))+' min (target '+C.T+')',ok?null:RED])}}
 else if(C.att>0)L.push(['Exits','none placed',RED]);
 return L}
function crowdModal(){
 var m=S.meta,C=crowdAll(),h='<h3>Crowd &amp; capacity</h3><p class="note"><b>'+esc(m.event||'')+'</b><br>'+esc(m.venue||'')+' · '+esc(m.date||'')+((m.tstart||m.tend)?' · '+esc(m.tstart||'')+(m.tend?' – '+esc(m.tend):''):'')+'</p>';
 h+='<table style="width:100%;border-collapse:collapse;font-size:12.5px"><tr style="text-align:left;color:#5b6b78"><th>Structure</th><th>Area m²</th><th>Usable m²</th><th>Basis</th><th>Capacity</th><th>Exit m</th></tr>';
 C.units.forEach(function(u){var need=u.cap/(C.flow*C.T),lowExit=!u.opn&&u.ew+1e-6<need;
  h+='<tr style="border-top:1px solid #d6dde2"><td>'+esc(u.name)+(u.hasLay?' <small>(internal layout)</small>':'')+'</td><td>'+cfmt(u.gross)+'</td><td>'+cfmt(u.net)+'</td><td>'+(u.how==='seats'?cfmt(u.seats)+' seats':u.how==='fixed'?'fixed':u.d+' m²/p')+'</td><td><b>'+cfmt(u.cap)+'</b></td><td style="color:'+(lowExit?'#c62828':'inherit')+'">'+(u.opn?'open sides <small>(no exits needed)</small>':(Math.round(u.ew*10)/10)+' <small>(need '+(Math.round(need*10)/10)+')</small>')+'</td></tr>'});
 if(C.open)h+='<tr style="border-top:1px solid #d6dde2"><td>Open ground '+(C.open.src==='typed'?'<small>(site area entered, less structures)</small>':'inside the perimeter <small>(estimate)</small>')+'</td><td>'+cfmt(C.open.area)+'</td><td>'+cfmt(C.open.free)+'</td><td>'+C.open.d+' m²/p</td><td><b>'+cfmt(C.open.cap)+'</b></td><td></td></tr>';
 h+='<tr style="border-top:2px solid #12202b"><td><b>Whole venue</b>'+(C.capped?' <small>(calculated '+cfmt(C.calc)+', limited to the venue\'s certified '+cfmt(C.cert)+')</small>':'')+'</td><td></td><td></td><td></td><td><b>'+cfmt(C.total)+'</b></td><td></td></tr></table>';
 h+='<p style="margin:10px 0 4px"><b>Expected attendance:</b> '+(C.att>0?cfmt(C.att):'<i>not entered (Sheet tab)</i>')+(C.att>0&&C.total>0?' — <b style="color:'+(C.over?'#c62828':'#12804a')+'">'+(C.over?'more than the planned capacity':'within the planned capacity')+'</b>':'')+'</p>';
 h+='<p style="margin:4px 0"><b>Exits:</b> '+C.nEx+' placed, '+(Math.round(C.exW*10)/10)+' m clear width in total. At '+C.flow+' people per minute per metre, '+(C.att>0&&C.exW>0?'the expected crowd clears in about <b style="color:'+(C.evTime>C.T?'#c62828':'#12804a')+'">'+(C.evTime<10?C.evTime.toFixed(1):Math.round(C.evTime))+' min</b> (target '+C.T+' min). ':'')+(C.att>0?'Width needed for the target time: <b>'+(Math.round(C.reqW*10)/10)+' m</b>.':'')+'</p>';
 C.warn.forEach(function(w){h+='<p class="note" style="color:#b45309">⚠ '+esc(w)+'</p>'});
 h+='<p style="margin:10px 0 4px"><b>Venue certified capacity</b> (from its fitness certificate; the plan never counts above this): <input id="cm_cert" type="number" min="0" step="1" value="'+(+m.certCap>0?m.certCap:'')+'" style="width:110px;padding:6px"> <button class="btn sm pri" data-act="sitearea">Set</button></p><p style="margin:10px 0 4px"><b>Venue with existing fencing?</b> Type the total event area instead of drawing it'+(siteBoundary()?' (used only when no boundary is drawn)':'')+':</p><div class="btns" style="align-items:center"><input id="cm_sitearea" type="number" min="0" step="1" placeholder="total area, m²" value="'+(+m.siteArea>0?m.siteArea:'')+'" style="width:140px;padding:6px"> m² <button class="btn sm pri" data-act="sitearea">Set</button>'+(siteBoundary()?'':' <button class="btn sm" data-act="drawsite">Or draw it</button>')+'</div>';
 h+='<p class="note">Densities and the exit flow rate are editable planning figures (Sheet tab). They are not legal limits: confirm against SANS 10400, the approved risk category and the ESSPC / fire department. Capacity reacts to each structure\'s internal layout: furniture is taken off the usable floor, and table seats are counted when a structure is set to "seated at tables".</p>';
 box(h);$('#modal').onclick=function(e){var t=e.target.closest('[data-act]');if(t&&t.dataset.act)act(t.dataset.act)};var mb=$('#modal .mbox');if(mb){mb.style.maxWidth='760px';mb.style.maxHeight='86vh';mb.style.overflow='auto'}
}
