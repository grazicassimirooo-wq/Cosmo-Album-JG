/* Cloud Function de push (FCM): o app chama `notify` via HTTPS logo depois de
   gravar QUALQUER interação no Firestore (carta, doce, foto, vídeo, toque,
   ato de serviço, presença, reação, lugar, quiz, pedido de doce…) e todos os
   aparelhos cadastrados recebem a notificação — menos o de quem enviou.

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

  const tokensSnap = await db.collection('tokens').get();
  const targets = [];
  const seen = new Set(); // mesmo token pode estar em dois docs (migração usuária → aparelho)
  tokensSnap.forEach((doc) => {
    const t = doc.data();
    if (t && t.token && t.client !== by && !seen.has(t.token)) {
      seen.add(t.token);
      targets.push({ id: doc.id, token: t.token });
    }
  });
  if (!targets.length) return;

  const res = await getMessaging().sendEachForMulticast({
    tokens: targets.map((t) => t.token),
    data: {
      title: '💛 Nova foto no álbum!',
      body: 'Alguém adicionou uma foto novinha 📸✨'
    },
    webpush: { headers: { Urgency: 'high' }, fcmOptions: { link: '/' } }
  });

  // Limpa tokens que não valem mais (aparelho desinstalou / permissão revogada)
  const deletions = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-argument') {
        deletions.push(db.collection('tokens').doc(targets[i].id).delete());
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

/* páginas que uma notificação pode abrir (whitelist — o cliente manda `pg`) */
const PAGES = {
  album: './', cap1: './#cap1', cartas: './carta-amor.html',
  toque: './capitulo3-toque.html', servico: './capitulo4-servico.html',
  tempo: './capitulo5-tempo.html', presentes: './capitulo-presentes.html',
  quiz: './quiz-linguagem.html', galeria: './memory-gallery.html'
};
const pgLink = (b, padrao) => PAGES[b.pg] || padrao || './';

/* mensagens por tipo de interação — estilo mensageiro: quem fez + o quê */
const TOQUES = {
  abraco: { e: '🤗', faz: 'está te abraçando agora',       ret: 'retribuiu seu abraço — aperta mais ♡' },
  beijo:  { e: '💋', faz: 'te mandou um beijo',            ret: 'retribuiu seu beijo ♡' },
  colo:   { e: '🌙', faz: 'está com você no colo',         ret: 'retribuiu o colo ♡' },
  cabelo: { e: '✦',  faz: 'está fazendo cafuné em você',   ret: 'retribuiu o cafuné ♡' }
};
const SERVICOS = {
  cuidei:    { e: '🌿', faz: 'cuidou de você agora' },
  resolvi:   { e: '⚡', faz: 'resolveu algo por você' },
  preparei:  { e: '🍽️', faz: 'preparou algo especial pra você' },
  organizei: { e: '📋', faz: 'organizou tudo pra você' },
  reconheci: { e: '💛', faz: 'reconheceu seu gesto de amor ♡' }
};
const PRESENCAS = {
  cafe:     'está tomando um café pensando em você',
  filme:    'quer assistir um filme com você agora',
  passeio:  'está passeando e imaginando você do lado',
  silencio: 'está em silêncio, mas pensando em você'
};

/* Monta título/corpo/link da notificação a partir do que o app mandou.
   Qualquer `kind` desconhecido vira o aviso genérico — assim TODA interação
   nova já chega no outro aparelho, mesmo antes de ganhar mensagem própria. */
