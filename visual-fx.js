/* 🌌 visual-fx.js — efeitos visuais cósmicos do Álbum J&G
   Técnicas inspiradas em awesome-web-styling, adaptadas ao tema galáxico:
   · nebulosa pulsante de fundo (gradientes animados via CSS)
   · partículas de poeira estelar flutuando devagar
   · aurora boreal sutil ondulando no topo
   · parallax suave no scroll/inclinação
   · brilho nos títulos (shimmer text)
   Tudo leve e performático: CSS animations + contain:strict,
   pointer-events:none, e nada roda com prefers-reduced-motion. */
(function(){
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.__jgVisualFx) return;
  window.__jgVisualFx = true;

  var css = document.createElement('style');
  css.textContent =
    /* ── nebulosa pulsante ── fundo que respira em tons do tema */
    '@keyframes jgvfx-nebula{' +
      '0%,100%{background-position:0% 50%;filter:hue-rotate(0deg)}' +
      '25%{background-position:50% 80%}' +
      '50%{background-position:100% 50%;filter:hue-rotate(12deg)}' +
      '75%{background-position:50% 20%}}' +
    '#jgvfx-nebula{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.18;' +
      'background:radial-gradient(ellipse at 20% 50%,#7C5BAD 0%,transparent 50%),' +
      'radial-gradient(ellipse at 80% 20%,#4A4090 0%,transparent 50%),' +
      'radial-gradient(ellipse at 50% 80%,#D4736E 0%,transparent 45%);' +
      'background-size:200% 200%;animation:jgvfx-nebula 25s ease-in-out infinite;' +
      'contain:strict;will-change:background-position,filter}' +

    /* ── aurora boreal ── faixa no topo que ondula */
    '@keyframes jgvfx-aurora{' +
      '0%{transform:translateX(-30%) scaleY(1);opacity:.12}' +
      '33%{transform:translateX(10%) scaleY(1.4);opacity:.18}' +
      '66%{transform:translateX(-10%) scaleY(.8);opacity:.1}' +
      '100%{transform:translateX(-30%) scaleY(1);opacity:.12}}' +
    '#jgvfx-aurora{position:fixed;top:-30px;left:-20%;z-index:1;pointer-events:none;' +
      'width:140%;height:90px;' +
      'background:linear-gradient(90deg,transparent,#7C5BAD,#4A4090,#E8B86D,#7C5BAD,transparent);' +
      'filter:blur(30px);border-radius:50%;' +
      'animation:jgvfx-aurora 18s ease-in-out infinite;contain:layout style;will-change:transform,opacity}' +

    /* ── poeira estelar (partículas CSS puras) ── */
    '@keyframes jgvfx-dust{' +
      '0%{transform:translate3d(0,0,0);opacity:0}' +
      '15%{opacity:var(--o)}' +
      '85%{opacity:var(--o)}' +
      '100%{transform:translate3d(var(--mx),var(--my),0);opacity:0}}' +
    '.jgvfx-dust{position:fixed;width:var(--sz);height:var(--sz);border-radius:50%;' +
      'background:var(--c);pointer-events:none;z-index:1;' +
      'box-shadow:0 0 calc(var(--sz)*2) var(--c);' +
      'animation:jgvfx-dust var(--dur) linear infinite;will-change:transform,opacity}' +

    /* ── shimmer nos títulos ── */
    '@keyframes jgvfx-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}' +
    '.jgvfx-shimmer{background:linear-gradient(90deg,' +
      '#F0DFC0 0%,#F0DFC0 35%,#E8B86D 50%,#F0DFC0 65%,#F0DFC0 100%) !important;' +
      'background-size:200% 100% !important;-webkit-background-clip:text !important;' +
      'background-clip:text !important;-webkit-text-fill-color:transparent !important;' +
      'animation:jgvfx-shimmer 6s ease-in-out infinite !important}' +

    /* ── vignette nas bordas ── */
    '#jgvfx-vignette{position:fixed;inset:0;z-index:2;pointer-events:none;' +
      'background:radial-gradient(ellipse at center,transparent 55%,rgba(10,8,32,.5) 100%);' +
      'contain:strict}' +

    /* ── lens flare no canto ── */
    '@keyframes jgvfx-flare{' +
      '0%,100%{opacity:.06;transform:scale(.8) translate(0,0)}' +
      '50%{opacity:.14;transform:scale(1.1) translate(5px,-3px)}}' +
    '#jgvfx-flare{position:fixed;top:8%;right:12%;z-index:1;pointer-events:none;' +
      'width:80px;height:80px;border-radius:50%;' +
      'background:radial-gradient(circle,rgba(232,184,109,.5),rgba(124,91,173,.2),transparent 70%);' +
      'filter:blur(15px);animation:jgvfx-flare 12s ease-in-out infinite;contain:layout style;' +
      'will-change:transform,opacity}';

  /* ── DOM ── */
  var nebula = document.createElement('div');
  nebula.id = 'jgvfx-nebula';

  var aurora = document.createElement('div');
  aurora.id = 'jgvfx-aurora';

  var vignette = document.createElement('div');
  vignette.id = 'jgvfx-vignette';

  var flare = document.createElement('div');
  flare.id = 'jgvfx-flare';

  [nebula, aurora, vignette, flare].forEach(function(el){ el.setAttribute('aria-hidden', 'true'); });

  /* ── poeira estelar ── */
  var DUST_COLORS = [
    'rgba(232,184,109,.4)',   // dourado
    'rgba(124,91,173,.35)',   // violeta
    'rgba(240,223,192,.3)',   // creme
    'rgba(212,115,110,.25)',  // coral
    'rgba(255,255,255,.2)'   // branco
  ];
  var DUST_COUNT = 18;
  var dustContainer = document.createDocumentFragment();

  function rnd(a, b){ return a + Math.random() * (b - a); }
  function pick(arr){ return arr[(Math.random() * arr.length) | 0]; }

  for (var i = 0; i < DUST_COUNT; i++){
    var d = document.createElement('div');
    d.className = 'jgvfx-dust';
    d.setAttribute('aria-hidden', 'true');
    var sz = rnd(1.5, 4);
    d.style.cssText =
      'left:' + rnd(2, 98) + 'vw;top:' + rnd(5, 95) + 'vh;' +
      '--sz:' + sz + 'px;--c:' + pick(DUST_COLORS) + ';' +
      '--o:' + rnd(0.3, 0.7) + ';' +
      '--mx:' + rnd(-60, 60) + 'px;--my:' + rnd(-50, 50) + 'px;' +
      '--dur:' + rnd(12, 28) + 's;' +
      'animation-delay:-' + rnd(0, 20) + 's';
    dustContainer.appendChild(d);
  }

  /* ── parallax suave com gyroscope/scroll ── */
  var pxLayer = document.createElement('div');
  pxLayer.id = 'jgvfx-parallax';
  pxLayer.setAttribute('aria-hidden', 'true');
  pxLayer.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;' +
    'transition:transform .8s cubic-bezier(.2,.6,.3,1);contain:layout style';

  var _gyroOK = false;
  function onGyro(e){
    if (!e.gamma && !e.beta) return;
    _gyroOK = true;
    var x = Math.max(-15, Math.min(15, (e.gamma || 0))) / 15 * 6;
    var y = Math.max(-15, Math.min(15, ((e.beta || 0) - 30))) / 15 * 4;
    pxLayer.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
  }
  if (window.DeviceOrientationEvent){
    window.addEventListener('deviceorientation', onGyro, { passive: true });
  }

  /* fallback: parallax com mouse em desktop */
  if (!('ontouchstart' in window)){
    window.addEventListener('mousemove', function(e){
      if (_gyroOK) return;
      var x = (e.clientX / window.innerWidth - 0.5) * 8;
      var y = (e.clientY / window.innerHeight - 0.5) * 5;
      pxLayer.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }, { passive: true });
  }

  /* ── shimmer automático nos títulos ── */
  function applyShimmer(){
    var selectors = 'h1, h2, .title, .titulo, [class*="heading"]';
    try {
      var els = document.querySelectorAll(selectors);
      for (var i = 0; i < Math.min(els.length, 5); i++){
        var el = els[i];
        if (el.closest('#jgvfx-nebula,#jgvfx-aurora,[aria-hidden="true"]')) continue;
        if (el.classList.contains('jgvfx-shimmer')) continue;
        if (el.textContent.trim().length < 2) continue;
        el.classList.add('jgvfx-shimmer');
      }
    } catch(e){}
  }

  /* ── montagem ── */
  function mount(){
    document.head.appendChild(css);

    pxLayer.appendChild(nebula);
    pxLayer.appendChild(aurora);
    pxLayer.appendChild(flare);
    document.body.insertBefore(pxLayer, document.body.firstChild);
    document.body.appendChild(vignette);
    document.body.appendChild(dustContainer);

    setTimeout(applyShimmer, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
