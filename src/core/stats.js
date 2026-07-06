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
