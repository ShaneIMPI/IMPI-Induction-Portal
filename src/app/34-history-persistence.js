/* ---------- history / persistence ---------- */
function snapH(){hist.push(JSON.stringify(S.objs));if(hist.length>1000)hist.shift();redoS.length=0}
function undo(){if(!hist.length)return;redoS.push(JSON.stringify(S.objs));S.objs=JSON.parse(hist.pop());S.sel=null;S.issues=[];changed(true)}
function redo(){if(!redoS.length)return;hist.push(JSON.stringify(S.objs));S.objs=JSON.parse(redoS.pop());S.sel=null;changed(true)}
var saveT=0;
function saveLocal(){S.dirty=true;clearTimeout(saveT);saveT=setTimeout(function(){
 try{var m=JSON.parse(JSON.stringify(S.meta));if(m.logo&&m.logo.length>450000)m.logo=null;if(m.eventLogo&&m.eventLogo.length>900000)m.eventLogo=null;localStorage.setItem('fps_v1',JSON.stringify({meta:m,objs:S.objs,nid:S.nid,custom:S.custom.map(function(c){return {k:c.k,n:c.n,w:c.w,h:c.h,src:c.src}}).filter(function(c){return c.src.length<300000})}));S.lsFail=false}catch(e){S.lsFail=true}
 idbSaveAll();chipUpdate()},500)}

