(function(){

"use strict";
const BRAND={maroon:"#451E28",gold:"#FFE283",amber:"#C09826",slate:"#A3AEBF",cream:"#FAFBF5",ink:"#3A3230"};
const PAPER={cream:"#FAFBF5",white:"#FFFFFF",transparent:"none"};
const CAT=["#451E28","#C09826","#A3AEBF","#E0B85A","#7A4B53","#6E7A8A","#9C6B2E","#C39FA4"];
const RAMP=d3.interpolateRgbBasis(["#FBF3DA","#FFE283","#C09826","#8A3340","#451E28"]);
const FONT="'Inter','Segoe UI',system-ui,sans-serif";
// real text width via canvas measureText (accurate for the actual figure font), with a fallback
let _measCtx=null;
function measure(s,size,weight){
  try{
    if(!_measCtx)_measCtx=document.createElement("canvas").getContext("2d");
    _measCtx.font=(weight?weight+" ":"")+size+"px "+FONT;
    const w=_measCtx.measureText(String(s)).width;
    if(isFinite(w)&&w>0)return w;
  }catch(e){}
  return String(s).length*size*0.56;
}
const GAIN="#C09826", LOSS="#A3AEBF", TOTALC="#451E28", ALERT="#B23A48", EMPTYCELL="#ECE8DD";

// ---- samples (real Arda-flavoured) ----
const SAMPLE={
  packed:{
    title:"Feedstock by brewery source",
    subtitle:"Wet BSG received, last 30 days",
    source:"Source: goods-in log · Showbench",
    unit:" kg",
    raw:"Caps Brewery, 4200, External\nVerdant, 3100, External\nHowling Hops, 2600, External\nPilot mash, 1800, Internal\nForty Five, 1500, External\nAffinity, 1200, External\nSolvay, 900, External"
  },
  half:{
    title:"Extract volume per batch",
    subtitle:"Protein-rich liquor recovered after clarification",
    source:"Source: batch records · Showbench",
    unit:" L",
    raw:"Batch 41, 540\nBatch 42, 575\nBatch 43, 610\nBatch 44, 560"
  },
  heatmap:{
    title:"Weekly operating metrics",
    subtitle:"Each row carries its own unit — set Bubble scale to Per row to compare within a row",
    source:"Source: weekly process report · Showbench",
    unit:"",
    raw:",W22,W23,W24,W25\nProtein yield (%),88,90,89,92\nSpent grain (kg),420,460,395,510\nWater use (L),1850,1700,1900,1600\nFloor area (m²),12,12,18,18\nEnergy (kWh),240,255,230,265"
  },
  treemap:{
    title:"Where the protein goes",
    subtitle:"Mass fate across the purification train",
    source:"Source: mass balance, Batch 44 · Showbench",
    unit:"%",
    raw:"Recovered protein, 62, Product\nWash losses, 14, Loss\nCentrate solids, 11, Loss\nSpent grain solids, 9, Loss\nBound moisture, 4, Loss"
  },
  lollipop:{
    title:"Step yields, latest batch",
    subtitle:"Single-pass recovery at each stage",
    source:"Source: Batch 44 · Showbench",
    unit:"%",
    raw:"Alkaline extraction, 92\nIsoelectric precip, 85\nCentrifuge recovery, 87\nUF / TFF, 83\nDiafiltration, 92"
  },
  square:{
    title:"Extract volume per batch",
    subtitle:"Litres recovered · square area scales with volume",
    source:"Source: batch records · Showbench",
    unit:" L",
    raw:"Batch 41, 540\nBatch 42, 575\nBatch 43, 610\nBatch 44, 560\nBatch 45, 628"
  },
  waffle:{
    title:"Percent of weekly target",
    subtitle:"Overall protein recovery against goal",
    source:"Source: weekly process report · Showbench",
    unit:"%",
    raw:"Yield to target, 92"
  },
  bullet:{
    title:"Yield versus target",
    subtitle:"Bar = this week · tick = target · ring = last week",
    source:"Source: weekly process report · Showbench",
    unit:"%",
    raw:"Overall yield, 84, 88, 81\nExtraction, 92, 90, 89\nPrecipitation, 85, 86, 83\nUF / TFF, 83, 85, 80\nDiafiltration, 92, 91, 90"
  },
  slope:{
    title:"Week on week, by step",
    subtitle:"Single-pass recovery, last week to this week",
    source:"Source: weekly process report · Showbench",
    unit:"%",
    raw:"#axes, Last week, This week\nExtraction, 89, 92\nPrecipitation, 83, 85\nCentrifuge, 85, 87\nUF / TFF, 80, 83\nDiafiltration, 90, 92"
  },
  waterfall:{
    title:"Where the protein goes",
    subtitle:"Mass balance, Batch 44 (% of inlet protein)",
    source:"Source: mass balance · Showbench",
    unit:"%",
    raw:"Protein in feed, 100\nExtraction loss, -8\nPrecipitation loss, -7\nCentrate solids, -11\nWash losses, -12\n= Recovered protein"
  },
  control:{
    title:"Yield control chart",
    subtitle:"Overall protein recovery by batch",
    source:"Source: batch records · Showbench",
    unit:"%",
    raw:"#center, 86\n#target, 88\nB38, 84\nB39, 87\nB40, 85\nB41, 86\nB42, 83\nB43, 88\nB44, 91\nB45, 86"
  }
};

const GLYPH={
  packed:'<svg width="46" height="30" viewBox="0 0 46 30"><circle cx="15" cy="16" r="11" fill="#451E28"/><circle cx="31" cy="10" r="7" fill="#C09826"/><circle cx="35" cy="22" r="6" fill="#A3AEBF"/><circle cx="9" cy="6" r="4" fill="#E0B85A"/></svg>',
  half:'<svg width="46" height="30" viewBox="0 0 46 30"><path d="M3 26 a8 8 0 0 1 16 0 z" fill="#A3AEBF"/><path d="M20 26 a11 11 0 0 1 22 0 z" fill="#451E28"/></svg>',
  heatmap:'<svg width="46" height="30" viewBox="0 0 46 30">'+[0,1,2].map(r=>[0,1,2,3].map(c=>{const v=[ [3,5,6,7],[5,7,4,6],[6,4,7,5] ][r][c];return `<circle cx="${8+c*11}" cy="${6+r*9}" r="${v*0.7}" fill="${['#FBF3DA','#FFE283','#C09826','#8A3340','#451E28'][Math.min(4,Math.floor(v/2))]}"/>`}).join('')).join('')+'</svg>',
  treemap:'<svg width="46" height="30" viewBox="0 0 46 30"><rect x="1" y="1" width="26" height="28" rx="1.5" fill="#451E28"/><rect x="29" y="1" width="16" height="15" rx="1.5" fill="#C09826"/><rect x="29" y="18" width="16" height="11" rx="1.5" fill="#A3AEBF"/></svg>',
  lollipop:'<svg width="46" height="30" viewBox="0 0 46 30"><line x1="4" y1="6" x2="34" y2="6" stroke="#A3AEBF" stroke-width="2"/><circle cx="36" cy="6" r="4" fill="#451E28"/><line x1="4" y1="16" x2="26" y2="16" stroke="#A3AEBF" stroke-width="2"/><circle cx="28" cy="16" r="4" fill="#C09826"/><line x1="4" y1="26" x2="40" y2="26" stroke="#A3AEBF" stroke-width="2"/><circle cx="42" cy="26" r="4" fill="#451E28"/></svg>',
  square:'<svg width="46" height="30" viewBox="0 0 46 30"><rect x="3" y="18" width="8" height="8" fill="#A3AEBF"/><rect x="14" y="12" width="13" height="13" fill="#C09826"/><rect x="30" y="9" width="16" height="16" fill="#451E28"/></svg>',
  waffle:'<svg width="46" height="30" viewBox="0 0 46 30">'+[0,1,2,3,4].map(r=>[0,1,2,3,4,5,6,7].map(c=>{const filled=(4-r)*8+c<26;return `<rect x="${3+c*5.2}" y="${3+r*5.2}" width="4" height="4" rx="1" fill="${filled?'#451E28':'#ECE8DD'}"/>`}).join('')).join('')+'</svg>',
  bullet:'<svg width="46" height="30" viewBox="0 0 46 30"><rect x="2" y="6" width="42" height="6" rx="2" fill="#EDE7D8"/><rect x="2" y="6" width="26" height="6" rx="2" fill="#451E28"/><line x1="32" y1="3" x2="32" y2="15" stroke="#3A3230" stroke-width="2.5"/><rect x="2" y="20" width="42" height="6" rx="2" fill="#EDE7D8"/><rect x="2" y="20" width="34" height="6" rx="2" fill="#C09826"/><line x1="30" y1="17" x2="30" y2="29" stroke="#3A3230" stroke-width="2.5"/></svg>',
  slope:'<svg width="46" height="30" viewBox="0 0 46 30"><line x1="10" y1="5" x2="36" y2="22" stroke="#A3AEBF" stroke-width="2"/><line x1="10" y1="20" x2="36" y2="9" stroke="#451E28" stroke-width="2"/><circle cx="10" cy="5" r="3" fill="#A3AEBF"/><circle cx="36" cy="22" r="3" fill="#A3AEBF"/><circle cx="10" cy="20" r="3" fill="#451E28"/><circle cx="36" cy="9" r="3" fill="#451E28"/></svg>',
  waterfall:'<svg width="46" height="30" viewBox="0 0 46 30"><rect x="3" y="6" width="7" height="20" fill="#C09826"/><rect x="13" y="6" width="7" height="8" fill="#A3AEBF"/><rect x="23" y="14" width="7" height="7" fill="#A3AEBF"/><rect x="33" y="14" width="7" height="12" fill="#451E28"/></svg>',
  control:'<svg width="46" height="30" viewBox="0 0 46 30"><line x1="3" y1="7" x2="43" y2="7" stroke="#A3AEBF" stroke-dasharray="3 2"/><line x1="3" y1="23" x2="43" y2="23" stroke="#A3AEBF" stroke-dasharray="3 2"/><line x1="3" y1="15" x2="43" y2="15" stroke="#451E28"/><polyline points="6,16 15,12 24,17 33,9 40,14" fill="none" stroke="#3A3230" stroke-width="1.5" opacity=".6"/><circle cx="15" cy="12" r="2.4" fill="#451E28"/><circle cx="33" cy="9" r="2.4" fill="#B23A48"/></svg>'
};

const CHARTS={
  packed:{name:"Packed circles", kind:"list", shape:"list", render:renderPacked},
  half:{name:"Proportional area (half)", kind:"list", shape:"list", render:renderHalf},
  square:{name:"Proportional area (square)", kind:"list", shape:"list", render:renderSquare},
  waffle:{name:"Waffle (% to goal)", kind:"list", shape:"list", render:renderWaffle},
  treemap:{name:"Treemap", kind:"list", shape:"list", render:renderTreemap},
  lollipop:{name:"Lollipop", kind:"list", shape:"list", render:renderLollipop},
  bullet:{name:"Bullet (vs target)", kind:"items", shape:"bullet", render:renderBullet},
  slope:{name:"Slope (week on week)", kind:"items", shape:"duo", render:renderSlope},
  waterfall:{name:"Waterfall", kind:"items", shape:"waterfall", render:renderWaterfall},
  control:{name:"Control chart (SPC)", kind:"items", shape:"control", render:renderControl},
  heatmap:{name:"Bubble heatmap", kind:"matrix", shape:"matrix", render:renderHeatmap}
};

const HINTS={
  list:"One row per item:  Label, Value, Group  (group is optional, drives colour).",
  matrix:"First row = column headers (leave the first cell empty). Each row = label then one value per column. Tip: write a row label as Name (unit) — eg Moisture (%) — to give that row its own unit when using Per-row bubble scale.",
  bullet:"One row per metric:  Label, Actual, Target, Last week  (last week is optional).",
  duo:"One row per item:  Label, Before, After.  Add a line  #axes, Last week, This week  to name the columns.",
  waterfall:"One row per step:  Label, signed value  (+ gains, − losses). Start a label with = for a running-total bar.",
  control:"Ordered series:  Label, Value.  Optional lines  #center, 88  and  #target, 90  set the centre and spec."
};

const S={type:"packed", colorMode:"brand", showValues:true, showLabels:true, sort:true,
         bubbleScale:"all",
         bg:"cream", aspect:"16x9", unit:" kg", isSample:true,
         title:"", subtitle:"", source:"", raw:""};

// ---- helpers ----
const fmt=d3.format(",");
function num(v){ if(v==null||v==="")return ""; const n=+v; return (Math.abs(n)<1000)? (Math.round(n*10)/10).toString() : fmt(Math.round(n)); }
function vlabel(v){ return num(v)+(S.unit||""); }
function readable(hex){ if(hex==="none")return BRAND.ink; const c=d3.rgb(hex); const L=(0.299*c.r+0.587*c.g+0.114*c.b)/255; return L>0.62? BRAND.ink : "#FFFFFF"; }
function slug(s){ return (s||"chart").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"chart"; }

function parseRows(raw){
  const meta={}, items=[];
  raw.split(/\r?\n/).forEach(line=>{
    if(!line.trim())return;
    const p=line.split(/\t|,/).map(s=>s.trim());
    if(p[0].startsWith("#")){ meta[p[0].slice(1).trim().toLowerCase()]=p.slice(1).map(s=>s.trim()); return; }
    const label=p[0]; const v=[]; let group=null;
    for(let i=1;i<p.length;i++){
      if(p[i]==="")continue;
      if(/^-?\d/.test(p[i])){ const n=parseFloat(p[i]); if(!isNaN(n)) v.push(n); }
      else if(group===null) group=p[i];
    }
    items.push({label, v, group});
  });
  return {meta, items};
}
function metaNum(meta,key){ const a=meta[key]; if(!a)return null; const n=parseFloat(a[0]); return isNaN(n)?null:n; }
function parseMatrix(raw){
  const lines=raw.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2)return null;
  const header=lines[0].split(/\t|,/).map(s=>s.trim());
  const colLabels=header.slice(1);
  const rowLabels=[], values=[];
  for(let i=1;i<lines.length;i++){
    const p=lines[i].split(/\t|,/).map(s=>s.trim());
    rowLabels.push(p[0]);
    values.push(colLabels.map((_,c)=>{const n=parseFloat(p[c+1]); return isNaN(n)?null:n;}));
  }
  return {rowLabels, colLabels, values};
}

function dims(){
  const W=1200;
  const H = S.aspect==="4x3"?900 : S.aspect==="1x1"?1200 : 675;
  return {W,H};
}

// ---- base svg with title block ----
function base(){
  const {W,H}=dims();
  document.getElementById("stage").innerHTML="";
  const svg=d3.select("#stage").append("svg")
    .attr("xmlns","http://www.w3.org/2000/svg")
    .attr("viewBox",`0 0 ${W} ${H}`).attr("width",W).attr("height",H);
  if(PAPER[S.bg]!=="none") svg.append("rect").attr("width",W).attr("height",H).attr("fill",PAPER[S.bg]);
  const hasTitle = S.title.trim()||S.subtitle.trim();
  if(S.title.trim())
    svg.append("text").attr("x",64).attr("y",54).attr("font-family",FONT)
       .attr("font-size",30).attr("font-weight",700).attr("fill",BRAND.ink).text(S.title);
  if(S.subtitle.trim())
    svg.append("text").attr("x",64).attr("y",82).attr("font-family",FONT)
       .attr("font-size",15).attr("fill",BRAND.amber).attr("font-weight",600).text(S.subtitle);
  if(S.source.trim())
    svg.append("text").attr("x",64).attr("y",H-24).attr("font-family",FONT)
       .attr("font-size",12).attr("fill","#9a9286").text(S.source);
  const top = hasTitle?112:44, bottom = S.source.trim()?54:32, side=64;
  const g=svg.append("g").attr("transform",`translate(${side},${top})`);
  return {svg,g, iw:W-side*2, ih:H-top-bottom};
}

function colorFn(list){
  if(S.colorMode==="ramp"){
    const ext=d3.extent(list,d=>d.value);
    const sc=d3.scaleSequential().domain([ext[0], ext[1]||1]).interpolator(RAMP);
    return d=>sc(d.value);
  }
  const groups=[...new Set(list.map(d=>d.group).filter(Boolean))];
  if(groups.length){ const o=d3.scaleOrdinal().domain(groups).range(CAT); return d=>o(d.group); }
  return (d,i)=>CAT[i%CAT.length];
}

// ---- renderers ----
function renderPacked(g,iw,ih,list){
  if(S.sort) list=[...list].sort((a,b)=>b.value-a.value);
  const root=d3.hierarchy({children:list}).sum(d=>d.value);
  d3.pack().size([iw,ih]).padding(5)(root);
  const col=colorFn(list);
  const node=g.selectAll("g.n").data(root.leaves()).join("g")
    .attr("class","n").attr("transform",d=>`translate(${d.x},${d.y})`);
  node.append("circle").attr("r",d=>d.r).attr("fill",(d,i)=>col(d.data,i))
      .attr("stroke",BRAND.cream).attr("stroke-width",2);
  node.each(function(d,i){
    const sel=d3.select(this), fill=col(d.data,i), tc=readable(typeof fill==="string"?fill:"#451E28");
    if(d.r>30 && S.showLabels){
      sel.append("text").attr("text-anchor","middle").attr("font-family",FONT)
         .attr("font-size",Math.min(18,d.r/3.2)).attr("font-weight",600).attr("fill",tc)
         .attr("dy",S.showValues?"-0.1em":"0.32em").text(trim(d.data.label,d.r/5.2));
    }
    if(d.r>30 && S.showValues){
      sel.append("text").attr("text-anchor","middle").attr("font-family",FONT)
         .attr("font-size",Math.min(16,d.r/3.6)).attr("font-weight",700).attr("fill",tc)
         .attr("dy",S.showLabels?"1.15em":"0.34em").text(vlabel(d.data.value));
    }
  });
}
function trim(s,max){ max=Math.max(3,Math.round(max)); return s.length>max? s.slice(0,max-1)+"…" : s; }

function renderHalf(g,iw,ih,list){
  if(S.sort) list=[...list].sort((a,b)=>b.value-a.value);
  const col=colorFn(list);
  const vmax=d3.max(list,d=>d.value)||1;
  const ratios=list.map(d=>Math.sqrt(d.value/vmax));
  const gap=26, labelH=46;
  const baseY=ih-labelH;
  const Rh=baseY*0.94;
  const Rw=(iw - gap*(list.length-1)) / (2*d3.sum(ratios));
  const R=Math.min(Rh,Rw);
  const radii=ratios.map(r=>r*R);
  const totalW=2*d3.sum(radii)+gap*(list.length-1);
  let x=(iw-totalW)/2;
  list.forEach((d,i)=>{
    const r=radii[i], cx=x+r, fill=col(d,i);
    g.append("path").attr("d",`M${cx-r},${baseY} A${r},${r} 0 0 1 ${cx+r},${baseY} Z`)
      .attr("fill",fill);
    if(S.showLabels)
      g.append("text").attr("x",cx).attr("y",baseY+20).attr("text-anchor","middle")
       .attr("font-family",FONT).attr("font-size",14).attr("font-weight",600).attr("fill",BRAND.ink)
       .text(trim(d.label,Math.max(8,r/4.5)));
    if(S.showValues)
      g.append("text").attr("x",cx).attr("y",baseY+39).attr("text-anchor","middle")
       .attr("font-family",FONT).attr("font-size",13).attr("font-weight",700).attr("fill",BRAND.amber)
       .text(vlabel(d.value));
    x+=2*r+gap;
  });
  g.append("line").attr("x1",(iw-totalW)/2-10).attr("x2",(iw+totalW)/2+10)
   .attr("y1",baseY).attr("y2",baseY).attr("stroke",BRAND.slate).attr("stroke-width",1).attr("opacity",.5);
}

// Split a row label like "Moisture (%)" into {label:"Moisture", suffix:"%"}.
// Falls back to the global unit when the label carries no unit of its own.
function splitRowUnit(label){
  const mm=/^(.*?)\s*\(\s*([^()]{1,8})\s*\)\s*$/.exec(label||"");
  if(mm){ const u=mm[2].trim(); return {label:mm[1].trim(), suffix: u==="%"?"%":" "+u}; }
  return {label:String(label==null?"":label), suffix:S.unit||""};
}
function renderHeatmap(g,iw,ih,m){
  if(!m){ throw new Error("matrix"); }
  const {rowLabels,colLabels,values}=m;
  const flat=values.flat().filter(v=>v!=null);
  if(!flat.length) throw new Error("no numeric values in matrix");
  const perRow = S.bubbleScale==="row";
  const gMin=d3.min(flat), gMax=d3.max(flat);
  // per-row stats + unit parsed from "Name (unit)" labels
  const rowInfo=rowLabels.map((rl,ri)=>{
    const rv=values[ri].filter(v=>v!=null);
    const su=splitRowUnit(rl);
    return {raw:String(rl==null?"":rl), label:su.label, suffix:su.suffix,
            max: rv.length?d3.max(rv):1};
  });
  const headW=d=>measure(perRow?d.label:d.raw,13) + (perRow && d.suffix.trim()?measure("  "+d.suffix.trim(),11):0);
  const leftPad=Math.min(210, 18+d3.max(rowInfo,headW)), topPad=30;
  const x=d3.scaleBand().domain(colLabels).range([leftPad,iw]).padding(0);
  const y=d3.scaleBand().domain(rowLabels).range([topPad,ih]).padding(0);
  const band=Math.min(x.bandwidth(),y.bandwidth());
  const rMax=band/2*0.84;
  // radius + colour scales: each row against its own max, or all against the global max
  const globalRad=d3.scaleSqrt().domain([0,gMax||1]).range([3,rMax]);
  const rowRad=rowInfo.map(ro=>d3.scaleSqrt().domain([0,ro.max||1]).range([3,rMax]));
  const fillForce = S.colorMode==="ramp";
  const seqGlobal=d3.scaleSequential().domain([gMin,gMax]).interpolator(RAMP);
  const rowSeq=rowInfo.map(ro=>d3.scaleSequential().domain([0,ro.max||1]).interpolator(RAMP));
  const radFor=(ri,v)=> perRow? rowRad[ri](v) : globalRad(v);
  const colorFor=(ri,v)=> !fillForce? BRAND.amber : (perRow? rowSeq[ri](v) : seqGlobal(v));
  // col headers
  colLabels.forEach(c=>g.append("text").attr("x",x(c)+x.bandwidth()/2).attr("y",topPad-12)
    .attr("text-anchor","middle").attr("font-family",FONT).attr("font-size",13).attr("fill",BRAND.ink).text(c));
  // row headers — strip the unit out of the label and show it as a muted chip in per-row mode
  rowInfo.forEach((ro,ri)=>{
    const ty=y(rowLabels[ri])+y.bandwidth()/2;
    const t=g.append("text").attr("x",leftPad-12).attr("y",ty)
      .attr("text-anchor","end").attr("dominant-baseline","middle")
      .attr("font-family",FONT).attr("font-size",13).attr("fill",BRAND.ink);
    if(perRow){
      t.append("tspan").text(ro.label);
      if(ro.suffix.trim()) t.append("tspan").attr("fill","#9a9286").attr("font-size",11).text("  "+ro.suffix.trim());
    } else {
      t.text(ro.raw);
    }
  });
  rowLabels.forEach((rl,ri)=>colLabels.forEach((cl,ci)=>{
    const v=values[ri][ci]; if(v==null)return;
    const cx=x(cl)+x.bandwidth()/2, cy=y(rl)+y.bandwidth()/2;
    const rad=radFor(ri,v), fill=colorFor(ri,v);
    g.append("circle").attr("cx",cx).attr("cy",cy).attr("r",rad).attr("fill",fill);
    if(S.showValues && rad>11)
      g.append("text").attr("x",cx).attr("y",cy).attr("text-anchor","middle")
       .attr("dominant-baseline","central").attr("font-family",FONT).attr("font-size",12)
       .attr("font-weight",700).attr("fill",fillForce?readable(fill):"#fff").text(num(v));
  }));
}

function renderTreemap(g,iw,ih,list){
  const root=d3.hierarchy({children:list}).sum(d=>d.value).sort((a,b)=>b.value-a.value);
  d3.treemap().size([iw,ih]).paddingInner(4).round(true)(root);
  const col=colorFn(list);
  const cell=g.selectAll("g.c").data(root.leaves()).join("g").attr("class","c")
    .attr("transform",d=>`translate(${d.x0},${d.y0})`);
  cell.append("rect").attr("width",d=>d.x1-d.x0).attr("height",d=>d.y1-d.y0)
      .attr("rx",3).attr("fill",(d,i)=>col(d.data,i));
  cell.each(function(d,i){
    const w=d.x1-d.x0,h=d.y1-d.y0,fill=col(d.data,i),tc=readable(typeof fill==="string"?fill:"#451E28");
    if(w<54||h<32)return;
    const sel=d3.select(this);
    if(S.showLabels)
      sel.append("text").attr("x",12).attr("y",24).attr("font-family",FONT).attr("font-size",15)
         .attr("font-weight",600).attr("fill",tc).text(trim(d.data.label,w/8.5));
    if(S.showValues)
      sel.append("text").attr("x",12).attr("y",h-12).attr("font-family",FONT).attr("font-size",18)
         .attr("font-weight",700).attr("fill",tc).text(vlabel(d.data.value));
  });
}

function renderLollipop(g,iw,ih,list){
  if(S.sort) list=[...list].sort((a,b)=>b.value-a.value);
  const col=colorFn(list);
  const labelW=Math.min(200, 14+d3.max(list,d=>measure(d.label,14)));
  const valW=64;
  const x=d3.scaleLinear().domain([0,d3.max(list,d=>d.value)*1.04]).range([labelW,iw-valW]);
  const y=d3.scaleBand().domain(list.map(d=>d.label)).range([4,ih-4]).padding(0.42);
  list.forEach((d,i)=>{
    const cy=y(d.label)+y.bandwidth()/2, fill=col(d,i);
    g.append("line").attr("x1",x(0)).attr("x2",x(d.value)).attr("y1",cy).attr("y2",cy)
      .attr("stroke",BRAND.slate).attr("stroke-width",2.5).attr("opacity",.55);
    g.append("circle").attr("cx",x(d.value)).attr("cy",cy).attr("r",8).attr("fill",fill);
    if(S.showLabels)
      g.append("text").attr("x",labelW-14).attr("y",cy).attr("text-anchor","end")
       .attr("dominant-baseline","middle").attr("font-family",FONT).attr("font-size",14)
       .attr("fill",BRAND.ink).text(d.label);
    if(S.showValues)
      g.append("text").attr("x",x(d.value)+15).attr("y",cy).attr("dominant-baseline","middle")
       .attr("font-family",FONT).attr("font-size",14).attr("font-weight",700).attr("fill",BRAND.maroon)
       .text(vlabel(d.value));
  });
}

function renderSquare(g,iw,ih,list){
  if(S.sort) list=[...list].sort((a,b)=>b.value-a.value);
  const col=colorFn(list);
  const vmax=d3.max(list,d=>d.value)||1;
  const sides=list.map(d=>Math.sqrt(Math.max(0,d.value)/vmax));
  const gap=26, labelH=46, baseY=ih-labelH;
  const Sh=baseY*0.96, Sw=(iw-gap*(list.length-1))/d3.sum(sides);
  const SIDE=Math.min(Sh,Sw);
  const w=sides.map(s=>s*SIDE), totalW=d3.sum(w)+gap*(list.length-1);
  let x=(iw-totalW)/2;
  list.forEach((d,i)=>{
    const s=w[i], fill=col(d,i), tc=readable(typeof fill==="string"?fill:"#451E28");
    g.append("rect").attr("x",x).attr("y",baseY-s).attr("width",s).attr("height",s).attr("rx",3).attr("fill",fill);
    if(S.showValues && s>34)
      g.append("text").attr("x",x+s/2).attr("y",baseY-s/2).attr("text-anchor","middle").attr("dominant-baseline","central")
       .attr("font-family",FONT).attr("font-size",Math.min(17,s/4)).attr("font-weight",700).attr("fill",tc).text(vlabel(d.value));
    if(S.showLabels)
      g.append("text").attr("x",x+s/2).attr("y",baseY+20).attr("text-anchor","middle").attr("font-family",FONT)
       .attr("font-size",13).attr("font-weight",600).attr("fill",BRAND.ink).text(trim(d.label,Math.max(8,s/4.5)));
    x+=s+gap;
  });
  g.append("line").attr("x1",(iw-totalW)/2-8).attr("x2",(iw+totalW)/2+8).attr("y1",baseY).attr("y2",baseY)
   .attr("stroke",BRAND.slate).attr("stroke-width",1).attr("opacity",.5);
}

function renderWaffle(g,iw,ih,list){
  const cols=10, rows=10, total=100;
  const sum=d3.sum(list,d=>d.value)||1;
  const scale = sum<=100 ? 100 : sum;
  const cells=list.map(d=>Math.round(Math.max(0,d.value)/scale*total));
  const assign=[]; list.forEach((d,i)=>{ for(let k=0;k<cells[i];k++) if(assign.length<total) assign.push(i); });
  while(assign.length<total) assign.push(-1);
  const col=colorFn(list);
  const single=list.length===1;
  const legendH=single?0:38;
  const avail=single? Math.min(ih-10, iw*0.52) : Math.min(iw, ih-legendH);
  const cell=avail/cols, pad=cell*0.14, sz=cell-pad;
  const gx=single?0:(iw-cols*cell)/2;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const cat=assign[(rows-1-r)*cols+c];
    g.append("rect").attr("x",gx+c*cell).attr("y",r*cell).attr("width",sz).attr("height",sz).attr("rx",2)
     .attr("fill", cat>=0? col(list[cat],cat) : EMPTYCELL);
  }
  if(single){
    const lx=gx+cols*cell+28, ly=rows*cell/2;
    g.append("text").attr("x",lx).attr("y",ly).attr("dominant-baseline","central").attr("font-family",FONT)
     .attr("font-size",58).attr("font-weight",700).attr("fill",BRAND.maroon).text(vlabel(list[0].value));
    if(S.showLabels)
      g.append("text").attr("x",lx).attr("y",ly+40).attr("font-family",FONT).attr("font-size",16).attr("fill",BRAND.ink).text(list[0].label);
  } else {
    let lx=gx, ly=rows*cell+22;
    list.forEach((d,i)=>{
      g.append("rect").attr("x",lx).attr("y",ly-11).attr("width",13).attr("height",13).attr("rx",2).attr("fill",col(d,i));
      const txt=d.label+(S.showValues?" "+vlabel(d.value):"");
      g.append("text").attr("x",lx+19).attr("y",ly).attr("dominant-baseline","central").attr("font-family",FONT)
       .attr("font-size",13).attr("fill",BRAND.ink).text(txt);
      lx += 19 + measure(txt,13) + 22;
    });
  }
}

