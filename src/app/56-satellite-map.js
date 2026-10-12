/* ---------- satellite map picker (Mapbox / Esri), inserts a calibrated aerial ---------- */
var MAPC=6378137*2*Math.PI/256;
function lsGet(k){try{return localStorage.getItem(k)||''}catch(e){return ''}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function mapToken(){return (window.__FPS_CFG&&window.__FPS_CFG.mapbox)||lsGet('fps_mapbox')||''}
var MAPP={
 mapbox:{n:'Mapbox Satellite',max:20,s:2,att:'© Mapbox © OpenStreetMap © Maxar',url:function(){return 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}@2x?access_token='+mapToken()}},
 esri:{n:'Esri World Imagery',max:19,s:1,att:'Esri, Maxar, Earthstar Geographics and the GIS User Community',url:function(){return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}}
};
function mapTileUrl(pk,z,x,y){var u=(window.__TILE_OVERRIDE||MAPP[pk].url());return u.replace('{z}',z).replace('{x}',x).replace('{y}',y)}
function mapLoadLib(){return new Promise(function(res,rej){
 if(window.L&&window.L.map)return res();
 var l=document.createElement('link');l.rel='stylesheet';l.href='/vendor/leaflet.css';document.head.appendChild(l);
 var s=document.createElement('script');s.src='/vendor/leaflet.js';s.onload=function(){res()};s.onerror=function(){rej(new Error('The map library did not load. Check your connection and try again.'))};document.head.appendChild(s)})}
function mp2px(lat,lon,z){var n=256*Math.pow(2,z),sn=Math.sin(lat*Math.PI/180);return {x:(lon+180)/360*n,y:(0.5-Math.log((1+sn)/(1-sn))/(4*Math.PI))*n}}
function hav(a,b){var R=6371008.8,r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r,h=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.sqrt(h))}
async function mapSearch(q){
 q=(q||'').trim();if(!q)return [];
 var m=q.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)||q.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
 if(m)return [{n:'Coordinates '+m[1]+', '+m[2],lat:+m[1],lon:+m[2]}];
 var tk=mapToken(),j;
 if(tk){try{var r=await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(q)+'.json?limit=6&access_token='+encodeURIComponent(tk));if(r.ok){j=await r.json();return (j.features||[]).map(function(f){return {n:f.place_name,lat:f.center[1],lon:f.center[0],bbox:f.bbox}})}}catch(e){}}
 var r2=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=6&q='+encodeURIComponent(q));if(!r2.ok)throw new Error('Search is unavailable right now. Paste coordinates or a Google Maps link instead.');
 j=await r2.json();return j.map(function(x){return {n:x.display_name,lat:+x.lat,lon:+x.lon,bbox:x.boundingbox?[+x.boundingbox[2],+x.boundingbox[0],+x.boundingbox[3],+x.boundingbox[1]]:null}})}
