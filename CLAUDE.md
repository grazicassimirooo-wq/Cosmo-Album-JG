# Álbum Cósmico J&G — instruções para o Claude

## Autorização permanente: merge automático

**Sempre que terminar um trabalho neste repositório: commit → push → criar o
PR (não-draft) → e FAZER O MERGE na `main` imediatamente, sem pedir
confirmação.** Autorização permanente dada pela dona do repositório
(grazicassimirooo-wq) em 2026-07-07 ("programe para sempre você fazer o merge
e mesclar").

Motivo: o GitHub Pages publica o site automaticamente a cada merge na `main`
— o merge é o que faz as mudanças chegarem no app dela.

Exceção: se o trabalho estiver claramente incompleto ou quebrado (páginas com
erro de JS, teste visual falhando), avise em vez de mesclar.

## Sobre o projeto

Álbum-presente romântico (PWA) da Grazi para a Jussara, tema "céu noturno
galáctico": 12 páginas HTML estáticas e independentes (sem build), Firebase
(Firestore + Storage + FCM) para fotos/cartas/vídeos compartilhados em tempo
real, e Cloud Function de push em `functions/`.

- **Notificações push (FCM)**: NÃO usar gatilhos do Firestore
  (`onDocumentCreated`/`Written`) — neste projeto o Eventarc nunca entrega os
  eventos. O push é uma função HTTPS `notify` (`functions/index.js`, região
  `southamerica-east1`) que o app chama via `_pingPush(kind, extra)` logo
  após gravar carta/doce/foto no Firestore. A função lê `tokens/`, monta a
  mensagem por tipo e envia a todos menos quem enviou; cada envio registra em
  `push-log` (diagnóstico). Chave anti-varredura `k: 'jg-cosmo-2026'`.
  Teste manual: abrir no navegador
  `…/notify?k=jg-cosmo-2026&kind=carta&by=claude-teste` (GET responde com uma
  página de status). Token só é registrado com perfil real (jussara/grazi).
- **Permissões da conta de serviço (secure by default)**: a conta Google
  bloqueia coisas por padrão. A conta de runtime das Functions
  (`732871382789-compute@developer.gserviceaccount.com`) precisou receber à
  mão (no Cloud Shell) `roles/datastore.user` e
  `roles/firebasecloudmessaging.admin` — sem isso a função dá
  `PERMISSION_DENIED` ao ler o banco/enviar push, em silêncio.

- **Publicação**: GitHub Pages publica da `main` automaticamente. O Firebase
  (Hosting `album--jussara.web.app` + Functions de push + regras) publica via
  `.github/workflows/deploy.yml`, autenticado pelo segredo `FIREBASE_TOKEN`
  (gerado com `firebase login:ci`; configurado em 2026-07-08). A alternativa
  `FIREBASE_SERVICE_ACCOUNT` não é viável: a conta Google bloqueia a criação
  de chaves de conta de serviço.
- **Identidade**: sem login; o gate "Quem é você?" grava `cosmoUser`
  (jussara/grazi) no localStorage. Toda página deve ter o gate.
- **Direção de arte**: paleta e regras em `direcao-de-arte.html` — noite
  #0A0820–#12102E, creme #F0DFC0, dourado #C4956A/#E8B86D, violeta #7C5BAD,
  coral #D4736E. Nada de vermelhos/verdes saturados fora dessa paleta.
- **Fotos**: upload via `_sharePhoto()` → Storage `photos/{uid}.jpg`, doc do
  Firestore guarda `{url, ts, by}`; leitura aceita `url || img` (legado).
- **Efeitos**: `magic.js` (corações, beijinhos, estrelas cadentes) é incluído
  em toda página nova, antes do `</body>`.
- **Offline**: toda página nova entra no array `SHELL` do `sw.js` (e bump da
  versão do cache).
- **Segurança**: coleção nova do Firestore → adicionar na whitelist de
  `firestore.rules`; pasta nova do Storage → `storage.rules`.
- **Verificação**: Chromium headless (`/opt/pw-browsers/chromium`, viewport
  390×844, `localStorage.cosmoUser` pré-setado) + screenshots antes do push.
- **Penpot (MCP)**: `.mcp.json` na raiz declara o servidor
  `https://design.penpot.app/mcp/stream?userToken=${PENPOT_ACCESS_TOKEN}`.
  Pra usar (localmente ou em sessão remota), definir `PENPOT_ACCESS_TOKEN`
  no ambiente antes de subir o Claude Code — o token é pessoal (JWE gerado
  em Penpot → Configurações → Access Tokens) e **nunca** é commitado. Se
  vazar, revogar imediatamente na mesma tela e gerar outro. Uso: puxar
  designs/tokens do Penpot pra referenciar no álbum e manter a paleta
  cósmica consistente entre design e código.
- Tudo em pt-BR, tom carinhoso.