function renderBullet(g,iw,ih,items){
  let rows=items.filter(it=>it.v.length>=2).map(it=>({label:it.label,actual:it.v[0],target:it.v[1],comp:it.v.length>2?it.v[2]:null}));
  if(!rows.length) throw new Error("need actual,target");
  if(S.sort) rows=[...rows].sort((a,b)=>b.actual-a.actual);
  const labelW=Math.min(200, 14+d3.max(rows,d=>measure(d.label,13)));
  const maxV=d3.max(rows,d=>Math.max(d.actual,d.target,d.comp||0))*1.12;
  const x=d3.scaleLinear().domain([0,maxV]).range([labelW, iw-50]);
  const y=d3.scaleBand().domain(rows.map(d=>d.label)).range([6,ih-6]).padding(0.45);
  rows.forEach(d=>{
    const cy=y(d.label), bh=y.bandwidth(), good=d.actual>=d.target;
    g.append("rect").attr("x",x(0)).attr("y",cy).attr("width",x(maxV)-x(0)).attr("height",bh).attr("fill","#F1EDE2");
    g.append("rect").attr("x",x(0)).attr("y",cy).attr("width",Math.max(0,x(d.target)-x(0))).attr("height",bh).attr("fill","#E6E0D1");
    g.append("rect").attr("x",x(0)).attr("y",cy+bh*0.28).attr("width",Math.max(0,x(d.actual)-x(0))).attr("height",bh*0.44)
     .attr("rx",2).attr("fill", good?BRAND.maroon:BRAND.amber);
    g.append("line").attr("x1",x(d.target)).attr("x2",x(d.target)).attr("y1",cy+bh*0.12).attr("y2",cy+bh*0.88)
     .attr("stroke",BRAND.ink).attr("stroke-width",3);
    if(d.comp!=null)
      g.append("circle").attr("cx",x(d.comp)).attr("cy",cy+bh/2).attr("r",4.5).attr("fill","none").attr("stroke",BRAND.slate).attr("stroke-width",2);
    if(S.showLabels)
      g.append("text").attr("x",labelW-14).attr("y",cy+bh/2).attr("text-anchor","end").attr("dominant-baseline","middle")
       .attr("font-family",FONT).attr("font-size",13).attr("fill",BRAND.ink).text(d.label);
    if(S.showValues)
      g.append("text").attr("x",x(d.actual)+9).attr("y",cy+bh/2).attr("dominant-baseline","middle").attr("font-family",FONT)
       .attr("font-size",13).attr("font-weight",700).attr("fill",good?BRAND.maroon:BRAND.amber).text(vlabel(d.actual));
  });
}

