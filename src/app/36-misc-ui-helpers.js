/* ---------- misc UI helpers ---------- */
var toastT=0;
function toast(m,ms){var t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('on')},ms||2600)}
function ask(title,fields,ok,okLabel){
 var m=$('#modal');
 m.innerHTML='<div class="mbox" role="dialog" aria-label="'+esc(title)+'"><h3>'+esc(title)+'</h3>'+fields.map(function(f,i){return '<label>'+esc(f.l)+'<input id="mf'+i+'" type="'+(f.type||'text')+'" value="'+esc(f.v==null?'':f.v)+'"'+(f.step?' step="'+f.step+'"':'')+'></label>'}).join('')+'<div class="mrow"><button class="btn" id="mc">Cancel</button><button class="btn pri" id="mo">'+(okLabel||'OK')+'</button></div></div>';
 m.classList.add('on');
 var f0=$('#mf0');setTimeout(function(){if(f0){f0.focus();if(f0.select)f0.select()}},60);
 function close(){m.classList.remove('on');m.innerHTML=''}
 $('#mc').onclick=close;
 $('#mo').onclick=function(){var v=fields.map(function(f,i){return $('#mf'+i).value});close();ok(v)};
 m.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();$('#mo')&&$('#mo').click()}if(e.key==='Escape')close()};
}
function box(html){var m=$('#modal');m.innerHTML='<div class="mbox">'+html+'<div class="mrow"><button class="btn pri" id="mc">Close</button></div></div>';m.classList.add('on');$('#mc').onclick=function(){m.classList.remove('on');m.innerHTML=''}}
var ANYIMG='image/*,.pdf,.svg,.png,.jpg,.jpeg,.jfif,.webp,.gif,.bmp,.tif,.tiff,.heic,.heif,.avif,.ico';
async function fileToLogo(file,cb){
 try{
  var img,isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(isPdf){
   if(!window.pdfjsLib)throw new Error('PDF reader did not load. Save the logo as a PNG and upload that.');
   pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
   var pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,pg=await pdf.getPage(1),v0=pg.getViewport({scale:1}),sc=Math.min(4,1400/Math.max(v0.width,v0.height)),vp=pg.getViewport({scale:sc}),cn=document.createElement('canvas');
   cn.width=Math.round(vp.width);cn.height=Math.round(vp.height);await pg.render({canvasContext:cn.getContext('2d'),viewport:vp}).promise;img=cn}
  else{try{img=await loadImgFile(file)}catch(e){throw new Error('This browser cannot read that file type ('+(file.name.split('.').pop()||'?')+'). Open it and save/export it as PNG or JPG, or upload it as a PDF.')}}
  var iw=img.naturalWidth||img.width||600,ih=img.naturalHeight||img.height||300,k=Math.min(1,1200/Math.max(iw,ih)),cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(iw*k));cv.height=Math.max(1,Math.round(ih*k));cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
  var out=cv.toDataURL('image/png');
  if(out.length>700000){var c2=document.createElement('canvas');c2.width=cv.width;c2.height=cv.height;var x2=c2.getContext('2d');x2.fillStyle='#fff';x2.fillRect(0,0,c2.width,c2.height);x2.drawImage(cv,0,0);out=c2.toDataURL('image/jpeg',.9)}
  cb(out)
 }catch(err){toast(err.message||'Could not read that file',6000)}
}
function pickFile(accept,cb){var f=$('#fileIn');f.accept=accept;f.multiple=false;f.value='';f.onchange=function(){if(f.files&&f.files[0])cb(f.files[0])};f.click()}
function loadImgFile(file){return new Promise(function(res,rej){var u=URL.createObjectURL(file),im=new Image();im.onload=function(){res(im)};im.onerror=function(){rej(new Error('Could not read image'))};im.src=u})}
function loadImgSrc(src){return new Promise(function(res,rej){var im=new Image();im.onload=function(){res(im)};im.onerror=function(){rej(new Error('img'))};im.src=src})}

