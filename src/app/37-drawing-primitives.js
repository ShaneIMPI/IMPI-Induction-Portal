/* ---------- drawing primitives ---------- */
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function hexA(h,a){var n=parseInt(h.slice(1),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')'}
function fontStr(sz,bold){return (bold?'600 ':'500 ')+sz+'px Barlow, "Helvetica Neue", Arial, sans-serif'}
function txt(c,s,x,y,size,o){
 o=o||{};c.save();c.translate(x,y);if(o.rot)c.rotate(o.rot);var k=R.u/R.z;c.scale(k,k);
 c.font=fontStr(size,o.bold);c.textAlign=o.align||'center';c.textBaseline=o.base||'middle';
 if(o.halo!==false){c.lineWidth=3.2;c.strokeStyle=o.haloCol||'rgba(255,255,255,.92)';c.lineJoin='round';c.strokeText(s,0,0)}
 c.fillStyle=o.col||'#12202b';c.fillText(s,0,0);c.restore();
}
function tw(c,s,size,bold){c.save();c.font=fontStr(size,bold);var w=c.measureText(s).width;c.restore();return w}
function dimLine(c,a,b,off,label,col){
 var dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-6)return;
 var ux=dx/len,uy=dy/len,nx=-uy,ny=ux,o=px(off||0);
 var a2={x:a.x+nx*o,y:a.y+ny*o},b2={x:b.x+nx*o,y:b.y+ny*o};
 col=col||DIMCOL;c.save();c.strokeStyle=col;c.fillStyle=col;c.lineWidth=px(1.1);c.lineCap='butt';
 if(off){var ov=px(4)*(off<0?-1:1),g=px(3)*(off<0?-1:1);
  c.beginPath();c.moveTo(a.x+nx*g,a.y+ny*g);c.lineTo(a2.x+nx*ov,a2.y+ny*ov);c.moveTo(b.x+nx*g,b.y+ny*g);c.lineTo(b2.x+nx*ov,b2.y+ny*ov);c.stroke()}
 c.beginPath();c.moveTo(a2.x,a2.y);c.lineTo(b2.x,b2.y);c.stroke();
 var t=px(4.5),tx=(ux-uy)*t,ty=(uy+ux)*t;
 c.lineWidth=px(1.6);c.beginPath();c.moveTo(a2.x-tx,a2.y-ty);c.lineTo(a2.x+tx,a2.y+ty);c.moveTo(b2.x-tx,b2.y-ty);c.lineTo(b2.x+tx,b2.y+ty);c.stroke();
 var ang=Math.atan2(dy,dx);if(ang>Math.PI/2||ang<-Math.PI/2)ang+=Math.PI;
 var mx=(a2.x+b2.x)/2,my=(a2.y+b2.y)/2;
 txt(c,label==null?fm(len):label,mx,my,12,{rot:ang,base:'bottom',col:col,bold:true});
 c.restore();
}


