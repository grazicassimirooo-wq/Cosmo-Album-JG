/* Inicialização compartilhada do Firebase — usada por páginas que precisam
   de _db / _stg / _CLIENT mas não têm o bloco inline do index.html.
   Inclua este arquivo DEPOIS dos SDKs compat (app, firestore, storage). */
(function(){
  var CONFIG = {
    apiKey: "AIzaSyD0-GBYHLsYc_mqqq3Ymhbq3ynpIdx2sMg",
    authDomain: "album--jussara.firebaseapp.com",
    projectId: "album--jussara",
    storageBucket: "album--jussara.firebasestorage.app",
    messagingSenderId: "732871382789",
    appId: "1:732871382789:web:7d93bce8c431ba80bd496c"
  };
  function init(){
    try{
      if(typeof firebase === 'undefined'){ setTimeout(init, 60); return; }
      if(!firebase.apps || !firebase.apps.length){
        firebase.initializeApp(CONFIG);
      }
      window._db = firebase.firestore();
      try{ window._stg = firebase.storage(); }catch(e){ window._stg = null; }
      var who = 'anon';
      try{ who = localStorage.getItem('cosmoUser') || 'anon'; }catch(e){}
      window._CLIENT = who;
      window._pingPush = window._pingPush || function(kind, extra){
        try{
          var w = '';
          try{ w = localStorage.getItem('cosmoUser') || ''; }catch(e){}
          fetch('https://southamerica-east1-album--jussara.cloudfunctions.net/notify', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify(Object.assign({ kind: kind, by: who, byWho: w, k: 'jg-cosmo-2026' }, extra || {}))
          }).catch(function(){});
        }catch(e){}
      };
    }catch(e){ console.warn('Firebase init falhou:', e); }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
