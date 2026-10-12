/* ---------- library ---------- */
var LIB=[
 {k:'trestle',n:'Trestle table + 2 benches',w:2.4,h:1.8,c:'Furniture',s:'table',seats:8,lab:''},
 {k:'round10',n:'Round table (10 seat)',w:2.7,h:2.7,c:'Furniture',s:'round',seats:10,lab:''},
 {k:'round8',n:'Round table (8 seat)',w:2.4,h:2.4,c:'Furniture',s:'round',seats:8,lab:''},
 {k:'cocktail',n:'Cocktail table',w:0.8,h:0.8,c:'Furniture',s:'cocktail',lab:''},
 {k:'umbrella',n:'Umbrella (3 m)',w:3,h:3,c:'Furniture',s:'umbrella',lab:''},
 {k:'vip_a',n:'VIP rope enclosure 4 × 4 (velvet)',w:4,h:4,c:'Exhibition',s:'ropebox',rp:'velvet',lab:'VIP'},
 {k:'vip_b',n:'VIP rope enclosure 8 × 5 (velvet)',w:8,h:5,c:'Exhibition',s:'ropebox',rp:'velvet',lab:'VIP'},
 {k:'vip_out',n:'Outdoor VIP rope & pole area 10 × 6',w:10,h:6,c:'Tents',s:'ropebox',rp:'ropepole',lab:'VIP',opn:1},
 {k:'rope_sq',n:'Stanchion & rope enclosure 3 × 3',w:3,h:3,c:'Exhibition',s:'ropebox',rp:'stanchion',lab:''},
 {k:'oct91',n:'MMA octagon cage 9.1 m (platform 10.7 m)',w:10.7,h:10.7,c:'Stage & AV',s:'octagon',cg:9.1,lab:'MMA cage'},
 {k:'oct73',n:'MMA octagon cage 7.3 m (platform 8.9 m)',w:8.9,h:8.9,c:'Stage & AV',s:'octagon',cg:7.3,lab:'MMA cage'},
 {k:'ring61',n:'Boxing / K-1 ring 6.1 m (platform 7.3 m)',w:7.3,h:7.3,c:'Stage & AV',s:'ring',cg:6.1,lab:'K-1 ring'},
 {k:'ring73',n:'Boxing / K-1 ring 7.3 m (platform 8.5 m)',w:8.5,h:8.5,c:'Stage & AV',s:'ring',cg:7.3,lab:'K-1 ring'},
 {k:'rstage6',n:'Round stage 6 m',w:6,h:6,c:'Stage & AV',s:'rstage',lab:'Round stage'},
 {k:'rstage8',n:'Round stage 8 m',w:8,h:8,c:'Stage & AV',s:'rstage',lab:'Round stage'},
 {k:'runway',n:'Catwalk / runway 12 × 1.5 m',w:12,h:1.5,c:'Stage & AV',s:'stage',lab:'Runway'},
 {k:'boom4',n:'Boom gate 4.5 m',w:4.5,h:.6,c:'Site & access',s:'boom',ps:1,lab:'Boom gate'},
 {k:'boom6',n:'Boom gate 6.5 m',w:6.5,h:.6,c:'Site & access',s:'boom',ps:1,lab:'Boom gate'},
 {k:'sgate4',n:'Sliding gate 4 m opening',w:8,h:.5,c:'Site & access',s:'sgate',ps:1,lab:'Sliding gate'},
 {k:'sgate6',n:'Sliding gate 6 m opening',w:12,h:.5,c:'Site & access',s:'sgate',ps:1,lab:'Sliding gate'},
 {k:'stairs_s',n:'Stairs 1.2 × 3 m',w:1.2,h:3,c:'Site & access',s:'stairs',ps:1,lab:'Stairs'},
 {k:'stairs_m',n:'Stairs 2.4 × 4 m',w:2.4,h:4,c:'Site & access',s:'stairs',ps:1,lab:'Stairs'},
 {k:'stairs_l',n:'Stairs 4 × 5 m',w:4,h:5,c:'Site & access',s:'stairs',ps:1,lab:'Stairs'},
 {k:'gaz3',n:'Gazebo 3 × 3',w:3,h:3,c:'Tents',s:'gazebo',lab:'Gazebo',opn:1},
 {k:'gaz36',n:'Gazebo 3 × 6',w:6,h:3,c:'Tents',s:'gazebo',lab:'Gazebo',opn:1},
 {k:'marq3',n:'Marquee 3 × 3',w:3,h:3,c:'Tents',s:'tent',lab:'Marquee'},
 {k:'marq5',n:'Marquee 5 × 5',w:5,h:5,c:'Tents',s:'tent',lab:'Marquee'},
 {k:'marq510',n:'Marquee 5 × 10',w:10,h:5,c:'Tents',s:'tent',lab:'Marquee'},
 {k:'marq10',n:'Marquee 10 × 10',w:10,h:10,c:'Tents',s:'tent',lab:'Marquee'},
 {k:'marq1020',n:'Marquee 10 × 20',w:20,h:10,c:'Tents',s:'tent',lab:'Marquee'},
 {k:'dome83',n:'Dome tent 8.3 × 8.3 (Crossover L, 68 m²)',w:8.29,h:8.29,c:'Tents',s:'dome',lab:'Dome'},
 {k:'dome5',n:'Small dome tent 5 × 5',w:5,h:5,c:'Tents',s:'dome',lab:'Dome'},
 {k:'bedouin',n:'Bedouin tent',w:8,h:8,c:'Tents',s:'bedouin',lab:'Bedouin',opn:1},
 {k:'snow',n:'Snow Peak tent',w:5,h:5,c:'Tents',s:'snow',lab:'Snow Peak'},
 {k:'stall',n:'Stall / stand 3 × 3',w:3,h:3,c:'Tents',s:'stall',lab:'Stall'},
 {k:'stage',n:'Stage',w:8,h:6,c:'Stage & AV',s:'stage',lab:'STAGE'},
 {k:'netting',n:'Shade netting, green (open underneath)',w:10,h:3,c:'Stage & AV',s:'netting',lab:'Shade netting'},
 {k:'nettingb',n:'Shade netting, black (open underneath)',w:10,h:3,c:'Stage & AV',s:'netting',dk:1,lab:'Shade netting'},
 {k:'truss33',n:'Truss frame 3 × 3',w:3,h:3,c:'Stage & AV',s:'truss',lab:''},
 {k:'truss44',n:'Truss frame 4 × 4',w:4,h:4,c:'Stage & AV',s:'truss',lab:''},
 {k:'truss64',n:'Truss frame 6 × 4',w:6,h:4,c:'Stage & AV',s:'truss',lab:''},
 {k:'truss66',n:'Truss frame 6 × 6',w:6,h:6,c:'Stage & AV',s:'truss',lab:''},
 {k:'truss3',n:'Truss run 3 m',w:3,h:.3,c:'Stage & AV',s:'truss',lab:''},
 {k:'truss6',n:'Truss run 6 m',w:6,h:.3,c:'Stage & AV',s:'truss',lab:''},
 {k:'deck3',n:'Decking 3 × 3',w:3,h:3,c:'Stage & AV',s:'deck',lab:'Deck'},
 {k:'deck63',n:'Decking 6 × 3',w:6,h:3,c:'Stage & AV',s:'deck',lab:'Deck'},
 {k:'deck66',n:'Decking 6 × 6',w:6,h:6,c:'Stage & AV',s:'deck',lab:'Deck'},
 {k:'deck99',n:'Decking 9 × 9',w:9,h:9,c:'Stage & AV',s:'deck',lab:'Deck'},
 {k:'cover',n:'Cover patch (hides the plan beneath)',w:4,h:3,c:'Plan editing',s:'cover',lab:''},
 {k:'screen',n:'LED / video screen',w:6,h:0.4,c:'Stage & AV',s:'screen',lab:''},
 {k:'foh',n:'FOH / sound desk',w:4,h:3,c:'Stage & AV',s:'plain',f:'#dfe6ee',lab:'FOH'},
 {k:'bar',n:'Bar counter',w:6,h:1.2,c:'Services',s:'plain',f:'#f3dcc3',lab:'Bar'},
 {k:'toilet',n:'Portable toilet',w:1.2,h:1.2,c:'Services',s:'wc',lab:''},
 {k:'toilet_wb',n:'Portable toilet + wash basin',w:1.8,h:1.2,c:'Services',s:'wcwb',lab:''},
 {k:'basin',n:'Wash basin',w:0.6,h:0.5,c:'Services',s:'basin',lab:''},
 {k:'basin3',n:'Hand-wash station (3 basins)',w:1.8,h:0.5,c:'Services',s:'basin',lab:''},
 {k:'urinal4',n:'Communal urinal (4 users)',w:1.6,h:1.6,c:'Services',s:'urinal',seats:4,lab:''},
 {k:'urinal6',n:'Communal urinal (6 users)',w:2.2,h:2.2,c:'Services',s:'urinal',seats:6,lab:''},
 {k:'trailer_abl',n:'Ablution trailer (6 cubicles)',w:6,h:2.5,c:'Services',s:'abltrailer',cub:6,lab:''},
 {k:'trailer_acc',n:'Accessible (disabled) ablution trailer',w:5,h:2.5,c:'Services',s:'abltrailer',acc:1,lab:''},
 {k:'gen',n:'Generator',w:2.5,h:1.2,c:'Services',s:'plain',f:'#f2e9b8',lab:'GEN'},
 {k:'vehicle',n:'Ambulance / vehicle',w:6,h:2.4,c:'Services',s:'vehicle',lab:'AMB'},
 {k:'faid',n:'First aid post',w:3,h:3,c:'Services',s:'plain',f:'#cfe9d9',lab:'First aid'},
 {k:'joc',n:'Command / JOC',w:4,h:3,c:'Services',s:'plain',f:'#cfe0f2',lab:'JOC'},
 {k:'stand33',n:'Stand 3 × 3',w:3,h:3,c:'Exhibition',s:'stand',lab:''},
 {k:'stand36',n:'Stand 6 × 3',w:6,h:3,c:'Exhibition',s:'stand',lab:''},
 {k:'stand66',n:'Stand 6 × 6',w:6,h:6,c:'Exhibition',s:'stand',lab:''},
 {k:'stand69',n:'Stand 9 × 6',w:9,h:6,c:'Exhibition',s:'stand',lab:''},
 {k:'stand99',n:'Island stand 9 × 9',w:9,h:9,c:'Exhibition',s:'stand',lab:''},
 {k:'column',n:'Column / pillar',w:0.6,h:0.6,c:'Exhibition',s:'column',lab:''},
 {k:'regdesk',n:'Registration / info desk',w:3,h:0.9,c:'Exhibition',s:'plain',f:'#f3dcc3',lab:'Desk'},
 {k:'lounge',n:'Seating / lounge area',w:4,h:3,c:'Exhibition',s:'plain',f:'#e6f0e0',lab:'Lounge'},
 {k:'storage',n:'Storage / back of house',w:3,h:3,c:'Exhibition',s:'plain',f:'#e3e3e3',lab:'Store'}
];
var LIBM={}; LIB.forEach(function(l){LIBM[l.k]=l});
var SIGNS=[
 {k:'fire_ext',n:'Fire extinguisher',t:'fire'},{k:'hydrant',n:'Fire hydrant',t:'fire'},
 {k:'hose_reel',n:'Fire hose reel',t:'fire'},{k:'call_point',n:'Fire alarm call point',t:'fire'},
 {k:'assembly',n:'Assembly point',t:'safe'},{k:'exit_run',n:'Emergency exit sign',t:'safe'},
 {k:'first_aid',n:'First aid',t:'safe'},{k:'exit_run_r',n:'Emergency exit sign (mirrored)',t:'safe',flip:1},{k:'exit_box',n:'EXIT sign (green box, white text)',t:'safe'},{k:'exit_sign',n:'EXIT sign (standard green, white text)',t:'safe'},{k:'disabled',n:'Accessible / disabled facility',t:'safe'},
 {k:'no_smoking',n:'No smoking',t:'proh'},{k:'no_entry',n:'No entry / restricted',t:'proh'},
 {k:'warn_elec',n:'Electrical hazard',t:'warn'},{k:'warn_gen',n:'General warning',t:'warn'}
];
var SIGNM={}; SIGNS.forEach(function(s){SIGNM[s.k]=s});
var DOORS=[
 {k:'entrance',n:'Entrance',col:'#1c6bb0',w:4,lab:'ENTRANCE'},
 {k:'exit',n:'Exit',col:'#12804a',w:3,lab:'EXIT'},
 {k:'eexit',n:'Emergency exit',col:'#0e7a45',w:3,lab:'EMERGENCY EXIT'},
 {k:'gate',n:'Vehicle / service gate',col:'#7a4b2a',w:5,lab:'GATE'}
];
var DOORM={}; DOORS.forEach(function(d){DOORM[d.k]=d});
var LINES=[{k:'fence',n:'Perimeter fence'},{k:'barrier',n:'Crowd barrier'},{k:'wall',n:'Wall / solid structure'},{k:'tape',n:'Tape / rope line'},{k:'shade',n:'Shade cloth fencing (green)'},{k:'shadeb',n:'Shade cloth fencing (black)'},{k:'drape',n:'Black draping'},{k:'truss',n:'Truss (draw any run or frame)'},{k:'stanchion',n:'Stanchion & rope (chrome posts, red rope)'},{k:'velvet',n:'VIP velvet rope (gold posts, red rope)'},{k:'belt',n:'Retractable belt barrier (black posts)'},{k:'ropepole',n:'Rope & timber poles (outdoor / VIP)'},{k:'plain',n:'Plain black line'},{k:'thin',n:'Thin line (hairline)'},{k:'brick',n:'Brick wall (hatched)'},{k:'shell',n:'Shell scheme wall'},{k:'evac',n:'Evacuation route'}];
var LINEM={}; LINES.forEach(function(l){LINEM[l.k]=l});
var ZCOL=[{c:'#5b6770',n:'Tent / structure'},{c:'#1c6bb0',n:'Hospitality'},{c:'#b7791f',n:'VIP'},{c:'#c62828',n:'Restricted'},{c:'#12804a',n:'General admission'},{c:'#7c3aed',n:'Backstage'}];
var PAPER={A5:{w:210,h:148},A4:{w:297,h:210},A3:{w:420,h:297},A2:{w:594,h:420},A1:{w:841,h:594},A0:{w:1189,h:841}};
function paperOf(m){if(m.paper==='Custom'){return {w:Math.max(60,Math.min(6000,+m.pw||420)),h:Math.max(60,Math.min(6000,+m.ph||297))}}return PAPER[m.paper]||PAPER.A3}
var SCALES=[10,20,25,50,75,100,150,200,250,300,400,500,600,750,1000,1250,1500,2000,2500,3000,4000,5000,7500,10000];

