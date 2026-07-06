/* ================= CORE: CSV / TABLE INFERENCE =================
   Parsing and layout detection for pasted or imported tables, shared by the
   Smart import and the paste dialog, unit-tested in Node (test/csv.test.mjs).

   analyzeTable() classifies one contiguous block of rows into:
     curves    — numeric X in col 0, every other column a curve (raw traces)
     summary   — lab export: spanned group header (",A,,,B,,") over mean/SD/n
     long      — tidy/long format: an X column, a group column, a value column
     groupReps — group column + value column with repeated groups (replicates)
     wide      — first column = categories, each numeric column a series
                 (error columns like "SD"/"SEM" attach to the series before them)
     table     — anything it can't confidently read */

import { num, mean, sd } from './stats.js';

export function parseGrid(raw){
  return raw.trim().split(/\r?\n/).map(line=>{
    if(line.includes('\t'))return line.split('\t').map(c=>c.trim());
    if(line.includes(','))return line.split(',').map(c=>c.trim());
    return line.trim().split(/\s+/);
  });
}

export function rawToRows(raw){
  return raw.replace(/\r/g,'').split('\n').map(line=>{
    if(line.includes('\t'))return line.split('\t');
    return line.split(',');
  });
}

export function isBlank(row){return !row.some(c=>String(c).trim()!=='');}

export function splitBlocks(rows){
  const blocks=[]; let cur=[];
  rows.forEach(r=>{ if(isBlank(r)){ if(cur.length){blocks.push(cur);cur=[];} } else cur.push(r); });
  if(cur.length)blocks.push(cur);
  return blocks.filter(b=>b.length);
}

export function numCount(row){let n=0;row.forEach(c=>{if(num(c)!==null)n++;});return n;}

// First mostly-numeric row = first data row; the row above it (if any) is the header.
export function guessHeaderRows(grid){
  for(let r=0;r<grid.length;r++){
    const cells=grid[r]; let nums=0,checked=0;
    for(let c=1;c<cells.length;c++){checked++;if(num(cells[c])!==null)nums++;}
    if(checked>0 && nums>=Math.ceil(checked/2)) return r;
  }
  return 1;
}

// In a lab summary block, the row holding group names is the first row that has text
// (non-numeric) values in columns 1+ (e.g. ",W251A,,,W251B,..."). Skip metadata rows.
export function guessGroups(block){
  let header=null;
  for(const r of block){
    const textCols=r.slice(1).filter(c=>String(c).trim()!=='' && num(c)===null);
    const dateish=/date|export/i.test(String(r[0]||''));
    if(textCols.length>=1 && !dateish){header=r;break;}
  }
  if(!header)header=block[0]||[];
  const names=[], starts=[];
  for(let c=1;c<header.length;c++){
    const v=String(header[c]||'').trim();
    if(v!==''){ if(!names.length||names[names.length-1]!==v){names.push(v);starts.push(c);} }
  }
  const widths=starts.map((s,i)=>(i<starts.length-1?starts[i+1]:header.length)-s);
  return {names,starts,widths};
}

const ERRISH=/(^|[^a-z])(s\.?d\.?|s\.?e\.?m\.?|se|stdev|stdv|std|err|error|dev)([^a-z]|$)|±/i;
export function isErrHeader(h){return ERRISH.test(String(h||'').trim());}

function cell(row,c){return row&&row[c]!=null?String(row[c]).trim():'';}

// Per-column profile over the data rows.
function profileCols(body,ncol){
  const cols=[];
  for(let c=0;c<ncol;c++){
    let nums=0,texts=0; const uniq=new Set();
    body.forEach(r=>{
      const v=cell(r,c); if(v==='')return;
      if(num(v)!==null)nums++; else texts++;
      uniq.add(v);
    });
    cols.push({nums,texts,uniq});
  }
  return cols;
}