async function openMap(){
 var ov=$('#mapov');
 try{await mapLoadLib()}catch(e){toast(e.message,5000);return}
 var tk=mapToken(),prov=tk?'mapbox':'esri',loc=null;try{loc=JSON.parse(lsGet('fps_maploc')||'null')}catch(e){}
 var st={pct:78,shape:'win',q:1,map:null,tl:null,rot:0};
 ov.innerHTML='<div class="mpbar"><b>Satellite map</b><input type="search" id="mpq" placeholder="Search an address or venue, or paste coordinates / a Google Maps link" autocomplete="off"><button class="btn sm pri" id="mpgo">Search</button><select id="mpprov" aria-label="Imagery source"></select><button class="btn sm" id="mptok" style="display:none">Add Mapbox token</button><button class="btn sm" id="mpx" aria-label="Close map">Close</button></div>'
  +'<div id="mpwrap"><div id="mpmap"></div><div id="mpframe"><div id="mpguide"><div id="mpgrid"></div></div><div id="mpread"></div></div><div id="mpres"></div></div>'
  +'<div class="mpfoot"><label>Frame size <input type="range" id="mpsz" min="35" max="96" value="78"></label>'
  +'<label>Shape <select id="mpshape"><option value="win">Fill window</option><option value="1.414">Sheet landscape</option><option value="0.707">Sheet portrait</option><option value="1">Square</option></select></label>'
  +'<label>Detail <select id="mpq2"><option value="0">Standard</option><option value="1" selected>High</option><option value="2">Maximum</option></select></label>'
  +'<label>Straighten <input type="range" id="mprot" min="-45" max="45" step="0.5" value="0" style="width:120px"> <input type="number" id="mprotn" min="-90" max="90" step="0.1" value="0" style="width:64px"> °</label>'
  +'<button class="btn pri" id="mpcap">Insert this area on the plan</button><span class="mpnote" id="mpnote">Pan and zoom so the venue sits inside the orange frame. The image arrives to true scale, so no calibration is needed. Imagery can be months or years old: confirm it matches the site.</span></div>';
 ov.classList.add('on');
 function opts(){var s=$('#mpprov');s.innerHTML='<option value="mapbox"'+(tk?'':' disabled')+'>'+MAPP.mapbox.n+(tk?'':' (needs token)')+'</option><option value="esri">'+MAPP.esri.n+'</option>';s.value=prov;$('#mptok').style.display=tk?'none':''}
 opts();
 var map=L.map('mpmap',{zoomSnap:1,zoomDelta:1,minZoom:3,maxZoom:21,zoomControl:true,attributionControl:true,worldCopyJump:true});
 map.attributionControl.setPrefix('');st.map=map;
 map.setView(loc?[loc.lat,loc.lon]:[-25.7479,28.2293],loc?loc.z:15);
 function setTiles(){if(st.tl)map.removeLayer(st.tl);var P=MAPP[prov],u=window.__TILE_OVERRIDE||P.url();st.tl=L.tileLayer(u,{tileSize:256,maxNativeZoom:P.max,maxZoom:21,attribution:P.att,crossOrigin:'anonymous'}).addTo(map)}
 setTiles();
 function frame(){var w=$('#mpmap').clientWidth,h=$('#mpmap').clientHeight,p=st.pct/100,fw,fh;
  if(st.shape==='win'){fw=w*p;fh=h*p}else{var r=parseFloat(st.shape);fh=Math.min(h*p,w*p/r);fw=fh*r}
  return {x:(w-fw)/2,y:(h-fh)/2,w:fw,h:fh}}
 function bounds(){var f=frame(),a=map.containerPointToLatLng([f.x,f.y]),b=map.containerPointToLatLng([f.x+f.w,f.y+f.h]);return {n:a.lat,w:a.lng,s:b.lat,e:b.lng}}
 function plan(){var bd=bounds(),P=MAPP[prov],vz=map.getZoom(),zc=Math.min(P.max,vz+st.q),clat=(bd.n+bd.s)/2,p0,p1,x0,y0,x1,y1,W,H,tiles;
  for(;;){p0=mp2px(bd.n,bd.w,zc);p1=mp2px(bd.s,bd.e,zc);x0=Math.floor(p0.x);y0=Math.floor(p0.y);x1=Math.ceil(p1.x);y1=Math.ceil(p1.y);
   W=(x1-x0)*P.s;H=(y1-y0)*P.s;tiles=(Math.floor((x1-1)/256)-Math.floor(x0/256)+1)*(Math.floor((y1-1)/256)-Math.floor(y0/256)+1);
   if((Math.max(W,H)<=5200&&tiles<=420)||zc<=3)break;zc--}
  var mpp=MAPC*Math.cos(clat*Math.PI/180)/Math.pow(2,zc)/P.s;
  return {bd:bd,zc:zc,x0:x0,y0:y0,x1:x1,y1:y1,W:W,H:H,tiles:tiles,mpp:mpp,clat:clat,clon:(bd.w+bd.e)/2,wm:hav({lat:clat,lon:bd.w},{lat:clat,lon:bd.e}),hm:hav({lat:bd.n,lon:(bd.w+bd.e)/2},{lat:bd.s,lon:(bd.w+bd.e)/2}),capped:zc<Math.min(P.max,vz+st.q)}}
 function upd(){var f=frame(),fr=$('#mpframe');fr.style.left=f.x+'px';fr.style.top=f.y+'px';fr.style.width=f.w+'px';fr.style.height=f.h+'px';
  var pl=plan(),fmt=function(v){return v>=1000?(v/1000).toFixed(2)+' km':Math.round(v)+' m'};
  $('#mpread').textContent='≈ '+fmt(pl.wm)+' × '+fmt(pl.hm)+'  ·  '+(pl.mpp*100).toFixed(pl.mpp<.1?1:0)+' cm per pixel'+(pl.capped?'  ·  detail reduced for size':'');
  var big=pl.wm>1500||pl.hm>1500;$('#mpnote').textContent=big?'That is a large area. Zoom in or shrink the frame for a sharper plan (the venue should fill most of the frame).':'Pan and zoom so the venue sits inside the orange frame. The image arrives to true scale, so no calibration is needed. Imagery can be months or years old: confirm it matches the site.'}
 map.on('move zoom moveend zoomend resize',upd);window.addEventListener('resize',upd);setTimeout(function(){map.invalidateSize();upd()},60);
 function close(){window.removeEventListener('resize',upd);document.removeEventListener('keydown',kd);try{var c=map.getCenter();lsSet('fps_maploc',JSON.stringify({lat:c.lat,lon:c.lng,z:map.getZoom()}))}catch(e){}map.remove();ov.classList.remove('on');ov.innerHTML=''}
 function kd(e){if(e.key==='Escape'&&!$('#modal').classList.contains('on'))close()}document.addEventListener('keydown',kd);
 $('#mpx').onclick=close;
 function setRot(v){v=Math.max(-90,Math.min(90,parseFloat(v)||0));st.rot=v;$('#mprot').value=v;$('#mprotn').value=v;$('#mpgrid').style.transform='rotate('+v+'deg)';$('#mpnote').textContent=v?'Turn the grid until its lines run along a fence or building edge. The plan will be rotated so those lines come out straight.':'Pan and zoom so the venue sits inside the orange frame.'}
 $('#mprot').oninput=function(){setRot(this.value)};$('#mprotn').onchange=function(){setRot(this.value)};
 $('#mpsz').oninput=function(){st.pct=+this.value;upd()};$('#mpshape').onchange=function(){st.shape=this.value;upd()};$('#mpq2').onchange=function(){st.q=+this.value;upd()};
 $('#mpprov').onchange=function(){prov=this.value;setTiles();upd()};
 $('#mptok').onclick=function(){ask('Mapbox access token',[{l:'Public token (starts with pk.)',v:''}],function(v){var t=(v[0]||'').trim();if(!/^pk\./.test(t)){toast('That does not look like a public Mapbox token (it starts with pk.)',5000);return}lsSet('fps_mapbox',t);tk=t;prov='mapbox';opts();setTiles();upd();toast('Mapbox satellite enabled on this browser')},'Save')};
 async function go(){var q=$('#mpq').value,res=$('#mpres');res.classList.remove('on');if(!q.trim())return;
  try{var r=await mapSearch(q);if(!r.length){toast('No match. Try the venue name with the town, or paste coordinates.',4500);return}
   if(r.length===1){pick(r[0]);return}
   res.innerHTML=r.map(function(x,i){return '<button data-i="'+i+'">'+esc(x.n)+'</button>'}).join('');res.classList.add('on');
   res.onclick=function(e){var b=e.target.closest('button');if(b){res.classList.remove('on');pick(r[+b.dataset.i])}}}
  catch(e){toast(e.message||'Search failed',5000)}}
 function pick(x){if(x.bbox&&x.bbox.length===4&&Math.abs(x.bbox[2]-x.bbox[0])<.2)map.fitBounds([[x.bbox[1],x.bbox[0]],[x.bbox[3],x.bbox[2]]],{maxZoom:19});else map.setView([x.lat,x.lon],18)}
 $('#mpgo').onclick=go;$('#mpq').onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();go()}};
 $('#mpcap').onclick=async function(){var b=this,pl=plan(),P=MAPP[prov];b.disabled=true;var old=b.textContent;
  try{
   var cn=document.createElement('canvas');cn.width=pl.W;cn.height=pl.H;var cx=cn.getContext('2d');cx.fillStyle='#0b1620';cx.fillRect(0,0,pl.W,pl.H);
   var n=Math.pow(2,pl.zc),jobs=[],tx,ty;
   for(ty=Math.floor(pl.y0/256);ty<=Math.floor((pl.y1-1)/256);ty++)for(tx=Math.floor(pl.x0/256);tx<=Math.floor((pl.x1-1)/256);tx++){if(ty<0||ty>=n)continue;jobs.push({tx:tx,ty:ty})}
   var done=0,fail=0,qi=0;
   function loadTile(j){return new Promise(function(res){var tries=0;(function go2(){var im=new Image();im.crossOrigin='anonymous';im.onload=function(){cx.drawImage(im,(j.tx*256-pl.x0)*P.s,(j.ty*256-pl.y0)*P.s,256*P.s,256*P.s);res(true)};im.onerror=function(){if(++tries<3)setTimeout(go2,300*tries);else res(false)};im.src=mapTileUrl(prov,pl.zc,((j.tx%n)+n)%n,j.ty)})()})}
   await Promise.all(Array.from({length:8},async function(){while(qi<jobs.length){var j=jobs[qi++],ok=await loadTile(j);done++;if(!ok)fail++;b.textContent='Downloading imagery '+done+' / '+jobs.length}}));
   if(fail)throw new Error(fail+' of '+jobs.length+' map tiles failed to download'+(prov==='mapbox'?'. Check the Mapbox token and your connection.':'. Check your connection and try again.'));
   try{cx.getImageData(0,0,1,1)}catch(e){throw new Error('The imagery provider blocked image export in this browser. Try the other imagery source.')}
   var geo={lat:pl.clat,lon:pl.clon,z:pl.zc,prov:prov,att:P.att,n:pl.bd.n,s:pl.bd.s,e:pl.bd.e,w:pl.bd.w,date:new Date().toISOString().slice(0,10)};
   var rr=st.rot;close();addMapLayer(cn,pl.mpp,geo,-rr)
  }catch(err){toast(err.message||'Could not build the image',7000)}
  finally{b.disabled=false;b.textContent=old}};
 setTimeout(function(){var q=$('#mpq');if(q)q.focus()},150);
}
function addMapLayer(cn,mpp,geo,rotDeg){
 var vb=viewBounds(),first=!S.layers.length&&!S.objs.length,cxw=first?0:(vb.x0+vb.x1)/2,cyw=first?0:(vb.y0+vb.y1)/2;
 var L={id:S.nl++,name:'Satellite '+geo.lat.toFixed(5)+', '+geo.lon.toFixed(5),kind:'sat',img:cn,mpp:mpp,x:cxw-cn.width*mpp/2,y:cyw-cn.height*mpp/2,rot:0,op:1,blend:'source-over',cal:true,vis:true,pdfScale:null,geo:geo};
 if(rotDeg){L.rot=rotDeg;var rc=rotv(cn.width*mpp/2,cn.height*mpp/2,rotDeg*D2R);L.x=cxw-rc.x;L.y=cyw-rc.y}
 S.layers.push(L);S.dismissed=true;fitTo(layerBounds(),.1);S.tab='lay';updateWelcome();renderPanel();draw();
 toast('Satellite image added to true scale ('+Math.round(cn.width*mpp)+' × '+Math.round(cn.height*mpp)+' m). Start placing structures; use Measure to spot-check a known distance.',7000);
 if(matchMedia('(max-width:820px)').matches)openPanel();
}