function renderSlope(g,iw,ih,items,meta){
  const rows=items.filter(it=>it.v.length>=2).map(it=>({label:it.label,a:it.v[0],b:it.v[1]}));
  if(!rows.length) throw new Error("need before,after");
  const caps = meta.axes? [meta.axes[0]||"Before", meta.axes[1]||"After"] : ["Before","After"];
  const xL=iw*0.30, xR=iw*0.70;
  const all=rows.flatMap(d=>[d.a,d.b]), ext=d3.extent(all), pad=(ext[1]-ext[0])*0.14||1;
  const y=d3.scaleLinear().domain([ext[0]-pad, ext[1]+pad]).range([ih-22, 30]);
  [xL,xR].forEach(xx=>g.append("line").attr("x1",xx).attr("x2",xx).attr("y1",24).attr("y2",ih-16).attr("stroke",BRAND.slate).attr("opacity",.4));
  g.append("text").attr("x",xL).attr("y",16).attr("text-anchor","middle").attr("font-family",FONT).attr("font-size",13).attr("font-weight",700).attr("fill",BRAND.ink).text(caps[0]);
  g.append("text").attr("x",xR).attr("y",16).attr("text-anchor","middle").attr("font-family",FONT).attr("font-size",13).attr("font-weight",700).attr("fill",BRAND.ink).text(caps[1]);
  const tgt=metaNum(meta,"target");
  if(tgt!=null){ const ty=y(tgt); g.append("line").attr("x1",xL).attr("x2",xR).attr("y1",ty).attr("y2",ty).attr("stroke",BRAND.amber).attr("stroke-dasharray","5 4").attr("opacity",.75); }
  rows.forEach(d=>{
    const up=d.b>d.a, flat=d.b===d.a, col=flat?BRAND.amber:(up?BRAND.maroon:BRAND.slate);
    g.append("line").attr("x1",xL).attr("y1",y(d.a)).attr("x2",xR).attr("y2",y(d.b)).attr("stroke",col).attr("stroke-width",2.5);
    g.append("circle").attr("cx",xL).attr("cy",y(d.a)).attr("r",4).attr("fill",col);
    g.append("circle").attr("cx",xR).attr("cy",y(d.b)).attr("r",4).attr("fill",col);
    if(S.showLabels){
      g.append("text").attr("x",xL-12).attr("y",y(d.a)).attr("text-anchor","end").attr("dominant-baseline","middle")
       .attr("font-family",FONT).attr("font-size",12.5).attr("fill",BRAND.ink).text((S.showValues?vlabel(d.a)+"  ":"")+d.label);
      g.append("text").attr("x",xR+12).attr("y",y(d.b)).attr("text-anchor","start").attr("dominant-baseline","middle")
       .attr("font-family",FONT).attr("font-size",12.5).attr("font-weight",600).attr("fill",col).text(d.label+(S.showValues?"  "+vlabel(d.b):""));
    } else if(S.showValues){
      g.append("text").attr("x",xL-10).attr("y",y(d.a)).attr("text-anchor","end").attr("dominant-baseline","middle").attr("font-family",FONT).attr("font-size",12).attr("fill",BRAND.ink).text(vlabel(d.a));
      g.append("text").attr("x",xR+10).attr("y",y(d.b)).attr("text-anchor","start").attr("dominant-baseline","middle").attr("font-family",FONT).attr("font-size",12).attr("font-weight",600).attr("fill",col).text(vlabel(d.b));
    }
  });
}

