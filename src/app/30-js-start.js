(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var cv=$('#cv'), ctx=cv.getContext('2d');
var TAU=Math.PI*2, D2R=Math.PI/180;
var DPR=Math.max(1,Math.min(3,window.devicePixelRatio||1));
function fmt(v){return v<10?v.toFixed(2):v.toFixed(1)}
function fm(v){return fmt(v)+' m'}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}
function today(){return new Date().toISOString().slice(0,10)}
var DIMCOL='#b42318', INK='#22313d';
var BRAND_NAME='IMPI RMS',BRAND_LOGO='/impi-logo.png';
function isAdmin(){return !!(S&&S.cloud&&S.cloud.user&&S.cloud.user.role==='admin')}
function enforceBrand(){if(!isAdmin()||/^IMPI Protection Agency/i.test(S.meta.company||''))S.meta.company=BRAND_NAME}
var BRAND_CFG=null,IMGC={};
var BRAND_FOOT=['IMPI RMS','10 Kosmos Crescent, Rynoue AH, Roodeplaat  ·  Tel 012 543 0640  ·  info@impi-secure.co.za  ·  www.impi-secure.co.za','Event Safety & Security'];
function loadBrand(){BRAND_CFG={name:BRAND_NAME,logos:[BRAND_LOGO],lines:BRAND_FOOT};return Promise.resolve(BRAND_CFG)}
function loadImgCached(src){if(!src)return Promise.resolve(null);if(IMGC[src]!==undefined)return Promise.resolve(IMGC[src]);return new Promise(function(res){var im=new Image();im.onload=function(){IMGC[src]=im;res(im)};im.onerror=function(){IMGC[src]=null;res(null)};im.src=src})}