function buildData(b, quem) {
  const kind = s(b.kind, 24);
  if (kind === 'carta') {
    return { title: '💌 Chegou uma carta de amor!', body: quem + ' te mandou uma carta seladinha ✦', tag: 'cosmo-carta', link: './carta-amor.html' };
  }
  if (kind === 'doce') {
    const doce = (b.ico ? s(b.ico, 8) + ' ' : '') + s(b.art || 'um', 8) + ' ' + s(b.nome, 30).toLowerCase();
    return { title: '🍬 Chegou um doce pra você!', body: quem + ' te mandou ' + doce + ' com carinho ✦', tag: 'cosmo-doce', link: './capitulo-presentes.html' };
  }
  if (kind === 'foto') {
    return { title: '💛 Nova foto no álbum!', body: quem + ' adicionou uma foto novinha 📸✨', tag: 'cosmo-photo', link: pgLink(b) };
  }
  if (kind === 'video') {
    return { title: '🎥 Chegou um vídeo pra você!', body: quem + ' te mandou um vídeo novinho — toca pra ver ✦', tag: 'cosmo-video', link: pgLink(b) };
  }
  if (kind === 'toque') {
    const t = TOQUES[b.mode] || { e: '🫂', faz: 'te mandou um toque de carinho', ret: 'retribuiu seu carinho ♡' };
    return { title: t.e + ' Toque a distância!', body: quem + ' ' + (b.retrib ? t.ret : t.faz), tag: 'cosmo-toque', link: './capitulo3-toque.html' };
  }
  if (kind === 'servico') {
    const sv = SERVICOS[b.mode] || { e: '🌿', faz: 'fez um ato de amor por você' };
    return { title: sv.e + ' Ato de amor!', body: quem + ' ' + sv.faz, tag: 'cosmo-servico', link: './capitulo4-servico.html' };
  }
  if (kind === 'presenca') {
    const body = b.retrib ? quem + ' sentiu sua presença e retribuiu ♡'
      : quem + ' ' + (PRESENCAS[b.mode] || 'está pensando em você agora');
    return { title: '🌿 Pensando em você', body, tag: 'cosmo-presenca', link: './capitulo5-tempo.html' };
  }
  if (kind === 'reacao') {
    return { title: '💬 Nova reação!', body: quem + ' reagiu com ' + (s(b.emoji, 8) || '💛') + ' no caderno do tempo', tag: 'cosmo-reacao', link: './capitulo5-tempo.html' };
  }
  if (kind === 'lugar') {
    const nome = s(b.nome, 40);
    return { title: '📍 Lugar novo no mapa!', body: quem + ' marcou ' + (s(b.emoji, 8) || '✦') + ' "' + (nome || 'um lugar') + '" nos lugares de vocês', tag: 'cosmo-lugar', link: './capitulo5-tempo.html' };
  }
  if (kind === 'quiz') {
    return { title: '💘 Quiz respondido!', body: quem + ' descobriu a linguagem do amor dela — vai ver o resultado ✦', tag: 'cosmo-quiz', link: './quiz-linguagem.html' };
  }
  if (kind === 'pedido') {
    return { title: '🍬 Me manda um doce aqui!', body: quem + ' compartilhou onde está, esperando um docinho 📍♡', tag: 'cosmo-pedido', link: './capitulo-presentes.html' };
  }
  if (!kind) return null;
  return { title: '💛 Novidade no álbum!', body: quem + ' acabou de fazer algo novo pra você ✦', tag: 'cosmo-novidade', link: pgLink(b) };
}

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

    // Push de teste — envia SÓ pro próprio cliente que pediu (self-test).
    // Usado pelo botão "verificar minhas notificações" no perfil.
    if (b.kind === 'teste-eu') {
      if (!by) { res.json({ ok: false, err: 'perfil não escolhido' }); return; }
      const db = getFirestore();
      let tokenDoc = null;
      try { tokenDoc = await db.collection('tokens').doc(by).get(); }
      catch (e) { res.json({ ok: false, err: 'falha ao ler tokens: ' + (e.message || e) }); return; }
      if (!tokenDoc.exists || !(tokenDoc.data() || {}).token) {
        res.json({ ok: false, err: 'sem-token', hint: 'este aparelho ainda não está registrado — permita as notificações e tente de novo' });
        return;
      }
      try {
        await getMessaging().send({
          token: tokenDoc.data().token,
          data: {
            title: '🔔 Notificação de teste',
            body: 'Seu álbum está pronto para receber cartas, doces e fotos ✦',
            tag: 'cosmo-teste', link: './'
          },
          webpush: {
            headers: { Urgency: 'high' },
            notification: { title: '🔔 Notificação de teste', body: 'Seu álbum está pronto para receber cartas, doces e fotos ✦', icon: BASE + 'icon-192.png', badge: BASE + 'icon-192.png', tag: 'cosmo-teste', renotify: true },
            fcmOptions: { link: BASE }
          }
        });
        res.json({ ok: true, sent: 1 });
      } catch (e) {
        const code = (e && e.errorInfo && e.errorInfo.code) || (e && e.code) || 'erro';
        res.json({ ok: false, err: 'envio-falhou', code });
      }
      return;
    }

    const data = buildData(b, quem);
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