function renderWaterfall(g,iw,ih,items){
  let run=0; const steps=[];
  items.forEach(it=>{
    if(it.label.trim().startsWith("=")){ steps.push({label:it.label.replace(/^=\s*/,""), y0:0, y1:run, total:true, val:run}); }
    else { const d=it.v.length?it.v[0]:0; steps.push({label:it.label, y0:run, y1:run+d, total:false, val:d}); run+=d; }
  });
  if(!steps.length) throw new Error("empty");
  const vals=steps.flatMap(s=>[s.y0,s.y1]), lo=Math.min(0,d3.min(vals)), hi=d3.max(vals);
  const labelH=46;
  const x=d3.scaleBand().domain(d3.range(steps.length)).range([0,iw]).padding(0.32);
  const y=d3.scaleLinear().domain([lo, hi*1.05]).range([ih-labelH, 14]);
  g.append("line").attr("x1",0).attr("x2",iw).attr("y1",y(0)).attr("y2",y(0)).attr("stroke",BRAND.slate).attr("opacity",.4);
  steps.forEach((s,i)=>{
    const bx=x(i), bw=x.bandwidth();
    const top=y(Math.max(s.y0,s.y1)), bot=y(Math.min(s.y0,s.y1));
    const col=s.total?TOTALC:(s.val>=0?GAIN:LOSS);
    g.append("rect").attr("x",bx).attr("y",top).attr("width",bw).attr("height",Math.max(1.5,bot-top)).attr("rx",2).attr("fill",col);
    if(i<steps.length-1)
      g.append("line").attr("x1",bx+bw).attr("x2",x(i+1)).attr("y1",y(s.y1)).attr("y2",y(s.y1))
       .attr("stroke",BRAND.ink).attr("stroke-dasharray","3 3").attr("opacity",.4);
    if(S.showValues){
      const lab=s.total?vlabel(s.val):(s.val>=0?"+":"")+vlabel(s.val);
      g.append("text").attr("x",bx+bw/2).attr("y",top-6).attr("text-anchor","middle").attr("font-family",FONT)
       .attr("font-size",12.5).attr("font-weight",700).attr("fill",col).text(lab);
    }
    if(S.showLabels)
      g.append("text").attr("x",bx+bw/2).attr("y",ih-labelH+18).attr("text-anchor","middle").attr("font-family",FONT)
       .attr("font-size",11.5).attr("fill",BRAND.ink).text(trim(s.label,bw/6));
  });
}

