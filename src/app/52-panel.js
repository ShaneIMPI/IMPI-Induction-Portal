/* ---------- panel ---------- */
function openPanel(){$('#panel').classList.add('open');renderPanel()}
function closePanel(){$('#panel').classList.remove('open')}
$('#bPanel').onclick=function(){$('#panel').classList.toggle('open');renderPanel()};
function renderTabs(){
 var T=[['lib','Library'],['sel','Selected'],['obj','Objects'],['lay','Images'],['sheet','Sheet']];
 $('#tabs').innerHTML=T.map(function(t){return '<button data-tab="'+t[0]+'" class="'+(S.tab===t[0]?'on':'')+'">'+t[1]+'</button>'}).join('');
 $('#tabs').onclick=function(e){var b=e.target.closest('button');if(!b)return;S.tab=b.dataset.tab;renderPanel()};
}
function fld(id,label,val,type,extra){return '<label class="fld">'+esc(label)+'<input id="'+id+'" type="'+(type||'text')+'" value="'+esc(val)+'" '+(extra||'')+'></label>'}
function previewItem(cn,e){var c=cn.getContext('2d');c.clearRect(0,0,cn.width,cn.height);c.save();iconDraw(c,e,cn.width/2,cn.height/2,Math.min(cn.width,cn.height)*.82,2);c.restore()}
function renderPanel(){renderViewSel();syncEvac();
 renderTabs();var b=$('#pbody'),h='';
 if(S.tab==='lib'){
  h+='<p class="note">Tap an item, then tap the plan to place it. Everything is stored in real metres. Edit sizes under <b>Selected</b> to match your supplier spec.</p>';
  var cats=(S.meta.mode==='indoor'?['Exhibition','Furniture','Services','Site & access','Stage & AV','Tents']:['Furniture','Tents','Stage & AV','Services','Site & access','Exhibition']).concat(S.layers.length?['Plan editing']:[]);
  cats.forEach(function(cn){h+='<h4>'+cn+'</h4><div class="grid">';allLib().filter(function(l){return (l.c||'Custom')===cn}).forEach(function(l){h+='<button class="pal'+(S.arm==='item:'+l.k?' on':'')+'" data-arm="item:'+l.k+'"><canvas width="140" height="88" data-pv="r:'+l.k+'"></canvas><span>'+esc(l.n)+'<small>'+l.w+' × '+l.h+' m</small></span></button>'});h+='</div>'});
  var cu=S.custom;if(cu.length){h+='<h4>My symbols</h4><div class="grid">';cu.forEach(function(l){h+='<button class="pal'+(S.arm==='item:'+l.k?' on':'')+'" data-arm="item:'+l.k+'"><canvas width="140" height="88" data-pv="r:'+l.k+'"></canvas><span>'+esc(l.n)+'<small>'+l.w+' × '+l.h+' m</small></span></button>'});h+='</div>'}
  h+='<div class="btns"><button class="btn sm" data-act="addsym">+ Add my own symbol (PNG / SVG)</button></div>';
  h+='<h4>Safety signs</h4><p class="note">Pictograms follow SANS 1186 colour conventions: red fire, green safe condition, yellow warning, red-ring prohibition. They are drawn approximations. To use the official artwork, add your licensed PNG with "Add my own symbol".</p><div class="grid">';
  SIGNS.forEach(function(s){h+='<button class="pal'+(S.arm==='sign:'+s.k?' on':'')+'" data-arm="sign:'+s.k+'"><canvas width="140" height="88" data-pv="s:'+s.k+'"></canvas><span>'+esc(s.n)+'</span></button>'});
  h+='</div><h4>Entrances &amp; exits</h4><div class="grid">';
  DOORS.forEach(function(d){h+='<button class="pal'+(S.arm==='door:'+d.k?' on':'')+'" data-arm="door:'+d.k+'"><canvas width="140" height="88" data-pv="d:'+d.k+'"></canvas><span>'+esc(d.n)+'<small>default '+d.w+' m wide</small></span></button>'});
  h+='</div><h4>Fences &amp; barriers</h4><p class="note">Use the <b>Fence</b> tool in the toolbar, then choose the line style under Selected.</p>';
 }
 else if(S.tab==='sel'){
  var o=getSel();
  if(o){h=selHTML(o)}
  else if(selIds().length>1){h=multiHTML()}
  else{h='<p class="note">Nothing selected. Tap an item on the plan to edit its size, rotation, colour and label. Hold Shift (or use Box select) to select several.</p>'}
 }
 else if(S.tab==='obj'){h=objHTML()}
 else if(S.tab==='lay'){h=layHTML()}
 else{h=sheetHTML()}
 b.innerHTML=h;
 $$('[data-pv]',b).forEach(function(cn){var a=cn.dataset.pv.split(':');var e={t:a[0]==='r'?'rect':a[0]==='s'?'sign':'door',k:a[1]};previewItem(cn,e)});
 wirePanel(b);
 if(S.tab==='sheet')refreshLegend();
}
function pf(prop,label,val,type,extra){return '<label class="fld">'+esc(label)+'<input type="'+(type||'text')+'" data-p="'+prop+'" value="'+esc(val)+'" '+(extra||'')+'></label>'}
function psel(prop,label,opts,cur){return '<label class="fld">'+esc(label)+'<select data-p="'+prop+'">'+opts.map(function(p){return '<option value="'+p[0]+'"'+(String(cur)===String(p[0])?' selected':'')+'>'+esc(p[1])+'</option>'}).join('')+'</select></label>'}
function pchk(prop,label,on){return '<label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" data-p="'+prop+'"'+(on?' checked':'')+'> '+esc(label)+'</label>'}
var LM_OPTS=[['along','Follow the long side'],['with','Follow the object'],['up','Always upright'],['off','Hidden']];
function labelFields(o){return psel('lm','Label direction',LM_OPTS,o.lm||'along')+'<div class="row2">'+pf('ls','Label size (px, 0 = auto-fit)',o.ls||0,'number','step="1" min="0"')+pf('lc','Label colour',o.lc||'#12202b','color')+'</div><div class="btns"><button class="btn sm" data-act="rst:lc">Auto colour</button></div>'}
function zbtns(){return '<h4>Layer order</h4><div class="btns"><button class="btn sm" data-act="zf">To front</button><button class="btn sm" data-act="zu">Forward</button><button class="btn sm" data-act="zd">Backward</button><button class="btn sm" data-act="zb">To back</button></div>'}
function selHTML(o){
 var h='',title={rect:(LIBM[o.k]||{n:'Item'}).n,area:'Zone / tent footprint',poly:'Free-form zone',door:(DOORM[o.k]||{n:'Door'}).n,sign:(SIGNM[o.k]||{n:'Sign'}).n,line:'Line',text:'Note',dim:'Measurement'}[o.t];
 h+='<h4>'+esc(title)+'</h4>';
 if(o.lk)h+='<p class="note"><b>Locked.</b> Untick Lock below to move or resize it on the plan.</p>';
 if(o.t==='rect'||o.t==='area'||o.t==='poly'||o.t==='door'||o.t==='line')h+=pf('label',o.t==='door'?'Label (wording)':((LIBM[o.k]||{}).s==='stand'&&o.t==='rect'?'Stand number':'Label on plan'),o.label||'','text')+((LIBM[o.k]||{}).s==='stand'&&o.t==='rect'?pf('sname','Stand name (optional, can be added later)',o.sname||'','text')+'<div class="note">On the plan: name top-left, size bottom-left, number bottom-right.</div>':'')+labelFields(o);
 if(o.t==='text'){h+='<label class="fld">Text (Enter = new line)<textarea data-p="text" rows="2">'+esc(o.text)+'</textarea></label><div class="row3">'+pf('size','Size (px)',o.size||14,'number','step="1" min="2"')+pf('rot','Rotate (°)',Math.round(o.rot||0),'number','step="1"')+pf('col','Colour',o.col||'#12202b','color')+'</div>'+pchk('b','Bold',o.b!==false)+pchk('hl','White outline for legibility',o.hl!==false)}
 if(o.t==='rect'||o.t==='area'||o.t==='door'||o.t==='sign'||o.t==='text')h+='<div class="row2">'+pf('x','Centre X (m)',+o.x.toFixed(3),'number','step="any"')+pf('y','Centre Y (m)',+o.y.toFixed(3),'number','step="any"')+'</div>';
 if(o.t==='rect'||o.t==='area')h+='<div class="row3">'+pf('w','Width (m)',+o.w.toFixed(3),'number','step="any" min="0.01"')+pf('h','Depth (m)',+o.h.toFixed(3),'number','step="any" min="0.01"')+pf('rot','Rotate (°)',+o.rot.toFixed(2),'number','step="any"')+'</div>'+pchk('lock','Keep proportions when resizing',o.lock||isCircle(o))+'<p class="note">Drag any of the 8 square handles to resize from that side or corner.</p>';
 if(o.t==='door')h+='<div class="row3">'+pf('w','Opening width (m)',+o.w.toFixed(3),'number','step="any" min="0.1"')+pf('th','Depth (m)',+(o.th||.6).toFixed(2),'number','step="any" min="0.1"')+pf('rot','Rotate (°)',+o.rot.toFixed(2),'number','step="any"')+'</div>'+pf('col','Colour',o.col||(DOORM[o.k]||{col:'#12804a'}).col,'color')+'<p class="note">The arrow shows travel direction. Use Flip to reverse it.</p><div class="btns"><button class="btn sm" data-act="flip">Flip direction</button><button class="btn sm" data-act="rst:col">Standard colour</button></div>';
 if(o.t==='sign')h+='<div class="row2">'+pf('s','Symbol size (m)',o.s,'number','step="any" min="0.1"')+pf('rot','Rotate (°)',+o.rot.toFixed(2),'number','step="any"')+'</div><p class="note">Signs are symbols, so they are drawn larger than real life to stay readable.</p>';
 if(o.t==='area'||o.t==='poly'){
  h+='<div class="note">Area: <b>'+Math.round(o.t==='poly'?Math.abs(polyArea(o.pts)):areaSqm(o)).toLocaleString('en-ZA')+' m²</b></div>';
  if(o.t==='area')h+=psel('sh','Shape',[['rect','Rectangle'],['ellipse','Ellipse / circle']],o.sh||'rect');
  h+='<div class="sw">'+ZCOL.map(function(z){return '<button title="'+z.n+'" data-zc="'+z.c+'" class="'+(o.col===z.c?'on':'')+'" style="background:'+z.c+'"></button>'}).join('')+'</div>';
  h+='<div class="row2">'+pf('col','Custom colour',o.col||'#5b6770','color')+pf('sw','Outline weight ×',o.sw||1,'number','step="0.1" min="0.1"')+'</div><label class="fld">Fill opacity<input type="range" min="0" max="100" data-p="fo" data-div="100" value="'+Math.round((o.fo==null?.12:o.fo)*100)+'"></label>'+pchk('nodim','Hide dimensions',o.nodim);
  if(o.t==='poly')h+='<p class="note">Drag a round handle to move a corner. Drag a diamond to add a corner. Double-tap a corner to remove it.</p>';
 }
 if(o.t==='rect')h+='<div class="row2">'+pf('fc','Fill colour',o.fc||'#e6ebef','color')+pf('sw','Outline weight ×',o.sw||1,'number','step="0.1" min="0.1"')+'</div><div class="btns"><button class="btn sm" data-act="rst:fc">Standard fill</button></div>';
 if(o.t==='rect')h+='<h4>Front (orange edge)</h4>'+psel('fr','Front side',[['auto','Default for this item'],['none','No front'],['n','Top'],['e','Right'],['s','Bottom'],['w','Left']],o.fr===undefined?'auto':o.fr)+frontBtns();
 if(o.t==='line'){h+=psel('style','Style',LINES.map(function(l){return [l.k,l.n]}),o.style||'fence')+'<div class="row2">'+pf('col','Colour',o.col||'#22313d','color')+pf('wt','Weight ×',o.wt||1,'number','step="0.1" min="0.1"')+'</div><div class="btns"><button class="btn sm" data-act="rst:col">Standard colour</button></div>'+(ROPEK[o.style]?pf('sp','Post spacing (m)',o.sp||ROPEK[o.style].sp,'number','step="0.1" min="0.5"'):'')+pchk('closed','Close the shape (perimeter)',o.closed)+pchk('segl','Show the length of each section',o.segl)+pchk('perim','List in legend as a measured perimeter',o.perim)+(o.gaps&&o.gaps.length?'<div class="note">Gaps: <b>'+lineRuns(o).gaps.length+'</b>, open length <b>'+fm(gapLen(o))+'</b></div><div class="btns"><button class="btn sm" data-act="gapsclr">Remove all gaps</button></div>':'<div class="note">Gaps: none. To leave a gap while drawing press Gap, then tap where the fence starts again.</div>')+'<div class="note">Total length: <b>'+fm(lineLen(o))+'</b></div><p class="note">Drag a round handle to move a point, a diamond to add one, double-tap a point to remove it.</p><div class="btns"><button class="btn sm pri" data-act="dogleg">Add dog-leg exit in this wall…</button></div>'+(o.ev?'<div class="btns"><button class="btn sm" data-act="evrev">Reverse direction</button></div>'+pchk('keep','Keep this route when I press Generate again',o.keep)+'<p class="note">Edit a route like any line: drag a round handle to move a point, a diamond to add one, double-tap a point to remove it.</p>':'')}
 if(o.t==='dim')h+='<div class="note">Length: <b>'+fm(Math.hypot(o.b.x-o.a.x,o.b.y-o.a.y))+'</b></div>'+pf('label','Custom label (optional)',o.label||'','text')+'<p class="note">Drag the middle handle to move the dimension line out or in.</p>';
 if((o.t==='poly'||o.t==='area'||(o.t==='line'&&o.closed))&&!o.ev)h+=sitePanel(o);
 if(isUnit(o)&&!o.ev)h+=crowdPanel(o);
 h+='<div class="row2">'+pchk('lk','Lock position',o.lk)+pchk('hd','Hide',o.hd)+'</div>'+zbtns();
 h+='<div class="btns"><button class="btn sm" data-act="dup">Duplicate</button><button class="btn sm" data-act="copy">Copy</button><button class="btn sm" data-act="paste">Paste</button>';
 if(o.t==='rect'||o.t==='area'||o.t==='door'||o.t==='sign')h+='<button class="btn sm" data-act="arr">Array / repeat</button>';
 if(canHost(o))h+='<button class="btn sm pri" data-act="inlay">'+((S.meta.layouts||[]).some(function(l){return l.src===o.id})?'Open internal layout':'Internal layout of this structure')+'</button>';
 h+='<button class="btn sm dng" data-act="del">Delete</button></div>';
 return h;
}
function frontBtns(){return '<div class="btns"><button class="btn sm" data-act="face:u">Face up ↑</button><button class="btn sm" data-act="face:r">Face right →</button><button class="btn sm" data-act="face:d">Face down ↓</button><button class="btn sm" data-act="face:l">Face left ←</button></div><div class="btns"><button class="btn sm pri" data-act="facept">Face towards a point / structure…</button><button class="btn sm" data-act="facematch">Match the first selected</button></div>'}
function multiHTML(){
 var a=selObjs(),h='<h4>'+a.length+' objects selected</h4><p class="note">Drag any selected object to move them all together. Shift-click adds or removes one. Arrow keys nudge.</p>';
 h+='<h4>Align</h4><div class="btns"><button class="btn sm" data-act="aln_l">Left</button><button class="btn sm" data-act="aln_cx">Centre</button><button class="btn sm" data-act="aln_r">Right</button><button class="btn sm" data-act="aln_t">Top</button><button class="btn sm" data-act="aln_cy">Middle</button><button class="btn sm" data-act="aln_b">Bottom</button></div>';
 h+='<h4>Front (orange edge)</h4><p class="note">Turn all selected structures so their front edge faces the same way, or towards a stage or point.</p>'+frontBtns();
 h+='<h4>Spread evenly</h4><div class="btns"><button class="btn sm" data-act="aln_dh">Across</button><button class="btn sm" data-act="aln_dv">Down</button></div>';
 h+=psel('lm','Label direction for all',[['','— leave as is —']].concat(LM_OPTS),'')+'<div class="row2">'+pchk('lk','Lock all',false)+pchk('hd','Hide all',false)+'</div>'+zbtns();
 h+='<div class="btns"><button class="btn sm" data-act="dup">Duplicate</button><button class="btn sm" data-act="copy">Copy</button><button class="btn sm" data-act="paste">Paste</button><button class="btn sm dng" data-act="del">Delete</button></div>';
 return h;
}
function objName(o){var base={rect:(LIBM[o.k]||{n:'Item'}).n,area:'Zone',poly:'Free-form zone',door:(DOORM[o.k]||{n:'Door'}).n,sign:(SIGNM[o.k]||{n:'Sign'}).n,line:'Line',text:'Note',dim:'Measurement'}[o.t]||'Object',lab=o.t==='text'?String(o.text||'').split('\n')[0]:o.label;return lab?lab+' · '+base:base}
function objHTML(){
 var h='<p class="note">Every object on the plan, top layer first. Tap a row to select it and jump to it. <b>Lock</b> stops accidental moves. <b>Hide</b> removes it from the plan, legend and export.</p><div class="btns"><button class="btn sm" data-act="selall">Select all</button><button class="btn sm" data-act="unlockall">Unlock all</button><button class="btn sm" data-act="showall">Show all</button></div>';
 var L=ordered().reverse().concat(S.objs.filter(function(o){return o.hd})),ids=selIds();
 if(!L.length)return h+'<p class="note">Nothing on the plan yet.</p>';
 h+=L.slice(0,600).map(function(o){return '<div class="orow'+(ids.indexOf(o.id)>=0?' on':'')+(o.hd?' off':'')+'" data-osel="'+o.id+'"><span>'+esc(objName(o))+'</span><button class="btn sm" data-olk="'+o.id+'">'+(o.lk?'Unlock':'Lock')+'</button><button class="btn sm" data-ohd="'+o.id+'">'+(o.hd?'Show':'Hide')+'</button></div>'}).join('');
 if(L.length>600)h+='<p class="note">Showing the top 600 of '+L.length+' objects.</p>';
 return h;
}
function layHTML(){
 var h='<p class="note">Stack an aerial image and the client plan. Calibrate each one by tapping two points a known distance apart (the Google Earth scale bar works well), then slide and rotate the plan until it lines up.</p>';
 h+='<div class="btns"><button class="btn sm pri" data-act="addmap">+ Satellite map</button><button class="btn sm" data-act="addsat">+ Upload aerial</button><button class="btn sm" data-act="addplan">+ Client plan (PDF/image)</button><button class="btn sm" data-act="adddxf">+ AutoCAD drawing (DWG or DXF)</button>'+(S._lastPdf&&S._lastPdf.pdf.numPages>1?'<button class="btn sm" data-act="pdfpage">+ Another page of '+esc(S._lastPdf.name)+'</button>':'')+'</div>';
 h+='<p class="note">Tip: take a Google Earth screenshot with its scale bar showing. Keep the imagery credit visible when sharing.</p>';
 if(!S.layers.length)h+='<p class="note">No images yet.</p>';
 S.layers.forEach(function(L,i){
  h+='<div class="card" data-lid="'+L.id+'"><b>'+esc(L.name)+'</b><span class="badge '+(L.cal===true?'ok':'warn')+'">'+(L.cal===true?(L.geo?'true scale (map)':'scale set'):L.cal==='eye'?'scaled by eye':'not calibrated')+'</span>';
  if(L.kind==='plan')h+='<label class="fld" style="flex-direction:row;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" data-lcrisp="'+L.id+'"'+(L.crisp?' checked':'')+'> Sharpen lines (crisp, for tracing)</label><div class="btns"><button class="btn sm" data-ldet="'+L.id+'" title="Find the red, green and yellow safety markers on this plan and place real items on them">Detect fire equipment &amp; exits</button><button class="btn sm pri" data-latr="'+L.id+'" title="Outline the building and its walls from this plan into editable venue lines">Auto-trace venue shell</button></div>';
  h+='<label class="fld" style="margin:8px 0 6px">Opacity '+Math.round(L.op*100)+'%<input type="range" min="5" max="100" value="'+Math.round(L.op*100)+'" data-lop="'+L.id+'"></label>';
  h+='<div class="btns"><button class="btn sm pri" data-lcal="'+L.id+'">Calibrate</button><button class="btn sm" data-lmv="'+L.id+'">Move</button><button class="btn sm" data-lvis="'+L.id+'">'+(L.vis?'Hide':'Show')+'</button>'+(L.kind==='plan'?'<button class="btn sm'+(L.base?' pri':'')+'" data-lbase="'+L.id+'" title="Show the imported plan at full strength as the drawing you annotate">'+(L.base?'Editing this plan ✓':'Edit this plan')+'</button>':'')+'<button class="btn sm" data-lup="'+L.id+'">Up</button><button class="btn sm" data-ldn="'+L.id+'">Down</button><button class="btn sm dng" data-ldel="'+L.id+'">Remove</button></div>';
  h+='<div class="row2"><label class="fld">Rotate (°)<input type="number" step="0.1" value="'+(+L.rot.toFixed(2))+'" data-lrot="'+L.id+'"></label>'+(L.kind==='plan'?'<label class="fld">Blend<select data-lbl="'+L.id+'"><option value="multiply"'+(L.blend==='multiply'?' selected':'')+'>See-through (best for plans)</option><option value="source-over"'+(L.blend!=='multiply'?' selected':'')+'>Normal</option></select></label>':'<div></div>')+'</div>';
  h+='<div class="row2"><label class="fld">Width on plan (m)<input type="number" step="0.1" value="'+(+(L.img.width*L.mpp).toFixed(2))+'" data-lw="'+L.id+'"></label><label class="fld">Height (m)<input type="number" value="'+(+(L.img.height*L.mpp).toFixed(2))+'" disabled></label></div>';
  h+='<div class="btns"><span class="note" style="margin:0;align-self:center">Resize:</span><button class="btn sm" data-lsc="'+L.id+':0.95">−5%</button><button class="btn sm" data-lsc="'+L.id+':0.99">−1%</button><button class="btn sm" data-lsc="'+L.id+':1.01">+1%</button><button class="btn sm" data-lsc="'+L.id+':1.05">+5%</button></div>';
  if(L.pdfScale){h+='<div class="row2"><label class="fld">Printed scale 1 :<input type="number" min="1" placeholder="e.g. 500" data-lps="'+L.id+'"></label><label class="fld">Page was reduced from<select data-lpp="'+L.id+'"><option value="0">Not reduced (printed 100%)</option><option value="420">A3 shrunk to this page</option><option value="594">A2 shrunk to this page</option><option value="841">A1 shrunk to this page</option><option value="1189">A0 shrunk to this page</option></select></label></div><div class="btns"><button class="btn sm" data-lpsa="'+L.id+'">Apply print scale</button></div><p class="note">Venue PDFs are often an A3 plan shrunk onto A4, so the printed scale (1:500) is not true on the page. The reliable way: tap Calibrate, tap both ends of a dimension line (snap lines helps), and type it, e.g. 107900 mm.</p>'}
  h+='</div>';
 });
 return h;
}
function sheetHTML(){
 var m=S.meta,h='<h4>Clear project</h4><p class="note">Finished a redraw? Wipe the sheet for the next one. Your company name, logo and paper size stay.</p><div class="btns"><button class="btn sm dng" data-act="clearp">'+(S.clrArm==='p'?'Click again to confirm: clears everything':'Clear project (blank)')+'</button>'+(S.objs.some(function(o){return o.vn})?'<button class="btn sm" data-act="clearev">'+(S.clrArm==='e'?'Click again to confirm: removes event objects':'Clear event only (keep venue)')+'</button>':'')+'</div><h4>Title block</h4>';
 h+=fld('m_event','Event name',m.event)+fld('m_title','Drawing title',m.title)+'<div class="row2">'+fld('m_venue','Venue',m.venue)+fld('m_client','Client',m.client)+'</div><div class="row3">'+fld('m_date','Date',m.date)+fld('m_rev','Revision',m.rev)+fld('m_drawn','Drawn by',m.drawn)+'</div>'+fld('m_ref','Reference no.',m.ref)+(isAdmin()?fld('m_company','Company name (watermark &amp; title block)',m.company):'<p class="note">Company name, logo and footer are fixed to '+esc(BRAND_NAME)+' on every sheet.</p>');
 if(isAdmin())h+='<div class="btns"><button class="btn sm" data-act="logo">'+(m.logo?'Replace logo':'Upload logo')+'</button>'+(m.logo?'<button class="btn sm dng" data-act="nologo">Remove logo</button>':'')+'</div>';
 h+='<h4>Event logo</h4><p class="note">Shown at the top of the right-hand panel on the sheet, above the event details. Any image or PDF works (PNG, JPG, SVG, WebP, GIF, PDF…); a transparent PNG looks best.</p><div class="btns"><button class="btn sm pri" data-act="elogo">'+(m.eventLogo?'Replace event logo':'Upload event logo')+'</button>'+(m.eventLogo?'<button class="btn sm dng" data-act="noelogo">Remove</button>':'')+'</div>';
 h+='<h4>Event times &amp; crowd</h4><div class="row3">'+fld('m_tstart','Start time',m.tstart||'','time')+fld('m_tend','End time',m.tend||'','time')+fld('m_attend','Expected attendance',m.attend||'','number','min="0" step="1"')+'</div><div class="row2">'+fld('m_flow','Exit flow (people / min / m)',m.flow||82,'number','min="10" step="1"')+fld('m_evt','Target clearance time (min)',m.evT||8,'number','min="1" step="0.5"')+'</div><div class="row2">'+fld('m_sitearea','Event site area, m² (if the venue has fencing you have not drawn)',m.siteArea||'','number','min="0" step="1"')+fld('m_cert','Venue certified capacity (fitness certificate)',m.certCap||'','number','min="0" step="1"')+'</div><p class="note">Space per person (m² each). Typical planning figures: confirm against SANS 10400, the approved risk category and your ESSPC / fire department.</p><div class="row2">'+DENS.map(function(x){return fld('m_d_'+x.k,x.n,dOf(x.k),'number','min="0.1" step="0.05"')}).join('')+'</div><label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="m_crowd"'+(m.crowd!==false?' checked':'')+'> Show the crowd &amp; capacity summary on the sheet</label><div class="btns"><button class="btn sm pri" data-act="crowd">Crowd &amp; capacity calculation…</button> <button class="btn sm pri" data-act="ready">Approval readiness check…</button></div>';
 h+='<h4>Sheet</h4><div class="row2"><label class="fld">Paper<select id="m_paper">'+Object.keys(PAPER).concat(['Custom']).map(function(k){return '<option'+(m.paper===k?' selected':'')+'>'+k+'</option>'}).join('')+'</select></label><label class="fld">Scale<select id="m_scale"><option value="auto"'+(m.scale==='auto'?' selected':'')+'>Auto-fit</option>'+SCALES.map(function(s){return '<option value="'+s+'"'+(String(m.scale)===String(s)?' selected':'')+'>1 : '+s+'</option>'}).join('')+'<option value="custom"'+(m.scale==='custom'?' selected':'')+'>Custom…</option></select></label></div>';
 if(m.paper==='Custom')h+='<div class="row2">'+fld('m_pw','Sheet width (mm)',m.pw||420,'number','min="60" step="1"')+fld('m_ph','Sheet height (mm)',m.ph||297,'number','min="60" step="1"')+'</div>';
 if(m.scale==='custom')h+=fld('m_scalec','Custom scale — 1 :',m.scaleC||500,'number','min="1" step="any"');
 h+='<div class="row2"><label class="fld">Plot area<select id="m_extent"><option value="content"'+(m.extent==='content'?' selected':'')+'>All drawn items</option><option value="view"'+(m.extent==='view'?' selected':'')+'>Current screen view</option></select></label>'+fld('m_north','North arrow (° clockwise)',m.north,'number','step="1"')+'</div>';
 h+='<label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="m_wm"'+(m.watermark?' checked':'')+'> Add a diagonal draft watermark to the sheet (leave off for submissions)</label><label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="m_bg"'+(m.bg?' checked':'')+'> Include aerial / client plan underlay</label>';
 h+='<h4>Emergency evacuation</h4><p class="note">Place your exits (Doors), assembly point and zones/tents/stands, then press Generate. Green routes run from each area to the nearest exit, around structures and fences, and on to the assembly point. It is a separate plan: toggle it with the Evacuation button, and it exports as its own sheet.</p><div class="btns"><button class="btn sm pri" data-act="evgen">Generate evacuation routes</button><button class="btn sm" data-act="evac">'+(m.evac?'Back to operational plan':'Show evacuation plan')+'</button></div>';
 h+='<h4>Internal layouts (tent, VIP area…)</h4><p class="note">Click a tent, zone or closed outline on the plan and press <b>Internal layout</b> in the bar that appears. Each structure gets its own layout (its own view, grid from its corner, legend, scale and sheet). Switch to that layout to see and draw its internals only, with its own legend, scale and sheet. Switch back to Whole plan to see everything together.</p>';
 var LY=m.layouts||[];
 if(LY.length){h+='<label class="fld">Current view<select id="m_view"><option value="">Whole plan</option>'+LY.map(function(l){return '<option value="'+l.id+'"'+(m.only===l.id?' selected':'')+'>'+esc(l.name)+'</option>'}).join('')+'</select></label>'}
 h+=(LY.length?'<div class="btns"><button class="btn sm pri" data-act="lxpdf">Download all layouts (one PDF)</button><button class="btn sm" data-act="lxpng">Download each as PNG</button></div>':'')+'<div class="btns"><button class="btn sm" data-act="newlay">New empty layout</button>'+(m.only?'<button class="btn sm" data-act="laysel">Add selected to this layout</button><button class="btn sm" data-act="layout">Remove selected from layout</button><button class="btn sm" data-act="layren">Rename</button><button class="btn sm dng" data-act="laydel">Delete layout</button>':'')+'</div>';
 h+='<h4>Plan type &amp; grid</h4><label class="fld">Plan type<select id="m_mode"><option value="outdoor"'+(m.mode!=='indoor'?' selected':'')+'>Outdoor event</option><option value="indoor"'+(m.mode==='indoor'?' selected':'')+'>Indoor / exhibition</option></select></label>';
 h+='<div class="row3">'+fld('m_gmod','Stand module (m, 0 = off)',m.gridMod||0,'number','min="0" step="any"')+fld('m_gmin','Fine grid every (m, 0 = off)',m.gridMinor===undefined?1:m.gridMinor,'number','min="0" step="any"')+fld('m_gx','Grid starts X (m)',m.gx||0,'number','step="any"')+fld('m_gy','Grid starts Y (m)',m.gy||0,'number','step="any"')+'</div><div class="btns"><button class="btn sm" data-act="gorigin">Set grid start by tapping the plan</button></div>';
 h+='<label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="m_gshow"'+(m.gridShow!==false?' checked':'')+'> Show the fine grid on the plan (over the aerial)</label><label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="m_gprint"'+(m.gridPrint!==false?' checked':'')+'> Print the grid on the sheet</label><label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="m_glab"'+(m.gridLabels!==false?' checked':'')+'> Letter the columns (A, B, C…) and number the rows (1, 2, 3…)</label><p class="note">Fine grid = every metre by default, so counting blocks gives the gap (3 open blocks = 3 m aisle). The module lines are bolder and carry the A/B/C and 1/2/3 labels. Exhibition tip: set the module to your stand size (for example 3 m). Stands from the Library then lock to the grid corners and snap follows the module. The Measure tool still works anywhere.</p><div class="btns"><button class="btn sm" data-act="autonum">Number the stands</button><button class="btn sm" data-act="stnames">Stand names…</button></div>';
 h+='<label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="m_front"'+(m.showFront!==false?' checked':'')+'> Show the orange front edge on structures</label>';
 h+='<h4>Safety checks</h4>'+fld('m_aisle','Minimum aisle / gap (m) — set to your event safety plan standard',m.minAisle,'number','step="0.1" min="0.1"')+'<div class="btns"><button class="btn sm pri" data-act="aisle">Check gaps between items</button>'+(S.issues.length?'<button class="btn sm" data-act="clrissue">Clear markers</button>':'')+'</div>';
 if(S.issues.length){h+='<p class="note">Gaps narrower than the minimum, shown in red on the plan. Round tables are checked as circles.</p>';S.issues.slice(0,12).forEach(function(it,i){h+='<div class="iss" data-iss="'+i+'"><span>'+esc(it.n)+'</span><b>'+fm(it.d)+'</b></div>'})}
 h+='<h4>Legend preview</h4><div id="legBox"></div>';
 h+=cloudHTML();h+='<h4>Before you submit</h4><div class="btns"><button class="btn pri" data-act="ready">Approval readiness check…</button></div><h4>Export</h4><div class="btns"><button class="btn pri" data-act="pdf">Export PDF</button><button class="btn" data-act="png">Export PNG</button><button class="btn" data-act="dxf">Export DXF (AutoCAD)</button></div><div class="btns"><button class="btn sm" data-act="save">Save project</button><button class="btn sm" data-act="open">Open project</button><button class="btn sm dng" data-act="newp">New plan</button></div>';
 return h;
}
function wirePanel(b){
 var o=getSel();
 function num(id,fn){var el=$('#'+id,b);if(el)el.onchange=function(){var v=parseFloat(el.value);if(isNaN(v))return;snapH();fn(v);changed();renderSelbar()}}
 function str(id,fn){var el=$('#'+id,b);if(el)el.oninput=function(){fn(el.value);draw();saveLocal();if(id==='m_company')$('#brandName').textContent=el.value||'FloorPlan Studio'}}

 $$('[data-zc]',b).forEach(function(z){z.onclick=function(){snapH();selObjs().forEach(function(q){q.col=z.dataset.zc});changed();renderPanel()}});
 $$('[data-p]',b).forEach(function(el){
  var k=el.dataset.p,ty=el.type,isTxt=(ty==='text'||el.tagName==='TEXTAREA'||ty==='range'),first=true;
  function apply(){
   var T=selObjs();if(!T.length)return;var v;
   if(ty==='checkbox')v=el.checked;
   else if(ty==='number'||ty==='range'){v=parseFloat(el.value);if(isNaN(v))return;if(el.dataset.div)v/=+el.dataset.div;if(el.min!==''&&v<+el.min&&!el.dataset.div)v=+el.min}
   else{v=el.value;if(el.tagName==='SELECT'&&v==='')return}
   if(first||!isTxt){snapH();first=false}
   T.forEach(function(q){q[k]=(k==='rot')?((v%360)+360)%360:v;if(k==='sh'&&v==='rect')delete q.sh;if(k==='fr'&&v==='auto')delete q.fr});
   changed();renderSelbar();if(!isTxt)renderPanel();
  }
  el.addEventListener(isTxt?'input':'change',apply);
 });
 if(S.tab==='sheet'){
  ['event','title','venue','client','date','rev','drawn','ref','company','tstart','tend'].forEach(function(k){str('m_'+k,function(v){S.meta[k]=v})});
  [['m_attend','attend',0],['m_flow','flow',82],['m_evt','evT',8],['m_sitearea','siteArea',0],['m_cert','certCap',0]].forEach(function(q){var el=$('#'+q[0],b);if(el)el.onchange=function(){var v=parseFloat(el.value);S.meta[q[1]]=(v>0)?v:q[2];saveLocal();draw()}});
  DENS.forEach(function(x){var el=$('#m_d_'+x.k,b);if(el)el.onchange=function(){var v=parseFloat(el.value);S.meta.dens=S.meta.dens||{};if(v>0)S.meta.dens[x.k]=v;else delete S.meta.dens[x.k];saveLocal();renderPanel()}});
  var mcw=$('#m_crowd',b);if(mcw)mcw.onchange=function(){S.meta.crowd=mcw.checked;saveLocal()};
  var mp=$('#m_paper',b);if(mp)mp.onchange=function(){S.meta.paper=mp.value;saveLocal();renderPanel()};
  [['m_pw','pw'],['m_ph','ph'],['m_scalec','scaleC']].forEach(function(q){var el=$('#'+q[0],b);if(el)el.onchange=function(){var v=parseFloat(el.value);if(v>0){S.meta[q[1]]=v;saveLocal()}}});
  var ms=$('#m_scale',b);if(ms)ms.onchange=function(){S.meta.scale=ms.value;saveLocal();renderPanel()};
  var me=$('#m_extent',b);if(me)me.onchange=function(){S.meta.extent=me.value;saveLocal()};
  var mn=$('#m_north',b);if(mn)mn.onchange=function(){S.meta.north=parseFloat(mn.value)||0;saveLocal()};
  var ma=$('#m_aisle',b);if(ma)ma.onchange=function(){S.meta.minAisle=Math.max(.1,parseFloat(ma.value)||2);saveLocal()};
  var mw=$('#m_wm',b);if(mw)mw.onchange=function(){S.meta.watermark=mw.checked;saveLocal()};
  var mb=$('#m_bg',b);if(mb)mb.onchange=function(){S.meta.bg=mb.checked;saveLocal()};
  var mv0=$('#m_view',b);if(mv0)mv0.onchange=function(){setView(mv0.value)};
  var mm0=$('#m_mode',b);if(mm0)mm0.onchange=function(){S.meta.mode=mm0.value;if(mm0.value==='indoor'&&!(S.meta.gridMod>0)){S.meta.gridMod=3;setSnap(3)}saveLocal();renderPanel();draw()};
  [['m_gmod','gridMod'],['m_gmin','gridMinor'],['m_gx','gx'],['m_gy','gy']].forEach(function(q){var el=$('#'+q[0],b);if(el)el.onchange=function(){var v=parseFloat(el.value);if(isNaN(v)||((q[1]==='gridMod'||q[1]==='gridMinor')&&v<0))v=0;S.meta[q[1]]=v;if(q[1]==='gridMod'&&v>0)setSnap(v);saveLocal();draw()}});
  var mf0=$('#m_front',b);if(mf0)mf0.onchange=function(){S.meta.showFront=mf0.checked;saveLocal();draw()};
  var mg0=$('#m_gshow',b);if(mg0)mg0.onchange=function(){S.meta.gridShow=mg0.checked;saveLocal();draw()};
  var mg1=$('#m_gprint',b);if(mg1)mg1.onchange=function(){S.meta.gridPrint=mg1.checked;saveLocal()};
  var mg2=$('#m_glab',b);if(mg2)mg2.onchange=function(){S.meta.gridLabels=mg2.checked;saveLocal();draw()};
 }
 b.onclick=function(e){
  var t=e.target.closest('button,.iss,.orow');if(!t)return;var d=t.dataset;
  if(d.olk||d.ohd){var oo=S.objs.filter(function(q){return q.id===+(d.olk||d.ohd)})[0];if(oo){snapH();if(d.olk)oo.lk=!oo.lk;else oo.hd=!oo.hd;changed(true)}return}
  if(d.osel){var o3=S.objs.filter(function(q){return q.id===+d.osel})[0];if(o3){if(e.shiftKey||e.ctrlKey){var ids2=selIds().slice(),ix2=ids2.indexOf(o3.id);if(ix2>=0)ids2.splice(ix2,1);else ids2.push(o3.id);setSel(ids2)}else setSel([o3.id]);var bb=boundsOf(o3);S.view.x=cv.clientWidth/2-((bb.x0+bb.x1)/2)*S.view.z;S.view.y=cv.clientHeight/2-((bb.y0+bb.y1)/2)*S.view.z;renderSelbar();renderPanel();draw()}return}
  if(d.arm){var a=d.arm;setTool('place',a);toast('Tap the plan to place');if(matchMedia('(max-width:820px)').matches)closePanel();return}
  if(d.act){act(d.act);return}
  if(d.latr){var LA=layer(+d.latr);if(LA)autoTraceModal(LA);return}
  if(d.ldet){var LD=layer(+d.ldet);if(LD)detectModal(LD);return}
  if(d.lcal){var L=layer(+d.lcal);S.calib={id:L.id,pts:[]};setTool('calib');if(matchMedia('(max-width:820px)').matches)closePanel();return}
  if(d.lmv){S.mv=+d.lmv;setTool('layermove');if(matchMedia('(max-width:820px)').matches)closePanel();return}
  if(d.lsc){var pr=d.lsc.split(':'),Ls=layer(+pr[0]);scaleLayer(Ls,parseFloat(pr[1]));if(Ls.cal===true)Ls.cal='eye';renderPanel();draw();return}
  if(d.lvis){var L2=layer(+d.lvis);L2.vis=!L2.vis;renderPanel();draw();return}
  if(d.lup||d.ldn){var id=+(d.lup||d.ldn),i=S.layers.findIndex(function(l){return l.id===id}),j=d.lup?i+1:i-1;if(j>=0&&j<S.layers.length){var tmp=S.layers[i];S.layers[i]=S.layers[j];S.layers[j]=tmp}renderPanel();draw();return}
  if(d.lbase){var Lb=layer(+d.lbase);Lb.base=!Lb.base;if(Lb.base){Lb._op=Lb.op;Lb.op=1;Lb.blend='multiply';S.meta.bg=true;S.meta.gridShow=false;toast('Editing the client plan: it now shows at full strength and prints as the drawing. Add exits (Library → Doors), signs and the evacuation plan on top. Use Cover patch (Library → Plan editing) to hide anything you do not want.',9000)}else{Lb.op=Lb._op||.65;toast('Plan back to a faint tracing background',3000)}renderPanel();draw();return}
  if(d.ldel){S.layers=S.layers.filter(function(l){return l.id!==+d.ldel});renderPanel();draw();updateWelcome();return}
  if(d.lpsa){var L3=layer(+d.lpsa),inp=$('[data-lps="'+L3.id+'"]',b),N=parseFloat(inp.value);if(!(N>0)){toast('Enter the scale printed on the drawing, e.g. 500');return}var pp=$('[data-lpp="'+L3.id+'"]',b),orig=pp?parseFloat(pp.value):0,red=(orig>0&&L3.pdfLong>0)?orig/L3.pdfLong:1,f=(25.4/72/L3.pdfScale)*N*red/1000/L3.mpp;L3.mpp*=f;L3.cal=true;renderPanel();draw();toast('Print scale applied. Check it with a measurement.');return}
  if(d.iss!=null){var it=S.issues[+d.iss];if(it){var cx=(it.a.x+it.b.x)/2,cy=(it.a.y+it.b.y)/2;S.view.x=cv.clientWidth/2-cx*S.view.z;S.view.y=cv.clientHeight/2-cy*S.view.z;draw()}return}
 };
 $$('[data-lop]',b).forEach(function(r){r.oninput=function(){layer(+r.dataset.lop).op=r.value/100;draw();r.parentNode.firstChild.nodeValue='Opacity '+r.value+'%'}});
 $$('[data-lcrisp]',b).forEach(function(r){r.onchange=function(){var L=layer(+r.dataset.lcrisp);L.crisp=r.checked;draw()}});
 $$('[data-lrot]',b).forEach(function(r){r.onchange=function(){var L=layer(+r.dataset.lrot);L.rot=parseFloat(r.value)||0;draw()}});
 $$('[data-lw]',b).forEach(function(r){r.onchange=function(){var L=layer(+r.dataset.lw),nw=parseFloat(r.value);if(nw>0){scaleLayer(L,nw/(L.img.width*L.mpp));L.cal=true;renderPanel();draw()}}});
 $$('[data-lbl]',b).forEach(function(r){r.onchange=function(){layer(+r.dataset.lbl).blend=r.value;draw()}});
}
function scaleLayer(L,f,cx,cy){if(cx==null){var c=rotv(L.img.width*L.mpp/2,L.img.height*L.mpp/2,L.rot*D2R);cx=L.x+c.x;cy=L.y+c.y}L.mpp*=f;L.x=cx+(L.x-cx)*f;L.y=cy+(L.y-cy)*f}
function layer(id){return S.layers.filter(function(l){return l.id===id})[0]}
function act(a){
 if(a.indexOf('aln_')===0){alignSel(a.slice(4));return}
 if(a.indexOf('rst:')===0){var pr=a.slice(4);snapH();selObjs().forEach(function(q){delete q[pr]});changed(true);return}
 var ZM={zf:'front',zb:'back',zu:'up',zd:'down'};if(ZM[a]){zOrder(ZM[a]);return}
 if(a==='copy'){copySel();return}if(a==='paste'){pasteSel();return}
 if(a==='selall'){selectAll();return}
 if(a==='unlockall'){snapH();S.objs.forEach(function(q){delete q.lk});changed(true);return}
 if(a==='showall'){snapH();S.objs.forEach(function(q){delete q.hd});changed(true);return}
 if(a==='flip'){var o=getSel();if(o){snapH();o.rot=(o.rot+180)%360;changed(true)}}
 else if(a==='dup')dupSel();else if(a==='del')delSel();else if(a==='arr')arraySel();
 else if(a==='addsym')addSymbol();
 else if(a==='addmap')openMap();else if(a==='addsat')pickLayer('sat');else if(a==='addplan')pickLayer('plan');else if(a==='pdfpage'&&S._lastPdf)addLayer({name:S._lastPdf.name,type:'application/pdf'},'plan',undefined,S._lastPdf.pdf);
 else if(a==='logo'){pickFile(ANYIMG,function(f){fileToLogo(f,function(d){S.meta.logo=d;S.logoImg=null;saveLocal();renderPanel();draw();toast('Logo added')})})}
 else if(a==='nologo'){S.meta.logo=null;S.logoImg=null;saveLocal();renderPanel()}
 else if(a==='elogo'){pickFile(ANYIMG,function(f){fileToLogo(f,function(d){S.meta.eventLogo=d;saveLocal();renderPanel();draw();toast('Event logo added')})})}
 else if(a==='noelogo'){S.meta.eventLogo=null;saveLocal();renderPanel()}
 else if(a==='dogleg'){var dl=S.objs.filter(function(x){return x.id===S.sel})[0];if(dl&&dl.t==='line'){S.dogId=dl.id;closePanel();setTool('dogtap')}}
 else if(a==='crowd'||a==='crowdev')crowdModal();
 else if(a==='drawsite'){var mm=$('#modal');mm.classList.remove('on');mm.innerHTML='';S.siteNext=true;setTool('poly');toast('Tap around the whole event area, then tap Finish. It becomes the event site boundary.',7000)}
 else if(a==='sitearea'){var sa=$('#cm_sitearea'),v=sa?parseFloat(sa.value):0;S.meta.siteArea=v>0?v:0;var ce=$('#cm_cert'),cv=ce?parseFloat(ce.value):0;S.meta.certCap=cv>0?cv:0;saveLocal();draw();crowdModal();toast(v>0?'Event area set to '+Math.round(v)+' m²':'Event area cleared')}
 else if(a==='ready')rdyModal();
 else if(a==='evdraw'){S.lineStyle='evac';setTool('line');toast('Tap along the route from the area to the exit, then tap Finish. It is kept when you press Generate again.',6000)}
 else if(a==='evlock'){var evs=S.objs.filter(function(o){return o.ev&&(!S.meta.only||o.lay===S.meta.only)});if(!evs.length){toast('No routes yet');return}var lk=!evs.every(function(o){return o.keep});snapH();evs.forEach(function(o){if(lk)o.keep=1;else delete o.keep});changed(true);toast(lk?evs.length+' routes locked: Generate will leave them alone':'Routes unlocked')}
 else if(a==='gapsclr'){var go=getSel();if(go){snapH();delete go.gaps;changed(true);renderPanel()}}
  else if(a==='evrev'){var ro=getSel();if(ro&&ro.pts){snapH();ro.pts.reverse();changed(true)}}
 else if(a==='autonum')autoNumber();else if(a==='stnames')standNamesModal();else if(a==='gorigin'){closePanel();setTool('gorigin')}
 else if(a==='newlay')newLayout();
 else if(a==='evac')setEvac(!S.meta.evac);
 else if(a.indexOf('face:')===0){var AN={u:-90,r:0,d:90,l:180}[a.slice(5)];faceTo(function(){return AN})}
 else if(a==='facematch'){var ids=selIds(),first=S.objs.filter(function(q){return q.id===ids[0]})[0];if(!first||first.t!=='rect'){toast('Select several structures; the first one selected sets the direction');return}var ang=first.rot+SIDEANG[frontSide(first)==='none'?'s':frontSide(first)];faceTo(function(){return ang})}
 else if(a==='facept'){S.fpIds=selIds().slice();if(!S.fpIds.length){toast('Select the structures first');return}setTool('facept');if(matchMedia('(max-width:820px)').matches)closePanel()}
 else if(a==='inlay')layoutForObj(getSel());
 else if(a==='lxpdf')exportAllLayouts('pdf');else if(a==='lxpng')exportAllLayouts('png');
 else if(a==='evgen')genEvac();
 else if(a==='evclr'){snapH();var nn=evClear();changed(true);toast(nn?nn+' routes cleared':'No routes to clear')}
 else if(a==='laysel'){var ss=selObjs();if(!ss.length){toast('Select items first');return}snapH();ss.forEach(function(o){o.lay=S.meta.only});changed(true);toast(ss.length+' added to this layout')}
 else if(a==='layout'){var s3=selObjs();if(!s3.length){toast('Select items first');return}snapH();s3.forEach(function(o){delete o.lay});setSel([]);changed(true);toast('Removed from this layout (now on the whole plan only)')}
 else if(a==='layren'){var lo=layoutOf(S.meta.only);if(lo)ask('Rename layout',[{l:'Name',v:lo.name}],function(v){if((v[0]||'').trim()){lo.name=v[0].trim();renderViewSel();saveLocal();renderPanel();draw()}},'Rename')}
 else if(a==='laydel'){var lo2=layoutOf(S.meta.only);if(lo2)ask('Delete layout "'+lo2.name+'"?',[{l:'Type YES. Its items stay on the whole plan.',v:''}],function(v){if(v[0].trim().toUpperCase()==='YES'){var id=lo2.id;snapH();S.objs.forEach(function(o){if(o.lay===id)delete o.lay});S.meta.layouts=S.meta.layouts.filter(function(l){return l.id!==id});S.meta.only=null;renderViewSel();changed(true);fitAll();renderPanel()}},'Delete')}
 else if(a==='aisle')checkAisles();
 else if(a==='clrissue'){S.issues=[];draw();renderPanel()}
 else if(a==='pdf')exportSheet('pdf');else if(a==='png')exportSheet('png');else if(a==='dxf')exportDxf();else if(a==='adddxf')importDxf();
 else if(a==='save')saveProject();else if(a==='open')openProject();
 else if(a==='clogin')cloudAuth('login');else if(a==='csetup')cloudAuth('setup');else if(a==='clogout')cloudLogout();else if(a==='csave')cloudSave();else if(a==='copen')cloudOpen();else if(a==='crevs')cloudRevs();else if(a==='cuser')cloudUser();
 else if(a==='clearp'){if(S.clrArm!=='p'){armClear('p');return}S.clrArm=null;clearProject()}
 else if(a==='clearev'){if(S.clrArm!=='e'){armClear('e');return}S.clrArm=null;venueNewEvent();toast('Event cleared, venue kept');renderPanel()}
 else if(a==='newp'){ask('Start a new plan?',[{l:'Type YES to clear the current plan and images',v:''}],function(v){if(v[0].trim().toUpperCase()==='YES'){snapH();S.objs=[];S.layers=[];S.sel=null;S.issues=[];S.meta.only=null;S.meta.layouts=[];S.meta.evac=false;syncEvac();renderViewSel();S.cloud.planId=null;S.cloud.rev=null;changed(true);fitAll()}},'Clear')}
}
function renderSelbar(){
 var el=$('#selbar'),a=selObjs();if(!a.length){el.classList.remove('on');return}
 var o=getSel(),arr=o&&(o.t==='rect'||o.t==='area'||o.t==='door'||o.t==='sign');
 el.innerHTML='<button class="btn sm" data-a="edit">'+(a.length>1?a.length+' selected · Edit':'Edit')+'</button><button class="btn sm" data-a="dup">Duplicate</button>'+(a.length===1&&canHost(o)?'<button class="btn sm pri" data-a="inlay">'+((S.meta.layouts||[]).some(function(l){return l.src===o.id})?'Open internal layout':'Internal layout')+'</button>':'')+(arr?'<button class="btn sm" data-a="arr">Repeat</button>':'')+'<button class="btn sm dng" data-a="del">Delete</button>';
 el.classList.add('on');
 el.onclick=function(e){var b=e.target.closest('button');if(!b)return;var a2=b.dataset.a;if(a2==='edit'){S.tab='sel';openPanel()}else if(a2==='dup')dupSel();else if(a2==='arr')arraySel();else if(a2==='inlay')layoutForObj(getSel());else if(a2==='del')delSel()};
}

