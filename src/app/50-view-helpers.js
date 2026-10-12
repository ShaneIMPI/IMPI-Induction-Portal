/* ---------- view helpers ---------- */
function objBounds(){
 var b=null;function add(p){if(!b)b={x0:p.x,y0:p.y,x1:p.x,y1:p.y};else{b.x0=Math.min(b.x0,p.x);b.y0=Math.min(b.y0,p.y);b.x1=Math.max(b.x1,p.x);b.y1=Math.max(b.y1,p.y)}}
 S.objs.forEach(function(o){if(!vo(o))return;if(o.t==='dim'){add(o.a);add(o.b)}else if(o.t==='line'||o.t==='poly'){o.pts.forEach(add)}else if(o.t==='text'){add(o)}else{corners(o).forEach(add)}});
 return b;
}
function layerBounds(){
 var b=null;S.layers.forEach(function(L){if(!L.vis)return;var w=L.img.width*L.mpp,h=L.img.height*L.mpp;[[0,0],[w,0],[w,h],[0,h]].forEach(function(q){var r=rotv(q[0],q[1],L.rot*D2R),p={x:L.x+r.x,y:L.y+r.y};if(!b)b={x0:p.x,y0:p.y,x1:p.x,y1:p.y};else{b.x0=Math.min(b.x0,p.x);b.y0=Math.min(b.y0,p.y);b.x1=Math.max(b.x1,p.x);b.y1=Math.max(b.y1,p.y)}})});return b;
}
function viewBounds(){var W=cv.clientWidth,H=cv.clientHeight,a=s2w({x:0,y:0}),b=s2w({x:W,y:H});return {x0:a.x,y0:a.y,x1:b.x,y1:b.y}}
function fitTo(b,pad){
 var W=cv.clientWidth,H=cv.clientHeight;if(!b||W<10)return;var bw=Math.max(b.x1-b.x0,1),bh=Math.max(b.y1-b.y0,1);
 var z=Math.min((W*(1-pad))/bw,(H*(1-pad))/bh);z=Math.max(.0005,Math.min(20000,z));S.view.z=z;S.view.x=W/2-((b.x0+b.x1)/2)*z;S.view.y=H/2-((b.y0+b.y1)/2)*z;draw();
}
function fitAll(){var b=objBounds()||layerBounds();if(!b){S.view.z=10;S.view.x=cv.clientWidth/2;S.view.y=cv.clientHeight/2;draw();return}fitTo(b,.12)}
function resize(){var W=cv.clientWidth,H=cv.clientHeight;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);draw()}
new ResizeObserver(resize).observe($('#stage'));