function renderControl(g,iw,ih,items,meta){
  const pts=items.filter(it=>it.v.length).map(it=>({label:it.label, v:it.v[0]}));
  if(pts.length<2) throw new Error("need series");
  const vals=pts.map(p=>p.v);
  const center=metaNum(meta,"center")!=null?metaNum(meta,"center"):d3.mean(vals);
  const sd=d3.deviation(vals)||1;
  const UCL=center+3*sd, LCL=center-3*sd, U2=center+2*sd, L2=center-2*sd;
  const target=metaNum(meta,"target");
  const labelH=40, leftPad=18;
  const x=d3.scalePoint().domain(pts.map(p=>p.label)).range([leftPad, iw-12]).padding(0.5);
  const lo=Math.min(LCL, d3.min(vals), target!=null?target:Infinity);
  const hi=Math.max(UCL, d3.max(vals), target!=null?target:-Infinity);
  const padv=(hi-lo)*0.1||1;
  const y=d3.scaleLinear().domain([lo-padv, hi+padv]).range([ih-labelH, 12]);
  g.append("rect").attr("x",leftPad).attr("y",y(UCL)).attr("width",iw-12-leftPad).attr("height",Math.max(0,y(LCL)-y(UCL))).attr("fill","#F4F0E6");
  const lim=(val,txt,dash,col,wt)=>{
    g.append("line").attr("x1",leftPad).attr("x2",iw-12).attr("y1",y(val)).attr("y2",y(val)).attr("stroke",col).attr("stroke-dasharray",dash).attr("stroke-width",wt||1.5).attr("opacity",.85);
    if(txt) g.append("text").attr("x",iw-10).attr("y",y(val)-4).attr("text-anchor","end").attr("font-family",FONT).attr("font-size",11).attr("fill",col).text(txt);
  };
  lim(U2,"","2 4","#C7BFAE",1); lim(L2,"","2 4","#C7BFAE",1);
  lim(UCL,"UCL "+num(UCL),"6 4",BRAND.slate); lim(LCL,"LCL "+num(LCL),"6 4",BRAND.slate);
  if(target!=null) lim(target,"target","5 3",BRAND.amber);
  g.append("line").attr("x1",leftPad).attr("x2",iw-12).attr("y1",y(center)).attr("y2",y(center)).attr("stroke",BRAND.maroon).attr("stroke-width",2);
  g.append("text").attr("x",iw-10).attr("y",y(center)-4).attr("text-anchor","end").attr("font-family",FONT).attr("font-size",11).attr("fill",BRAND.maroon).text("CL "+num(center));
  g.append("path").datum(pts).attr("fill","none").attr("stroke",BRAND.ink).attr("stroke-width",2).attr("opacity",.5)
   .attr("d",d3.line().x(p=>x(p.label)).y(p=>y(p.v)));
  pts.forEach(p=>{
    const oob=p.v>UCL||p.v<LCL;
    g.append("circle").attr("cx",x(p.label)).attr("cy",y(p.v)).attr("r",oob?7:5).attr("fill",oob?ALERT:BRAND.maroon).attr("stroke","#fff").attr("stroke-width",1.5);
    if(S.showValues)
      g.append("text").attr("x",x(p.label)).attr("y",y(p.v)-12).attr("text-anchor","middle").attr("font-family",FONT).attr("font-size",11).attr("font-weight",700).attr("fill",oob?ALERT:BRAND.ink).text(num(p.v));
  });
  if(S.showLabels) pts.forEach(p=>g.append("text").attr("x",x(p.label)).attr("y",ih-labelH+18).attr("text-anchor","middle").attr("font-family",FONT).attr("font-size",11.5).attr("fill",BRAND.ink).text(p.label));
}

