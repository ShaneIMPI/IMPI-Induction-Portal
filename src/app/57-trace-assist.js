/* ---------- trace assist: snap to the lines of an imported plan ---------- */
var TRACE_TOOLS={line:1,poly:1,dim:1,area:1,calib:1,gorigin:1};
function layerMask(L){
 if(L._m&&L._m.src===L.img)return L._m;
 var w=L.img.width,h=L.img.height,cn=document.createElement('canvas');cn.width=w;cn.height=h;var c=cn.getContext('2d',{willReadFrequently:true});c.fillStyle='#fff';c.fillRect(0,0,w,h);c.drawImage(L.img,0,0);
 var d;try{d=c.getImageData(0,0,w,h).data}catch(e){L._m={src:L.img,bad:true};return L._m}
 var m=new Uint8Array(w*h),lu=new Uint8Array(w*h),hist=new Uint32Array(256),i,j;
 for(i=0,j=0;i<lu.length;i++,j+=4){var lv=(.299*d[j]+.587*d[j+1]+.114*d[j+2])|0;lu[i]=lv;hist[lv]++}
 /* the paper tone is the commonest light value; ink is anything clearly darker than it (works for white CAD plots and grey or cream scans) */
 var acc=0,paper=255;for(i=255;i>=0;i--){acc+=hist[i];if(acc>=lu.length*.2){paper=i;break}}
 var thr=Math.max(95,Math.min(185,paper-65));
 for(i=0;i<m.length;i++)m[i]=lu[i]<thr?1:0;
 L._m={src:L.img,w:w,h:h,m:m};return L._m}
function parseDist(s){s=String(s||'').trim().toLowerCase().replace(/,/g,'.').replace(/\s+/g,'');var m=s.match(/^(\d*\.?\d+)(mm|cm|m|km)?$/);if(!m)return NaN;var n=parseFloat(m[1]),u=m[2];if(!(n>0))return NaN;if(!u)u=n>=300?'mm':'m';return u==='mm'?n/1000:u==='cm'?n/100:u==='km'?n*1000:n}
function syncTrace(){$$('#tools [data-act=trace]').forEach(function(x){x.classList.toggle('on',S.traceSnap!==false)})}
function setGridOrigin(q){var lo=S.meta.only?layoutOf(S.meta.only):null;if(lo){lo.gx=q.x;lo.gy=q.y}else{S.meta.gx=Math.round(q.x*1000)/1000;S.meta.gy=Math.round(q.y*1000)/1000}
 setTool('select');saveLocal();renderPanel();draw();toast('Stand grid now starts at that corner. Stands snap to the module from there.',5000)}
async function choosePdfPage(pdf,name){
 return new Promise(function(res){
  var m=$('#modal'),n=pdf.numPages;
  m.innerHTML='<div class="mbox" style="width:min(900px,100%)" role="dialog" aria-label="Choose a page"><h3>Which page do you want to use?</h3><p class="note" style="margin:0 0 8px">'+esc(name)+' has '+n+' pages. Pick one; you can add other pages afterwards from the Images tab.</p><div id="pgGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px"></div><div class="mrow"><button class="btn" id="mc">Cancel</button></div></div>';
  m.classList.add('on');var g=$('#pgGrid'),closed=false;
  function close(v){closed=true;m.classList.remove('on');m.innerHTML='';res(v)}
  $('#mc').onclick=function(){close(null)};
  for(var i=1;i<=n;i++){(function(i){var b=document.createElement('button');b.className='btn';b.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;height:auto';b.innerHTML='<canvas width="190" height="134" style="width:100%;background:#fff;border:1px solid var(--ln);border-radius:4px"></canvas><span>Page '+i+'</span>';b.onclick=function(){close(i)};g.appendChild(b)})(i)}
  (async function(){var cs=g.querySelectorAll('canvas');for(var i=1;i<=n&&!closed;i++){try{var pg=await pdf.getPage(i),v0=pg.getViewport({scale:1}),sc=380/Math.max(v0.width,v0.height),vp=pg.getViewport({scale:sc}),cn=cs[i-1];cn.width=Math.round(vp.width);cn.height=Math.round(vp.height);var cx=cn.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cn.width,cn.height);await pg.render({canvasContext:cx,viewport:vp}).promise}catch(e){}}})();
  m.onkeydown=function(e){if(e.key==='Escape')close(null)}})}

