/* ---------- durable local copy (IndexedDB) + save status ---------- */
var IDB=null,idbBusy=false,idbAgain=false;
function idbOpen(){return new Promise(function(res,rej){if(IDB)return res(IDB);try{var r=indexedDB.open('fps_local',1);r.onupgradeneeded=function(){r.result.createObjectStore('kv')};r.onsuccess=function(){IDB=r.result;res(IDB)};r.onerror=function(){rej(r.error)}}catch(e){rej(e)}})}
function idbPut(k,v){return idbOpen().then(function(d){return new Promise(function(res,rej){var t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=function(){res()};t.onerror=function(){rej(t.error)};t.onabort=function(){rej(t.error)}})})}
function idbGet(k){return idbOpen().then(function(d){return new Promise(function(res,rej){var t=d.transaction('kv','readonly'),q=t.objectStore('kv').get(k);q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)}})})}
var LAYKEYS=['name','kind','x','y','rot','op','blend','cal','vis','geo','base','_op','pdfLong'];
async function idbSaveAll(){
 if(idbBusy){idbAgain=true;return}idbBusy=true;
 try{
  var lays=[];
  for(var i=0;i<S.layers.length;i++){var L=S.layers[i];
   if(!L._bk||L._bk.img!==L.img){var sc=Math.min(1,3600/Math.max(L.img.width,L.img.height));L._bk={sc:sc,img:L.img,blob:await layerBlob(L,sc)}}
   var q={mpp:L.mpp/L._bk.sc,blob:L._bk.blob};LAYKEYS.forEach(function(k){if(L[k]!==undefined)q[k]=L[k]});lays.push(q)}
  await idbPut('layers',{at:Date.now(),layers:lays});
  await idbPut('session',{at:Date.now(),dirty:!!S.dirty,meta:S.meta,objs:S.objs,nid:S.nid,custom:S.custom.map(function(c){return {k:c.k,n:c.n,w:c.w,h:c.h,src:c.src}}),cloud:{planId:S.cloud&&S.cloud.planId,rev:S.cloud&&S.cloud.rev}});
  S.idbFail=false
 }catch(e){S.idbFail=true}
 idbBusy=false;if(idbAgain){idbAgain=false;idbSaveAll()}
}
async function idbRestore(){
 try{
  var ses=await idbGet('session'),rec=await idbGet('layers'),did=false;
  if(ses&&S.cloud&&ses.cloud&&ses.cloud.planId){S.cloud.planId=ses.cloud.planId;S.cloud.rev=ses.cloud.rev}
  if(ses&&ses.objs&&!S.objs.length&&!lsGet('fps_v1')){Object.keys(ses.meta||{}).forEach(function(k){S.meta[k]=ses.meta[k]});S.objs=ses.objs;S.nid=ses.nid||1;(ses.custom||[]).forEach(addCustomLib);did=true}
  if(rec&&rec.layers&&rec.layers.length&&!S.layers.length){
   for(var i=0;i<rec.layers.length;i++){var q=rec.layers[i],im=await loadImgSrc(URL.createObjectURL(q.blob)),L={id:S.nl++,img:im,mpp:q.mpp};LAYKEYS.forEach(function(k){if(q[k]!==undefined)L[k]=q[k]});if(L.vis===undefined)L.vis=true;L.pdfScale=null;L._bk={sc:1,img:im,blob:q.blob};S.layers.push(L)}
   // stored mpp is relative to the stored (scaled) image, which is what we just loaded
   did=true}
  if(did){S._lsig=layersSig();S.dirty=!!(ses&&ses.dirty);S.dismissed=true;enforceBrand();$('#brandName').textContent=S.meta.company||'FloorPlan Studio';fitAll();updateWelcome();renderPanel();draw();toast('Restored your last session, including the background images',4500)}
 }catch(e){}
 chipUpdate()
}
function chipUpdate(){
 var el=$('#saveChip');if(!el)return;var has=S.objs.length||S.layers.length;
 if(!has){el.hidden=true;return}el.hidden=false;
 function tm(t){var d=new Date(t);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
 var txt,cls='';
 if(S.lsFail&&S.idbFail){txt='⚠ Not auto-saving: save to the cloud or download a file now';cls='warn'}
 else if(S.dirty){txt='● Unsaved changes'+(S.savedAt?' (last saved '+tm(S.savedAt)+')':'');cls='warn'}
 else if(S.savedAt){txt='✓ '+(S.savedHow==='file'?'Backup file saved ':'Saved to cloud'+(S.cloud&&S.cloud.rev?' #'+S.cloud.rev:'')+' ')+tm(S.savedAt);cls='ok'}
 else txt='✓ Nothing changed';
 el.textContent=txt;el.className=cls;
 el.title=S.dirty?'Your work is kept on this device automatically (including background images), but it is not in the cloud or in a file yet. Use Save to cloud (Sheet tab) or Export > Project file.':'Everything is saved.'
}
function layersSig(){return S.layers.map(function(L){return [L.id,L.mpp,L.x,L.y,L.rot,L.op,L.blend,L.vis,L.cal,L.base,L.name].join('|')}).join(';')}
S._lsig='';
setInterval(function(){try{var sig=layersSig();if(sig!==S._lsig){S._lsig=sig;saveLocal()}chipUpdate()}catch(e){}},2500);
window.addEventListener('beforeunload',function(e){if(S.dirty&&(S.objs.length||S.layers.length)){e.preventDefault();e.returnValue=''}});
function loadLocal(){try{var j=localStorage.getItem('fps_v1');if(!j)return;var d=JSON.parse(j);if(d.meta)Object.keys(d.meta).forEach(function(k){S.meta[k]=d.meta[k]});S.objs=d.objs||[];S.nid=d.nid||1;(d.custom||[]).forEach(addCustomLib)}catch(e){}}
function changed(full){enforceBrand();S.issues=S.issues&&S.issues.length&&!full?[]:S.issues;draw();saveLocal();updateWelcome();if(full){renderPanel();renderSelbar()}else if(S.tab==='sheet'){refreshLegend()}}