// ---- render dispatch ----
function render(){
  const cfg=CHARTS[S.type]; const {W,H}=dims();
  document.getElementById("dims").textContent=`${W} × ${H} px`;
  document.getElementById("heatmapOpts").style.display = S.type==="heatmap" ? "" : "none";
  persist();
  try{
    if(cfg.kind==="matrix"){
      const m=parseMatrix(S.raw);
      if(!m||!m.rowLabels.length) return showEmpty("Add a matrix of values to draw the heatmap.");
      const {g,iw,ih}=base(); cfg.render(g,iw,ih,m); return;
    }
    const {meta,items}=parseRows(S.raw);
    const usable = cfg.kind==="list" ? items.filter(it=>it.v.length) : items;
    if(!usable.length) return showEmpty("Add data on the left to draw the chart.");
    const {g,iw,ih}=base();
    if(cfg.kind==="list"){
      const list=usable.map(it=>({label:it.label, value:it.v[0], group:it.group}));
      cfg.render(g,iw,ih,list);
    } else {
      cfg.render(g,iw,ih,items,meta);
    }
  }catch(e){
    const msg=String((e&&e.message)||"");
    const why={
      "need actual,target":"Each row needs a label, an actual and a target — e.g. “Overall yield, 84, 88”.",
      "need before,after":"Each row needs a label, a before and an after value — e.g. “Extraction, 89, 92”.",
      "need series":"Add at least two data points for the control chart.",
      "empty":"Add at least one step to the waterfall.",
      "no numeric values in matrix":"This matrix has no numbers to plot — check the cells are numeric.",
      "matrix":"Add a matrix of values to draw the heatmap."
    }[msg] || "Could not read the data for this chart.";
    showEmpty(why+" "+(HINTS[cfg.shape]||""));
  }
}
function showEmpty(msg){
  document.getElementById("stage").innerHTML=`<div class="empty">${msg}</div>`;
  document.getElementById("dims").textContent="";
}

// ---- export ----
// Inline Inter as a base64 @font-face so exported SVG/PNG render in the real figure
// font (a rasterised SVG can't see page webfonts). Cached + prefetched at startup.
const _fontCache={};
function abToB64(buf){const b=new Uint8Array(buf);let s="";const C=0x8000;for(let i=0;i<b.length;i+=C)s+=String.fromCharCode.apply(null,b.subarray(i,i+C));return btoa(s);}
async function interFontCSS(){
  if("inter" in _fontCache)return _fontCache.inter;
  let out="";
  try{
    const css=await (await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap")).text();
    let faces=[...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)].filter(m=>m[1]==="latin");
    if(!faces.length)faces=[...css.matchAll(/(@font-face)\s*{([^}]*)}/g)];
    for(const m of faces){
      const body=m[2];
      const w=(/font-weight:\s*([0-9]+)/.exec(body)||[])[1]||"400";
      const sty=(/font-style:\s*(\w+)/.exec(body)||[])[1]||"normal";
      const u=/url\(([^)]+\.woff2)\)/.exec(body); if(!u)continue;
      const fu=u[1].replace(/^['"]|['"]$/g,"");
      const buf=await (await fetch(fu)).arrayBuffer();
      out+=`@font-face{font-family:'Inter';font-style:${sty};font-weight:${w};src:url(data:font/woff2;base64,${abToB64(buf)}) format('woff2');}`;
    }
  }catch(e){out="";}
  _fontCache.inter=out; return out;
}
function svgString(extraStyle){
  const node=document.querySelector("#stage svg"); if(!node)return null;
  const c=node.cloneNode(true);
  c.setAttribute("xmlns","http://www.w3.org/2000/svg");
  if(extraStyle){ const st=document.createElementNS("http://www.w3.org/2000/svg","style"); st.textContent=extraStyle; c.insertBefore(st,c.firstChild); }
  return new XMLSerializer().serializeToString(c);
}
function dl(blob,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1500); }
async function downloadSVG(){ const s=svgString(await interFontCSS()); if(!s)return; dl(new Blob([s],{type:"image/svg+xml"}), slug(S.title)+".svg"); }
async function toPng(cb,scale){
  const fs=await interFontCSS();
  try{ if(document.fonts&&document.fonts.ready) await document.fonts.ready; }catch(e){}
  const s=svgString(fs); if(!s){cb(null);return;} const {W,H}=dims();
  const img=new Image();
  const url=URL.createObjectURL(new Blob([s],{type:"image/svg+xml;charset=utf-8"}));
  img.onload=()=>{
    const cv=document.createElement("canvas"); cv.width=W*scale; cv.height=H*scale;
    const ctx=cv.getContext("2d");
    if(S.bg!=="transparent"){ ctx.fillStyle=PAPER[S.bg]; ctx.fillRect(0,0,cv.width,cv.height); }
    ctx.drawImage(img,0,0,cv.width,cv.height); URL.revokeObjectURL(url); cv.toBlob(cb,"image/png");
  };
  img.onerror=()=>{URL.revokeObjectURL(url);cb(null);};
  img.src=url;
}
function downloadPNG(){ const btn=document.getElementById("dlPng"),o=btn.textContent; btn.textContent="…";
  toPng(b=>{ btn.textContent=o; if(b) dl(b, slug(S.title)+".png"); else alert("PNG export failed — use Download SVG instead."); },2); }
