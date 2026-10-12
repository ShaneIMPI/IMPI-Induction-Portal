/* ---------- venue library: save the bare venue once, start every event from it ---------- */
function venueReady(){if(!S.cloud||!S.cloud.on){toast('Saving venues needs the cloud. Use Save project to keep a file copy for now.',6000);return false}if(!S.cloud.user){toast('Sign in first (Sheet tab, Cloud).',5000);return false}return true}
function cloudSaveVenue(){
 if(!venueReady())return;
 var nv=S.objs.filter(function(o){return o.vn}).length;
 if(!nv){toast('Nothing is marked as venue yet. Trace the venue or turn on Venue mode first.',6000);return}
 ask('Save as venue',[{l:'Venue name (for example CTICC Halls 1-4)',v:(S.meta.venue&&S.meta.venue.indexOf('[')<0)?S.meta.venue:''},{l:'Note (optional)',v:''}],async function(v){
  var name=(v[0]||'').trim();if(!name){toast('Give the venue a name');return}
  try{
   toast('Saving venue…',30000);
   for(var i=0;i<S.layers.length;i++)if(!S.layers[i].imageId)await uploadLayer(S.layers[i]);
   var objs=S.objs.filter(function(o){return o.vn}).map(function(o){var c=JSON.parse(JSON.stringify(o));c.lk=1;return c});
   var meta=Object.assign({},S.meta,{isVenue:1,venue:name,event:'VENUE: '+name,title:name,attend:0,certCap:0,siteArea:0,layouts:[],only:null});
   var data={v:2,meta:meta,objs:objs,nid:S.nid,custom:S.custom.map(function(c){return {k:c.k,n:c.n,w:c.w,h:c.h,src:c.src}}),layers:S.layers.map(function(L){return {name:L.name,kind:L.kind,imageId:L.imageId,mpp:L.mpp/(L.cloudSc||1),x:L.x,y:L.y,rot:L.rot,op:L.op,blend:L.blend,cal:L.cal,vis:L.vis,geo:L.geo,base:L.base,_op:L._op,pdfLong:L.pdfLong,crisp:L.crisp}})};
   var j=await api('/api/plans',{method:'POST',json:{planId:S.meta.venuePlanId||undefined,label:'Venue',note:v[1],data:data}});
   var chk=await api('/api/plans?id='+j.planId+'&rev='+j.rev_no),cd=chk&&chk.revision&&chk.revision.data;
   if(!cd||(cd.objs||[]).length!==objs.length||(cd.layers||[]).length!==S.layers.length)throw new Error('The cloud copy did not match, so it was not trusted');
   S.meta.venuePlanId=j.planId;S.meta.venue=name;saveLocal();renderPanel();
   toast('Venue saved: '+name+' ('+objs.length+' venue objects, locked). Start any event from it with Venue > Start new event from a saved venue.',8000)
  }catch(e){toast('Venue save failed: '+e.message,7000)}
 },'Save venue')}
async function cloudVenuePick(){
 if(!venueReady())return;
 try{var j=await api('/api/plans'),vs=(j.plans||[]).filter(function(p){return /^VENUE:/i.test(p.event||'')});
  if(!vs.length){toast('No saved venues yet. Trace a venue and use Save as venue.',6000);return}
  listModal('Start a new event at which venue?',vs.map(function(p){return '<div class="iss" data-pick="'+p.id+'"><span><b style="color:inherit">'+esc((p.event||'').replace(/^VENUE:\\s*/i,''))+'</b><br><small>rev #'+p.rev_no+' · '+esc(p.by||'')+' · '+new Date(p.updated_at).toLocaleDateString('en-ZA')+'</small></span><b>Use</b></div>'}).join(''),async function(id){
   try{toast('Opening venue…',30000);var res=await api('/api/plans?id='+id);var vid=res.plan.id;await applyCloud(res);S.meta.venuePlanId=vid;
    S.objs.forEach(function(o){o.vn=1});venueNewEvent();delete S.meta.isVenue;S.meta.venuePlanId=vid;saveLocal();renderPanel();
    toast('New event started on this venue. Add the event layout now; it saves as a new plan.',7000)}catch(e){toast(e.message,6000)}})
 }catch(e){toast(e.message,5000)}}
