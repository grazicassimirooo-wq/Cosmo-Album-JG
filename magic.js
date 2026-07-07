/* ✨ magic.js — a camada de magia romântica e galáctica do Álbum J&G
   · corações flutuando devagar, subindo como se o álbum respirasse amor
   · estrelas cadentes cruzando o céu de vez em quando
   · toque em qualquer lugar → explosãozinha de corações e brilhos
   · toque longo (segurar) → chuva de beijinhos 💋
   Tudo leve, sem travar o resto: pointer-events:none, nós removidos ao
   fim da animação, limite de partículas, e nada roda se a pessoa pediu
   menos movimento (prefers-reduced-motion). */
(function(){
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.__jgMagic) return; // não duplica se incluído duas vezes
  window.__jgMagic = true;

  var MAX_NODES = 48;
  var stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden;contain:strict';

  var css = document.createElement('style');
  css.textContent =
    '@keyframes jgm-float{' +
      '0%{transform:translate3d(0,0,0) rotate(var(--r0)) scale(.5);opacity:0}' +
      '12%{opacity:var(--o)}' +
      '100%{transform:translate3d(var(--dx),-110vh,0) rotate(var(--r1)) scale(1);opacity:0}}' +
    '@keyframes jgm-burst{' +
      '0%{transform:translate3d(0,0,0) scale(.3) rotate(0);opacity:1}' +
      '100%{transform:translate3d(var(--dx),var(--dy),0) scale(var(--s)) rotate(var(--r1));opacity:0}}' +
    '@keyframes jgm-shoot{' +
      '0%{transform:translate3d(0,0,0) rotate(var(--ang));opacity:0}' +
      '8%{opacity:1}' +
      '100%{transform:translate3d(var(--dx),var(--dy),0) rotate(var(--ang));opacity:0}}' +
    '.jgm-p{position:absolute;will-change:transform,opacity;user-select:none;' +
      'filter:drop-shadow(0 0 6px rgba(244,218,138,.55))}' +
    '.jgm-star{position:absolute;width:110px;height:2px;border-radius:99px;' +
      'background:linear-gradient(90deg,rgba(255,255,255,0),rgba(244,220,168,.9),#fff);' +
      'box-shadow:0 0 8px rgba(244,220,168,.8);will-change:transform,opacity}' +
    '.jgm-star::after{content:"";position:absolute;right:-3px;top:-2px;width:6px;height:6px;' +
      'border-radius:50%;background:#fff;box-shadow:0 0 12px 3px rgba(255,240,200,.9)}';

  function boot(){
    document.head.appendChild(css);
    document.body.appendChild(stage);
    setTimeout(floatLoop, 2200);
    setTimeout(shootLoop, 4000);
  }

  function spawn(el, life){
    if (stage.childElementCount >= MAX_NODES) return null;
    stage.appendChild(el);
    // fallback: alguns navegadores não disparam animationend em aba oculta
    setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, life + 300);
    return el;
  }
  function rnd(a, b){ return a + Math.random() * (b - a); }
  function pick(arr){ return arr[(Math.random() * arr.length) | 0]; }

  /* ── corações flutuando (ambiente) ── */
  var FLOATERS = ['💛','💖','🤍','✨','💫','⭐'];
  function floatOne(){
    var el = document.createElement('div');
    el.className = 'jgm-p';
    el.textContent = pick(FLOATERS);
    var life = rnd(9000, 15000);
    el.style.cssText =
      'left:' + rnd(4, 94) + 'vw;top:104vh;font-size:' + rnd(0.7, 1.3) + 'rem;' +
      '--dx:' + rnd(-14, 14) + 'vw;--o:' + rnd(0.25, 0.55) + ';' +
      '--r0:' + rnd(-30, 30) + 'deg;--r1:' + rnd(-40, 40) + 'deg;' +
      'animation:jgm-float ' + life + 'ms linear forwards';
    spawn(el, life);
  }
  function floatLoop(){
    floatOne();
    setTimeout(floatLoop, rnd(2600, 5200));
  }

  /* ── estrelas cadentes ── */
  function shootOne(){
    var el = document.createElement('div');
    el.className = 'jgm-star';
    var down = rnd(18, 42);                    // desce enquanto cruza
    var fromLeft = Math.random() < 0.5;
    var dx = (fromLeft ? 1 : -1) * rnd(55, 90);
    var ang = Math.atan2(down, dx) * 180 / Math.PI;
    var life = rnd(900, 1500);
    el.style.cssText =
      'left:' + (fromLeft ? rnd(-10, 20) : rnd(80, 105)) + 'vw;' +
      'top:' + rnd(3, 30) + 'vh;' +
      (fromLeft ? '' : 'transform:scaleX(-1);') +
      '--dx:' + dx + 'vw;--dy:' + down + 'vh;--ang:' + ang + 'deg;' +
      'animation:jgm-shoot ' + life + 'ms ease-out forwards';
    spawn(el, life);
  }
  function shootLoop(){
    shootOne();
    setTimeout(shootLoop, rnd(7000, 16000));
  }

  /* ── explosãozinha no toque ── */
  var BURST = ['💛','💖','✨','💫','🌟','💗'];
  var KISS  = ['💋','💛','💋','💖','💋','😘'];
  function burstAt(x, y, emojis, n, big){
    for (var i = 0; i < n; i++){
      var el = document.createElement('div');
      el.className = 'jgm-p';
      el.textContent = pick(emojis);
      var a = rnd(0, Math.PI * 2), d = rnd(30, big ? 130 : 80);
      var life = rnd(650, 1100);
      el.style.cssText =
        'left:' + x + 'px;top:' + y + 'px;font-size:' + rnd(0.8, big ? 1.6 : 1.2) + 'rem;' +
        '--dx:' + Math.cos(a) * d + 'px;--dy:' + (Math.sin(a) * d - rnd(20, 60)) + 'px;' +
        '--s:' + rnd(0.9, 1.5) + ';--r1:' + rnd(-90, 90) + 'deg;' +
        'animation:jgm-burst ' + life + 'ms cubic-bezier(.2,.7,.3,1) forwards';
      if (!spawn(el, life)) break;
    }
  }

  var lastTap = 0, pressTimer = null, pressPos = null;
  function onDown(e){
    var t = e.touches ? e.touches[0] : e;
    if (!t) return;
    pressPos = { x: t.clientX, y: t.clientY };
    var now = Date.now();
    if (now - lastTap > 500){          // sem spam durante raspadinha/arrasto
      lastTap = now;
      burstAt(pressPos.x, pressPos.y, BURST, 5, false);
    }
    clearTimeout(pressTimer);          // segurar 600ms → chuva de beijinhos
    pressTimer = setTimeout(function(){
      if (pressPos){
        burstAt(pressPos.x, pressPos.y, KISS, 12, true);
        if (navigator.vibrate) navigator.vibrate([15, 60, 15]);
      }
    }, 600);
  }
  function onUp(){ clearTimeout(pressTimer); pressPos = null; }

  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
