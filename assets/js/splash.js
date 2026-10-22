/* Show splash until the dashboard has rendered, minimum 1.3s, max 6s. */
(function(){
  'use strict';
  var splash=document.getElementById('kito-splash');
  if(!splash)return;
  var started=Date.now(),done=false;
  function dismiss(){if(done)return;done=true;splash.classList.add('is-hidden');setTimeout(function(){if(splash.parentNode)splash.parentNode.removeChild(splash);},600);}
  function ready(){var wait=Math.max(0,1300-(Date.now()-started));setTimeout(dismiss,wait);}
  function check(){
    var app=document.getElementById('app');
    if(!app)return false;
    var text=(app.textContent||'').trim();
    if(!text || (text==='Memuat dashboard…') || (text==='Memuat dashboard...'))return false;
    ready();return true;
  }
  if(!check()){
    var app=document.getElementById('app');
    if(app&&window.MutationObserver){var observer=new MutationObserver(function(){if(check())observer.disconnect();});observer.observe(app,{childList:true,subtree:true,characterData:true});}
    window.addEventListener('load',function(){setTimeout(check,100);},{once:true});
  }
  setTimeout(dismiss,6000);
})();
