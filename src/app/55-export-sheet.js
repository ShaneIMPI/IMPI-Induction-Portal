/* ---------- export sheet ---------- */
function loadLogo(){return new Promise(function(res){var src=(isAdmin()&&S.meta.logo)?S.meta.logo:BRAND_LOGO;if(S.logoImg&&S.logoSrc===src)return res(S.logoImg);var im=new Image();im.onload=function(){S.logoImg=im;S.logoSrc=src;res(im)};im.onerror=function(){S.logoImg=null;res(null)};im.src=src})}
function wrapText(c,s,maxW){var words=String(s).split(/\s+/),lines=[],cur='';words.forEach(function(w){var t=cur?cur+' '+w:w;if(c.measureText(t).width>maxW&&cur){lines.push(cur);cur=w}else cur=t});if(cur)lines.push(cur);return lines}
async function renderSheet(){
 enforceBrand();
 if(document.fonts&&document.fonts.ready)await document.fonts.ready;
 var m=S.meta,P=paperOf(m),kk=Math.min(1.8,Math.max(.85,Math.max(P.w,P.h)/420*(P.w>=P.h?1:.7))),coarse=matchMedia('(pointer:coarse)').matches,ppm=Math.min(200/25.4,Math.sqrt((coarse?16e6:60e6)/(P.w*P.h)),(coarse?4900:14000)/Math.max(P.w,P.h)),W=Math.round(P.w*ppm),H=Math.round(P.h*ppm);
 var cx=document.createElement('canvas');cx.width=W;cx.height=H;var c=cx.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,W,H);
 function mm(v){return v*ppm}
 var brand=await loadBrand(),flogos=[],fl=(isAdmin()&&m.logo?[m.logo]:[]).concat(brand.logos||[]);
  for(var fi=0;fi<fl.length;fi++){var fim=await loadImgCached(fl[fi]);if(fim)flogos.push(fim)}
  var flines=(brand.lines||[]).filter(Boolean);var gat={};S.layers.forEach(function(L){if(L.vis!==false&&L.geo&&L.geo.att)gat[L.geo.att]=1});if(Object.keys(gat).length)flines=flines.concat(['Aerial imagery: '+Object.keys(gat).join('; ')]);var FH=(flogos.length||flines.length)?20*kk:0;
  var M=8,panW=Math.round(88*kk),A={x0:M,y0:M,x1:P.w-M-panW,y1:P.h-M-FH};
 var b=(m.extent==='view'&&!m.only)?viewBounds():(objBounds()||layerBounds()||viewBounds());
 var bw=Math.max(b.x1-b.x0,1),bh=Math.max(b.y1-b.y0,1),aw=(A.x1-A.x0)-4-30*kk,ah=(A.y1-A.y0)-4-30*kk,N;
 if(m.scale==='auto'){N=SCALES.filter(function(n){return bw*1000/n<=aw&&bh*1000/n<=ah})[0]||SCALES[SCALES.length-1]}else if(m.scale==='custom')N=Math.max(1,+m.scaleC||500);else N=+m.scale||500;
 var z=ppm*1000/N,ox=mm((A.x0+A.x1)/2)-((b.x0+b.x1)/2)*z,oy=mm((A.y0+A.y1)/2)-((b.y0+b.y1)/2)*z,u=ppm*0.2646*kk;
 c.save();c.beginPath();c.rect(mm(A.x0+1),mm(A.y0+1),mm(A.x1-A.x0-2),mm(A.y1-A.y0-2));c.clip();
 c.setTransform(z,0,0,z,ox,oy);var sv=R;R={z:z,u:u};
 if(m.bg&&!m.only)S.layers.forEach(function(L){drawLayer(c,L)});
 var pvb={x0:(mm(A.x0+1)-ox)/z,y0:(mm(A.y0+1)-oy)/z,x1:(mm(A.x1-1)-ox)/z,y1:(mm(A.y1-1)-oy)/z},pgrid=m.gridPrint!==false&&(m.gridMod>0||m.gridShow!==false);
 if(pgrid)drawModuleGrid(c,pvb,m,'lines');
 drawObjs(c);
 if(pgrid)drawModuleGrid(c,pvb,m,'labels');
 R=sv;c.restore();
 c.setTransform(1,0,0,1,0,0);
 var ink='#12202b';c.strokeStyle=ink;c.lineWidth=mm(.7);c.strokeRect(mm(M-3),mm(M-3),mm(P.w-2*M+6),mm(P.h-2*M+6));c.lineWidth=mm(.4);c.strokeRect(mm(A.x0),mm(A.y0),mm(A.x1-A.x0),mm(A.y1-A.y0));
 function T(s,x,y,sz,o){o=o||{};c.font=fontStr(mm(sz),o.bold);c.fillStyle=o.col||ink;c.textAlign=o.align||'left';c.textBaseline=o.base||'alphabetic';c.fillText(s,mm(x),mm(y))}
 function line(x0,y0,x1,y1,w){c.lineWidth=mm(w||.3);c.strokeStyle=ink;c.beginPath();c.moveTo(mm(x0),mm(y0));c.lineTo(mm(x1),mm(y1));c.stroke()}
 /* scale bar */
 var nice=[1,2,5,10,20,25,50,100,200,250,500,1000,2000],L0=nice[0];nice.forEach(function(n){if(n*1000/N<=62*kk)L0=n});
 var sbx=A.x0+7*kk,sby=A.y1-12*kk,sbw=L0*1000/N;
 c.fillStyle='rgba(255,255,255,.88)';c.fillRect(mm(sbx-4*kk),mm(sby-8*kk),mm(sbw+16*kk),mm(18*kk));
 for(var i=0;i<4;i++){c.fillStyle=i%2?'#fff':ink;c.fillRect(mm(sbx+sbw*i/4),mm(sby),mm(sbw/4),mm(2.2*kk));}
 c.lineWidth=mm(.3);c.strokeStyle=ink;c.strokeRect(mm(sbx),mm(sby),mm(sbw),mm(2.2*kk));
 T('0',sbx,sby-1.2*kk,2.6*kk,{align:'center'});T(String(L0/2),sbx+sbw/2,sby-1.2*kk,2.6*kk,{align:'center'});T(L0+' m',sbx+sbw,sby-1.2*kk,2.6*kk,{align:'center'});
 T('Scale 1 : '+N+' @ '+m.paper,sbx,sby+6.4*kk,2.6*kk,{bold:true});
 /* north arrow */
 var nx=A.x1-14*kk,ny=A.y0+16*kk,nr=8*kk;c.fillStyle='rgba(255,255,255,.88)';c.beginPath();c.arc(mm(nx),mm(ny),mm(nr+2),0,TAU);c.fill();
 c.save();c.translate(mm(nx),mm(ny));c.rotate((m.north||0)*D2R);c.fillStyle=ink;c.beginPath();c.moveTo(0,-mm(nr));c.lineTo(mm(nr*.45),mm(nr*.7));c.lineTo(0,mm(nr*.3));c.closePath();c.fill();c.fillStyle='#fff';c.strokeStyle=ink;c.lineWidth=mm(.3);c.beginPath();c.moveTo(0,-mm(nr));c.lineTo(-mm(nr*.45),mm(nr*.7));c.lineTo(0,mm(nr*.3));c.closePath();c.fill();c.stroke();c.restore();
 T('N',nx,ny-nr-1.6*kk,3.4*kk,{align:'center',bold:true});
 /* panel */
 var px0=P.w-M-panW,px1=P.w-M,pw=panW,y=M;
 c.lineWidth=mm(.4);c.strokeStyle=ink;c.strokeRect(mm(px0),mm(M),mm(pw),mm(P.h-2*M-FH));
 var elog=await loadImgCached(m.eventLogo),lh=elog?34*kk:0;
 if(elog){var sc=Math.min((pw-10)/elog.width,(lh-6)/elog.height),lw2=elog.width*sc,lh2=elog.height*sc;c.drawImage(elog,mm(px0+pw/2-lw2/2),mm(y+lh/2-lh2/2),mm(lw2),mm(lh2));y+=lh;line(px0,y,px1,y,.4)}
 T((m.evac?((m.only&&layoutOf(m.only))?'EMERGENCY EVACUATION – '+layoutOf(m.only).name:'EMERGENCY EVACUATION PLAN'):((m.only&&layoutOf(m.only))?layoutOf(m.only).name+' – internal layout':(m.title||'SITE & FLOOR PLAN'))),px0+4,y+6.2*kk,3*kk,{col:'#5b6b78',bold:true});
 c.font=fontStr(mm(6.4*kk),true);var el=wrapText(c,m.event||'',mm(pw-8)).slice(0,3);el.forEach(function(s,i){T(s,px0+4,y+14*kk+i*7.4*kk,6.4*kk,{bold:true})});
 y+=14*kk+Math.max(1,el.length)*7.4*kk+1*kk;line(px0,y,px1,y,.4);
 var tmS=(m.tstart||m.tend)?((m.tstart||'')+(m.tend?' – '+m.tend:'')):'',attS=(+m.attend>0)?Math.round(+m.attend).toLocaleString('en-ZA'):'',rows=[['Venue',m.venue],['Client',m.client],['Date',m.date]].concat(tmS?[['Event times',tmS]]:[]).concat(attS?[['Exp. attendance',attS]]:[]).concat([['Revision',m.rev],['Drawn by',m.drawn],['Ref no.',m.ref],['Sheet',m.paper+'  ·  1 : '+N]]).concat(pgrid&&(m.gridMod>0||m.gridShow!==false)?[['Grid',(m.gridMod>0?m.gridMod+' m module':'')+((m.gridMinor===undefined?1:m.gridMinor)>0&&m.gridShow!==false?(m.gridMod>0?' · ':'')+(m.gridMinor===undefined?1:m.gridMinor)+' m lines':'')]]:[]),rh=6.6*kk;
 rows.forEach(function(r,i){T(r[0],px0+4,y+rh*.68,2.3*kk,{col:'#5b6b78'});c.font=fontStr(mm(3*kk),true);var v=String(r[1]||''),sz=3*kk;while(c.measureText(v).width>mm(pw-30*kk)&&sz>1.8*kk){sz-=.2*kk;c.font=fontStr(mm(sz),true)}T(v,px0+26*kk,y+rh*.68,sz,{bold:true});y+=rh;line(px0,y,px1,y,.18)});
 var CL=m.crowd===false?[]:crowdLines();
 if(CL.length){y+=1;T(m.only?'CAPACITY OF THIS STRUCTURE':'CROWD & CAPACITY',px0+4,y+4.6*kk,3.2*kk,{bold:true});y+=6.4*kk;var crh=4.6*kk;
  CL.forEach(function(r){var sz=2.5*kk;c.font=fontStr(mm(sz),false);var nm2=r[0];while(c.measureText(nm2).width>mm(pw-34*kk)&&nm2.length>6)nm2=nm2.slice(0,-2);
   T(nm2,px0+4,y+crh*.68,sz,{col:'#33444f'});if(r[1]!==''){c.font=fontStr(mm(2.7*kk),true);var vv=String(r[1]),vs=2.7*kk;while(c.measureText(vv).width>mm(pw*.52)&&vs>1.5*kk){vs-=.1*kk;c.font=fontStr(mm(vs),true)}T(vv,px1-4,y+crh*.68,vs,{bold:true,align:'right',col:r[2]||ink})}y+=crh});
  line(px0,y,px1,y,.18)}
 y+=1;T('LEGEND',px0+4,y+4.6*kk,3.2*kk,{bold:true});y+=7*kk;
 var bottomH=40*kk,avail=(P.h-M-FH)-bottomH-y,LD=legendData(),cols=1,rowH=Math.min(6.6*kk,avail/Math.max(1,LD.length));
 if(rowH<4.2*kk&&LD.length>1){cols=2;rowH=Math.min(6.6*kk,avail/Math.ceil(LD.length/2))}
 var colW=(pw-6)/cols;
 LD.forEach(function(e,i){var col=cols===2?Math.floor(i/Math.ceil(LD.length/2)):0,ri=cols===2?i%Math.ceil(LD.length/2):i,ex=px0+3+col*colW,ey=y+ri*rowH;
  var ib=Math.min(rowH*.84,6.6*kk);
  var sv2=R;iconDraw(c,e,mm(ex+ib/2+.5),mm(ey+rowH/2),mm(ib),ppm*0.2646*kk*.7);R=sv2;
  var nsz=Math.min(2.7*kk,rowH*.52);c.font=fontStr(mm(nsz),false);var nm=e.name,mw=mm(colW-ib-(cols===2?13:19)*kk);while(c.measureText(nm).width>mw&&nm.length>4)nm=nm.slice(0,-2);if(nm!==e.name)nm+='…';
  T(nm,ex+ib+2,ey+rowH/2+nsz*.34,nsz);T(e.q,ex+colW-2,ey+rowH/2+nsz*.34,nsz,{align:'right',col:'#33444f'})});
 var by=P.h-M-FH-bottomH;line(px0,by,px1,by,.4);
 c.font=fontStr(mm(2.1*kk),false);var sat=S.layers.some(function(l){return l.vis&&l.kind==='sat'})&&m.bg;
 var note='All dimensions in metres. Scale applies only when printed at '+m.paper+' at 100%; otherwise use the scale bar. Indicative layout for approval purposes: verify on site before setting out.'+(m.showFront!==false?' Orange edge = front of the structure.':'')+(m.evac?' Evacuation routes are indicative (shortest clear walking path to the nearest exit): confirm exit widths, travel distances and capacity against the approved event safety plan.':'')+(sat?' Aerial imagery © Google and/or third parties.':'');
 c.fillStyle='#33444f';wrapText(c,note,mm(pw-8)).slice(0,7).forEach(function(s,i){c.textAlign='left';c.textBaseline='alphabetic';c.fillText(s,mm(px0+4),mm(by+5*kk+i*3.1*kk))});
 T((m.ref||'')+'  ·  Rev '+m.rev,px0+4,P.h-M-FH-3*kk,2.2*kk,{bold:true});
  if(FH>0){
   var fy=P.h-M-FH;line(M,fy,P.w-M,fy,.4);
   var lx=M+4,lhh=FH-6;
   flogos.slice(0,5).forEach(function(im){var scl=Math.min(lhh/im.height,(P.w*.12)/im.width),w1=im.width*scl,h1=im.height*scl;c.drawImage(im,mm(lx),mm(fy+FH/2-h1/2),mm(w1),mm(h1));lx+=w1+5});
   var tx=lx+(flogos.length?3:0),tw1=(P.w-M-4)-tx,nl=Math.min(4,flines.length);
   if(nl&&tw1>40){var fs=Math.min(3*kk,(FH-4)/(nl*1.35));flines.slice(0,4).forEach(function(ln,i){var sz=fs;c.font=fontStr(mm(sz),i===0);while(c.measureText(ln).width>mm(tw1)&&sz>1.4){sz-=.1;c.font=fontStr(mm(sz),i===0)}T(ln,tx,fy+FH/2-(nl-1)*fs*.675+i*fs*1.35+fs*.34,sz,{bold:i===0,col:i===0?ink:'#33444f'})})}
  }
 /* watermark (optional, off by default) */
 if(m.watermark){ c.save();c.globalAlpha=.075;c.fillStyle='#0b3d6b';var wt=((m.company||'')+'  ·  '+(m.ref||'')).toUpperCase(),wsz=mm(6.5*kk);c.font=fontStr(wsz,true);c.textAlign='center';c.textBaseline='middle';
 var tw0=c.measureText(wt).width,stepX=tw0+mm(40*kk),stepY=mm(42*kk);c.translate(W/2,H/2);c.rotate(-28*D2R);
 for(var yy=-H;yy<H;yy+=stepY){var off=(Math.round(yy/stepY)%2)*stepX/2;for(var xx=-W-stepX;xx<W+stepX;xx+=stepX)c.fillText(wt,xx+off,yy)}
 c.restore();}
 return {canvas:cx,N:N,P:P};
}
async function exportSheet(kind){
 if(!S.objs.length&&!S.layers.length){toast('Draw something first');return}
 toast('Rendering sheet…',8000);
 try{
  var r=await renderSheet(),name=(S.meta.event||'plan').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')+'_'+S.meta.ref+'_Rev'+S.meta.rev+((S.meta.only&&layoutOf(S.meta.only))?'_'+layoutOf(S.meta.only).name.replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_'):'');
  var blob;
  if(kind==='pdf'){var jsPDF=window.jspdf&&window.jspdf.jsPDF;if(!jsPDF)throw new Error('PDF library did not load. Try PNG export.');var pdf=new jsPDF({orientation:r.P.w>=r.P.h?'landscape':'portrait',unit:'mm',format:[r.P.w,r.P.h]});pdf.addImage(r.canvas.toDataURL('image/jpeg',.93),'JPEG',0,0,r.P.w,r.P.h,undefined,'FAST');pdf.setProperties({title:(S.meta.event||'')+' – '+S.meta.title,author:S.meta.company,subject:'Ref '+S.meta.ref});blob=pdf.output('blob');name+='.pdf'}
  else{blob=await new Promise(function(res){r.canvas.toBlob(res,'image/png')});name+='.png'}
  var ok=await download(name,blob);
  if(!ok){var url=r.canvas.toDataURL('image/jpeg',.9);box('<h3>Your sheet is ready</h3><p class="note">Saving to a file is not available here. Press and hold the image to save or share it, or use your browser menu.</p><img alt="Rendered plan sheet" src="'+url+'">')}
  else toast('1 : '+r.N+' on '+S.meta.paper+' — saved')
 }catch(err){toast(err.message||'Export failed',5000)}
}
$('#bExport').onclick=function(){S.tab='sheet';openPanel();if(!matchMedia('(max-width:820px)').matches)renderPanel()};