function copyPNG(){
  if(!navigator.clipboard||!window.ClipboardItem){ alert("Clipboard images are not supported in this browser. Use Download PNG."); return; }
  toPng(async b=>{ if(!b)return; try{ await navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
    flash("copyPng","Copied"); }catch(e){ alert("Copy blocked by the browser. Use Download PNG."); } },2);
}
function flash(id,txt){ const el=document.getElementById(id); const o=el.textContent; el.textContent=txt;
  setTimeout(()=>el.textContent=o,1100); }

// ---- table data editor ----
let _rt=null; function renderSoon(){ clearTimeout(_rt); _rt=setTimeout(render,120); }   // debounce heavy redraws
function attr(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
function mvAt(id){ const e=document.getElementById(id); return e?e.value.trim():""; }

// Build the spreadsheet-style editor for the active chart type (the textarea stays as a raw/paste fallback).
function buildDataUI(){
  const cfg=CHARTS[S.type], shape=cfg.shape, kind=cfg.kind;
  const host=document.getElementById("dataTable");
  const metaHost=document.getElementById("tableMeta");
  document.getElementById("addColBtn").style.display = kind==="matrix" ? "" : "none";
  metaHost.innerHTML=""; host.innerHTML="";

  if(kind==="matrix"){ buildMatrixTable(host, parseMatrix(S.raw)); return; }

  const {meta,items}=parseRows(S.raw);
  if(shape==="duo"){
    const ax=meta.axes||[];
    metaHost.innerHTML=`<div class="tmeta">
      <label><span class="k">Left column name</span><input id="axisFrom" type="text" value="${attr(ax[0]||"")}" placeholder="Before"></label>
      <label><span class="k">Right column name</span><input id="axisTo" type="text" value="${attr(ax[1]||"")}" placeholder="After"></label></div>`;
  } else if(shape==="control"){
    const c=(meta.center||[])[0]||"", t=(meta.target||[])[0]||"";
    metaHost.innerHTML=`<div class="tmeta">
      <label><span class="k">Centre line</span><input id="metaCenter" type="text" value="${attr(c)}" placeholder="auto (mean)"></label>
      <label><span class="k">Target / spec</span><input id="metaTarget" type="text" value="${attr(t)}" placeholder="optional"></label></div>`;
  }
  if(shape==="waterfall"){ buildWaterfallTable(host, items); return; }

  let headers, rowCells;
  if(shape==="bullet"){ headers=["Label","Actual","Target","Last wk"]; rowCells=it=>[it.label,it.v[0],it.v[1],it.v[2]]; }
  else if(shape==="duo"){ headers=["Label","Left","Right"]; rowCells=it=>[it.label,it.v[0],it.v[1]]; }
  else if(shape==="control"){ headers=["Label","Value"]; rowCells=it=>[it.label,it.v[0]]; }
  else { headers=["Label","Value","Group"]; rowCells=it=>[it.label,it.v[0],it.group]; }   // list
  const rows = items.length?items:[{label:"",v:[],group:null}];
  host.innerHTML = rowsTableHTML(headers, rows.map(rowCells));
}
function rowsTableHTML(headers, rowsVals){
  let h="<table class='dt' data-cols='"+headers.length+"'><tr>";
  headers.forEach(x=>h+="<th>"+attr(x)+"</th>"); h+="<th class='ch'></th></tr>";
  rowsVals.forEach(vals=>{
    h+="<tr class='drow'>";
    for(let i=0;i<headers.length;i++) h+="<td><input class='cell' type='text' value=\""+attr(vals[i]==null?"":vals[i])+"\"></td>";
    h+="<td class='ch'><button class='rm' title='Remove row'>×</button></td></tr>";
  });
  return h+"</table>";
}
function buildWaterfallTable(host, items){
  const rows = items.length?items:[{label:"",v:[]}];
  let h="<table class='dt' data-shape='waterfall'><tr><th>Step label</th><th>Value (±)</th><th class='ch' title='Running-total bar'>Σ</th><th class='ch'></th></tr>";
  rows.forEach(it=>{
    const lab=String(it.label||""), tot=lab.trim().startsWith("=");
    const disp=tot?lab.replace(/^\s*=\s*/,""):lab, valv=(it.v&&it.v.length)?it.v[0]:"";
    h+="<tr class='drow'>"+
       "<td><input class='cell lab' type='text' value=\""+attr(disp)+"\"></td>"+
       "<td><input class='cell val' type='text' value=\""+attr(valv)+"\""+(tot?" disabled placeholder='—'":"")+"></td>"+
       "<td class='ch'><input class='tot' type='checkbox'"+(tot?" checked":"")+" title='Running-total bar'></td>"+
       "<td class='ch'><button class='rm' title='Remove row'>×</button></td></tr>";
  });
  return void(host.innerHTML=h+"</table>");
}
function buildMatrixTable(host, m){
  let cols, rowLabels, values;
  if(m && m.colLabels.length){ cols=m.colLabels; rowLabels=m.rowLabels.length?m.rowLabels:[""]; values=m.values; }
  else { cols=["Col 1","Col 2"]; rowLabels=["Row 1"]; values=[["",""]]; }
  let h="<table class='dt' data-shape='matrix'><tr><th>Row \\ column</th>";
  cols.forEach(c=>h+="<th><input class='cell colh' type='text' value=\""+attr(c)+"\"></th>");
  h+="<th class='ch'></th></tr>";
  rowLabels.forEach((rl,ri)=>{
    h+="<tr class='drow'><td><input class='cell rowh' type='text' value=\""+attr(rl)+"\" placeholder='Name (unit)'></td>";
    cols.forEach((c,ci)=>{ const v=(values[ri]&&values[ri][ci]!=null)?values[ri][ci]:""; h+="<td><input class='cell mv' type='text' value=\""+attr(v)+"\"></td>"; });
    h+="<td class='ch'><button class='rm' title='Remove row'>×</button></td></tr>";
  });
  host.innerHTML=h+"</table>";
}
// Read the table back into S.raw (the format the renderers already consume).
function commitFromDOM(){
  const cfg=CHARTS[S.type], shape=cfg.shape, kind=cfg.kind;
  const lines=[];
  if(kind==="matrix"){
    const tbl=document.querySelector("#dataTable table"); if(!tbl)return;
    const colhs=[...tbl.querySelectorAll("input.colh")].map(i=>i.value.trim());
    lines.push([""].concat(colhs).join(", "));
    [...tbl.querySelectorAll("tr.drow")].forEach(tr=>{
      const rl=tr.querySelector("input.rowh").value.trim();
      const vals=[...tr.querySelectorAll("input.mv")].map(i=>i.value.trim());
      if(rl==="" && vals.every(v=>v==="")) return;
      lines.push([rl].concat(vals).join(", "));
    });
  } else {
    if(shape==="duo"){ const a=mvAt("axisFrom"),b=mvAt("axisTo"); if(a||b) lines.push("#axes, "+(a||"Before")+", "+(b||"After")); }
    if(shape==="control"){ const c=mvAt("metaCenter"),t=mvAt("metaTarget"); if(c!=="") lines.push("#center, "+c); if(t!=="") lines.push("#target, "+t); }
    [...document.querySelectorAll("#dataTable tr.drow")].forEach(tr=>{
      if(shape==="waterfall"){
        const lab=tr.querySelector("input.lab").value.trim();
        const tot=tr.querySelector("input.tot").checked;
        const val=tr.querySelector("input.val").value.trim();
        if(!lab && !val) return;
        lines.push(tot ? ("= "+lab) : (lab+", "+(val||"0")));
      } else {
        let cells=[...tr.querySelectorAll("input.cell")].map(i=>i.value.trim());
        while(cells.length>1 && cells[cells.length-1]==="") cells.pop();
        if(cells.every(c=>c==="")) return;
        lines.push(cells.join(", "));
      }
    });
  }
  S.raw=lines.join("\n");
  document.getElementById("data").value=S.raw;
  S.isSample=false;
  renderSoon();
}
function addDataRow(){
  const cfg=CHARTS[S.type], shape=cfg.shape, kind=cfg.kind;
  const tbl=document.querySelector("#dataTable table"); if(!tbl){ buildDataUI(); return; }
  const tr=document.createElement("tr"); tr.className="drow";
  if(kind==="matrix"){
    const ncol=tbl.querySelectorAll("input.colh").length;
    let html="<td><input class='cell rowh' type='text' value='' placeholder='Name (unit)'></td>";
    for(let i=0;i<ncol;i++) html+="<td><input class='cell mv' type='text' value=''></td>";
    tr.innerHTML=html+"<td class='ch'><button class='rm'>×</button></td>";
  } else if(shape==="waterfall"){
    tr.innerHTML="<td><input class='cell lab' type='text' value=''></td><td><input class='cell val' type='text' value=''></td><td class='ch'><input class='tot' type='checkbox'></td><td class='ch'><button class='rm'>×</button></td>";
  } else {
    const ncol=+tbl.getAttribute("data-cols")||3;
    let html=""; for(let i=0;i<ncol;i++) html+="<td><input class='cell' type='text' value=''></td>";
    tr.innerHTML=html+"<td class='ch'><button class='rm'>×</button></td>";
  }
  tbl.appendChild(tr); const f=tr.querySelector("input"); if(f)f.focus();
}
function addDataCol(){
  const tbl=document.querySelector("#dataTable table"); if(!tbl)return;
  const headRow=tbl.querySelector("tr"), chTh=headRow.querySelector("th.ch");
  const th=document.createElement("th"); th.innerHTML="<input class='cell colh' type='text' value=''>"; headRow.insertBefore(th,chTh);
  [...tbl.querySelectorAll("tr.drow")].forEach(tr=>{ const chTd=tr.querySelector("td.ch"); const td=document.createElement("td"); td.innerHTML="<input class='cell mv' type='text' value=''>"; tr.insertBefore(td,chTd); });
  commitFromDOM();
}

// ---- UI wiring ----
function buildTypes(){
  const wrap=document.getElementById("types"); wrap.innerHTML="";
  Object.entries(CHARTS).forEach(([k,c])=>{
    const b=document.createElement("button");
    b.className="type"+(k===S.type?" on":""); b.dataset.k=k;
    b.innerHTML=GLYPH[k]+`<small>${c.name}</small>`;
    b.onclick=()=>{ S.type=k; if(S.isSample) applySample(k); buildTypes(); syncHint(); buildDataUI(); render(); };
    wrap.appendChild(b);
  });
}
function applySample(k){
  const s=SAMPLE[k];
  S.raw=s.raw; S.title=s.title; S.subtitle=s.subtitle; S.source=s.source; S.unit=s.unit; S.isSample=true;
  document.getElementById("data").value=s.raw;
  document.getElementById("title").value=s.title;
  document.getElementById("subtitle").value=s.subtitle;
  document.getElementById("source").value=s.source;
  document.getElementById("unit").value=s.unit.trim();
  buildDataUI();
}
function syncHint(){ document.getElementById("dataHint").textContent=HINTS[CHARTS[S.type].shape]; }

function bind(){
  const $=id=>document.getElementById(id);
  // raw textarea is a fallback / paste target; editing it rebuilds the table above
  $("data").addEventListener("input",e=>{ S.raw=e.target.value; S.isSample=false; buildDataUI(); renderSoon(); });
  // table editor (event delegation so it survives rebuilds)
  const dt=$("dataTable");
  dt.addEventListener("input", commitFromDOM);
  dt.addEventListener("change", e=>{ if(e.target.classList.contains("tot")){ const v=e.target.closest("tr").querySelector("input.val"); if(v) v.disabled=e.target.checked; } commitFromDOM(); });
  dt.addEventListener("click", e=>{ const b=e.target.closest(".rm"); if(b){ b.closest("tr").remove(); commitFromDOM(); } });
  $("tableMeta").addEventListener("input", commitFromDOM);
  $("addRowBtn").onclick=addDataRow;
  $("addColBtn").onclick=addDataCol;
  // editing any title field also means this is no longer the untouched sample (stops chart-type switches clobbering your text)
  ["title","subtitle","source"].forEach(id=>$(id).addEventListener("input",e=>{ S[id]=e.target.value; S.isSample=false; render(); }));
  $("unit").addEventListener("input",e=>{ S.unit=e.target.value?(" "+e.target.value.trim().replace(/^ /,"")):""; if(e.target.value==="%")S.unit="%"; render(); });
  $("colorMode").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    S.colorMode=b.dataset.v; $("colorMode").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); render(); });
  $("bubbleScale").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    S.bubbleScale=b.dataset.v; $("bubbleScale").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); render(); });
  $("showValues").onchange=e=>{ S.showValues=e.target.checked; render(); };
  $("showLabels").onchange=e=>{ S.showLabels=e.target.checked; render(); };
  $("sort").onchange=e=>{ S.sort=e.target.checked; render(); };
  $("aspect").onchange=e=>{ S.aspect=e.target.value; render(); };
  $("bg").onchange=e=>{ S.bg=e.target.value; render(); };
  $("loadSample").onclick=()=>{ applySample(S.type); render(); };
  $("dlSvg").onclick=downloadSVG; $("dlPng").onclick=downloadPNG; $("copyPng").onclick=copyPNG;
}

// ---- persistence (localStorage autosave) ----
const LSKEY="showbench.state";
function persist(){ try{ localStorage.setItem(LSKEY, JSON.stringify(S)); }catch(e){} }
function restore(){ try{ const raw=localStorage.getItem(LSKEY); if(!raw)return false;
  const o=JSON.parse(raw); if(!o||typeof o!=="object"||!CHARTS[o.type])return false;
  Object.assign(S,o); return true; }catch(e){ return false; } }
function syncUI(){
  const $=id=>document.getElementById(id);
  $("title").value=S.title||""; $("subtitle").value=S.subtitle||""; $("source").value=S.source||"";
  $("unit").value=(S.unit||"").trim(); $("data").value=S.raw||"";
  $("showValues").checked=S.showValues; $("showLabels").checked=S.showLabels; $("sort").checked=S.sort;
  $("aspect").value=S.aspect; $("bg").value=S.bg;
  $("colorMode").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.v===S.colorMode));
  $("bubbleScale").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.v===S.bubbleScale));
}

// init
if(!restore()) applySample("packed");
buildTypes(); syncHint(); bind(); syncUI(); buildDataUI(); render();
interFontCSS();   // warm the embedded-font cache so the first export/copy is instant

})();