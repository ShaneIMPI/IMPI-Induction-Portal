/* ---------- cloud (Neon via /api) ---------- */
S.cloud={on:!!window.__FPS_USER,user:window.__FPS_USER||null,needsSetup:false,planId:null,rev:null};
async function api(path,opt){
 opt=opt||{};var init={method:opt.method||'GET',credentials:'same-origin',headers:opt.headers||{}};
 if(opt.json){init.headers['content-type']='application/json';init.body=JSON.stringify(opt.json)}
 if(opt.body)init.body=opt.body;
 var r=await fetch(path,init),t=await r.text(),j=null;try{j=JSON.parse(t)}catch(e){}
 if(r.status===401&&!(opt.json&&opt.json.action==='login')){if(S.objs.length||S.layers.length){S.cloud.user=null;try{renderPanel()}catch(e){}throw new Error('Your sign-in expired. Your work is kept on this device. Sign in again (Sheet tab, Cloud) and save')}location.href='/';throw new Error('Session expired. Please sign in again.')}
 if(!r.ok)throw new Error((j&&j.error)||('Request failed ('+r.status+')'));
 if(j===null)throw new Error('Unexpected response');return j;
}
function cloudInit(){
 if(location.protocol==='file:')return;
 api('/api/auth').then(function(j){if(!j.user){location.href='/';return}S.cloud.on=true;S.cloud.user=j.user;enforceBrand();S.cloud.needsSetup=j.needsSetup;if(S.tab==='sheet')renderPanel()}).catch(function(){S.cloud.on=false});
}
function cloudHTML(){
 var c=S.cloud,h='<h4>Cloud</h4>';
 if(!c.on)return h+'<p class="note">Cloud save and revision history switch on once the app is deployed with its Neon database (see README).</p>';
 if(c.needsSetup)return h+'<p class="note">First run: create the administrator account.</p><div class="btns"><button class="btn sm pri" data-act="csetup">Create admin account</button></div>';
 if(!c.user)return h+'<div class="btns"><button class="btn sm pri" data-act="clogin">Sign in</button></div>';
 h+='<p class="note">Signed in as <b>'+esc(c.user.name)+'</b>'+(c.planId?' · cloud plan open'+(c.rev?', revision #'+c.rev:''):' · not saved to the cloud yet')+'</p>';
 h+='<div class="btns"><button class="btn sm pri" data-act="csave">Save to cloud</button><button class="btn sm" data-act="copen">Open from cloud</button>'+(c.planId?'<button class="btn sm" data-act="crevs">Revisions</button>':'')+(c.user.role==='admin'?'<button class="btn sm" data-act="cuser">Add team member</button>':'')+'<button class="btn sm" data-act="clogout">Sign out</button></div>';
 return h;
}
function cloudAuth(kind){
 var setup=kind==='setup';
 ask(setup?'Create admin account':'Sign in',(setup?[{l:'Your name',v:''}]:[]).concat([{l:'Email',v:'',type:'email'},{l:'Password'+(setup?' (min 10 characters)':''),v:'',type:'password'}]),async function(v){
  try{var b=setup?{action:'setup',name:v[0],email:v[1],password:v[2]}:{action:'login',email:v[0],password:v[1]};
   var j=await api('/api/auth',{method:'POST',json:b});S.cloud.user=j.user;S.cloud.needsSetup=false;renderPanel();toast('Signed in as '+j.user.name)}
  catch(e){toast(e.message,4500)}
 },setup?'Create':'Sign in');
}
function cloudUser(){
 ask('Add team member',[{l:'Name',v:''},{l:'Email',v:'',type:'email'},{l:'Temporary password (min 10 characters)',v:'',type:'password'}],async function(v){
  try{await api('/api/auth',{method:'POST',json:{action:'createUser',name:v[0],email:v[1],password:v[2]}});toast('Team member added')}catch(e){toast(e.message,4500)}
 },'Add');
}
async function cloudLogout(){try{await api('/api/auth',{method:'POST',json:{action:'logout'}})}catch(e){}S.cloud.user=null;S.cloud.planId=null;S.cloud.rev=null;location.href='/'}
function layerBlob(L,sc){var jq=L.kind==='plan'?.92:.82;return new Promise(function(res){var cn=document.createElement('canvas');cn.width=Math.round(L.img.width*sc);cn.height=Math.round(L.img.height*sc);var c=cn.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,cn.width,cn.height);c.drawImage(L.img,0,0,cn.width,cn.height);cn.toBlob(res,'image/jpeg',jq)})}
async function uploadLayer(L){
 var sc=Math.min(1,(L.kind==='plan'?4400:3000)/Math.max(L.img.width,L.img.height)),blob;
 for(var t=0;t<4;t++){blob=await layerBlob(L,sc);if(blob.size<4200000)break;sc*=.75}
 var r=await api('/api/image',{method:'POST',body:blob,headers:{'content-type':'image/jpeg','x-name':encodeURIComponent(L.name)}});
 L.imageId=r.id;L.cloudSc=sc;
}
function cloudSave(){
 ask('Save to cloud',[{l:'Revision label (e.g. A, B, Issued for EMS)',v:S.meta.rev},{l:'Note (optional)',v:''}],async function(v){
  try{
   toast('Saving…',30000);S.meta.rev=v[0]||S.meta.rev;
   for(var i=0;i<S.layers.length;i++)if(!S.layers[i].imageId)await uploadLayer(S.layers[i]);
   var data={v:2,meta:S.meta,objs:S.objs,nid:S.nid,custom:S.custom.map(function(c){return {k:c.k,n:c.n,w:c.w,h:c.h,src:c.src}}),layers:S.layers.map(function(L){return {name:L.name,kind:L.kind,imageId:L.imageId,mpp:L.mpp/(L.cloudSc||1),x:L.x,y:L.y,rot:L.rot,op:L.op,blend:L.blend,cal:L.cal,vis:L.vis,geo:L.geo,base:L.base,_op:L._op,pdfLong:L.pdfLong,crisp:L.crisp}})};
   var j=await api('/api/plans',{method:'POST',json:{planId:S.cloud.planId,label:v[0],note:v[1],data:data}});
   var chk=await api('/api/plans?id='+j.planId+'&rev='+j.rev_no),cd=chk&&chk.revision&&chk.revision.data;
   if(!cd||(cd.objs||[]).length!==S.objs.length||(cd.layers||[]).length!==S.layers.length)throw new Error('The cloud copy did not match what is on screen, so it was not trusted');
   S.cloud.planId=j.planId;S.cloud.rev=j.rev_no;S.dirty=false;S.savedAt=Date.now();S.savedHow='cloud';saveLocal();S.dirty=false;chipUpdate();renderPanel();toast('Saved to the cloud as revision #'+j.rev_no+' and checked',5000);
  }catch(e){toast('Cloud save failed: '+e.message+'. Downloading a backup file instead…',7000);try{await saveProject()}catch(e2){}}
 },'Save');
}
async function applyCloud(res){
 var d=res.revision.data;Object.keys(d.meta||{}).forEach(function(k){S.meta[k]=d.meta[k]});S.logoImg=null;S.objs=d.objs||[];S.nid=d.nid||1;S.custom=[];(d.custom||[]).forEach(addCustomLib);S.layers=[];
 for(var i=0;i<(d.layers||[]).length;i++){var q=d.layers[i],im=await loadImgSrc('/api/image?id='+q.imageId);S.layers.push({id:S.nl++,name:q.name,kind:q.kind,img:im,mpp:q.mpp,x:q.x,y:q.y,rot:q.rot,op:q.op,blend:q.blend,cal:q.cal,vis:q.vis!==false,geo:q.geo,base:q.base,_op:q._op,pdfLong:q.pdfLong,pdfScale:null,crisp:q.crisp,imageId:q.imageId,cloudSc:1})}
 S.sel=null;S.issues=[];hist.length=0;redoS.length=0;S.dismissed=true;S.cloud.planId=res.plan.id;S.cloud.rev=res.revision.rev_no;
 $('#brandName').textContent=S.meta.company||'FloorPlan Studio';fitAll();changed(true);S.dirty=false;S.savedAt=Date.now();S.savedHow='cloud';chipUpdate();
}
async function loadCloud(id,rev){
 try{toast('Opening…',30000);var res=await api('/api/plans?id='+id+(rev?'&rev='+rev:''));await applyCloud(res);toast('Opened revision #'+res.revision.rev_no)}catch(e){toast(e.message,5500)}
}
function listModal(title,rowsHtml,onPick){
 var m=$('#modal');m.innerHTML='<div class="mbox"><h3>'+esc(title)+'</h3>'+rowsHtml+'<div class="mrow"><button class="btn" id="mc">Close</button></div></div>';m.classList.add('on');
 function close(){m.classList.remove('on');m.innerHTML='';m.onclick=null}
 $('#mc').onclick=close;m.onclick=function(e){var r=e.target.closest('[data-pick]');if(r){close();onPick(r.dataset.pick)}};
}
async function cloudOpen(){
 try{var j=await api('/api/plans');
  listModal('Open from cloud',j.plans.length?j.plans.map(function(p){return '<div class="iss" data-pick="'+p.id+'"><span><b style="color:inherit">'+esc(p.event||p.title||'Untitled')+'</b><br><small>'+esc(p.venue||'')+' · rev #'+p.rev_no+' · '+esc(p.by||'')+' · '+new Date(p.updated_at).toLocaleDateString('en-ZA')+'</small></span><b>Open</b></div>'}).join(''):'<p class="note">No saved plans yet.</p>',function(id){loadCloud(id)});
 }catch(e){toast(e.message,4500)}
}
async function cloudRevs(){
 try{var j=await api('/api/plans?id='+S.cloud.planId+'&revs=1');
  listModal('Revision history',j.revs.map(function(r){return '<div class="iss" data-pick="'+r.rev_no+'"><span><b style="color:inherit">#'+r.rev_no+(r.label?' · '+esc(r.label):'')+'</b><br><small>'+esc(r.by||'')+' · '+new Date(r.created_at).toLocaleString('en-ZA')+(r.note?' · '+esc(r.note):'')+'</small></span><b>Open</b></div>'}).join(''),function(n){loadCloud(S.cloud.planId,n)});
 }catch(e){toast(e.message,4500)}
}

