/* ---------- state ---------- */
var S={view:{x:0,y:0,z:10},layers:[],objs:[],sel:null,tool:'select',arm:null,grid:1,issues:[],tmp:null,tab:'lib',nid:1,nl:1,custom:[],calib:null,mv:null,hover:null,snapPt:null,
 meta:{title:'SITE & FLOOR PLAN',event:'[EVENT NAME]',venue:'[VENUE]',client:'[CLIENT]',date:today(),rev:'A',drawn:'[DRAWN BY]',ref:'FP-'+today().replace(/-/g,'')+'-001',company:'IMPI RMS',paper:'A3',scale:'auto',extent:'content',north:0,minAisle:2,bg:true,logo:null,eventLogo:null,showFront:true,watermark:false,only:null,evac:false,gridMinor:1,gridShow:true,evAll:true,evEntr:true,layouts:[],mode:'outdoor',gridMod:0,gridPrint:true,gridLabels:true,gx:0,gy:0}};
var hist=[],redoS=[];
var R={z:1,u:1};
function px(v){return v*R.u/R.z}

