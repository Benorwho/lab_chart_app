(function(){

/*{{CORE}}*/

/* ================= STATE ================= */
const PALETTE = ['#451E28','#C09826','#A3AEBF','#5a8a4f','#b3503f','#3A3230','#8a6d3b','#6e8fa3','#9a7c1f','#7a8b3a','#b4541e','#5a6b8c'];
const SWATCHES = ['#451E28','#3A3230','#6e6359','#b3503f','#C09826','#9a7c1f','#FFE283','#A3AEBF','#6e8fa3','#5a8a4f','#7a8b3a','#E4EDF0','#EDEADC','#FAFBF5','#2f6fed','#e8543f','#27a567','#8b5cf6','#15b8c4','#000000'];

let S = defaultState();
function defaultState(){
  return {
    type:'bar',
    series:[
      {name:'Control', color:PALETTE[0], axis:'left', marker:'circle', mSize:6, line:true, showErr:true,
        pts:[{x:'Day 1',y:12.4,e:1.1},{x:'Day 2',y:14.1,e:0.9},{x:'Day 3',y:13.7,e:1.3}]},
      {name:'Treated', color:PALETTE[1], axis:'left', marker:'square', mSize:6, line:true, showErr:true,
        pts:[{x:'Day 1',y:18.9,e:1.5},{x:'Day 2',y:21.3,e:1.2},{x:'Day 3',y:20.1,e:1.8}]}
    ],
    st:{
      title:'', xlab:'Condition', yLlab:'Response (a.u.)', yRlab:'Secondary axis',
      font:"'Inter', Helvetica, Arial, sans-serif", fontSize:14, titleSize:18,
      w:720, h:480, bg:'#ffffff',
      yLauto:true, yLmin:0, yLmax:25, yRauto:true, yRmin:0, yRmax:100,
      gridY:true, gridX:false, gridColor:'#e6e8ec',
      axisColor:'#333740', axisWidth:1.2,
      legend:true, legendPos:'top-right',
      barGap:0.22, groupGap:0.18, barRadius:2, barOpacity:1, barStroke:false,
      barMode:'grouped',          // grouped | stacked | diverging
      errCap:6, errWidth:1.3, errColor:'#333740', errMatch:false,
      lineWidth:2, showMarkers:true, denseMode:false, markerEvery:1,
      xRotate:0, ticks:6,
      decimals:'auto',
      showValues:false, valuePos:'above', valueDec:'auto', valueSize:0.85, valueErr:false, valueColor:'#333740',
      useRight:false,
      analysis:{on:false, eLo:0, eHi:5, yieldMethod:'offset', offset:0.2, perSeries:[]}
    }
  };
}

/* ================= UTIL ================= */
const $=s=>document.querySelector(s);
const el=(t,a={},...kids)=>{const n=document.createElement(t);for(const k in a){if(k==='class')n.className=a[k];else if(k.startsWith('on'))n.addEventListener(k.slice(2),a[k]);else if(k==='html')n.innerHTML=a[k];else n.setAttribute(k,a[k]);}kids.flat().forEach(c=>n.append(c.nodeType?c:document.createTextNode(c)));return n;};
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
// num, linregress, trapzArea live in src/core/stats.js (inlined at the CORE marker)

/* ============ MECHANICAL PROPERTIES (stress-strain) ============
   Input: array of {x:strain, y:stress}. Strain assumed in % (as in the W175 plot),
   stress in MPa. Modulus reported in same stress units per strain-fraction (MPa).
   The user sets the elastic strain window [eLo,eHi] in the same units as the x data. */
// strainUnitToFraction: if strain is in %, divide by 100 to get true strain fraction for modulus/toughness in consistent units
function analyzeSeries(s, st){
  const pts=s.pts.map(p=>({x:num(p.x),y:num(p.y)})).filter(p=>p.x!==null&&p.y!==null).sort((a,b)=>a.x-b.x);
  if(pts.length<3)return null;
  const a=st.analysis;
  // ---- Young's modulus: slope over [eLo,eHi] in user x-units ----
  const win=pts.filter(p=>p.x>=a.eLo && p.x<=a.eHi);
  let E=null,Eb=0,r2=null,Eunit='per x-unit';
  const reg = win.length>=2 ? linregress(win.map(p=>[p.x,p.y])) : null;
  if(reg){E=reg.m;Eb=reg.b;r2=reg.r2;}
  // If strain looks like % (max x > 5), also give modulus per unit strain (×100)
  const strainIsPct = pts[pts.length-1].x > 5;
  const E_perStrain = E===null?null:(strainIsPct? E*100 : E); // stress per (strain fraction)
  // ---- UTS (max stress) ----
  let uts=pts[0],iUts=0; pts.forEach((p,i)=>{if(p.y>uts.y){uts=p;iUts=i;}});
  // ---- strain at break: last recorded point (curve end) ----
  const brk=pts[pts.length-1];
  // ---- yield ----
  let yield_=null;
  if(E!==null){
    if(a.yieldMethod==='offset'){
      // offset line: y = E*(x - offsetX), offsetX in same x-units as strain
      // Proper offset line: parallel to elastic region, shifted by `offset` along the strain axis.
      // Elastic line is σ = E·ε + Eb, so the offset line is σ = E·(ε − offset) + Eb.
      const ox=a.offset;
      let prev=null;
      for(let i=0;i<pts.length;i++){
        const lineY=E*(pts[i].x-ox)+Eb;     // offset line through (ε0+offset) with elastic slope
        const diff=pts[i].y-lineY;           // >0 above the line, <0 below
        // yield = first point where the curve falls to/below the offset line (after the offset strain)
        if(prev!==null && prev>0 && diff<=0 && pts[i].x>ox){
          yield_={x:pts[i].x,y:pts[i].y}; break;
        }
        prev=diff;
      }
    } else { // deviation: first point where data departs linear fit by > tol fraction
      const tol=a.offset/100; // reuse offset field as % deviation
      for(let i=0;i<pts.length;i++){
        const fit=E*pts[i].x+Eb;
        if(fit!==0 && Math.abs(pts[i].y-fit)/Math.abs(fit) > tol && pts[i].x>a.eLo){yield_={x:pts[i].x,y:pts[i].y};break;}
      }
    }
  }
  // ---- toughness: area under full curve (stress·strain) ----
  let tough=trapzArea(pts);
  let toughDisp=tough, toughUnit='MPa·(x-unit)';
  if(strainIsPct){toughDisp=tough/100;toughUnit='MJ/m³ (MPa)';} // strain%→fraction
  return {
    E, E_perStrain, r2, Eb, win:win.length, strainIsPct,
    uts, brk, yield_, tough:toughDisp, toughUnit,
    eLo:a.eLo, eHi:a.eHi
  };
}

function niceNumber(x,round){
  if(x<=0)return 1;
  const exp=Math.floor(Math.log10(x)), f=x/Math.pow(10,exp);let nf;
  if(round) nf=f<1.5?1:f<3?2:f<7?5:10; else nf=f<=1?1:f<=2?2:f<=5?5:10;
  return nf*Math.pow(10,exp);
}
function niceScale(min,max,count){
  if(!isFinite(min)||!isFinite(max)){min=0;max=1;}
  if(min===max){min-=0.5;max+=0.5;}
  const range=niceNumber(max-min,false);
  const step=niceNumber(range/Math.max(1,count-1),true);
  const nmin=Math.floor(min/step)*step, nmax=Math.ceil(max/step)*step;
  const ticks=[];for(let v=nmin;v<=nmax+step*0.5;v+=step)ticks.push(+v.toPrecision(12));
  return {min:nmin,max:nmax,ticks,step};
}
function fmt(v,dec){
  if(dec==='auto'){
    if(v===0)return '0';
    const a=Math.abs(v);
    if(a>=10000||a<0.001)return v.toExponential(1).replace('e','e');
    return (+v.toPrecision(4)).toString();
  }
  return v.toFixed(+dec);
}
// real text width via canvas measureText (accurate for the actual figure font), with a safe fallback
let _measCtx=null;
function textW(s,size,weight){
  try{
    if(!_measCtx)_measCtx=document.createElement('canvas').getContext('2d');
    _measCtx.font=(weight?weight+' ':'')+size+'px '+((S&&S.st&&S.st.font)||'Inter, sans-serif');
    const w=_measCtx.measureText(String(s)).width;
    if(isFinite(w)&&w>0)return w;
  }catch(e){}
  return String(s).length*size*0.56;
}
// luminance + contrast-aware ink so titles/legend stay legible on dark backgrounds
function lum(hex){
  const c=String(hex||'').replace('#','');
  if(!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c))return 1;            // non-hex (e.g. 'none') → treat as light
  const n=c.length===3?c.split('').map(x=>x+x).join(''):c;
  const r=parseInt(n.slice(0,2),16),g=parseInt(n.slice(2,4),16),b=parseInt(n.slice(4,6),16);
  return (0.299*r+0.587*g+0.114*b)/255;
}
function inkFor(bg){ return lum(bg)>0.6?'#1a1d22':'#f3efe8'; }

/* ================= RENDER CHART ================= */
function renderChart(){
  const st=S.st, type=S.type;
  const W=st.w, H=st.h;
  const svgNS='http://www.w3.org/2000/svg';

  // axis usage
  const leftSeries=S.series.filter(s=>s.axis==='left');
  const rightSeries=S.series.filter(s=>s.axis==='right');
  const hasRight=st.useRight && rightSeries.length>0;

  // domains
  function domainFor(list,axis){
    let lo=Infinity,hi=-Infinity;
    const bmode=st.barMode;
    if(type==='bar' && bmode==='stacked'){
      // sum per category across this axis's series
      const cats=new Set(); list.forEach(s=>s.pts.forEach(p=>cats.add(String(p.x))));
      cats.forEach(c=>{let pos=0,neg=0;list.forEach(s=>{const p=s.pts.find(q=>String(q.x)===c);const y=p?num(p.y):null;if(y===null)return;if(y>=0)pos+=y;else neg+=y;});hi=Math.max(hi,pos);lo=Math.min(lo,neg);});
      lo=Math.min(lo,0);hi=Math.max(hi,0);
    } else if(type==='bar' && bmode==='diverging'){
      // first series up (+), the rest stack downward (−); size domain to the stacked extents
      const cats=new Set(); list.forEach(s=>s.pts.forEach(p=>cats.add(String(p.x))));
      cats.forEach(c=>{let pos=0,neg=0;list.forEach((s,si)=>{const p=s.pts.find(q=>String(q.x)===c);const y=p?num(p.y):null;if(y===null)return;const m=Math.abs(y);if(si===0)pos=Math.max(pos,m);else neg+=m;});hi=Math.max(hi,pos);lo=Math.min(lo,-neg);});
      lo=Math.min(lo,0);hi=Math.max(hi,0);
    } else {
      list.forEach(s=>s.pts.forEach(p=>{
        const y=num(p.y); if(y===null)return; const e=s.showErr?(num(p.e)||0):0;
        lo=Math.min(lo,y-e,(type==='bar'?0:y-e)); hi=Math.max(hi,y+e);
      }));
      if(type==='bar') lo=Math.min(lo,0);
    }
    if(!isFinite(lo)){lo=0;hi=1;}
    if(axis==='left'&&!st.yLauto)return {min:st.yLmin,max:st.yLmax,...ticksFor(st.yLmin,st.yLmax,st.ticks)};
    if(axis==='right'&&!st.yRauto)return {min:st.yRmin,max:st.yRmax,...ticksFor(st.yRmin,st.yRmax,st.ticks)};
    return niceScale(lo,hi,st.ticks);
  }
  function ticksFor(min,max,count){const ticks=[];const step=(max-min)/(count-1);for(let i=0;i<count;i++)ticks.push(+ (min+step*i).toPrecision(12));return {ticks,step};}

  const Ld=domainFor(leftSeries,'left');
  const Rd=hasRight?domainFor(rightSeries,'right'):null;

  // x handling
  let categories=[], xIsNum=(type!=='bar');
  if(type==='bar'){
    const seen=new Map();
    S.series.forEach(s=>s.pts.forEach(p=>{const k=String(p.x);if(!seen.has(k))seen.set(k,1);}));
    categories=[...seen.keys()];
  } else {
    // also allow categorical x for line if non-numeric
    const allNum=S.series.every(s=>s.pts.every(p=>num(p.x)!==null||p.x===''||p.x==null));
    xIsNum=allNum && S.series.some(s=>s.pts.length);
    if(!xIsNum){const seen=new Map();S.series.forEach(s=>s.pts.forEach(p=>{const k=String(p.x);if(!seen.has(k))seen.set(k,1);}));categories=[...seen.keys()];}
  }

  let Xd=null;
  if(xIsNum){
    let lo=Infinity,hi=-Infinity;
    S.series.forEach(s=>s.pts.forEach(p=>{const x=num(p.x);if(x!==null){lo=Math.min(lo,x);hi=Math.max(hi,x);}}));
    if(!isFinite(lo)){lo=0;hi=1;}
    Xd=niceScale(lo,hi,Math.min(8,st.ticks+1));
  }

  // margins
  const maxYLabL=Math.max(...Ld.ticks.map(t=>textW(fmt(t,st.decimals),st.fontSize)),10);
  const mTop=(st.title?st.titleSize+22:18)+10;
  const mBot=48+(st.xlab?22:0)+(st.xRotate?28:0);
  const mLeft=18+maxYLabL+(st.yLlab?22:0);
  let mRight=18;
  if(hasRight){const maxYLabR=Math.max(...Rd.ticks.map(t=>textW(fmt(t,st.decimals),st.fontSize)),10);mRight=18+maxYLabR+(st.yRlab?22:0);}
  const pl=mLeft, pr=W-mRight, pt=mTop, pb=H-mBot;
  const plotW=pr-pl, plotH=pb-pt;

  const yL=v=>pb-(v-Ld.min)/(Ld.max-Ld.min)*plotH;
  const yR=v=>hasRight?pb-(v-Rd.min)/(Rd.max-Rd.min)*plotH:0;
  const yFor=s=>s.axis==='right'&&hasRight?yR:yL;

  let xPos, bandW;
  if(xIsNum){ xPos=v=>pl+(v-Xd.min)/(Xd.max-Xd.min)*plotW; }
  else { bandW=plotW/categories.length; xPos=(cat)=>{const i=categories.indexOf(String(cat));return pl+bandW*(i+0.5);}; }

  // ---- build svg string with presentation attributes (export-safe) ----
  let g='';
  const ff=esc(st.font), fs=st.fontSize, ac=esc(st.axisColor);

  // background
  g+=`<rect x="0" y="0" width="${W}" height="${H}" fill="${esc(st.bg)}"/>`;

  // gridlines Y (left)
  if(st.gridY){
    Ld.ticks.forEach(t=>{const y=yL(t);g+=`<line x1="${pl}" y1="${y.toFixed(2)}" x2="${pr}" y2="${y.toFixed(2)}" stroke="${esc(st.gridColor)}" stroke-width="1"/>`;});
  }
  if(st.gridX){
    if(xIsNum){Xd.ticks.forEach(t=>{const x=xPos(t);g+=`<line x1="${x.toFixed(2)}" y1="${pt}" x2="${x.toFixed(2)}" y2="${pb}" stroke="${esc(st.gridColor)}" stroke-width="1"/>`;});}
    else{categories.forEach(c=>{const x=xPos(c);g+=`<line x1="${x.toFixed(2)}" y1="${pt}" x2="${x.toFixed(2)}" y2="${pb}" stroke="${esc(st.gridColor)}" stroke-width="1"/>`;});}
  }

  // ---- data ----
  if(type==='bar'){
    const barSeries=S.series;
    const n=barSeries.length||1;
    const bmode=st.barMode;
    // ---- value labels ("call-outs"): number printed at each bar / segment ----
    const vfs=Math.max(8,Math.round(st.fontSize*st.valueSize));
    const valueText=(yv,ev)=>{
      let s=fmt(yv,st.valueDec);
      if(st.valueErr&&ev!=null&&isFinite(ev)&&ev!==0)s+=' ± '+fmt(ev,st.valueDec);
      return s;
    };
    // above the bar end (clear of the error whisker), or below it for negative bars
    const valueOutside=(cx,yv,ev,yf)=>{
      if(!st.showValues||st.valuePos!=='above')return;
      const e=ev!=null&&isFinite(ev)?Math.abs(ev):0;
      if(yv>=0)g+=txt(cx,yf(yv+e)-5,valueText(yv,ev),ff,vfs,esc(st.valueColor),'middle');
      else g+=txt(cx,yf(yv-e)+vfs+4,valueText(yv,ev),ff,vfs,esc(st.valueColor),'middle');
    };
    // centered in the bar / segment, only when it fits
    const valueInside=(cx,yTop,hgt,yv,ev)=>{
      if(!st.showValues||st.valuePos!=='inside'||hgt<vfs*1.5)return;
      g+=txt(cx,yTop+hgt/2+vfs*0.36,valueText(yv,ev),ff,vfs,'#ffffff','middle');
    };
    if(bmode==='stacked'){
      // one bar per category; series stack. Positive stack up, negative down.
      const bw=bandW*(1-st.groupGap);
      categories.forEach((c,ci)=>{
        const cx=pl+bandW*(ci+0.5), x0=cx-bw/2;
        let accPos=0, accNeg=0;
        barSeries.forEach(s=>{
          const yf=yFor(s);
          const p=s.pts.find(q=>String(q.x)===c); const yv=p?num(p.y):null; if(yv===null)return;
          let from,to;
          if(yv>=0){from=accPos;to=accPos+yv;accPos=to;} else {from=accNeg;to=accNeg+yv;accNeg=to;}
          const yTop=Math.min(yf(from),yf(to)), hgt=Math.abs(yf(from)-yf(to));
          g+=`<rect x="${x0.toFixed(2)}" y="${yTop.toFixed(2)}" width="${bw.toFixed(2)}" height="${hgt.toFixed(2)}" fill="${esc(s.color)}" fill-opacity="${st.barOpacity}" rx="${st.barRadius}"${st.barStroke?` stroke="${esc(s.color)}" stroke-width="1"`:''}/>`;
          valueInside(cx,yTop,hgt,yv,null);
        });
        // 'above' on a stack labels the totals
        if(st.showValues&&st.valuePos==='above'){
          const yf0=yFor(barSeries[0]||{axis:'left'});
          if(accPos>0)g+=txt(cx,yf0(accPos)-5,valueText(accPos,null),ff,vfs,esc(st.valueColor),'middle');
          if(accNeg<0)g+=txt(cx,yf0(accNeg)+vfs+4,valueText(accNeg,null),ff,vfs,esc(st.valueColor),'middle');
        }
      });
    } else if(bmode==='diverging'){
      // first series plots upward; the rest stack downward from the zero line
      const bw=bandW*(1-st.groupGap);
      categories.forEach((c,ci)=>{
        const cx=pl+bandW*(ci+0.5), x0=cx-bw/2;
        let accNeg=0;
        barSeries.forEach((s,si)=>{
          const yf=yFor(s);
          const p=s.pts.find(q=>String(q.x)===c); const yv=p?num(p.y):null; if(yv===null)return;
          const mag=Math.abs(yv);
          let from,to;
          if(si===0){ from=0; to=mag; }                    // first series: upward from zero
          else { from=accNeg; to=accNeg-mag; accNeg=to; }   // remaining series: stack downward
          const yTop=Math.min(yf(from),yf(to)), hgt=Math.abs(yf(from)-yf(to));
          g+=`<rect x="${x0.toFixed(2)}" y="${yTop.toFixed(2)}" width="${bw.toFixed(2)}" height="${hgt.toFixed(2)}" fill="${esc(s.color)}" fill-opacity="${st.barOpacity}" rx="${st.barRadius}"${st.barStroke?` stroke="${esc(s.color)}" stroke-width="1"`:''}/>`;
          if(s.showErr){const e=p?num(p.e):null;if(e!==null&&e!==0){g+=errBar(cx,yf(to+e),yf(to-e),st.errCap,st.errWidth,st.errMatch?s.color:st.errColor);}}
          if(st.showValues&&st.valuePos==='above'){
            const ev=s.showErr&&p?num(p.e):null, e2=ev!=null&&isFinite(ev)?Math.abs(ev):0;
            if(si===0)g+=txt(cx,yf(to+e2)-5,valueText(yv,ev),ff,vfs,esc(st.valueColor),'middle');
            else g+=txt(cx,yf(to-e2)+vfs+4,valueText(yv,ev),ff,vfs,esc(st.valueColor),'middle');
          }
          valueInside(cx,yTop,hgt,yv,null);
        });
      });
      // emphasise the zero baseline
      g+=`<line x1="${pl}" y1="${yL(0).toFixed(2)}" x2="${pr}" y2="${yL(0).toFixed(2)}" stroke="${ac}" stroke-width="${(st.axisWidth*1.4).toFixed(2)}"/>`;
    } else {
      // grouped (default)
      const groupInner=bandW*(1-st.groupGap);
      const slot=groupInner/n;
      const bw=slot*(1-st.barGap);
      barSeries.forEach((s,si)=>{
        const yf=yFor(s);
        s.pts.forEach(p=>{
          const ci=categories.indexOf(String(p.x)); if(ci<0)return;
          const yv=num(p.y); if(yv===null)return;
          const cx=pl+bandW*(ci+0.5);
          const x0=cx-groupInner/2+slot*si+(slot-bw)/2;
          const base=yf(0), top=yf(yv);
          const yTop=Math.min(base,top), hgt=Math.abs(base-top);
          g+=`<rect x="${x0.toFixed(2)}" y="${yTop.toFixed(2)}" width="${bw.toFixed(2)}" height="${hgt.toFixed(2)}" fill="${esc(s.color)}" fill-opacity="${st.barOpacity}" rx="${st.barRadius}"${st.barStroke?` stroke="${esc(s.color)}" stroke-width="1"`:''}/>`;
          if(s.showErr){const e=num(p.e);if(e!==null&&e!==0){const cxb=x0+bw/2;g+=errBar(cxb,yf(yv+e),yf(yv-e),st.errCap,st.errWidth,st.errMatch?s.color:st.errColor);}}
          const cxb=x0+bw/2;
          valueOutside(cxb,yv,s.showErr?num(p.e):null,yf);
          valueInside(cxb,yTop,hgt,yv,s.showErr?num(p.e):null);
        });
      });
    }
  } else {
    // line + scatter
    S.series.forEach(s=>{
      const yf=yFor(s);
      const pts=s.pts.map(p=>{const xv=xIsNum?num(p.x):p.x; const yv=num(p.y); if(yv===null||(xIsNum&&xv===null))return null; return {px:xPos(xv),py:yf(yv),e:num(p.e),x:xv,y:yv};}).filter(Boolean);
      if(type==='line'&&s.line!==false&&pts.length>1){
        const d=pts.map((p,i)=>(i?'L':'M')+p.px.toFixed(2)+' '+p.py.toFixed(2)).join(' ');
        g+=`<path d="${d}" fill="none" stroke="${esc(s.color)}" stroke-width="${st.lineWidth}" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      // error bars
      if(s.showErr){pts.forEach(p=>{if(p.e!==null&&p.e!==0)g+=errBar(p.px,yf(p.y+p.e),yf(p.y-p.e),st.errCap,st.errWidth,st.errMatch?s.color:st.errColor);});}
      // markers (scatter always shows; line shows when enabled; thinned in dense mode)
      const everyN=st.denseMode?Math.max(1,st.markerEvery|0):1;
      if(type==='scatter' || st.showMarkers){
        pts.forEach((p,i)=>{ if(st.denseMode && type!=='scatter' && (i%everyN!==0)) return; g+=marker(s.marker,p.px,p.py,s.mSize,s.color);});
      }
      // analysis overlays (Young's modulus line, yield/UTS markers)
      if(st.analysis&&st.analysis.on&&type!=='bar'){g+=analysisOverlay(s,pts,xPos,yf);}
    });
  }

  // ---- axes ----
  g+=`<line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pb}" stroke="${ac}" stroke-width="${st.axisWidth}"/>`;
  g+=`<line x1="${pl}" y1="${pb}" x2="${pr}" y2="${pb}" stroke="${ac}" stroke-width="${st.axisWidth}"/>`;
  if(hasRight) g+=`<line x1="${pr}" y1="${pt}" x2="${pr}" y2="${pb}" stroke="${ac}" stroke-width="${st.axisWidth}"/>`;

  // left ticks
  Ld.ticks.forEach(t=>{const y=yL(t);g+=`<line x1="${pl-5}" y1="${y.toFixed(2)}" x2="${pl}" y2="${y.toFixed(2)}" stroke="${ac}" stroke-width="${st.axisWidth}"/>`;
    g+=txt(pl-9,y+fs*0.34,fmt(t,st.decimals),ff,fs,ac,'end');});
  // right ticks
  if(hasRight)Rd.ticks.forEach(t=>{const y=yR(t);g+=`<line x1="${pr}" y1="${y.toFixed(2)}" x2="${pr+5}" y2="${y.toFixed(2)}" stroke="${ac}" stroke-width="${st.axisWidth}"/>`;
    g+=txt(pr+9,y+fs*0.34,fmt(t,st.decimals),ff,fs,ac,'start');});

  // x ticks/labels
  if(xIsNum){
    Xd.ticks.forEach(t=>{const x=xPos(t);g+=`<line x1="${x.toFixed(2)}" y1="${pb}" x2="${x.toFixed(2)}" y2="${pb+5}" stroke="${ac}" stroke-width="${st.axisWidth}"/>`;
      g+=txt(x,pb+fs+8,fmt(t,st.decimals),ff,fs,ac,'middle');});
  } else {
    categories.forEach(c=>{const x=xPos(c);
      g+=`<line x1="${x.toFixed(2)}" y1="${pb}" x2="${x.toFixed(2)}" y2="${pb+5}" stroke="${ac}" stroke-width="${st.axisWidth}"/>`;
      if(st.xRotate){g+=`<text x="${x.toFixed(2)}" y="${(pb+fs+6).toFixed(2)}" font-family="${ff}" font-size="${fs}" fill="${ac}" text-anchor="end" transform="rotate(${-st.xRotate} ${x.toFixed(2)} ${(pb+fs+6).toFixed(2)})">${esc(c)}</text>`;}
      else g+=txt(x,pb+fs+8,c,ff,fs,ac,'middle');});
  }

  // axis labels
  if(st.yLlab)g+=`<text x="${14}" y="${(pt+pb)/2}" font-family="${ff}" font-size="${fs+1}" fill="${ac}" text-anchor="middle" transform="rotate(-90 14 ${((pt+pb)/2).toFixed(2)})">${esc(st.yLlab)}</text>`;
  if(hasRight&&st.yRlab)g+=`<text x="${W-12}" y="${(pt+pb)/2}" font-family="${ff}" font-size="${fs+1}" fill="${ac}" text-anchor="middle" transform="rotate(90 ${W-12} ${((pt+pb)/2).toFixed(2)})">${esc(st.yRlab)}</text>`;
  if(st.xlab)g+=txt((pl+pr)/2,H-8,st.xlab,ff,fs+1,ac,'middle');
  if(st.title)g+=txt(W/2,st.titleSize+14,st.title,ff,st.titleSize,esc(inkFor(st.bg)),'middle','600');

  // legend
  if(st.legend&&S.series.length){
    g+=legendSVG(pl,pr,pt,pb,ff,fs);
  }

  const _capType=S.type.charAt(0).toUpperCase()+S.type.slice(1);
  const a11y=`<title>${esc(st.title||(_capType+' chart'))}</title>`+
    `<desc>${esc([st.xlab,st.yLlab].filter(Boolean).join(' vs ')||(_capType+' figure'))}</desc>`;
  const svg=`<svg id="theSvg" xmlns="${svgNS}" role="img" aria-label="${esc(st.title||(_capType+' chart'))}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${ff}">${a11y}${g}</svg>`;
  $('#paper').innerHTML=svg;

  // helpers (closures) ---------------------------------
  function analysisOverlay(s,pts,xPos,yf){
    if(!pts.length)return '';
    const res=analyzeSeries(s,st); if(!res)return '';
    let o='';
    const col=esc(s.color);
    // modulus fit line across [eLo,eHi]
    if(res.E!==null){
      const x1=res.eLo, x2=res.eHi;
      const y1=res.E*x1+res.Eb, y2=res.E*x2+res.Eb;
      o+=`<line x1="${xPos(x1).toFixed(2)}" y1="${yf(y1).toFixed(2)}" x2="${xPos(x2).toFixed(2)}" y2="${yf(y2).toFixed(2)}" stroke="${col}" stroke-width="2.2" stroke-dasharray="6 3"/>`;
    }
    // UTS marker (hollow ring + tick)
    if(res.uts){const px=xPos(res.uts.x),py=yf(res.uts.y);
      o+=`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="5" fill="none" stroke="${col}" stroke-width="2"/>`;
      o+=`<line x1="${px.toFixed(2)}" y1="${py.toFixed(2)}" x2="${px.toFixed(2)}" y2="${(py-14).toFixed(2)}" stroke="${col}" stroke-width="1"/>`;
    }
    // yield marker (filled square)
    if(res.yield_){const px=xPos(res.yield_.x),py=yf(res.yield_.y);
      o+=`<rect x="${(px-4).toFixed(2)}" y="${(py-4).toFixed(2)}" width="8" height="8" fill="${col}"/>`;
    }
    return o;
  }
  function errBar(cx,yTop,yBot,cap,w,col){
    cx=+cx.toFixed(2);yTop=+yTop.toFixed(2);yBot=+yBot.toFixed(2);col=esc(col);
    return `<line x1="${cx}" y1="${yTop}" x2="${cx}" y2="${yBot}" stroke="${col}" stroke-width="${w}"/>`+
      (cap>0?`<line x1="${cx-cap/2}" y1="${yTop}" x2="${cx+cap/2}" y2="${yTop}" stroke="${col}" stroke-width="${w}"/><line x1="${cx-cap/2}" y1="${yBot}" x2="${cx+cap/2}" y2="${yBot}" stroke="${col}" stroke-width="${w}"/>`:'');
  }
  function marker(shape,x,y,r,col){
    x=+x.toFixed(2);y=+y.toFixed(2);col=esc(col);
    if(shape==='square')return `<rect x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" fill="${col}"/>`;
    if(shape==='triangle')return `<path d="M${x} ${y-r} L${x+r} ${y+r} L${x-r} ${y+r} Z" fill="${col}"/>`;
    if(shape==='diamond')return `<path d="M${x} ${y-r} L${x+r} ${y} L${x} ${y+r} L${x-r} ${y} Z" fill="${col}"/>`;
    if(shape==='cross')return `<line x1="${x-r}" y1="${y}" x2="${x+r}" y2="${y}" stroke="${col}" stroke-width="2"/><line x1="${x}" y1="${y-r}" x2="${x}" y2="${y+r}" stroke="${col}" stroke-width="2"/>`;
    if(shape==='open')return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${col}" stroke-width="1.8"/>`;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`;
  }
  function txt(x,y,s,ff,fs,col,anchor,weight){return `<text x="${(+x).toFixed(2)}" y="${(+y).toFixed(2)}" font-family="${ff}" font-size="${fs}" fill="${col}" text-anchor="${anchor||'start'}"${weight?` font-weight="${weight}"`:''}>${esc(s)}</text>`;}
  function legendSVG(pl,pr,pt,pb,ff,fs){
    const items=S.series.map(s=>({name:s.name||'series',color:s.color,marker:s.marker}));
    const pad=10,row=fs+8,sw=14;
    const widths=items.map(it=>sw+6+textW(it.name,fs)+16);
    const pos=st.legendPos;
    let out='';
    if(pos.startsWith('top')||pos.startsWith('bottom')){
      const total=widths.reduce((a,b)=>a+b,0);
      let x = pos.endsWith('right')?pr-total+ (pr-pl-total>0?0:0): pos.endsWith('left')?pl: (pl+pr)/2-total/2;
      x=Math.max(pl,x);
      const y=pos.startsWith('top')?pt-8:pb+ (st.xlab?38:30)+ (st.xRotate?28:0);
      // background
      out+=`<rect x="${(x-6).toFixed(2)}" y="${(y-fs).toFixed(2)}" width="${(total+12).toFixed(2)}" height="${(row).toFixed(2)}" fill="${esc(st.bg)}" fill-opacity="0.0"/>`;
      items.forEach((it,i)=>{
        out+=legendMark(it,x,y-fs/2+2,sw,ff,fs);
        x+=widths[i];
      });
    } else {
      const x = pos.endsWith('left')?pl+12:pr-Math.max(...widths)-6;
      let y=pt+14;
      items.forEach(it=>{out+=`<rect x="${(x-6).toFixed(2)}" y="${(y-fs+2).toFixed(2)}" width="${(Math.max(...widths)).toFixed(2)}" height="${row}" fill="${esc(st.bg)}" fill-opacity="0.85"/>`;out+=legendMark(it,x,y,sw,ff,fs);y+=row;});
    }
    return out;
    function legendMark(it,x,y,sw,ff,fs){
      let m;
      if(S.type==='line') m=`<line x1="${x}" y1="${y-2}" x2="${x+sw}" y2="${y-2}" stroke="${esc(it.color)}" stroke-width="${st.lineWidth}"/>`+ (st.showMarkers?`<circle cx="${x+sw/2}" cy="${y-2}" r="3.5" fill="${esc(it.color)}"/>`:'');
      else if(S.type==='scatter') m=`<circle cx="${x+sw/2}" cy="${y-2}" r="4.5" fill="${esc(it.color)}"/>`;
      else m=`<rect x="${x}" y="${y-fs+1}" width="${sw}" height="${fs-1}" rx="2" fill="${esc(it.color)}" fill-opacity="${st.barOpacity}"/>`;
      return m+`<text x="${x+sw+6}" y="${y}" font-family="${ff}" font-size="${fs}" fill="${esc(inkFor(st.bg))}">${esc(it.name)}</text>`;
    }
  }
}

/* ================= EDITOR (left rail) ================= */
function renderEditor(){
  const list=$('#seriesList'); list.innerHTML='';
  S.series.forEach((s,si)=>{
    const card=el('div',{class:'scard'+(s._open?' open':'')});
    const head=el('div',{class:'shead'});
    const sw=el('div',{class:'swatch'}); const colIn=el('input',{type:'color',value:s.color,oninput:e=>{s.color=e.target.value;sw.style.background=e.target.value;renderChart();}}); sw.style.background=s.color; sw.append(colIn);
    const name=el('input',{class:'sname',type:'text',value:s.name,oninput:e=>{s.name=e.target.value;renderChart();}});
    const exp=el('button',{class:'expand',title:'Series options',html:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',onclick:()=>{s._open=!s._open;card.classList.toggle('open');}});
    const del=el('button',{class:'xbtn',title:'Delete series',html:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',onclick:()=>{S.series.splice(si,1);renderEditor();renderChart();}});
    const dup=el('button',{class:'xbtn',title:'Duplicate series (same X labels, new colour)',html:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',onclick:()=>{
      const copy=JSON.parse(JSON.stringify(s)); delete copy._open;
      copy.name=s.name+' copy'; copy.color=PALETTE[S.series.length%PALETTE.length]; copy._open=true;
      S.series.splice(si+1,0,copy); renderEditor(); renderChart();
    }});
    head.append(sw,name,exp,dup,del);
    card.append(head);

    const body=el('div',{class:'sbody'});
    // options row
    const opt=el('div',{});
    const axisRow=el('div',{class:'row'},el('label',{},'Y axis'),selectEl(['left','right'],['Left','Right'],s.axis,v=>{s.axis=v;renderChart();}));
    opt.append(axisRow);
    if(S.type!=='bar'){
      opt.append(el('div',{class:'row'},el('label',{},'Marker'),selectEl(['circle','square','triangle','diamond','open','cross'],['● Circle','■ Square','▲ Triangle','◆ Diamond','○ Open','✛ Cross'],s.marker,v=>{s.marker=v;renderChart();})));
      opt.append(el('div',{class:'row'},el('label',{},'Marker size'),numEl(s.mSize,v=>{s.mSize=v;renderChart();},1,20,0.5)));
    }
    const errTog=toggle('Error bars',s.showErr,v=>{s.showErr=v;renderChart();});
    opt.append(el('div',{class:'row'},errTog));
    body.append(opt);

    // data table
    const tbl=el('table',{class:'dt'});
    const thead=el('tr',{},el('th',{},S.type==='bar'?'X (label)':'X'),el('th',{},'Y'),el('th',{},'± err'),el('th',{}));
    tbl.append(thead);
    s.pts.forEach((p,pi)=>{
      const tr=el('tr',{},
        el('td',{},inp(p.x,v=>{p.x=v;renderChart();},'text')),
        el('td',{},inp(p.y,v=>{p.y=v;renderChart();},'text')),
        el('td',{},inp(p.e,v=>{p.e=v;renderChart();},'text')),
        el('td',{class:'rmrow',title:'Remove row',onclick:()=>{s.pts.splice(pi,1);renderEditor();renderChart();}},'×'));
      tbl.append(tr);
    });
    body.append(tbl);
    body.append(el('button',{class:'addrow',onclick:()=>{s.pts.push({x:'',y:'',e:''});renderEditor();renderChart();}},'＋ row'));
    // paste into series
    body.append(el('button',{class:'addrow',style:'margin-top:5px',onclick:()=>pasteIntoSeries(si)},'⊞ paste rows into this series'));
    card.append(body);
    list.append(card);
  });
}
function inp(v,cb,type){const i=el('input',{type:type||'text',value:v==null?'':v});i.addEventListener('input',e=>cb(e.target.value));return i;}
function numEl(v,cb,min,max,step){const i=el('input',{type:'number',value:v,min:min,max:max,step:step||1});i.addEventListener('input',e=>cb(e.target.value===''?0:+e.target.value));return i;}
function selectEl(vals,labels,cur,cb){const s=el('select',{});vals.forEach((v,i)=>{const o=el('option',{value:v},labels[i]);if(v===cur)o.selected=true;s.append(o);});s.addEventListener('change',e=>cb(e.target.value));return s;}
function toggle(label,on,cb){const t=el('div',{class:'tog'+(on?' on':'')},el('div',{class:'sw'}),el('span',{},label));t.addEventListener('click',()=>{on=!on;t.classList.toggle('on');cb(on);});return t;}

function pasteIntoSeries(si){
  const raw=prompt('Paste rows (X  Y  Err) — one point per line, separated by tab/comma/space:');
  if(!raw)return;
  const rows=parseGrid(raw);
  S.series[si].pts=rows.map(r=>({x:r[0]??'',y:r[1]??'',e:r[2]??''}));
  renderEditor();renderChart();
}

/* ================= STYLE PANEL (right rail) ================= */
function renderStyle(){
  const st=S.st;
  const rail=$('#styleRail'); rail.innerHTML='';
  rail.append(el('div',{class:'railtitle'},'Appearance'));

  // Titles & labels
  rail.append(section('Titles & labels',[
    field('Chart title', inp(st.title,v=>{st.title=v;renderChart();})),
    field('X axis label', inp(st.xlab,v=>{st.xlab=v;renderChart();})),
    field('Left Y label', inp(st.yLlab,v=>{st.yLlab=v;renderChart();})),
    field('Right Y label', inp(st.yRlab,v=>{st.yRlab=v;renderChart();})),
  ]));

  // Typography
  rail.append(section('Typography',[
    field('Font', selectEl(
      ["'Inter', Helvetica, Arial, sans-serif","Helvetica, Arial, sans-serif","Georgia, 'Times New Roman', serif","'Times New Roman', Times, serif","'IBM Plex Mono', monospace","Calibri, sans-serif"],
      ['Inter','Helvetica / Arial','Georgia (serif)','Times (serif)','Plex Mono','Calibri'],
      st.font,v=>{st.font=v;renderChart();})),
    mini2('Label size',numEl(st.fontSize,v=>{st.fontSize=+v;renderChart();},6,40),'Title size',numEl(st.titleSize,v=>{st.titleSize=+v;renderChart();},8,60)),
    field('Number format', selectEl(['auto','0','1','2','3'],['Auto','0 dp','1 dp','2 dp','3 dp'],st.decimals,v=>{st.decimals=v;renderChart();})),
  ],true));

  // Left axis
  rail.append(section('Left Y axis',[
    rowTog('Auto range',st.yLauto,v=>{st.yLauto=v;renderStyle();renderChart();}),
    ...(st.yLauto?[]:[mini2('Min',numEl(st.yLmin,v=>{st.yLmin=+v;renderChart();}),'Max',numEl(st.yLmax,v=>{st.yLmax=+v;renderChart();}))]),
    field('Tick count', numEl(st.ticks,v=>{st.ticks=Math.max(2,+v);renderChart();},2,15)),
  ],true));

  // Right axis
  const rightFields=[ rowTog('Enable right axis',st.useRight,v=>{st.useRight=v;renderStyle();renderChart();}) ];
  if(st.useRight){
    rightFields.push(el('div',{class:'note'},'Assign a series to the right axis in its options (left panel).'));
    rightFields.push(rowTog('Auto range',st.yRauto,v=>{st.yRauto=v;renderStyle();renderChart();}));
    if(!st.yRauto)rightFields.push(mini2('Min',numEl(st.yRmin,v=>{st.yRmin=+v;renderChart();}),'Max',numEl(st.yRmax,v=>{st.yRmax=+v;renderChart();})));
  }
  rail.append(section('Right Y axis',rightFields,true));

  // Error bars
  rail.append(section('Error bars',[
    mini2('Cap width',numEl(st.errCap,v=>{st.errCap=+v;renderChart();},0,30),'Line width',numEl(st.errWidth,v=>{st.errWidth=+v;renderChart();},0.5,6,0.1)),
    rowTog('Match series colour',st.errMatch,v=>{st.errMatch=v;renderStyle();renderChart();}),
    ...(st.errMatch?[]:[field('Error colour',colorRow(st.errColor,v=>{st.errColor=v;renderChart();}))]),
  ],true));

  // Bars / markers (contextual)
  if(S.type==='bar'){
    rail.append(section('Bars',[
      field('Bar mode', selectEl(['grouped','stacked','diverging'],['Grouped (side by side)','Stacked','Diverging (up / down)'],st.barMode,v=>{st.barMode=v;renderStyle();renderChart();})),
      ...(st.barMode==='diverging'?[el('div',{class:'note'},'First series plots upward; any further series stack downward from the zero line. Great for swelling vs. mass-loss, or gains vs. several loss terms.')]:[]),
      ...(st.barMode==='stacked'?[el('div',{class:'note'},'Series stack on top of each other per category. Negative values stack below zero.')]:[]),
      ...(st.barMode==='grouped'?[sliderRow('Bar gap',st.barGap,0,0.8,0.02,v=>{st.barGap=v;renderChart();})]:[]),
      sliderRow('Group gap',st.groupGap,0,0.7,0.02,v=>{st.groupGap=v;renderChart();}),
      sliderRow('Opacity',st.barOpacity,0.1,1,0.05,v=>{st.barOpacity=v;renderChart();}),
      field('Corner radius',numEl(st.barRadius,v=>{st.barRadius=+v;renderChart();},0,20)),
      rowTog('Outline bars',st.barStroke,v=>{st.barStroke=v;renderChart();}),
    ],true));
    // Value labels (call-outs) on bars
    rail.append(section('Value labels',[
      rowTog('Show values on bars',st.showValues,v=>{st.showValues=v;renderStyle();renderChart();}),
      ...(st.showValues?[
        field('Position',selectEl(['above','inside'],[st.barMode==='stacked'?'Above (stack totals)':'Above the bar','Inside the bar'],st.valuePos,v=>{st.valuePos=v;renderStyle();renderChart();})),
        field('Decimals',selectEl(['auto','0','1','2','3'],['Auto','0','1','2','3'],String(st.valueDec),v=>{st.valueDec=v;renderChart();})),
        ...(st.valuePos==='above'?[
          rowTog('Include ± error',st.valueErr,v=>{st.valueErr=v;renderChart();}),
          field('Label colour',colorRow(st.valueColor,v=>{st.valueColor=v;renderChart();})),
        ]:[el('div',{class:'note'},'Inside labels appear only on segments tall enough to fit them.')]),
        sliderRow('Size',st.valueSize,0.6,1.3,0.05,v=>{st.valueSize=v;renderChart();}),
      ]:[]),
    ],!st.showValues));
  } else {
    rail.append(section('Lines & markers',[
      field('Line width',numEl(st.lineWidth,v=>{st.lineWidth=+v;renderChart();},0.5,8,0.5)),
      ...(S.type==='line'?[rowTog('Show markers',st.showMarkers,v=>{st.showMarkers=v;renderChart();})]:[]),
      rowTog('Dense data mode',st.denseMode,v=>{st.denseMode=v;renderStyle();renderChart();}),
      ...(st.denseMode?[
        el('div',{class:'note'},'For experimental curves with thousands of points: keeps the line crisp and thins markers.'),
        field('Show every Nth marker',numEl(st.markerEvery,v=>{st.markerEvery=Math.max(1,+v|0);renderChart();},1,500,1)),
      ]:[]),
    ],true));
    // Mechanical properties analyzer (line/scatter only)
    rail.append(mechSection());
  }

  // Axes & grid
  rail.append(section('Axes & grid',[
    rowTog('Horizontal gridlines',st.gridY,v=>{st.gridY=v;renderChart();}),
    rowTog('Vertical gridlines',st.gridX,v=>{st.gridX=v;renderChart();}),
    field('Grid colour',colorRow(st.gridColor,v=>{st.gridColor=v;renderChart();})),
    field('Axis colour',colorRow(st.axisColor,v=>{st.axisColor=v;renderChart();})),
    field('Axis width',numEl(st.axisWidth,v=>{st.axisWidth=+v;renderChart();},0.5,4,0.1)),
    field('X label angle',selectEl(['0','30','45','60','90'],['0°','30°','45°','60°','90°'],String(st.xRotate),v=>{st.xRotate=+v;renderChart();})),
  ],true));

  // Legend
  rail.append(section('Legend',[
    rowTog('Show legend',st.legend,v=>{st.legend=v;renderChart();}),
    field('Position',selectEl(['top-left','top-right','bottom-left','bottom-right','inside-left','inside-right'],
      ['Top left','Top right','Bottom left','Bottom right','Inside left','Inside right'],st.legendPos,v=>{st.legendPos=v;renderChart();})),
  ],true));

  // Canvas
  rail.append(section('Canvas',[
    mini2('Width (px)',numEl(st.w,v=>{st.w=+v;renderChart();},200,3000),'Height (px)',numEl(st.h,v=>{st.h=+v;renderChart();},150,2400)),
    field('Background',colorRow(st.bg,v=>{st.bg=v;renderChart();})),
    el('div',{class:'note'},'Tip: PNG export is rasterised at 3× for crisp publication figures. SVG export is fully editable vector.'),
  ],true));

  // palette quick-apply
  rail.append(section('Series palette',[
    el('div',{class:'note'},'Click to recolour all series in order.'),
    paletteRow(),
  ],true));
}

function fmtSig(v,n){if(v===null||v===undefined||!isFinite(v))return '—';return (+v.toPrecision(n||4)).toString();}
function mechSection(){
  const st=S.st, a=st.analysis;
  const kids=[];
  kids.push(rowTog('Analyze stress–strain',a.on,v=>{a.on=v; if(v&&!a._autodone){autoElasticWindow();a._autodone=true;} renderStyle();renderChart();}));
  if(a.on){
    kids.push(el('div',{class:'note'},'Treats X as strain, Y as stress. Set the elastic (linear) window for the modulus fit, in the same units as your X data.'));
    kids.push(mini2('Elastic from',numEl(a.eLo,v=>{a.eLo=+v;renderStyle();renderChart();},0,100000,0.1),'Elastic to',numEl(a.eHi,v=>{a.eHi=+v;renderStyle();renderChart();},0,100000,0.1)));
    kids.push(field('Yield method',selectEl(['offset','deviation'],['Offset (parallel line)','Deviation from linear'],a.yieldMethod,v=>{a.yieldMethod=v;renderStyle();renderChart();})));
    kids.push(field(a.yieldMethod==='offset'?'Offset (x-units)':'Deviation (%)',numEl(a.offset,v=>{a.offset=+v;renderStyle();renderChart();},0,100,0.05)));
    kids.push(el('button',{class:'addrow',style:'margin-top:2px',onclick:()=>{autoElasticWindow();renderStyle();renderChart();}},'⌕ Auto-find best elastic window'));
    // results table
    const tbl=el('table',{class:'mech'});
    const head=el('tr',{},el('th',{},'Series'),el('th',{},'E'),el('th',{},'R²'),el('th',{},'σ_y'),el('th',{},'UTS'),el('th',{},'ε_brk'),el('th',{},'Tough.'));
    tbl.append(head);
    let anyPct=false, anyLowR2=false;
    S.series.forEach(s=>{
      const r=analyzeSeries(s,st);
      const tr=el('tr',{});
      const dot=el('span',{class:'mdot'});dot.style.background=s.color;
      tr.append(el('td',{},el('div',{style:'display:flex;align-items:center;gap:5px'},dot,el('span',{},s.name||'series'))));
      if(!r){tr.append(el('td',{},'—'),el('td',{},'—'),el('td',{},'—'),el('td',{},'—'),el('td',{},'—'),el('td',{},'—'));}
      else{
        anyPct=anyPct||r.strainIsPct;
        const lowR2=r.r2!==null&&r.r2<0.98; anyLowR2=anyLowR2||lowR2;
        const r2cell=el('td',{},r.r2===null?'—':fmtSig(r.r2,3));
        if(lowR2)r2cell.style.color='var(--bad)';
        tr.append(
          el('td',{},fmtSig(r.E_perStrain,4)),
          r2cell,
          el('td',{},r.yield_?fmtSig(r.yield_.y,3):'—'),
          el('td',{},fmtSig(r.uts.y,4)),
          el('td',{},fmtSig(r.brk.x,4)),
          el('td',{},fmtSig(r.tough,4)),
        );
      }
      tbl.append(tr);
    });
    kids.push(el('div',{class:'mechwrap'},tbl));
    if(anyLowR2)kids.push(el('div',{class:'note',style:'color:var(--bad)'},'⚠ A modulus fit has R² < 0.98 — your elastic window is probably too wide (it includes the non-linear region). Narrow "Elastic to", or use Auto-find above.'));
    kids.push(el('div',{class:'note'},'E & UTS in your stress units (e.g. MPa); E is per unit strain'+(anyPct?', strain auto-detected as % (×100).':'.')+' ε_brk = last strain. Toughness = area under curve. Chart overlays: dashed = E fit, ◻ = yield, ◯ = UTS. The modulus depends entirely on the elastic window — fit it to the initial straight part only (often the first 1–2% strain).'));
    kids.push(el('button',{class:'addrow',style:'margin-top:8px',onclick:()=>exportMechCSV()},'⤓ Export properties as CSV'));
  }
  return section('Mechanical properties',kids,true);
}
// Find the elastic window that maximises R² of the modulus fit on the first (steepest) part of the curve.
function autoElasticWindow(){
  const a=S.st.analysis;
  // use the first series with enough points as the reference
  const s=S.series.find(s=>s.pts.filter(p=>num(p.x)!==null&&num(p.y)!==null).length>=6);
  if(!s)return;
  const pts=s.pts.map(p=>({x:num(p.x),y:num(p.y)})).filter(p=>p.x!==null&&p.y!==null).sort((u,v)=>u.x-v.x);
  const xMax=pts[pts.length-1].x, lo=pts[0].x;
  let best=null;
  // sweep candidate upper bounds across the lowest 10% of strain, pick highest-slope window with R²>=0.995
  for(let frac=0.01; frac<=0.12; frac+=0.005){
    const hi=lo+(xMax-lo)*frac;
    const w=pts.filter(p=>p.x>=lo&&p.x<=hi);
    if(w.length<4)continue;
    const reg=linregress(w.map(p=>[p.x,p.y]));
    if(!reg)continue;
    // prefer steepest slope among windows that still fit well
    const score = reg.r2>=0.995 ? reg.m : reg.m*reg.r2;
    if(!best||score>best.score)best={hi,score,r2:reg.r2,m:reg.m};
  }
  if(best){a.eLo=+lo.toPrecision(4);a.eHi=+best.hi.toPrecision(4);}
}
function exportMechCSV(){
  const rows=[['Series','E (stress/strain)','R2_fit','Yield_strain','Yield_stress','UTS_stress','UTS_strain','Strain_at_break','Toughness','Toughness_unit']];
  S.series.forEach(s=>{const r=analyzeSeries(s,S.st);if(!r){rows.push([s.name||'series','','','','','','','','','']);return;}
    rows.push([s.name||'series',r.E_perStrain,r.r2,r.yield_?r.yield_.x:'',r.yield_?r.yield_.y:'',r.uts.y,r.uts.x,r.brk.x,r.tough,r.toughUnit]);});
  const csv=rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  download('plotbench-mechanical-properties.csv',new Blob([csv],{type:'text/csv'}));
}
let _secOpen={};   // remembers which style sections are expanded, keyed by title
function section(title,children,collapsed){
  // if we've seen this section before, honour the user's open/closed choice
  const startCollapsed = (title in _secOpen) ? !_secOpen[title] : collapsed;
  const s=el('div',{class:'sec'+(startCollapsed?' collapsed':'')});
  const h=el('h3',{},title,el('span',{class:'chev',html:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>'}));
  h.addEventListener('click',()=>{s.classList.toggle('collapsed');_secOpen[title]=!s.classList.contains('collapsed');});
  const b=el('div',{class:'body'},children);
  s.append(h,b);return s;
}
function field(label,control){const f=el('div',{class:'row'},el('label',{},label),el('div',{class:'grow'},control));return f;}
function mini2(l1,c1,l2,c2){return el('div',{class:'mini'},el('div',{},el('div',{class:'fieldlab'},l1),c1),el('div',{},el('div',{class:'fieldlab'},l2),c2));}
function rowTog(label,on,cb){const t=el('div',{class:'tog'+(on?' on':'')},el('div',{class:'sw'}),el('span',{},label));t.addEventListener('click',()=>{on=!on;t.classList.toggle('on');cb(on);});return el('div',{class:'row',style:'margin:9px 0'},t);}
function colorRow(val,cb){const w=el('div',{style:'display:flex;gap:8px;align-items:center'});const sw=el('div',{class:'swatch'});sw.style.background=val;const i=el('input',{type:'color',value:val});i.addEventListener('input',e=>{sw.style.background=e.target.value;cb(e.target.value);});sw.append(i);const tx=el('input',{type:'text',value:val});tx.addEventListener('input',e=>{sw.style.background=e.target.value;cb(e.target.value);});w.append(sw,tx);return w;}
function sliderRow(label,val,min,max,step,cb){
  const wrap=el('div',{class:'row'});const out=el('span',{style:'font-family:var(--mono);font-size:11px;color:var(--muted);width:34px;text-align:right'},(+val).toFixed(2));
  const r=el('input',{type:'range',min:min,max:max,step:step,value:val,style:'flex:1'});
  r.addEventListener('input',e=>{out.textContent=(+e.target.value).toFixed(2);cb(+e.target.value);});
  wrap.append(el('label',{},label),el('div',{class:'grow',style:'display:flex;gap:8px;align-items:center'},r,out));return wrap;
}
function paletteRow(){
  const wrap=el('div',{class:'palette'});
  SWATCHES.forEach(c=>{const p=el('div',{class:'p'});p.style.background=c;wrap.append(p);});
  // also a "apply default palette" button
  const apply=el('button',{class:'addrow',style:'margin-top:8px',onclick:()=>{S.series.forEach((s,i)=>s.color=PALETTE[i%PALETTE.length]);renderEditor();renderChart();}},'↻ apply default sequence');
  return el('div',{},wrap,apply);
}

/* ================= SMART IMPORT =================
   Parsing and layout detection (parseGrid, splitBlocks, analyzeTable, series
   builders) live in src/core/csv.js and are inlined at the CORE marker.
   This section is the modal UI: one card per detected block, each with a
   plain-language description, a preview of the series it will create, and a
   one-click load. */

// Wrap a bare {name, showErr, pts} from the core builders in Plotbench styling.
function mkSeries(bare,i){
  return {name:bare.name,color:PALETTE[i%PALETTE.length],axis:'left',marker:'circle',
    mSize:6,line:true,showErr:!!bare.showErr,pts:bare.pts};
}
function applyBarSeries(series,labels){
  S.series=series; S.type='bar'; S.st.barMode='grouped';
  if(labels.xlab)S.st.xlab=labels.xlab;
  if(labels.ylab)S.st.yLlab=labels.ylab;
  S.st.title=labels.title||''; S.st.analysis.on=false; S.st.yLauto=true;
  [...$('#typeTabs').children].forEach(x=>x.classList.toggle('on',x.dataset.t==='bar'));
  renderEditor();renderStyle();renderChart();closeModal('#smartModal');
}
// Colored chips previewing the series about to be created (palette order).
function seriesPreview(names){
  const w=el('div',{class:'sprev'});
  names.slice(0,8).forEach((n,i)=>{
    const d=el('span',{class:'sdot'}); d.style.background=PALETTE[i%PALETTE.length];
    w.append(el('span',{class:'schip'},d,n||'—'));
  });
  if(names.length>8)w.append(el('span',{class:'schip'},'+'+(names.length-8)+' more'));
  return w;
}
// Hand a block to the paste dialog with a mode pre-selected and columns pre-guessed.
function openPasteWith(rows,mode){
  $('#pasteArea').value=rows.map(r=>r.join('\t')).join('\n');
  closeModal('#smartModal'); openModal('#pasteModal');
  const btn=[...$('#pasteMode').children].find(b=>b.dataset.m===mode);
  if(btn&&!btn.classList.contains('on'))btn.click();
  $('#pasteArea').dispatchEvent(new Event('input',{bubbles:true}));
}
const SMART_KINDS={
  curves:   {badge:'raw curves'},
  summary:  {badge:'summary stats'},
  long:     {badge:'grouped data'},
  groupReps:{badge:'replicates'},
  wide:     {badge:'series columns'},
  table:    {badge:'table'}
};
let _smartBlocks=null;
function smartImport(raw){
  const blocks=splitBlocks(rawToRows(raw)).map(b=>analyzeTable(b));
  _smartBlocks=blocks;
  const host=$('#smartBlocks'); host.innerHTML='';
  $('#smartIntro').innerHTML=blocks.length===1
    ? 'Here is what was found in your file — one click to chart it.'
    : `Found <b>${blocks.length}</b> blocks in your file. Choose what to load.`;
  blocks.forEach(info=>{
    const card=el('div',{class:'scard open',style:'margin:10px 0'});
    const body=el('div',{class:'sbody',style:'display:block'});
    let title,desc,preview=null,pasteMode='long';
    const actions=[];

    if(info.kind==='curves'){
      const cols=(info.headerRow||info.data[0]).length-1;
      title=`Raw curves — ${cols} series × ${info.data.length} points`;
      desc='Plot as stress–strain (X = first column, each other column a curve).';
      actions.push(el('button',{class:'fullbtn',onclick:()=>loadCurves(info)},'→ Load as stress–strain curves'));

    } else if(info.kind==='summary'){
      title=`Summary table — ${info.propRows.length} properties × ${info.groups.names.length} group(s)`;
      desc='Bar-chart any property (UTS, modulus…) across groups, with error bars from the SD column.';
      const propSel=selectEl(info.propRows.map(o=>String(o.i)), info.propRows.map(o=>o.label),
        info.propRows.length?String(info.propRows[0].i):'0', ()=>{});
      body.append(el('div',{class:'row'},el('label',{},'Property'),el('div',{class:'grow'},propSel)));
      preview=seriesPreview(info.groups.names);
      actions.push(el('button',{class:'fullbtn',onclick:()=>loadSummaryProperty(info.rows,info.groups,+propSel.value)},'→ Bar chart this property across groups'));

    } else if(info.kind==='long'){
      const r=seriesFromLong(info.body,info.map,info.header);
      title=`Grouped data — ${r.series.length} group(s) × ${r.order.length} categories`;
      desc=`One colored series per ${r.groupName||'group'}, bars side by side per ${r.xlab||'category'}`
        +(info.map.ei!=null?', error bars from the '+(info.header?String(info.header[info.map.ei]||'error').trim():'error')+' column.':'. No error column detected.');
      preview=seriesPreview(r.series.map(s=>s.name));
      actions.push(el('button',{class:'fullbtn',onclick:()=>{
        applyBarSeries(r.series.map(mkSeries),{xlab:r.xlab,ylab:r.ylab});
      }},`→ Grouped bar chart (${r.series.length} series)`));

    } else if(info.kind==='groupReps'){
      const agg=aggregateGroupReps(info.body,info.map);
      const ylab=info.header?String(info.header[info.map.yi]||'').trim():'';
      title=`Replicates — ${agg.pts.length} group(s), mean ± SD`;
      desc='Each row is one replicate; groups are averaged: '
        +agg.pts.map(p=>`${p.x} (n=${p.n})`).join(', ')+'.';
      preview=seriesPreview(agg.pts.map(p=>p.x));
      actions.push(el('button',{class:'fullbtn',onclick:()=>{
        const pts=agg.pts.map(p=>({x:p.x,y:p.y,e:p.e}));
        applyBarSeries([mkSeries({name:ylab||'mean',showErr:true,pts},0)],
          {xlab:info.header?String(info.header[info.map.gi]||'').trim():'',ylab});
      }},'→ Bar chart mean ± SD per group'));

    } else if(info.kind==='wide'){
      const ser=seriesFromWide(info.body,info.cols,info.xi,info.header);
      const hasErr=info.cols.some(c=>c.e!=null);
      title=`Series columns — ${ser.length} series × ${info.body.length} rows`;
      desc='Each numeric column becomes one colored series; categories from the first column'
        +(hasErr?', error columns attached as error bars.':'.');
      preview=seriesPreview(ser.map(s=>s.name));
      pasteMode='values';
      actions.push(el('button',{class:'fullbtn',onclick:()=>{
        applyBarSeries(ser.map(mkSeries),{
          xlab:info.header?String(info.header[info.xi]||'').trim():'',
          ylab:ser.length===1?ser[0].name:''});
      }},`→ Grouped bar chart (${ser.length} series)`));

    } else {
      title=`Table — ${info.rows.length} rows`;
      desc='Could not confidently detect the layout — map the columns yourself.';
    }

    const head=el('div',{class:'shead'});
    head.append(el('div',{style:'flex:1'},
      el('div',{style:'display:flex;align-items:center;gap:8px'},
        el('span',{class:'kbadge'},SMART_KINDS[info.kind].badge),
        el('span',{style:'font-weight:600;color:var(--maroon)'},title)),
      el('div',{class:'note',style:'margin-top:3px'},desc)));
    card.append(head);
    if(preview)body.append(preview);
    actions.forEach(a=>body.append(a));
    body.append(el('button',{class:'addrow',style:'margin-top:6px',onclick:()=>openPasteWith(info.rows,pasteMode)},
      info.kind==='table'?'→ Open in paste dialog to map columns':'⚙ Not right? Adjust the column mapping'));
    card.append(body);
    host.append(card);
  });
}
function loadCurves(info){
  const header=info.headerRow||[];
  const data=info.data;
  const ncol=Math.max(...data.map(r=>r.length));
  const series=[];
  for(let c=1;c<ncol;c++){
    series.push({name:(header[c]&&String(header[c]).trim())||('Curve '+c),color:PALETTE[(c-1)%PALETTE.length],
      axis:'left',marker:'circle',mSize:3,line:true,showErr:false,
      pts:data.map(r=>({x:r[0]==null?'':String(r[0]).trim(),y:r[c]==null?'':String(r[c]).trim(),e:''}))});
  }
  S.series=series; S.type='line';
  S.st.denseMode=true; S.st.markerEvery=Math.max(1,Math.round(data.length/40)); S.st.showMarkers=false;
  S.st.xlab='Strain / %'; S.st.yLlab='Stress / MPa'; S.st.title='';
  S.st.analysis.on=true; S.st.analysis._autodone=false;
  [...$('#typeTabs').children].forEach(x=>x.classList.toggle('on',x.dataset.t==='line'));
  if(!S.st.analysis._autodone){autoElasticWindow();S.st.analysis._autodone=true;}
  renderEditor();renderStyle();renderChart();closeModal('#smartModal');
}
function loadSummaryProperty(block,groups,rowIdx){
  const row=block[rowIdx]; const label=(row[0]||'value').trim();
  const pts=groups.names.map((g,i)=>{
    const s=groups.starts[i], w=groups.widths[i];
    // Recognize a [mean, SD, n] block: last in-group column is a small integer count.
    const lastVal=num(row[s+w-1]);
    const looksTriple = w>=2 && lastVal!==null && Number.isInteger(lastVal) && lastVal>=1 && lastVal<=200 && num(row[s])!==null;
    if(looksTriple){
      return {x:g, y:String(row[s]).trim(), e:(w>=2&&num(row[s+1])!==null)?String(row[s+1]).trim():''};
    }
    // else: replicate columns → compute mean ± SD
    const vals=[]; for(let c=s;c<s+w;c++){const v=num(row[c]); if(v!==null)vals.push(v);}
    if(!vals.length)return {x:g,y:'',e:''};
    if(vals.length===1)return {x:g,y:vals[0],e:''};
    return {x:g, y:+mean(vals).toPrecision(6), e:+sd(vals).toPrecision(4)};
  });
  applyBarSeries([{name:label,color:PALETTE[0],axis:'left',marker:'circle',mSize:6,line:true,showErr:true,pts}],
    {xlab:'Group',ylab:label,title:label+' by group'});
}


/* ================= EXPORT ================= */
// Inline the webfont as a base64 @font-face so exported SVG/PNG render in the real
// figure font instead of a fallback (an SVG rasterised to canvas can't see page webfonts).
const _fontCache={};
function abToB64(buf){const b=new Uint8Array(buf);let s='';const C=0x8000;for(let i=0;i<b.length;i+=C)s+=String.fromCharCode.apply(null,b.subarray(i,i+C));return btoa(s);}
async function googleFontCSS(family,weights){
  const key=family+':'+weights.join(',');
  if(key in _fontCache)return _fontCache[key];
  let out='';
  try{
    const url='https://fonts.googleapis.com/css2?family='+family.replace(/ /g,'+')+':wght@'+weights.join(';')+'&display=swap';
    const css=await (await fetch(url)).text();
    let faces=[...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)].filter(m=>m[1]==='latin');
    if(!faces.length)faces=[...css.matchAll(/(@font-face)\s*{([^}]*)}/g)];
    for(const m of faces){
      const body=m[2];
      const w=(/font-weight:\s*([0-9]+)/.exec(body)||[])[1]||'400';
      const sty=(/font-style:\s*(\w+)/.exec(body)||[])[1]||'normal';
      const u=/url\(([^)]+\.woff2)\)/.exec(body); if(!u)continue;
      const fu=u[1].replace(/^['"]|['"]$/g,'');
      const buf=await (await fetch(fu)).arrayBuffer();
      out+=`@font-face{font-family:'${family}';font-style:${sty};font-weight:${w};src:url(data:font/woff2;base64,${abToB64(buf)}) format('woff2');}`;
    }
  }catch(e){out='';}
  _fontCache[key]=out; return out;
}
async function embeddedFontStyle(){
  const f=(S.st.font||'').toLowerCase();
  let css='';
  if(f.includes('inter')) css+=await googleFontCSS('Inter',['400','500','600','700']);
  if(f.includes('plex mono')) css+=await googleFontCSS('IBM Plex Mono',['400','500','600']);
  return css;                          // system fonts (Helvetica/Times/Calibri) need no embedding
}
function getSVGString(extraStyle){
  const svg=$('#theSvg').cloneNode(true);
  svg.removeAttribute('id');
  if(extraStyle){
    const st=document.createElementNS('http://www.w3.org/2000/svg','style');
    st.textContent=extraStyle;
    svg.insertBefore(st, svg.firstChild);
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(svg);
}
function download(name,blob){const a=el('a',{href:URL.createObjectURL(blob),download:name});document.body.append(a);a.click();a.remove();}
function withBusy(btn,fn){
  const o=btn?btn.textContent:''; if(btn){btn.disabled=true;btn.textContent='Exporting…';}
  return Promise.resolve().then(fn).finally(()=>{ if(btn){btn.disabled=false;btn.textContent=o;} });
}
async function exportSVG(){ const fs=await embeddedFontStyle(); download('plotbench-figure.svg',new Blob([getSVGString(fs)],{type:'image/svg+xml'})); }
async function exportPNG(){
  const scale=3; const fs=await embeddedFontStyle();
  try{ if(document.fonts&&document.fonts.ready) await document.fonts.ready; }catch(e){}
  const svgStr=getSVGString(fs);
  const img=new Image();
  const url=URL.createObjectURL(new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'}));
  await new Promise((res,rej)=>{
    img.onload=()=>{
      const c=el('canvas');c.width=S.st.w*scale;c.height=S.st.h*scale;
      const ctx=c.getContext('2d');ctx.scale(scale,scale);ctx.drawImage(img,0,0);
      URL.revokeObjectURL(url);
      c.toBlob(b=>{download('plotbench-figure.png',b);res();},'image/png');
    };
    img.onerror=()=>{URL.revokeObjectURL(url);alert('PNG export failed in this browser — use SVG export and convert, or open the tool in a full browser tab.');rej();};
    img.src=url;
  }).catch(()=>{});
}

/* ================= MODALS / WIRING ================= */
function openModal(id){$(id).classList.add('on');}
function closeModal(id){$(id).classList.remove('on');}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',e=>e.target.closest('.modal').classList.remove('on')));
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('on');}));

// type tabs
$('#typeTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  [...e.currentTarget.children].forEach(x=>x.classList.remove('on'));b.classList.add('on');
  S.type=b.dataset.t;renderEditor();renderStyle();renderChart();});

$('#addSeries').onclick=()=>{const i=S.series.length;S.series.push({name:'Series '+(i+1),color:PALETTE[i%PALETTE.length],axis:'left',marker:'circle',mSize:6,line:true,showErr:true,pts:[{x:'',y:'',e:''}],_open:true});renderEditor();renderChart();};
$('#svgBtn').onclick=()=>withBusy($('#svgBtn'),exportSVG);
$('#pngBtn').onclick=()=>withBusy($('#pngBtn'),exportPNG);
$('#cfgBtn').onclick=()=>openModal('#cfgModal');

// ---- paste modal ----
$('#pasteBtn').onclick=()=>openModal('#pasteModal');
$('#smartBtn').onclick=()=>$('#smartFile').click();
$('#smartFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{openModal('#smartModal');$('#smartIntro').textContent='Reading your file…';$('#smartBlocks').innerHTML='';smartImport(r.result);}catch(err){$('#smartIntro').textContent='Could not parse that file. Try the paste dialog instead.';console.error(err);}};
  r.readAsText(f); e.target.value='';};

let _lastLongCols=-1;
function pasteModeNoteText(m){
  if(m==='valerr')return 'Wide layout: first column = X, then each series is TWO columns — its value then its error.';
  if(m==='long')return 'Long / tidy layout: every row is one observation. Choose which column is the X axis, which splits the bars, the value, and the error. Blank X cells are filled down from above.';
  return 'Wide layout: first column = X, first row = series names, each other column is a series of values.';
}
$('#pasteMode').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  [...e.currentTarget.children].forEach(x=>x.classList.remove('on'));b.classList.add('on');
  const m=b.dataset.m;
  $('#pasteModeNote').textContent=pasteModeNoteText(m);
  $('#longOpts').style.display = m==='long'?'block':'none';
  if(m==='long'){ _lastLongCols=-1; guessAndSetHeaderRows(); populateLongCols(true); updateLongPreview(); }
});

function colCount(grid){return grid.reduce((m,r)=>Math.max(m,r.length),0);}
// guessHeaderRows lives in src/core/csv.js (inlined at the CORE marker)
function guessAndSetHeaderRows(){
  const grid=parseGrid($('#pasteArea').value);
  if(grid.length<2)return;
  $('#hdrRows').value=String(Math.min(3,guessHeaderRows(grid)));
}
function populateLongCols(resetDefaults){
  const grid=parseGrid($('#pasteArea').value);
  if(!grid.length)return;
  const hr=+$('#hdrRows').value, ncol=colCount(grid);
  const header = hr>0 ? grid[Math.min(hr-1,grid.length-1)] : null;
  function fill(sel,includeNone,def){
    const prev=sel.value; sel.innerHTML='';
    if(includeNone)sel.append(el('option',{value:''},'— none —'));
    for(let i=0;i<ncol;i++){const raw=header&&header[i]!=null?String(header[i]).trim():'';sel.append(el('option',{value:String(i)},raw||('Column '+(i+1))));}
    if(!resetDefaults && [...sel.options].some(o=>o.value===prev)) sel.value=prev; else sel.value=String(def);
  }
  // Prefer the layout detector's guess for the column defaults; fall back to positions.
  const guess=analyzeTable(grid);
  const m=guess.kind==='long'?guess.map:(guess.kind==='groupReps'?{xi:guess.map.gi,gi:guess.map.gi,yi:guess.map.yi,ei:null}:null);
  fill($('#colX'),false, m?m.xi:0);
  fill($('#colGroup'),false, m?m.gi:Math.min(1,ncol-1));
  fill($('#colY'),false, m?m.yi:Math.min(2,ncol-1));
  fill($('#colErr'),true, m?(m.ei!=null?m.ei:''):(ncol>=4?3:''));
}
function parseLong(){
  const grid=parseGrid($('#pasteArea').value);
  if(grid.length<2)return null;
  const hr=+$('#hdrRows').value;
  const header = hr>0 ? grid[Math.min(hr-1,grid.length-1)] : null;
  const body=grid.slice(hr);
  const xi=+$('#colX').value, gi=+$('#colGroup').value, yi=+$('#colY').value;
  const eiRaw=$('#colErr').value, ei = eiRaw===''?null:+eiRaw;
  const r=seriesFromLong(body,{xi,gi,yi,ei},header);
  if(!r)return null;
  const series=r.series.map((s,i)=>mkSeries({
    name:(r.groupName?r.groupName+' ':'')+(s.name==='—'?'':s.name), showErr:s.showErr, pts:s.pts
  },i));
  return {series, order:r.order, groupName:r.groupName, xlab:r.xlab, ylab:r.ylab};
}
function updateLongPreview(){
  const r=parseLong();
  if(!r){$('#longPreview').textContent='';return;}
  $('#longPreview').innerHTML=`Will create <b>${r.series.length}</b> bar series${r.groupName?' by <b>'+esc(r.groupName)+'</b>':''} across <b>${r.order.length}</b> X position(s): ${esc(r.order.join(', '))}`;
}
$('#hdrRows').addEventListener('change',()=>{populateLongCols(true);updateLongPreview();});
['#colX','#colGroup','#colY','#colErr'].forEach(id=>$(id).addEventListener('change',updateLongPreview));
$('#pasteArea').addEventListener('input',()=>{
  if($('#pasteMode').querySelector('.on').dataset.m!=='long')return;
  const grid=parseGrid($('#pasteArea').value);
  const nc=colCount(grid);
  const shapeChanged = nc!==_lastLongCols;
  _lastLongCols=nc;
  if(shapeChanged){ guessAndSetHeaderRows(); populateLongCols(true); }   // fresh paste: re-detect everything
  else populateLongCols(false);                                          // minor edit: keep user's column choices
  updateLongPreview();
});

$('#pasteApply').onclick=()=>{
  const mode=$('#pasteMode').querySelector('.on').dataset.m;
  if(mode==='long'){
    const r=parseLong();
    if(!r||!r.series.length){alert('Could not read the table. Check the Header rows count and the column mapping.');return;}
    S.series=r.series;
    if(r.xlab)S.st.xlab=r.xlab;
    if(r.ylab)S.st.yLlab=r.ylab;
    S.st.yLauto=true;
    renderEditor();renderStyle();renderChart();closeModal('#pasteModal');
    return;
  }
  const grid=parseGrid($('#pasteArea').value);
  if(grid.length<2){alert('Need at least a header row and one data row.');return;}
  const header=grid[0];const body=grid.slice(1);
  const newSeries=[];
  if(mode==='values'){
    for(let c=1;c<header.length;c++){
      newSeries.push({name:header[c]||('Series '+c),color:PALETTE[(c-1)%PALETTE.length],axis:'left',marker:'circle',mSize:6,line:true,showErr:false,
        pts:body.map(r=>({x:r[0]??'',y:r[c]??'',e:''}))});
    }
  } else {
    for(let c=1;c<header.length;c+=2){
      newSeries.push({name:header[c]||('Series '+((c+1)/2)),color:PALETTE[Math.floor((c-1)/2)%PALETTE.length],axis:'left',marker:'circle',mSize:6,line:true,showErr:true,
        pts:body.map(r=>({x:r[0]??'',y:r[c]??'',e:r[c+1]??''}))});
    }
  }
  if(newSeries.length){S.series=newSeries;renderEditor();renderStyle();renderChart();closeModal('#pasteModal');}
};

// replicates
function computeRepl(){
  const grid=parseGrid($('#replArea').value);
  const hasLabel=$('#replLabel').value==='label';
  const errType=$('#replType').value;
  const rows=grid.map(r=>{
    let label='',vals;
    if(hasLabel){label=r[0];vals=r.slice(1).map(num).filter(v=>v!==null);}
    else vals=r.map(num).filter(v=>v!==null);
    const n=vals.length;const mean=n?vals.reduce((a,b)=>a+b,0)/n:0;
    const variance=n>1?vals.reduce((a,b)=>a+(b-mean)**2,0)/(n-1):0;
    const sd=Math.sqrt(variance);
    let e=sd;if(errType==='sem')e=sd/Math.sqrt(n);if(errType==='ci95')e=1.96*sd/Math.sqrt(n);
    return {label:label||'',n,mean:+mean.toPrecision(6),e:+e.toPrecision(4)};
  }).filter(r=>r.n>0);
  return rows;
}
$('#replArea').addEventListener('input',updateReplPreview);
$('#replType').addEventListener('change',updateReplPreview);
$('#replLabel').addEventListener('change',updateReplPreview);
function updateReplPreview(){
  const rows=computeRepl();
  if(!rows.length){$('#replPreview').textContent='';return;}
  $('#replPreview').innerHTML='Preview: '+rows.map(r=>`${r.label||'·'} = <b>${r.mean}</b> ± ${r.e} (n=${r.n})`).join(' &nbsp;|&nbsp; ');
}
$('#replBtn').onclick=()=>{$('#replArea').value='';$('#replPreview').textContent='';openModal('#replModal');};
$('#replApply').onclick=()=>{
  const rows=computeRepl();
  if(!rows.length){alert('No numeric replicates found.');return;}
  const i=S.series.length;
  S.series.push({name:'Series '+(i+1),color:PALETTE[i%PALETTE.length],axis:'left',marker:'circle',mSize:6,line:true,showErr:true,
    pts:rows.map((r,idx)=>({x:r.label||('G'+(idx+1)),y:r.mean,e:r.e}))});
  renderEditor();renderStyle();renderChart();closeModal('#replModal');
};

// config save/load
$('#cfgSave').onclick=()=>{const clean=JSON.parse(JSON.stringify(S));clean.series.forEach(s=>delete s._open);download('plotbench-config.json',new Blob([JSON.stringify(clean,null,2)],{type:'application/json'}));};
$('#cfgLoad').onclick=()=>$('#cfgFile').click();
$('#cfgReset').onclick=()=>{ if(!confirm('Discard the current figure and reset to the sample data?'))return;
  clearSaved(); S=defaultState();
  [...$('#typeTabs').children].forEach(x=>x.classList.toggle('on',x.dataset.t===S.type));
  renderEditor();renderStyle();_renderChart();
  _hist=[snapshot()];_redo=[];updateHistButtons();persist();
  closeModal('#cfgModal'); };
$('#cfgFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const obj=JSON.parse(r.result);if(!obj.series||!obj.st)throw 0;S=obj;[...$('#typeTabs').children].forEach(x=>x.classList.toggle('on',x.dataset.t===S.type));renderEditor();renderStyle();renderChart();closeModal('#cfgModal');}catch(err){alert('Could not read that config file.');}};r.readAsText(f);};

/* ================= HISTORY (undo / redo) ================= */
const HIST_MAX=7;
let _hist=[], _redo=[], _restoring=false, _commitTimer=null;
function snapshot(){const c=JSON.parse(JSON.stringify(S));c.series.forEach(s=>delete s._open);return c;}
function sameAsTop(snap){return _hist.length && JSON.stringify(_hist[_hist.length-1])===JSON.stringify(snap);}
function updateHistButtons(){$('#undoBtn').disabled=_hist.length<=1;$('#redoBtn').disabled=_redo.length===0;}
// Called (debounced) after any change settles. Pushes the new state onto the stack.
function commit(){
  if(_restoring)return;
  clearTimeout(_commitTimer);
  _commitTimer=setTimeout(()=>{
    const snap=snapshot();
    if(sameAsTop(snap))return;       // nothing actually changed
    _hist.push(snap);
    if(_hist.length>HIST_MAX)_hist.shift();
    _redo=[];                        // a fresh change clears the redo branch
    updateHistButtons();
    persist();                       // autosave the latest state to localStorage
  },350);
}
function applyState(snap){
  _restoring=true;
  S=JSON.parse(JSON.stringify(snap));
  [...$('#typeTabs').children].forEach(x=>x.classList.toggle('on',x.dataset.t===S.type));
  renderEditor();renderStyle();renderChart();
  _restoring=false;
}
function undo(){
  if(_hist.length<=1)return;
  _redo.push(_hist.pop());
  if(_redo.length>HIST_MAX)_redo.shift();
  applyState(_hist[_hist.length-1]);
  updateHistButtons();
}
function redo(){
  if(!_redo.length)return;
  const snap=_redo.pop();
  _hist.push(snap);
  if(_hist.length>HIST_MAX)_hist.shift();
  applyState(snap);
  updateHistButtons();
}
$('#undoBtn').onclick=undo;
$('#redoBtn').onclick=redo;
document.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();
  const typing=tag==='input'||tag==='textarea'||tag==='select';
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){
    // allow native text undo while editing a field; only hijack when not typing
    if(typing)return;
    e.preventDefault();
    if(e.shiftKey)redo();else undo();
  } else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){
    if(typing)return;e.preventDefault();redo();
  }
});
// Hook commit onto the render pipeline: every renderChart triggered by a user action records history.
const _renderChart=renderChart;
renderChart=function(){_renderChart.apply(this,arguments);commit();};

/* ================= PERSISTENCE (localStorage autosave) ================= */
const LSKEY='plotbench.v2.state', LSKEY_THEME='plotbench.v2.theme';
function persist(){ try{ localStorage.setItem(LSKEY, JSON.stringify(snapshot())); }catch(e){} }
function restore(){
  try{
    const raw=localStorage.getItem(LSKEY); if(!raw)return false;
    const o=JSON.parse(raw); if(!o||!Array.isArray(o.series)||!o.st)return false;
    const d=defaultState();
    // merge styling with defaults so states saved by older versions keep new fields
    o.st={...d.st, ...o.st, analysis:{...d.st.analysis, ...(o.st.analysis||{})}};
    S=o; return true;
  }catch(e){ return false; }
}
function clearSaved(){ try{ localStorage.removeItem(LSKEY); }catch(e){} }

/* ================= THEME ================= */
function setTheme(dark){
  document.getElementById('pbApp').classList.toggle('dark',dark);
  $('#themeIcon').innerHTML = dark
    ? '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>' // sun
    : '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'; // moon
  $('#themeBtn').title = dark?'Switch to light mode':'Switch to dark mode';
  try{ localStorage.setItem(LSKEY_THEME, dark?'1':'0'); }catch(e){}
}
let _dark=false;
$('#themeBtn').onclick=()=>{_dark=!_dark;setTheme(_dark);};

/* ================= INIT ================= */
restore();                   // load the autosaved figure if one exists
[...$('#typeTabs').children].forEach(x=>x.classList.toggle('on',x.dataset.t===S.type));
renderEditor();
renderStyle();
_renderChart();              // initial paint without recording a duplicate
_hist=[snapshot()];          // seed history with the starting state
updateHistButtons();
let _savedDark=false; try{ _savedDark=localStorage.getItem(LSKEY_THEME)==='1'; }catch(e){}
_dark=_savedDark; setTheme(_dark);
googleFontCSS('Inter',['400','500','600','700']);   // warm embedded-font cache for instant export

})();