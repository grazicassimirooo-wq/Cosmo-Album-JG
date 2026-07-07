/* Cloud Functions: quando entra uma foto, carta ou doce novo no Firestore,
   envia push (FCM) para todos os aparelhos cadastrados, menos o de quem enviou. */
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
setGlobalOptions({ maxInstances: 3 });

const NOMES = { grazi: 'A Grazi', jussara: 'A Jussara' };

/* Envia o push para todos os tokens, exceto o de quem enviou (`by`).
   `data` precisa ser só strings (exigência do FCM). */
async function sendToOther(by, data) {
  const db = getFirestore();
  const tokensSnap = await db.collection('tokens').get();
  const targets = [];
  tokensSnap.forEach((doc) => {
    const t = doc.data();
    if (t && t.token && t.client !== by) targets.push({ id: doc.id, token: t.token });
  });
  if (!targets.length) return;

  const res = await getMessaging().sendEachForMulticast({
    tokens: targets.map((t) => t.token),
    data,
    webpush: { headers: { Urgency: 'high' }, fcmOptions: { link: data.link || '/' } }
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
    }
  });
  await Promise.all(deletions);
}

exports.notifyNewPhoto = onDocumentWritten('photos/{id}', async (event) => {
  const snap = event.data && event.data.after;
  const after = snap && snap.exists ? snap.data() : null;
  if (!after || !(after.img || after.url)) return;
  const quem = NOMES[after.by] || 'Alguém';
  await sendToOther(after.by || '', {
    title: '💛 Nova foto no álbum!',
    body: quem + ' adicionou uma foto novinha 📸✨',
    tag: 'cosmo-photo',
    link: './'
  });
});

exports.notifyNewLetter = onDocumentCreated('letters/{id}', async (event) => {
  const d = event.data && event.data.data();
  if (!d || !d.body) return;
  const quem = NOMES[d.by] || 'Seu amor';
  await sendToOther(d.by || '', {
    title: '💌 Chegou uma carta de amor!',
    body: quem + ' te mandou uma carta seladinha ✦',
    tag: 'cosmo-carta',
    link: './carta-amor.html'
  });
});

exports.notifyNewDoce = onDocumentCreated('doces/{id}', async (event) => {
  const d = event.data && event.data.data();
  if (!d || !d.nome) return;
  const quem = NOMES[d.by] || 'Seu amor';
  const doce = (d.ico ? d.ico + ' ' : '') + (d.art || 'um') + ' ' + String(d.nome).toLowerCase();
  await sendToOther(d.by || '', {
    title: '🍬 Chegou um doce pra você!',
    body: quem + ' te mandou ' + doce + ' com carinho ✦',
    tag: 'cosmo-doce',
    link: './capitulo-presentes.html'
  });
});
