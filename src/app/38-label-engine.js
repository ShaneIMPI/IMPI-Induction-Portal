/* ---------- label engine: text that follows and fits its structure ---------- */
function normAng(a){a=(((a+Math.PI)%TAU)+TAU)%TAU-Math.PI;if(a>Math.PI/2+1e-9)a-=Math.PI;else if(a<=-Math.PI/2+1e-9)a+=Math.PI;return a}
function wrapAt(c,s,sz,maxW,bold){
 var words=String(s).split(/\s+/),lines=[],cur='';
 words.forEach(function(w){var t=cur?cur+' '+w:w;if(tw(c,t,sz,bold)>maxW&&cur){lines.push(cur);cur=w}else cur=t});
 if(cur)lines.push(cur);return lines;
}
/* draws label inside a w x h (metres) box; the context must already be in the object's local frame (translated + rotated by o.rot).
   o.lm: 'along' (follow the long side, default) | 'with' (follow the object's own horizontal) | 'up' (always upright) | 'off'
   o.ls: fixed size in px (0/absent = auto-fit). Returns true if drawn. */
function labelBox(c,o,lab,w,h,opt){
 opt=opt||{};var mode=o.lm||'along';if(mode==='off'||!lab)return false;
 var ppu=R.z/R.u,wp=w*ppu,hp=h*ppu,rot=(o.rot||0)*D2R,rel;
 if(mode==='up')rel=-rot;else if(mode==='with')rel=normAng(rot)-rot;else rel=normAng(rot+(hp>wp*1.15?-Math.PI/2:0))-rot;
 var cs=Math.abs(Math.cos(rel)),sn=Math.abs(Math.sin(rel)),manual=+o.ls>0,maxSz=manual?+o.ls:Math.min(opt.max||18,Math.max(8,Math.min(wp,hp)*.5)),minSz=manual?+o.ls:6,pad=6;
 var axisAvail=(cs>=sn?wp:hp)-pad,subTxt=opt.sub||null,best=null,withSub,sz,L,tW,tH,bw,bh,sz2;
 for(withSub=subTxt?1:0;withSub>=0&&!best;withSub--){
  for(sz=maxSz;sz>=minSz-1e-6;sz-=0.5){
   L=wrapAt(c,lab,sz,Math.max(10,axisAvail),true);if(!manual&&L.length>4)continue;
   sz2=Math.max(6,Math.min(sz*.8,11));
   tW=0;L.forEach(function(l){tW=Math.max(tW,tw(c,l,sz,true))});
   tH=L.length*sz*1.12;
   if(withSub){tW=Math.max(tW,tw(c,subTxt,sz2,false));tH+=sz2*1.25}
   bw=tW*cs+tH*sn;bh=tW*sn+tH*cs;
   if(bw<=wp-4&&bh<=hp-4){best={L:L,sz:sz,sz2:sz2,sub:withSub?subTxt:null,tH:tH};break}
  }
 }
 if(!best){if(!manual)return false;L=wrapAt(c,lab,minSz,Math.max(10,axisAvail),true);best={L:L,sz:minSz,sz2:7,sub:null,tH:L.length*minSz*1.12}}
 var cx0=opt.cx||0,cy0=opt.cy||0,ca=Math.cos(rel),sa=Math.sin(rel),n=best.L.length,total=best.tH,y0=-total/2,dark=!!opt.dark,col=o.lc||(dark?'#fff':(opt.col||'#12202b'));
 best.L.forEach(function(l,i){var dy=y0+(i+.5)*best.sz*1.12;txt(c,l,cx0+(-sa)*px(dy),cy0+ca*px(dy),best.sz,{rot:rel,col:col,bold:true,halo:!dark})});
 if(best.sub){var dy2=y0+n*best.sz*1.12+best.sz2*.65;txt(c,best.sub,cx0+(-sa)*px(dy2),cy0+ca*px(dy2),best.sz2,{rot:rel,col:o.lc||'#33444f',halo:!dark})}
 return true;
}
function polyArea(P){var s=0,i,j;for(i=0,j=P.length-1;i<P.length;j=i++)s+=P[j].x*P[i].y-P[i].x*P[j].y;return s/2}
function polyCentroid(P){var a=polyArea(P),cx=0,cy=0,i,j,f;if(Math.abs(a)<1e-9){P.forEach(function(p){cx+=p.x;cy+=p.y});return {x:cx/P.length,y:cy/P.length}}
 for(i=0,j=P.length-1;i<P.length;j=i++){f=P[j].x*P[i].y-P[i].x*P[j].y;cx+=(P[j].x+P[i].x)*f;cy+=(P[j].y+P[i].y)*f}
 return {x:cx/(6*a),y:cy/(6*a)}}
function chordThrough(P,cx,cy,ang){
 var ux=Math.cos(ang),uy=Math.sin(ang),lo=-Infinity,hi=Infinity,i,a,b,dx,dy,det,t,sv,ex,ey;
 for(i=0;i<P.length;i++){a=P[i];b=P[(i+1)%P.length];dx=b.x-a.x;dy=b.y-a.y;det=-ux*dy+dx*uy;if(Math.abs(det)<1e-12)continue;ex=a.x-cx;ey=a.y-cy;t=(-ex*dy+dx*ey)/det;sv=(ux*ey-uy*ex)/det;
  if(sv>=0&&sv<1){if(t<=0&&t>lo)lo=t;if(t>=0&&t<hi)hi=t}}
 if(!isFinite(lo)||!isFinite(hi))return 0;return hi-lo;
}

