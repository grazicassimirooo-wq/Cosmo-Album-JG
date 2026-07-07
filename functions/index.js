/* Cloud Function: ao entrar uma foto nova no Firestore, envia push (FCM)
   para todos os aparelhos cadastrados, menos o de quem subiu a foto. */
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
setGlobalOptions({ maxInstances: 3 });

exports.notifyNewPhoto = onDocumentWritten('photos/{id}', async (event) => {
  const snap = event.data && event.data.after;
  const after = snap && snap.exists ? snap.data() : null;
  if (!after || !(after.img || after.url)) return;

  const by = after.by || '';
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
    }
  });
  await Promise.all(deletions);
});
