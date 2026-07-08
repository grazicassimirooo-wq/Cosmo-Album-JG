/* Cloud Function de push (FCM): o app chama `notify` via HTTPS logo depois de
   gravar uma carta, doce ou foto no Firestore, e todos os aparelhos
   cadastrados recebem a notificação — menos o de quem enviou.

   (Os gatilhos do Firestore/Eventarc foram abandonados: neste projeto eles
   nunca receberam eventos, mesmo com região certa e recriação — o caminho
   HTTP é direto e auditável pelo push-log.) */
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
// mesma região do banco
setGlobalOptions({ maxInstances: 3, region: 'southamerica-east1' });

const NOMES = { grazi: 'A Grazi', jussara: 'A Jussara' };
const BASE = 'https://grazicassimirooo-wq.github.io/Cosmo-Album-JG/';
// chave simples anti-spam (o Firestore do álbum é aberto por design; isso só
// evita disparos por varredura automática de URLs)
const KEY = 'jg-cosmo-2026';

/* Envia o push para todos os tokens, exceto o de quem enviou (`by`).
   `data` precisa ser só strings (exigência do FCM). Cada envio deixa um
   registro em `push-log` para diagnóstico. */
async function sendToOther(by, data) {
  const db = getFirestore();
  const log = { tag: data.tag || '?', by: by || '?', ts: Date.now() };
  try {
    const tokensSnap = await db.collection('tokens').get();
    const targets = [];
    tokensSnap.forEach((doc) => {
      const t = doc.data();
      if (t && t.token && t.client !== by) targets.push({ id: doc.id, token: t.token });
    });
    log.targets = targets.map((t) => t.id).join(',');
    if (!targets.length) { log.result = 'sem destinatários'; return log; }

    const link = new URL(data.link || './', BASE).href;
    const res = await getMessaging().sendEachForMulticast({
      tokens: targets.map((t) => t.token),
      data,
      webpush: {
        headers: { Urgency: 'high' },
        // com o bloco `notification`, o navegador exibe o aviso sozinho,
        // mesmo se o service worker não rodar o onBackgroundMessage
        notification: {
          title: data.title,
          body: data.body,
          icon: BASE + 'icon-192.png',
          badge: BASE + 'icon-192.png',
          tag: data.tag,
          renotify: true
        },
        fcmOptions: { link }
      }
    });
    log.ok = res.successCount;
    log.fail = res.failureCount;
    const errs = [];
    const deletions = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = (r.error && r.error.code) || 'erro';
        errs.push(targets[i].id + ':' + code);
        // Limpa tokens que não valem mais (aparelho desinstalou / permissão revogada)
        if (code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-argument') {
          deletions.push(db.collection('tokens').doc(targets[i].id).delete());
        }
      }
    });
    if (errs.length) log.errs = errs.join(' | ');
    await Promise.all(deletions);
    return log;
  } catch (e) {
    log.result = 'ERRO: ' + (e && e.message ? e.message : String(e));
    return log;
  } finally {
    try { await db.collection('push-log').add(log); } catch (e) { /* diagnóstico não pode derrubar o push */ }
  }
}

const s = (v, max) => String(v == null ? '' : v).slice(0, max || 60);

exports.notify = onRequest({ cors: true }, async (req, res) => {
  try {
    // POST (app) manda JSON; GET (teste no navegador) manda query string
    const b = (req.method === 'GET') ? (req.query || {})
      : ((req.body && typeof req.body === 'object') ? req.body : {});
    if (b.k !== KEY) { res.status(403).json({ ok: false }); return; }
    if (b.kind === 'ping') {
      // prova de vida (usada pelo CI): registra no diário, sem enviar push.
      // O resultado da escrita vai na resposta — se a conta de serviço da
      // função estiver sem permissão no Firestore, é aqui que aparece.
      let write = 'ok';
      try { await getFirestore().collection('push-log').add({ tag: 'ping', ts: Date.now() }); }
      catch (e) { write = 'ERRO: ' + ((e && e.message) || String(e)); }
      res.json({ ok: true, pong: true, write });
      return;
    }
    const by = (b.by === 'grazi' || b.by === 'jussara') ? b.by : '';
    const quem = NOMES[by] || 'Seu amor';
    let data = null;
    if (b.kind === 'carta') {
      data = {
        title: '💌 Chegou uma carta de amor!',
        body: quem + ' te mandou uma carta seladinha ✦',
        tag: 'cosmo-carta',
        link: './carta-amor.html'
      };
    } else if (b.kind === 'doce') {
      const doce = (b.ico ? s(b.ico, 8) + ' ' : '') + s(b.art || 'um', 8) + ' ' + s(b.nome, 30).toLowerCase();
      data = {
        title: '🍬 Chegou um doce pra você!',
        body: quem + ' te mandou ' + doce + ' com carinho ✦',
        tag: 'cosmo-doce',
        link: './capitulo-presentes.html'
      };
    } else if (b.kind === 'foto') {
      data = {
        title: '💛 Nova foto no álbum!',
        body: (NOMES[by] || 'Alguém') + ' adicionou uma foto novinha 📸✨',
        tag: 'cosmo-photo',
        link: './'
      };
    }
    if (!data) { res.status(400).json({ ok: false }); return; }
    const log = await sendToOther(by, data);
    if (req.method === 'GET') {
      // resposta amigável pro teste no navegador
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send('<body style="background:#12102E;color:#F0DFC0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:95vh;text-align:center"><div><h1>✦ Push enviado! ✦</h1><p>enviados: ' + (log.ok || 0) + ' · falhas: ' + (log.fail || 0) + (log.result ? ' · ' + log.result : '') + '</p><p>Olhe o celular 💜</p></div></body>');
      return;
    }
    res.json({ ok: true, sent: log.ok || 0, fail: log.fail || 0, result: log.result || '' });
  } catch (e) {
    res.status(500).json({ ok: false, err: String((e && e.message) || e) });
  }
});
