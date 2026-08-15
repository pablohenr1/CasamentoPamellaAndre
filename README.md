# Mesa de Memórias — Photo Booth Digital

Photo booth digital para casamento. Os convidados escaneiam um **QR Code**, adicionam **fotos e vídeos** do próprio celular, deixam um recado, e tudo aparece numa **galeria ao vivo** com visualização **estilo stories do Instagram**. Os noivos podem baixar tudo compactado ao final.

Feito pela **Nexus Moments** · marca **Nexus PH**.

---

## ✨ O que já vem pronto

- **Envio** de foto (comprimida no navegador) ou vídeo (com **limite de duração** configurável).
- **Corte de vídeo dentro do app**: se o vídeo passar do limite, o convidado arrasta um controle pra escolher o trecho que quer usar — o servidor corta de verdade (com `ffmpeg`) antes de guardar; só o trecho escolhido fica salvo.
- **Tags de momento** (Cerimônia, Recepção, Festa, Pista).
- **Galeria ao vivo** (atualiza sozinha por polling a cada poucos segundos) com mural de polaroids.
- **Bandeja de recentes** + **visualizador estilo stories**: barras de progresso, auto-avanço (foto 5s / vídeo até o fim), toque para navegar, segurar para pausar e **curtir com coração**.
- **Busca** (por nome ou recado) e **filtros** (fotos, vídeos e momentos).
- **Baixar tudo (.zip)** — empacota mídias + um `recados.txt`, com trava opcional por PIN dos noivos.
- Pronto para **Vercel**, com **Firestore** (metadados) e **Cloudflare R2** (fotos/vídeos) como back-end.

---

## 🧱 Como funciona (arquitetura)

```
Convidado (navegador)
        │
        ▼
  Front-end (Vite + JS)  ──►  /api/presign-upload  ──►  Cloudflare R2
        │                                                (guarda fotos/vídeos)
        │
        └──────────────────►  /api/moments (GET/POST)  ──►  Firestore
                               /api/moments/:id/like        (guarda nome, recado,
                               (corta vídeo com ffmpeg        tag, url, likes)
                               quando precisa)
        ▲
        │  galeria atualiza por polling
        ▼
   Galeria / Stories
```

O navegador **nunca** fala direto com o Firestore ou com o R2 — tudo passa pelas *serverless functions* em `/api`, que guardam as credenciais de verdade (chave do Firebase Admin, chaves do R2). Assim nenhuma chave sensível aparece no código que roda no navegador. É por isso que:

- As regras do Firestore (`firestore.rules`) negam tudo — é o Admin SDK (via `/api`) quem manda, as regras são só uma segunda trava.
- Um "ticket" assinado garante que só quem realmente subiu um arquivo pro R2 (via `/api/presign-upload`) pode usá-lo pra criar ou cortar um momento — sem isso, a `storagePath` de um convidado poderia ser reaproveitada por outro.

### Estrutura de pastas

```
photobooth-casamento/
├── index.html                 # HTML da página (uma página só)
├── public/
│   └── nexus-np.png           # monograma da Nexus (favicon + rodapé)
├── src/
│   ├── main.js                # entrada: monta cabeçalho e liga os módulos
│   ├── config.js              # config do evento a partir do .env (só VITE_*)
│   ├── momentsService.js       # fala com /api: upload, listener, curtir, download
│   ├── upload.js               # tela de envio + editor de corte de vídeo
│   ├── gallery.js              # mural, bandeja, busca, filtros, baixar tudo
│   ├── stories.js               # visualizador estilo stories
│   ├── zip.js                  # gerador de .zip em JS puro (sem dependência)
│   ├── utils.js                # utilidades (compressão, datas, nomes...)
│   └── styles.css              # todo o visual
├── api/
│   ├── _firebaseAdmin.js       # inicializa o Firebase Admin SDK (server-only)
│   ├── _r2.js                  # cliente do Cloudflare R2 (server-only)
│   ├── _uploadTicket.js        # assina/confere o "ticket" de upload
│   ├── _trimVideo.js           # corta o vídeo no servidor (ffmpeg)
│   ├── presign-upload.js       # POST → URL assinada pra subir mídia no R2
│   ├── moments.js              # GET lista / POST cria um momento
│   └── moments/[id]/like.js    # POST curtir/descurtir
├── .env.example                # modelo das variáveis (copie para .env)
├── firestore.rules             # regras do Firestore (nega tudo — 2ª trava)
├── firebase.json               # aponta as regras pra Firebase CLI
├── r2-cors.json                # modelo de CORS do bucket R2
├── vercel.json                 # config de deploy + limites da function de moments
├── vite.config.js
└── package.json
```

