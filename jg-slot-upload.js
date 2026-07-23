/* ═══════════════════════════════════════════════════════════════════════
   JG-SLOT-UPLOAD — foto e vídeo autorais nos slots decorativos.

   Como usar:
     <div class="jg-slot ratio-photo" data-slot-id="cap1-carta-selada">
       ...placeholder original...
     </div>
   Basta o atributo `data-slot-id` (único global, kebab-case). Funciona
   com qualquer container — a classe visual não importa, o que ativa é
   o atributo. Compatível com `.jg-slot` (Cap I) e `.slot` (Cap 1 palavras,
   Cap Secreto, etc).

   O que faz:
   - Click / Enter / Space no slot abre o picker de arquivo.
   - Foto: resize pra 1080px (canvas), upload pra Storage `jg-slots/`,
     grava `{url, kind:'image', ts, by}` em Firestore `jg-slots/{id}`.
   - Vídeo: sobe original (limite 80MB), mesma pasta e coleção.
   - Sync onSnapshot: se alguém sobe num aparelho, todo mundo vê no ato.
   - Controles ao passar o mouse: ✎ trocar, ✕ remover.
   - Fallback: se Storage falha, cai pra base64 no Firestore (só imagens
     pequenas, respeitando o limite de ~1MB por doc).
   - Push: dispara `foto`/`video` na cloud function pra notificar a outra.

   Não escreve nada quando o perfil ainda é 'anon' (gate não passou).
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const STORAGE_DIR = 'jg-slots';
  const COLLECTION  = 'jg-slots';
  const MAX_IMG_DIM = 900;   // reduz pra caber inline no Firestore se Storage falhar
  const MAX_INLINE  = 900 * 1024; // <1MB → cabe num doc Firestore
  const DEBUG = true;
  function _log(){ if(DEBUG){ try{ console.log.apply(console, ['[jg-slot]'].concat([].slice.call(arguments))); }catch(e){} } }

  function _who(){ try{ return localStorage.getItem('cosmoUser') || 'anon'; }catch(e){ return 'anon'; } }
  function _client(){ try{ return window._CLIENT || _who(); }catch(e){ return 'anon'; } }
  function _db(){ try{ return window._db || (window.firebase && firebase.firestore && firebase.firestore()); }catch(e){ return null; } }
  function _stg(){ try{ return window._stg || (window.firebase && firebase.storage && firebase.storage()); }catch(e){ return null; } }
  function _pushKind(kind, extra){
    try{ if(typeof window._pingPush === 'function') window._pingPush(kind, extra || {}); }catch(e){}
  }

  function _toast(msg){
    let el = document.getElementById('jgSlotToast');
    if(!el){
      el = document.createElement('div');
      el.id = 'jgSlotToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:9999;'
        +'background:rgba(20,16,46,.94);color:#F0DFC0;padding:10px 18px;border-radius:99px;'
        +'border:1px solid rgba(232,184,109,.4);font-family:Nunito,sans-serif;font-weight:800;'
        +'font-size:.7rem;letter-spacing:1.5px;text-transform:uppercase;'
        +'box-shadow:0 8px 24px rgba(0,0,0,.5);opacity:0;transition:opacity .3s,transform .3s;'
        +'pointer-events:none;max-width:88vw;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, -8px)';
    clearTimeout(el._t);
    el._t = setTimeout(()=>{ el.style.opacity = '0'; el.style.transform = 'translateX(-50%)'; }, 2200);
  }

  function _injectStyles(){
    if(document.getElementById('jgSlotUploadCss')) return;
    const s = document.createElement('style');
    s.id = 'jgSlotUploadCss';
    s.textContent = `
[data-slot-id]{cursor:pointer;position:relative;transition:filter .2s,transform .2s}
[data-slot-id]:not(.has-media):hover{filter:brightness(1.06)}
[data-slot-id]:not(.has-media):focus-visible{outline:2px solid #E8B86D;outline-offset:3px}
[data-slot-id].has-media{background:transparent;border:1px solid rgba(232,184,109,.35);padding:0;justify-content:stretch;align-items:stretch;overflow:hidden}
[data-slot-id] .jg-media{display:block;width:100%;height:100%;object-fit:cover;border-radius:2px}
[data-slot-id] .jg-slot-hint{position:absolute;right:6px;bottom:6px;
  font-family:'Nunito',sans-serif;font-weight:800;font-size:.44rem;letter-spacing:1.3px;text-transform:uppercase;
  color:rgba(90,60,20,.75);text-align:center;pointer-events:none;
  padding:3px 8px;border-radius:99px;background:rgba(255,240,190,.7);border:1px dashed rgba(90,60,20,.35);
  opacity:.85;transition:opacity .2s}
[data-slot-id]:hover .jg-slot-hint{opacity:1}
[data-slot-id] .jg-slot-hint::before{content:'✒ '}
[data-slot-id] .jg-slot-hint-text{display:inline}
[data-slot-id].has-media .jg-slot-hint{display:none}
[data-slot-id] .jg-slot-tools{position:absolute;top:8px;right:8px;display:flex;gap:6px;opacity:0;
  transition:opacity .2s;pointer-events:none;z-index:3}
[data-slot-id].has-media:hover .jg-slot-tools,
[data-slot-id].has-media:focus-within .jg-slot-tools{opacity:1;pointer-events:auto}
[data-slot-id] .jg-slot-tool{width:32px;height:32px;border-radius:50%;cursor:pointer;
  background:rgba(20,16,46,.85);color:#F0DFC0;border:1px solid rgba(232,184,109,.55);
  font-size:.9rem;line-height:1;display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 12px rgba(0,0,0,.5)}
[data-slot-id] .jg-slot-tool:hover{background:rgba(232,184,109,.25);color:#FFF3C8}
[data-slot-id].uploading{filter:brightness(.6)}
[data-slot-id] .jg-slot-progress{position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:4;
  background:rgba(20,16,46,.65);color:#F0DFC0;font-family:'Nunito',sans-serif;font-weight:800;font-size:.55rem;
  letter-spacing:1.5px;text-transform:uppercase;pointer-events:none;text-align:center;padding:8px}
[data-slot-id].uploading .jg-slot-progress{display:flex}
@media (hover:none){
  [data-slot-id] .jg-slot-tools{opacity:1;pointer-events:auto}
}`;
    document.head.appendChild(s);
  }

  function _resizeImage(dataURL, maxDim, cb){
    const img = new Image();
    img.onload = ()=>{
      let w = img.width, h = img.height;
      if(Math.max(w,h) > maxDim){
        const k = maxDim/Math.max(w,h);
        w = Math.round(w*k); h = Math.round(h*k);
      }
      try{
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(cv.toDataURL('image/jpeg', 0.85));
      }catch(e){ cb(dataURL); }
    };
    img.onerror = ()=> cb(dataURL);
    img.src = dataURL;
  }

  function _applyMedia(slot, url, kind){
    slot.querySelectorAll('.jg-media').forEach(n => n.remove());
    Array.from(slot.children).forEach(ch => {
      if(!ch.classList.contains('jg-slot-tools')
         && !ch.classList.contains('jg-slot-hint')
         && !ch.classList.contains('jg-slot-progress')){
        ch.style.display = 'none';
      }
    });
    let el;
    if(kind === 'video'){
      el = document.createElement('video');
      el.src = url; el.muted = true; el.loop = true; el.playsInline = true; el.autoplay = true;
      el.setAttribute('webkit-playsinline','');
      el.play && el.play().catch(()=>{});
    } else {
      el = document.createElement('img');
      el.src = url;
      el.alt = slot.getAttribute('data-slot-alt') || 'arte autoral';
      el.loading = 'lazy';
    }
    el.className = 'jg-media';
    slot.insertBefore(el, slot.firstChild);
    slot.classList.add('has-media');
    _ensureTools(slot);
  }

  function _clearMedia(slot){
    slot.querySelectorAll('.jg-media').forEach(n => n.remove());
    Array.from(slot.children).forEach(ch => {
      if(!ch.classList.contains('jg-slot-tools')
         && !ch.classList.contains('jg-slot-hint')
         && !ch.classList.contains('jg-slot-progress')){
        ch.style.display = '';
      }
    });
    slot.classList.remove('has-media');
  }

  function _ensureTools(slot){
    if(slot.querySelector('.jg-slot-tools')) return;
    const box = document.createElement('div');
    box.className = 'jg-slot-tools';
    box.innerHTML = '<button type="button" class="jg-slot-tool" data-tool="swap" title="Trocar" aria-label="Trocar">✎</button>'
                  + '<button type="button" class="jg-slot-tool" data-tool="del"  title="Remover" aria-label="Remover">✕</button>';
    slot.appendChild(box);
  }
  function _ensureHint(slot){
    if(slot.querySelector('.jg-slot-hint')) return;
    const h = document.createElement('div');
    h.className = 'jg-slot-hint';
    h.textContent = 'enviar foto ou vídeo';
    slot.appendChild(h);
  }
  function _ensureProgress(slot){
    if(slot.querySelector('.jg-slot-progress')) return;
    const p = document.createElement('div');
    p.className = 'jg-slot-progress';
    p.textContent = 'enviando…';
    slot.appendChild(p);
  }

  let _picker = null;
  let _activeSlot = null;
  function _picker_el(){
    if(_picker) return _picker;
    _picker = document.createElement('input');
    _picker.type = 'file';
    _picker.accept = 'image/*,video/*';
    _picker.style.display = 'none';
    document.body.appendChild(_picker);
    _picker.addEventListener('change', _onFile);
    return _picker;
  }
  function _openPicker(slot){
    _activeSlot = slot;
    const p = _picker_el();
    p.value = '';
    p.click();
  }

  function _onFile(){
    const file = _picker.files && _picker.files[0];
    if(!file || !_activeSlot) return;
    const slot = _activeSlot; _activeSlot = null;
    const isVideo = file.type.startsWith('video/');
    const isImg   = file.type.startsWith('image/');
    _log('file selected', {name: file.name, type: file.type, size: file.size});
    if(!isVideo && !isImg){ _toast('tipo não suportado'); return; }
    if(file.size > 80 * 1024 * 1024){ _toast('arquivo maior que 80MB'); return; }
    if(_who() === 'anon'){ _toast('escolhe seu perfil primeiro (jussara/grazi)'); return; }

    slot.classList.add('uploading');
    const id = slot.dataset.slotId;
    const kind = isVideo ? 'video' : 'image';

    // MOSTRA A MÍDIA LOCALMENTE IMEDIATAMENTE — assim a Grazi vê a foto no ato,
    // mesmo que o Firebase demore ou falhe. Só depois sincroniza.
    const showLocal = (src) => {
      _applyMedia(slot, src, kind);
      slot.classList.remove('uploading');
      if(navigator.vibrate) navigator.vibrate(15);
    };

    const persistFirestore = (src, isRemote) => {
      const db = _db();
      if(!db){
        _log('_db missing, não persistiu no Firestore');
        if(!isRemote) _toast('foto no aparelho — sync do banco falhou (recarregue)');
        return Promise.resolve();
      }
      return db.collection(COLLECTION).doc(id).set({
        src, kind, ts: Date.now(), by: _client()
      }).then(()=> {
        _log('firestore ok', id);
        _pushKind(kind === 'video' ? 'video' : 'foto', { pg: 'album', slot: id });
      }).catch(err => {
        _log('firestore falhou', err && err.message);
        _toast('foto no aparelho — banco recusou (' + ((err && err.code) || 'erro') + ')');
      });
    };

    const uploadStorage = (blob, contentType) => {
      const stg = _stg();
      if(!stg){
        _log('_stg missing, indo direto pro dataUrlFallback');
        return dataUrlFallback(blob);
      }
      const ext = contentType.includes('gif')  ? 'gif'
                : contentType.includes('png')  ? 'png'
                : contentType.includes('webp') ? 'webp'
                : contentType.includes('mp4')  ? 'mp4'
                : contentType.includes('webm') ? 'webm'
                : contentType.includes('ogg')  ? 'ogv'
                : kind === 'video' ? 'mp4' : 'jpg';
      try{
        const ref = stg.ref().child(STORAGE_DIR + '/' + id + '.' + ext);
        const task = ref.put(blob, { contentType });
        task.on('state_changed',
          snap => {
            if(!snap || !snap.totalBytes) return;
            const pct = Math.round(100 * snap.bytesTransferred / snap.totalBytes);
            const p = slot.querySelector('.jg-slot-progress');
            if(p) p.textContent = 'enviando… ' + pct + '%';
          },
          err => {
            _log('Storage falhou:', err && err.message);
            _toast('storage indisponível — usando cache local');
            dataUrlFallback(blob);
          },
          () => {
            task.snapshot.ref.getDownloadURL().then(url => {
              _log('storage ok', url);
              showLocal(url);
              persistFirestore(url, true).then(() => _toast(kind === 'video' ? 'vídeo enviado ✓' : 'foto enviada ✓'));
            }).catch(err => {
              _log('URL falhou:', err && err.message);
              dataUrlFallback(blob);
            });
          });
      }catch(e){
        _log('Storage exception:', e && e.message);
        dataUrlFallback(blob);
      }
    };

    const dataUrlFallback = (blob) => {
      const r = new FileReader();
      r.onload = ev => {
        const src = ev.target.result;
        showLocal(src);
        if(typeof src === 'string' && src.length < MAX_INLINE){
          persistFirestore(src, false).then(() => _toast('foto salva ✓'));
        } else {
          _toast('foto salva neste aparelho (grande demais pra sync sem storage)');
        }
      };
      r.onerror = () => { slot.classList.remove('uploading'); _toast('falha ao ler o arquivo'); };
      r.readAsDataURL(blob);
    };

    if(isImg && !file.type.includes('gif')){
      const r = new FileReader();
      r.onload = ev => _resizeImage(ev.target.result, MAX_IMG_DIM, out => {
        // mostra IMEDIATAMENTE a foto local (data URL reduzido), depois tenta subir
        showLocal(out);
        fetch(out).then(res => res.blob())
          .then(blob => uploadStorage(blob, 'image/jpeg'))
          .catch(err => {
            _log('fetch dataURL falhou:', err && err.message);
            // já mostrou local, tenta persistir só a data URL no Firestore
            if(out.length < MAX_INLINE) persistFirestore(out, false).then(() => _toast('foto salva ✓'));
            else _toast('foto salva neste aparelho');
          });
      });
      r.onerror = () => { slot.classList.remove('uploading'); _toast('falha ao ler a foto'); };
      r.readAsDataURL(file);
    } else {
      // gif ou vídeo: mostra local via blob URL primeiro (instantâneo), depois tenta subir
      try{ showLocal(URL.createObjectURL(file)); }catch(e){}
      // se for pequeno (<8MB) tenta subir; se for grande, avisa que ficou só local
      if(file.size < 8 * 1024 * 1024 || _stg()){
        uploadStorage(file, file.type || (isVideo ? 'video/mp4' : 'image/jpeg'));
      } else {
        _toast(isVideo ? 'vídeo salvo neste aparelho (sem sync)' : 'gif salvo neste aparelho');
      }
    }
  }

  function _removeSlot(slot){
    const id = slot.dataset.slotId;
    _clearMedia(slot);
    const db = _db();
    if(db){ db.collection(COLLECTION).doc(id).delete().catch(()=>{}); }
    _toast('removido');
  }

  function _initSlot(slot){
    if(!slot || slot._jgWired) return;
    slot._jgWired = true;
    slot.setAttribute('tabindex', '0');
    slot.setAttribute('role', 'button');
    slot.setAttribute('aria-label', 'enviar foto ou vídeo neste slot');
    _ensureHint(slot);
    _ensureProgress(slot);
    slot.addEventListener('click', (e) => {
      const tool = e.target.closest('.jg-slot-tool');
      if(tool){
        e.stopPropagation();
        if(tool.dataset.tool === 'del'){
          _removeSlot(slot);
        } else if(tool.dataset.tool === 'swap'){
          _openPicker(slot);
        }
        return;
      }
      if(slot.classList.contains('uploading')) return;
      _openPicker(slot);
    });
    slot.addEventListener('keydown', (e) => {
      if(slot.classList.contains('uploading')) return;
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        _openPicker(slot);
      }
    });
  }

  function _initAll(){
    _injectStyles();
    document.querySelectorAll('[data-slot-id]').forEach(_initSlot);
  }

  function _syncFromFirestore(){
    const db = _db();
    if(!db) return;
    try{
      db.collection(COLLECTION).onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          const id = ch.doc.id;
          const slot = document.querySelector('[data-slot-id="' + CSS.escape(id) + '"]');
          if(!slot) return;
          if(ch.type === 'removed'){ _clearMedia(slot); return; }
          const d = ch.doc.data() || {};
          if(!d.src) return;
          _applyMedia(slot, d.src, d.kind || 'image');
        });
      }, err => { console.warn('jg-slots snapshot falhou:', err); });
    }catch(e){ console.warn('jg-slots snapshot exception:', e); }
  }

  function _boot(){
    _initAll();
    _syncFromFirestore();
    try{
      const mo = new MutationObserver(mut => {
        for(const m of mut){
          for(const n of m.addedNodes){
            if(n.nodeType !== 1) continue;
            if(n.dataset && n.dataset.slotId) _initSlot(n);
            n.querySelectorAll && n.querySelectorAll('[data-slot-id]').forEach(_initSlot);
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

  window._jgSlotUpload = { init: _initAll, sync: _syncFromFirestore };
})();
