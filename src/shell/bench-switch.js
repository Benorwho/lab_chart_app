(function(){
  var sb=document.getElementById('sbApp'), pb=document.getElementById('pbApp');
  var tabs=document.querySelectorAll('#benchSwitch [data-bench]');
  var themeBtn=document.getElementById('chartThemeBtn');
  function setTheme(theme){
    var dark=theme==='dark';
    document.body.dataset.chartTheme=dark?'dark':'light';
    if(pb) pb.classList.toggle('dark',dark);
    if(themeBtn){
      themeBtn.textContent=dark?'Light':'Dark';
      themeBtn.setAttribute('aria-pressed',String(dark));
      themeBtn.title=dark?'Switch to light mode':'Switch to dark mode';
    }
    try{
      localStorage.setItem('chartbench.theme',dark?'dark':'light');
      localStorage.setItem('plotbench.v2.theme',dark?'1':'0');
    }catch(e){}
    window.dispatchEvent(new Event('resize'));
  }
  function show(which){
    sb.classList.toggle('active',which==='sb');
    pb.classList.toggle('active',which==='pb');
    tabs.forEach(function(t){t.classList.toggle('on',t.dataset.bench===which);});
    try{localStorage.setItem('chartbench.mode',which);}catch(e){}
    window.dispatchEvent(new Event('resize'));
  }
  tabs.forEach(function(t){t.onclick=function(){show(t.dataset.bench);};});
  if(themeBtn){
    themeBtn.onclick=function(){ setTheme(document.body.dataset.chartTheme==='dark'?'light':'dark'); };
  }
  var m='sb'; try{m=localStorage.getItem('chartbench.mode')||'sb';}catch(e){}
  var theme='light'; try{theme=localStorage.getItem('chartbench.theme')||(localStorage.getItem('plotbench.v2.theme')==='1'?'dark':'light');}catch(e){}
  show(m);
  setTheme(theme);
  var pbTheme=document.getElementById('themeBtn');
  if(pbTheme){
    pbTheme.addEventListener('click',function(){
      setTimeout(function(){ setTheme(pb.classList.contains('dark')?'dark':'light'); },0);
    });
  }
})();