/* ---------- project save / open ---------- */
function layerToData(L){var sc=Math.min(1,(L.kind==='plan'?4400:3600)/Math.max(L.img.width,L.img.height)),cn=document.createElement('canvas');cn.width=Math.round(L.img.width*sc);cn.height=Math.round(L.img.height*sc);var c=cn.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,cn.width,cn.height);c.drawImage(L.img,0,0,cn.width,cn.height);return {name:L.name,kind:L.kind,mpp:L.mpp/sc,x:L.x,y:L.y,rot:L.rot,op:L.op,blend:L.blend,cal:L.cal,vis:L.vis,geo:L.geo,base:L.base,_op:L._op,pdfLong:L.pdfLong,crisp:L.crisp,data:cn.toDataURL('image/jpeg',L.kind==='plan'?.92:.85)}}
async function saveProject(){
 toast('Preparing project file…',4000);
 var data={v:1,meta:S.meta,objs:S.objs,nid:S.nid,custom:S.custom.map(function(c){return {k:c.k,n:c.n,w:c.w,h:c.h,src:c.src}}),layers:S.layers.map(layerToData)};
 await download((S.meta.event||'plan').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')+'_'+S.meta.ref+'.json',new Blob([JSON.stringify(data)],{type:'application/json'}));
 S.dirty=false;S.savedAt=Date.now();S.savedHow='file';saveLocal();S.dirty=false;chipUpdate();
}
function openProject(){pickFile('.json,application/json',function(f){var r=new FileReader();r.onload=async function(){try{var d=JSON.parse(r.result);Object.keys(d.meta||{}).forEach(function(k){S.meta[k]=d.meta[k]});S.logoImg=null;S.objs=d.objs||[];S.nid=d.nid||1;S.custom=[];(d.custom||[]).forEach(addCustomLib);S.layers=[];for(var i=0;i<(d.layers||[]).length;i++){var q=d.layers[i],im=await loadImgSrc(q.data);S.layers.push({id:S.nl++,name:q.name,kind:q.kind,img:im,mpp:q.mpp,x:q.x,y:q.y,rot:q.rot,op:q.op,blend:q.blend,cal:q.cal,vis:q.vis!==false,geo:q.geo,base:q.base,_op:q._op,pdfLong:q.pdfLong,pdfScale:null,crisp:q.crisp})}S.sel=null;S.issues=[];hist.length=0;redoS.length=0;enforceBrand();$('#brandName').textContent=S.meta.company||'FloorPlan Studio';fitAll();changed(true);S.dirty=false;S.savedAt=Date.now();S.savedHow='file';chipUpdate();toast('Project opened')}catch(e){toast('That file could not be opened',4000)}};r.readAsText(f)})}
async function download(name,blob){
 try{var dl=window.claude&&await claude.use('downloads');
  if(dl){await dl.save({filename:name,data:blob});toast('Saved '+name);return true}
 }catch(e){if(e&&e.code==='declined')return false}
 try{var u=URL.createObjectURL(blob),an=document.createElement('a');an.href=u;an.download=name;document.body.appendChild(an);an.click();setTimeout(function(){an.remove();URL.revokeObjectURL(u)},4000);toast('Saved '+name);return true}catch(e2){return false}
}

