/* ---------- layers / import ---------- */
function pickLayer(kind){pickFile('image/*,application/pdf,.pdf',function(f){addLayer(f,kind)})}
async function addLayer(file,kind,pageNo,pdfObj){
 toast('Loading '+file.name+'…',6000);
 try{
  var img,pdfScale=null,pgSel=0,pdfLong=0,isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(isPdf){
   if(!window.pdfjsLib)throw new Error('PDF reader did not load. Export the plan as a PNG/JPG and import that instead.');
   pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
   var pdf=pdfObj||await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;S._lastPdf={pdf:pdf,name:file.name};
   if(pdf.numPages>1&&!pageNo){pageNo=await choosePdfPage(pdf,file.name);if(!pageNo){toast('Import cancelled');return}}
   pgSel=pdf.numPages>1?pageNo:0;var pg=await pdf.getPage(Math.min(pageNo||1,pdf.numPages)),v0=pg.getViewport({scale:1});pdfLong=Math.max(v0.width,v0.height)*25.4/72;
   pdfScale=Math.min(5,5200/Math.max(v0.width,v0.height));var vp=pg.getViewport({scale:pdfScale}),cn=document.createElement('canvas');cn.width=Math.round(vp.width);cn.height=Math.round(vp.height);var cx=cn.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cn.width,cn.height);await pg.render({canvasContext:cx,viewport:vp}).promise;img=cn;kind='plan';
  }else{img=await loadImgFile(file)}
  var vb=viewBounds(),mpp=Math.max(.01,(Math.max(vb.x1-vb.x0,40)*.8)/img.width),cxw=(vb.x0+vb.x1)/2,cyw=(vb.y0+vb.y1)/2;
  if(!S.layers.length&&!S.objs.length){mpp=100/img.width;cxw=0;cyw=0}
  var L={id:S.nl++,name:file.name.replace(/\.[^.]+$/,'')+(pgSel?' (page '+pgSel+')':''),kind:kind,img:img,mpp:mpp,pdfLong:pdfLong,x:cxw-img.width*mpp/2,y:cyw-img.height*mpp/2,rot:0,op:kind==='plan'?.9:1,blend:kind==='plan'?'multiply':'source-over',cal:false,vis:true,pdfScale:pdfScale,crisp:kind==='plan'};
  S.layers.push(L);fitTo(layerBounds(),.1);S.tab='lay';updateWelcome();renderPanel();draw();
  toast('Now tap Calibrate and pick two points a known distance apart',4500);
  if(matchMedia('(max-width:820px)').matches)openPanel();
 }catch(err){toast(err.message||'Import failed',5000)}
}
function addCustomLib(c){var im=new Image();im.src=c.src;var l={k:c.k,n:c.n,w:c.w,h:c.h,c:'Custom',s:'img',lab:'',im:im,src:c.src};im.onload=function(){draw();if(S.tab==='lib')renderPanel()};S.custom.push(l);LIBM[l.k]=l}
function addSymbol(){
 pickFile('image/png,image/svg+xml,image/jpeg',function(f){var r=new FileReader();r.onload=function(){
  ask('Add symbol',[{l:'Name',v:f.name.replace(/\.[^.]+$/,'')},{l:'Real width (m)',v:1,type:'number',step:'0.1'},{l:'Real depth (m)',v:1,type:'number',step:'0.1'}],function(v){addCustomLib({k:'c'+Date.now(),n:v[0]||'Symbol',w:parseFloat(v[1])||1,h:parseFloat(v[2])||1,src:r.result});saveLocal();renderPanel();toast('Symbol added to the library')});
 };r.readAsDataURL(f)});
}

