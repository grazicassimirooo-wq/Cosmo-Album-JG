/* 🟢 presence.js — "online agora / visto há X" estilo WhatsApp.

   Cada aparelho com perfil real (jussara/grazi) escreve um heartbeat em
   presence-status/{eu} e observa presence-status/{a outra}. Um selo discreto
   no rodapé mostra se a outra pessoa está online agora ou quando foi vista
   pela última vez.

   Regras de projeto respeitadas:
   - Só perfis reais participam (igual ao registro de token de push).
   - Sem Firebase (páginas estáticas) o módulo simplesmente não faz nada.
   - Coleção nova → já está na whitelist do firestore.rules.
   - Respeita prefers-reduced-motion (sem pulsar o pontinho). */
(function(){
  'use strict';
  if (window.__jgPresence) return;               // não duplica se incluído 2x
  window.__jgPresence = true;

  /* ── quem sou eu / quem é a outra ── */
  var ME = null;
  try { ME = localStorage.getItem('cosmoUser'); } catch(e){}
  if (ME !== 'jussara' && ME !== 'grazi') return;   // só perfis reais
  var THEM = ME === 'grazi' ? 'jussara' : 'grazi';
  var THEIR_NAME = THEM === 'grazi' ? 'Grazi' : 'Jussara';

  /* ── Firebase (as páginas com sync já carregam os compat scripts) ── */
  if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return;
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyD0-GBYHLsYc_mqqq3Ymhbq3ynpIdx2sMg",
    authDomain: "album--jussara.firebaseapp.com",
    projectId: "album--jussara",
    storageBucket: "album--jussara.firebasestorage.app",
    messagingSenderId: "732871382789",
    appId: "1:732871382789:web:7d93bce8c431ba80bd496c"
  };
  var db;
  try {
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
  } catch(e){ return; }

  var COL = 'presence-status';
  var ONLINE_WINDOW = 60000;   // considera online se o último heartbeat < 60s
  var BEAT_MS = 25000;         // bate o coração a cada 25s
  var myRef = db.collection(COL).doc(ME);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function pageName(){
    var p = (location.pathname.split('/').pop() || 'index.html');
    return p.replace('.html', '') || 'album';
  }

  /* ── heartbeat ── */
  function beat(online){
    try {
      myRef.set({ online: !!online, ts: Date.now(), page: pageName(), by: ME }, { merge: true });
    } catch(e){}
  }
  beat(true);
  setInterval(function(){ if (!document.hidden) beat(true); }, BEAT_MS);
  document.addEventListener('visibilitychange', function(){ beat(!document.hidden); });
  window.addEventListener('online', function(){ beat(true); });
  window.addEventListener('focus', function(){ beat(true); });
  var bye = function(){ beat(false); };
  window.addEventListener('pagehide', bye);
  window.addEventListener('beforeunload', bye);

  /* ── selo visual ── */
  var css = document.createElement('style');
  css.textContent =
    '#jg-presence-pill{position:fixed;left:12px;z-index:10000;' +
      'bottom:calc(env(safe-area-inset-bottom,0px) + 12px);' +
      'display:flex;align-items:center;gap:7px;padding:6px 13px 6px 11px;' +
      'border-radius:99px;background:rgba(12,10,34,.82);backdrop-filter:blur(10px);' +
      '-webkit-backdrop-filter:blur(10px);border:1px solid rgba(232,184,109,.35);' +
      "font-family:'Nunito',sans-serif;font-weight:800;font-size:.66rem;letter-spacing:.3px;" +
      'color:#F0DFC0;box-shadow:0 6px 18px rgba(0,0,0,.45);' +
      'opacity:0;transform:translateY(8px);transition:opacity .4s ease,transform .4s ease;' +
      'pointer-events:none;max-width:calc(100vw - 24px);white-space:nowrap}' +
    '#jg-presence-pill.on{opacity:1;transform:translateY(0)}' +
    '#jg-presence-pill .jgpd{width:8px;height:8px;border-radius:50%;flex-shrink:0;' +
      'background:#6C6A82;box-shadow:none;transition:background .3s,box-shadow .3s}' +
    '#jg-presence-pill.live .jgpd{background:#5FD07A;box-shadow:0 0 0 0 rgba(95,208,122,.55)' +
      (reduce ? '' : ';animation:jgp-pulse 2s ease-out infinite') + '}' +
    '#jg-presence-pill .jgpt b{color:#E8B86D;font-weight:900}' +
    '@keyframes jgp-pulse{0%{box-shadow:0 0 0 0 rgba(95,208,122,.5)}' +
      '70%{box-shadow:0 0 0 7px rgba(95,208,122,0)}100%{box-shadow:0 0 0 0 rgba(95,208,122,0)}}';

  var pill = document.createElement('div');
  pill.id = 'jg-presence-pill';
  pill.setAttribute('aria-live', 'polite');
  pill.innerHTML = '<span class="jgpd"></span><span class="jgpt"></span>';

  function mount(){
    if (!document.head.contains(css)) document.head.appendChild(css);
    if (!document.body.contains(pill)) document.body.appendChild(pill);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  var txt = pill.querySelector('.jgpt');
  function fmtAgo(ts){
    var m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'agora mesmo';
    if (m < 60) return 'há ' + m + 'min';
    var h = Math.floor(m / 60);
    if (h < 24) return 'há ' + h + 'h';
    var d = Math.floor(h / 24);
    return d === 1 ? 'ontem' : 'há ' + d + 'd';
  }
  var _last = null;
  function render(d){
    _last = d;
    var online = !!(d && d.online === true && (Date.now() - (d.ts || 0) < ONLINE_WINDOW));
    if (online){
      pill.classList.add('live');
      txt.innerHTML = '<b>' + THEIR_NAME + '</b> online agora';
    } else {
      pill.classList.remove('live');
      txt.innerHTML = d && d.ts
        ? '<b>' + THEIR_NAME + '</b> · visto ' + fmtAgo(d.ts)
        : '<b>' + THEIR_NAME + '</b> · offline';
    }
    pill.classList.add('on');
  }

  try {
    db.collection(COL).doc(THEM).onSnapshot(
      function(s){ render(s.exists ? s.data() : null); },
      function(){ /* silêncio: sem status, o selo só não aparece */ }
    );
  } catch(e){}

  // re-renderiza sozinho pra o "visto há X" envelhecer e pra cair pra offline
  // quando o heartbeat da outra pessoa passar da janela sem novo snapshot
  setInterval(function(){ if (_last) render(_last); }, 30000);
})();
