/* ================= CORE: STATS =================
   Pure numeric helpers shared across the app and unit-tested in Node
   (test/stats.test.mjs). This file is the seed of the validated stats
   engine — every function added here needs a golden test against a
   published R/scipy reference value before it ships. */

export function num(v){const n=parseFloat(v);return isFinite(n)?n:null;}

export function mean(a){if(!a.length)return null;return a.reduce((x,y)=>x+y,0)/a.length;}

// Sample standard deviation (n−1 denominator), as used for error bars.
export function sd(a){
  if(a.length<2)return null;
  const m=mean(a);
  return Math.sqrt(a.reduce((acc,v)=>acc+(v-m)**2,0)/(a.length-1));
}

export function sem(a){const s=sd(a);return s===null?null:s/Math.sqrt(a.length);}

// Ordinary least squares over [[x,y],...] → {m, b, r2, n} or null.
export function linregress(pairs){
  const n=pairs.length; if(n<2)return null;
  let sx=0,sy=0,sxy=0,sxx=0;
  pairs.forEach(([x,y])=>{sx+=x;sy+=y;sxy+=x*y;sxx+=x*x;});
  const d=n*sxx-sx*sx; if(d===0)return null;
  const m=(n*sxy-sx*sy)/d, b=(sy-m*sx)/n;
  // R^2
  const my=sy/n; let ssTot=0,ssRes=0;
  pairs.forEach(([x,y])=>{const f=m*x+b;ssRes+=(y-f)**2;ssTot+=(y-my)**2;});
  const r2=ssTot===0?1:1-ssRes/ssTot;
  return {m,b,r2,n};
}

// Trapezoidal integration of y over x for [{x,y},...] sorted by x.
export function trapzArea(pts){
  let a=0; for(let i=1;i<pts.length;i++){const dx=pts[i].x-pts[i-1].x; a+=(pts[i].y+pts[i-1].y)/2*dx;} return a;
}

/* ---- distributions (box plots, violins, points) ---- */

// Linear-interpolated quantile on an already-sorted ascending array.
// Matches R quantile(type=7) and numpy.percentile (the 'linear' default).
export function quantile(sorted, q){
  const n=sorted.length; if(!n)return null; if(n===1)return sorted[0];
  const h=(n-1)*q, lo=Math.floor(h), frac=h-lo;
  return lo+1<n ? sorted[lo]+frac*(sorted[lo+1]-sorted[lo]) : sorted[lo];
}

// Five-number summary + Tukey whiskers (1.5×IQR) + outliers, from raw values.
// Whiskers extend to the most extreme datum still within the fence.
export function boxStats(values){
  const v=values.map(Number).filter(x=>isFinite(x)).sort((a,b)=>a-b);
  const n=v.length; if(!n)return null;
  const q1=quantile(v,0.25), med=quantile(v,0.5), q3=quantile(v,0.75);
  const iqr=q3-q1, loFence=q1-1.5*iqr, hiFence=q3+1.5*iqr;
  let wLo=v[0], wHi=v[n-1]; const outliers=[];
  for(const x of v){ if(x<loFence||x>hiFence)outliers.push(x); }
  wLo=v.find(x=>x>=loFence); wHi=[...v].reverse().find(x=>x<=hiFence);
  return {n, min:v[0], max:v[n-1], q1, median:med, q3, iqr,
    whiskerLo:wLo, whiskerHi:wHi, outliers, mean:mean(v)};
}

// Silverman's rule-of-thumb bandwidth for a Gaussian kernel.
export function silverman(values){
  const v=values.filter(x=>isFinite(x));
  const n=v.length; if(n<2)return 1;
  const s=sd(v); const sorted=[...v].sort((a,b)=>a-b);
  const iqr=quantile(sorted,0.75)-quantile(sorted,0.25);
  const spread=iqr>0 ? Math.min(s,iqr/1.349) : s;
  return 1.06*(spread||s||1)*Math.pow(n,-1/5);
}

// Gaussian kernel density estimate sampled at `steps` points across the data
// range (padded by `pad`×bandwidth). Returns [{v, d}] for violin outlines.
export function kde(values, {steps=48, bandwidth=null, pad=3}={}){
  const v=values.map(Number).filter(x=>isFinite(x));
  const n=v.length; if(!n)return [];
  const h=bandwidth||silverman(v)||1;
  const lo=Math.min(...v)-pad*h, hi=Math.max(...v)+pad*h;
  const norm=1/(n*h*Math.sqrt(2*Math.PI));
  const out=[];
  for(let i=0;i<steps;i++){
    const x=lo+(hi-lo)*i/(steps-1);
    let s=0; for(const xi of v){const u=(x-xi)/h; s+=Math.exp(-0.5*u*u);}
    out.push({v:x, d:s*norm});
  }
  return out;
}