---

## 🚀 Passo a passo

### 0. Pré-requisitos

- **Node.js 18+** ([nodejs.org](https://nodejs.org)).
- Conta no **Firebase**, no **Cloudflare** (R2), no **GitHub** e no **Vercel** (todas têm plano gratuito).

### 1. Criar o projeto no Firebase (só o Firestore, como banco)

1. Acesse o [Console do Firebase](https://console.firebase.google.com) → **Adicionar projeto**.
2. Ative **Build → Firestore Database** → *Criar banco de dados* (pode ser em modo produção — quem controla o acesso é o Admin SDK via `/api`, não as regras do cliente).
3. Gere a chave de serviço: ⚙️ **Configurações do projeto → Contas de serviço → Gerar nova chave privada** — baixa um `.json`.
4. Desse `.json`, preencha no seu `.env` (baseado no `.env.example`):

   | campo do `.json` | variável no `.env`      |
   | ----------------- | ------------------------ |
   | `project_id`       | `FIREBASE_PROJECT_ID`     |
   | `client_email`     | `FIREBASE_CLIENT_EMAIL`   |
   | `private_key`      | `FIREBASE_PRIVATE_KEY` (mantenha as `\n` literais, entre aspas) |

> Apague o `.json` baixado depois de preencher o `.env` — ele tem a chave privada completa e não precisa ficar solto no disco. **Nunca** comite o `.env` nem esse `.json` (o `.gitignore` já protege o `.env`).

### 2. Criar o bucket no Cloudflare R2 (fotos e vídeos)

1. No painel da Cloudflare → **R2** → crie um bucket (ex: `mesa-de-memorias`).
2. Ative o acesso público do bucket (ou configure um domínio customizado) pra conseguir a **URL pública** (`https://pub-xxxx.r2.dev` ou seu domínio).
3. Em **Manage API Tokens**, crie um token com permissão de leitura/escrita nesse bucket.
4. Preencha no `.env`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`.
5. Aplique o CORS do bucket (necessário pro navegador subir o arquivo direto pela URL assinada e pro "Baixar tudo" funcionar). O modelo já está em `r2-cors.json` — aplique pelo painel da Cloudflare (R2 → seu bucket → Settings → CORS Policy → cole o conteúdo do arquivo) ou via `wrangler`:

   ```bash
   npx wrangler r2 bucket cors put SEU-BUCKET --rules r2-cors.json
   # (confira a sintaxe atual com `npx wrangler r2 bucket cors --help`,
   #  pode variar entre versões do wrangler)
   ```

   > O arquivo libera `origin: ["*"]` por padrão — se quiser, restrinja ao seu domínio do Vercel.

### 3. Gerar o segredo interno do ticket de upload

Esse valor não vem de nenhum provedor externo — é só um segredo aleatório usado internamente pra garantir que ninguém reaproveite o arquivo de upload de outra pessoa. Gere um e cole em `UPLOAD_TICKET_SECRET` no `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Rodar localmente

Como o app depende das *functions* em `/api` (Firestore + R2 + corte de vídeo), rodar só `npm run dev` (Vite puro) não é suficiente pra testar o envio — o Vite sozinho não sabe servir `/api/*`. Use o CLI da Vercel:

```bash
npm install
cp .env.example .env        # preencha com o que fez nos passos 1–3
npm install -g vercel        # ou use "npx vercel"
vercel login
vercel link                  # cria/associa um projeto Vercel (pode ser --yes)
vercel dev                   # sobe front-end + /api juntos, lendo o .env local
```

Abra o endereço que aparecer (por padrão `http://localhost:3000`). Se só quiser mexer em CSS/HTML sem testar upload, `npm run dev` (Vite) também funciona e é mais rápido de subir.

### 5. Publicar as regras do Firestore

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # selecione seu projeto
firebase deploy --only firestore:rules
```

Ou copie e cole o conteúdo de `firestore.rules` direto em **Firestore → Regras** no Console do Firebase.

### 6. Subir no GitHub

```bash
git init
git add .
git commit -m "Mesa de Memórias — versão inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/photobooth-casamento.git
git push -u origin main
```

> O `.gitignore` já impede que `.env`, `.vercel/` e `node_modules/` subam. **Nunca** comite essas coisas.

### 7. Deploy no Vercel

1. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório do GitHub (ou continue com o projeto que o `vercel link` já criou).
2. O Vercel detecta **Vite** sozinho (build `npm run build`, saída `dist`).
3. Em **Settings → Environment Variables**, cadastre **todas** as variáveis do seu `.env` — `FIREBASE_*`, `R2_*`, `UPLOAD_TICKET_SECRET` e as `VITE_*`. Sem isso, `/api/moments` quebra em produção do mesmo jeito que quebra localmente sem o `.env`.
4. Clique em **Deploy**. Ao terminar, você recebe uma URL pública (ex: `https://mesa-de-memorias.vercel.app`).

### 8. Gerar o QR Code

Aponte um gerador de QR Code (ex: o próprio Google, ou qrcode-monkey) para a **URL do Vercel**. Imprima nos cartõezinhos das mesas. Pronto! 🎉

---

## ⚙️ Personalização rápida (no `.env`)

| Variável                 | Para quê                                                        |
| ------------------------ | ---------------------------------------------------------------- |
| `VITE_NOIVOS`             | Nome dos noivos que aparece no topo e no título.                 |
| `VITE_DATA_CASAMENTO`     | Data do casamento (uso livre / futuras telas).                   |
| `VITE_VIDEO_MAX_SECONDS`  | Limite de duração dos vídeos (ex.: `15` ou `30`). Vídeos mais longos abrem o editor de corte. |
| `VITE_ADMIN_PIN`          | PIN pedido antes de "Baixar tudo". Deixe vazio para não pedir.   |

Para trocar as **tags de momento**, edite os botões em `index.html` (blocos `#tagPicker` e `#filterRow`).

> `VITE_ADMIN_PIN` é uma trava **leve, só de interface** — como toda variável `VITE_*`, ela fica visível em texto no JavaScript que roda no navegador (é assim que o Vite funciona: só o que tem prefixo `VITE_` vai pro bundle, e vai mesmo, sem criptografia). Não é pensada pra proteger nada sensível, só evitar cliques por engano. As credenciais de verdade (Firebase, R2, o ticket de upload) **nunca** levam `VITE_` e só existem no servidor.

---

## 💡 Notas de produção

- **Corte de vídeo:** quando o vídeo passa do limite, o app sobe o arquivo inteiro pro R2 e o servidor corta com `ffmpeg` (recodificando, pra garantir precisão), sobe só o trecho, e apaga o original. Isso significa que o vídeo inteiro ainda trafega pela internet do convidado no envio — só não fica guardado depois. A function de `/api/moments` tem até 60s e 1GB de memória reservados pra isso (`vercel.json`); clipes muito longos ou conexões muito lentas podem esbarrar nesse teto.
- **Nenhuma rota tem limite de requisições (rate limit).** Pra um evento fechado via QR Code o risco é baixo, mas nada impede alguém de martelar `/api/presign-upload` ou `/api/moments`. Se for um evento grande/público, vale considerar um rate limit (ex: Vercel Firewall).
- **"Baixar tudo" com muitas mídias:** o zip é montado no navegador. Para centenas de itens em alta, considere gerar o zip no servidor. Para volumes de um casamento típico, funciona bem.
- **Curtidas:** são salvas no campo `likes` de cada momento (via transação, incremento controlado). O estado "eu curti" é local ao aparelho — sem login, não há como saber quem curtiu, o que é adequado para um evento.
- **Moderação:** se quiser aprovar fotos antes de aparecerem no telão, dá para adicionar um campo `approved` e filtrar em `/api/moments`. Posso montar isso quando quiser.

---

## 🛠️ Scripts

| Comando           | O que faz                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `npm run dev`      | Servidor de desenvolvimento só do front-end (hot reload, sem `/api`). |
| `vercel dev`       | Front-end + `/api` juntos, pra testar o app completo localmente.   |
| `npm run build`    | Gera a versão de produção em `dist/`.                              |
| `npm run preview`  | Prévia local do build de produção (sem `/api`).                    |

---

Feito com carinho pela **Nexus PH · Nexus Moments**.
