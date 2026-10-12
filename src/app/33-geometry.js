/* ---------- geometry ---------- */
function rotv(x,y,a){var c=Math.cos(a),s=Math.sin(a);return {x:x*c-y*s,y:x*s+y*c}}
function dimsOf(o){if(o.t==='sign')return {w:o.s,h:o.s};if(o.t==='door')return {w:o.w,h:o.th||0.6};return {w:o.w,h:o.h}}
function toLocal(o,p){return rotv(p.x-o.x,p.y-o.y,-o.rot*D2R)}
function toWorld(o,lx,ly){var r=rotv(lx,ly,o.rot*D2R);return {x:o.x+r.x,y:o.y+r.y}}
function corners(o){var d=dimsOf(o),w=d.w/2,h=d.h/2;return [[-w,-h],[w,-h],[w,h],[-w,h]].map(function(q){return toWorld(o,q[0],q[1])})}
function w2s(p){return {x:p.x*S.view.z+S.view.x,y:p.y*S.view.z+S.view.y}}
function s2w(p){return {x:(p.x-S.view.x)/S.view.z,y:(p.y-S.view.y)/S.view.z}}
function ptSeg(p,a,b){var dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,t=l2?((p.x-a.x)*dx+(p.y-a.y)*dy)/l2:0;t=Math.max(0,Math.min(1,t));var q={x:a.x+t*dx,y:a.y+t*dy};return {d:Math.hypot(p.x-q.x,p.y-q.y),q:q}}
function segInt(a,b,c,d){function o(p,q,r){return (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x)}var d1=o(a,b,c),d2=o(a,b,d),d3=o(c,d,a),d4=o(c,d,b);return d1*d2<0&&d3*d4<0}
function inPoly(p,P){var ins=false;for(var i=0,j=P.length-1;i<P.length;j=i++){if(((P[i].y>p.y)!==(P[j].y>p.y))&&(p.x<(P[j].x-P[i].x)*(p.y-P[i].y)/(P[j].y-P[i].y)+P[i].x))ins=!ins}return ins}
function polyGap(A,B){
 var i,j;
 for(i=0;i<A.length;i++)for(j=0;j<B.length;j++)if(segInt(A[i],A[(i+1)%A.length],B[j],B[(j+1)%B.length]))return null;
 if(inPoly(A[0],B)||inPoly(B[0],A))return null;
 var best={d:Infinity},r;
 for(i=0;i<A.length;i++)for(j=0;j<B.length;j++){r=ptSeg(A[i],B[j],B[(j+1)%B.length]);if(r.d<best.d)best={d:r.d,a:A[i],b:r.q}}
 for(i=0;i<B.length;i++)for(j=0;j<A.length;j++){r=ptSeg(B[i],A[j],A[(j+1)%A.length]);if(r.d<best.d)best={d:r.d,a:r.q,b:B[i]}}
 return best;
}
function isCircle(o){var L=LIBM[o.k];return L&&(L.s==='round'||L.s==='cocktail'||L.s==='umbrella')}
function polyOf(o){
 if(isCircle(o)){var r=Math.min(o.w,o.h)/2,p=[];for(var i=0;i<16;i++){var a=i/16*TAU;p.push({x:o.x+Math.cos(a)*r,y:o.y+Math.sin(a)*r})}return p}
 return corners(o);
}

