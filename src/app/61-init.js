/* ---------- init ---------- */
loadLocal();enforceBrand();buildTools();cloudInit();idbRestore();
$('#brandName').textContent=S.meta.company||'FloorPlan Studio';
setTool('select');renderPanel();
if(S.objs.length)S.dismissed=true;
updateWelcome();
setTimeout(function(){resize();fitAll()},30);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){draw()});
if(!matchMedia('(max-width:820px)').matches){}