export function analyzeTable(rows){
  const nrows=rows.length;
  const ncol=Math.max(0,...rows.map(r=>r.length));
  if(!nrows||ncol<2)return {kind:'table',rows};

  // ---- curves: numeric col 0 and (mostly) all-numeric data rows ----
  const dataRows=rows.filter(r=>num(r[0])!==null);
  if(dataRows.length>=5 && dataRows.length>=nrows-2){
    const allNumeric=dataRows.every(r=>numCount(r)>=Math.max(2,r.length-1));
    if(allNumeric)return {kind:'curves', rows, headerRow:rows.find(r=>num(r[0])===null)||null, data:dataRows};
  }

  // ---- lab summary: spanned group header over mean/SD/n triples ----
  const groups=guessGroups(rows);
  if(groups.names.length>=1 && groups.widths.some(w=>w>=2)){
    const propRows=rows.map((r,i)=>({i,label:cell(r,0),ok:num(r[0])===null&&cell(r,0)!==''&&numCount(r)>=2}))
                       .filter(o=>o.ok);
    if(propRows.length>=1)return {kind:'summary', rows, groups, propRows};
  }

  // ---- header/body split + column profiles ----
  const hi=guessHeaderRows(rows);
  const header=hi>0?rows[Math.min(hi-1,nrows-1)]:null;
  const body=rows.slice(hi);
  if(!body.length)return {kind:'table',rows};
  const prof=profileCols(body,ncol);
  const filled=c=>prof[c].nums+prof[c].texts;
  const isValueCol=c=>filled(c)>0 && prof[c].nums>=Math.max(1,Math.ceil(filled(c)*0.8));
  const valueCols=[]; for(let c=0;c<ncol;c++)if(isValueCol(c))valueCols.push(c);

  // ---- long / groupReps: a text "factor" column whose values repeat ----
  const factorCols=[];
  for(let c=0;c<ncol;c++){
    if(isValueCol(c))continue;
    const p=prof[c];
    if(p.texts>=Math.ceil(filled(c)*0.8) && p.uniq.size>=2 && p.uniq.size<filled(c))factorCols.push(c);
  }
  if(factorCols.length && valueCols.length){
    const gi=factorCols.find(c=>c>0)??factorCols[0];
    const yi=valueCols.find(c=>c!==gi);
    if(yi!=null){
      // an X column: any other column with content (prefer the leftmost)
      let xi=null;
      for(let c=0;c<ncol;c++){if(c!==gi&&c!==yi&&filled(c)>0){xi=c;break;}}
      // error column: a value column right of Y with an error-ish header
      let ei=null;
      for(const c of valueCols){if(c>yi&&c!==xi&&header&&isErrHeader(header[c])){ei=c;break;}}
      if(xi!=null&&xi!==ei)return {kind:'long', rows, header, body, map:{xi,gi,yi,ei}, groups:[...prof[gi].uniq]};
      return {kind:'groupReps', rows, header, body, map:{gi,yi}, groups:[...prof[gi].uniq]};
    }
  }

  // ---- wide: col 0 = mostly-unique text categories, numeric series columns ----
  const p0=prof[0];
  if(p0.texts>=Math.ceil(filled(0)*0.8) && p0.uniq.size>=Math.max(2,filled(0)-1)){
    const cols=[];
    for(let c=1;c<ncol;c++){
      if(!isValueCol(c))continue;
      const name=cell(header||[],c);
      if(cols.length && isErrHeader(name) && cols[cols.length-1].e==null){cols[cols.length-1].e=c;continue;}
      cols.push({y:c, e:null, name:name||('Series '+(cols.length+1))});
    }
    if(cols.length)return {kind:'wide', rows, header, body, xi:0, cols};
  }

  return {kind:'table',rows};
}

/* ---------- series builders (color/marker styling is the caller's job) ---------- */

// Long format → one series per group value. Blank X cells inherit the value above
// (merged-cell style exports). Returns bare series: {name, showErr, pts}.
export function seriesFromLong(body,{xi,gi,yi,ei},header){
  let lastX=''; const order=[]; const map=new Map();
  body.forEach(row=>{
    let xv=cell(row,xi);
    if(xv==='')xv=lastX; else lastX=xv;
    const gv=cell(row,gi), yv=cell(row,yi);
    const ev=ei!=null?cell(row,ei):'';
    if(gv===''&&yv==='')return;
    if(xv!==''&&!order.includes(xv))order.push(xv);
    if(!map.has(gv))map.set(gv,new Map());
    map.get(gv).set(xv,{y:yv,e:ev});
  });
  if(!map.size)return null;
  const series=[...map.entries()].map(([gv,vals])=>({
    name:gv||'—', showErr:ei!=null,
    pts:order.map(xv=>{const c=vals.get(xv);return {x:xv,y:c?c.y:'',e:c?c.e:''};})
  }));
  return {series, order,
    groupName:header?cell(header,gi):'',
    xlab:header?cell(header,xi):'', ylab:header?cell(header,yi):''};
}

// Wide format → one series per value column, X from the category column.
export function seriesFromWide(body,cols,xi,header){
  return cols.map(col=>({
    name:col.name, showErr:col.e!=null,
    pts:body.map(r=>({x:cell(r,xi), y:cell(r,col.y), e:col.e!=null?cell(r,col.e):''}))
       .filter(p=>p.x!==''||p.y!=='')
  }));
}

// Replicate rows → one point per group: mean ± sample SD (n kept for labels).
export function aggregateGroupReps(body,{gi,yi}){
  const order=[]; const map=new Map();
  body.forEach(row=>{
    const gv=cell(row,gi); const yv=num(row[yi]);
    if(gv===''||yv===null)return;
    if(!map.has(gv)){map.set(gv,[]);order.push(gv);}
    map.get(gv).push(yv);
  });
  if(!map.size)return null;
  return {pts:order.map(gv=>{
    const vals=map.get(gv);
    const m=mean(vals), s=vals.length>1?sd(vals):null;
    return {x:gv, y:+m.toPrecision(6), e:s===null?'':+s.toPrecision(4), n:vals.length};
  })};
}
