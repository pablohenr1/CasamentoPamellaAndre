# Mesa de Memórias — Photo Booth Digital

Photo booth digital para casamento. Os convidados escaneiam um **QR Code**, adicionam **fotos e vídeos** do próprio celular, deixam um recado, e tudo aparece numa **galeria ao vivo** com visualização **estilo stories do Instagram**. Os noivos podem baixar tudo compactado ao final.

Feito pela **Nexus Moments** · marca **Nexus PH**.

---

## ✨ O que já vem pronto

- **Envio** de foto (comprimida no navegador) ou vídeo (com **limite de duração** configurável).
- **Tags de momento** (Cerimônia, Recepção, Festa, Pista).
- **Galeria em tempo real** (atualiza sozinha via Firestore) com mural de polaroids.
- **Bandeja de recentes** + **visualizador estilo stories**: barras de progresso, auto-avanço (foto 5s / vídeo até o fim), toque para navegar, segurar para pausar e **curtir com coração**.
- **Busca** (por nome ou recado) e **filtros** (fotos, vídeos e momentos).
- **Baixar tudo (.zip)** — empacota mídias + um `recados.txt`, com trava opcional por PIN dos noivos.
- Pronto para **Vercel** (Vite) e com **regras de segurança** do Firebase inclusas.

---

## 🧱 Como funciona (arquitetura)

```
Convidado (navegador)
        │
        ▼
  Front-end (Vite + JS)  ──► Firebase Storage   (guarda as fotos/vídeos)
                          └─► Firebase Firestore (guarda nome, recado, tag, URL, likes)
        ▲
        │  galeria em tempo real (onSnapshot)
        ▼
   Galeria / Stories
```

Não há servidor próprio para manter: o **Firebase é o back-end**. O front é estático e roda no Vercel.

### Estrutura de pastas

```
photobooth-casamento/
├── index.html              # HTML da página (uma página só)
├── public/
│   └── nexus-np.png        # monograma da Nexus (favicon + rodapé)
├── src/
│   ├── main.js             # entrada: monta cabeçalho e liga os módulos
│   ├── firebase.js         # inicializa o Firebase a partir do .env
│   ├── momentsService.js   # "back-end": upload, listener realtime, curtir, download
│   ├── upload.js           # tela de envio
│   ├── gallery.js          # mural, bandeja, busca, filtros, baixar tudo
│   ├── stories.js          # visualizador estilo stories
│   ├── zip.js              # gerador de .zip em JS puro (sem dependência)
│   ├── utils.js            # utilidades (compressão, datas, nomes...)
│   └── styles.css          # todo o visual
├── .env.example            # modelo das variáveis (copie para .env)
├── firestore.rules         # regras de segurança do banco
├── storage.rules           # regras de segurança do storage
├── firebase.json           # aponta as regras para a Firebase CLI
├── vercel.json             # config de deploy no Vercel
├── vite.config.js
└── package.json
```

---

## 🚀 Passo a passo

### 0. Pré-requisitos

- **Node.js 18+** ([nodejs.org](https://nodejs.org)).
- Uma conta no **Firebase**, no **GitHub** e no **Vercel** (todas têm plano gratuito).

### 1. Rodar localmente

```bash
# na pasta do projeto
npm install
cp .env.example .env     # depois preencha o .env (passo 2)
npm run dev
```

Abra o endereço que aparecer (algo como `http://localhost:5173`).

> Enquanto o `.env` não estiver preenchido, o app abre mas o envio/galeria não funcionam (o console avisa). É só configurar o Firebase abaixo.

### 2. Criar o projeto no Firebase

1. Acesse o [Console do Firebase](https://console.firebase.google.com) → **Adicionar projeto**.
2. Dentro do projeto, crie um **App da Web** (ícone `</>`). Dê um apelido e finalize.
3. Copie o objeto **`firebaseConfig`** que aparece e preencha o seu **`.env`** (baseado no `.env.example`):

   | firebaseConfig      | variável no .env                  |
   | ------------------- | --------------------------------- |
   | `apiKey`            | `VITE_FIREBASE_API_KEY`           |
   | `authDomain`        | `VITE_FIREBASE_AUTH_DOMAIN`       |
   | `projectId`         | `VITE_FIREBASE_PROJECT_ID`        |
   | `storageBucket`     | `VITE_FIREBASE_STORAGE_BUCKET`    |
   | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId`             | `VITE_FIREBASE_APP_ID`            |

4. No menu lateral, ative:
   - **Build → Firestore Database** → *Criar banco de dados* (comece em modo produção; as regras deste projeto cuidam do acesso).
   - **Build → Storage** → *Começar*.

> As chaves do `firebaseConfig` **não são secretas** — todo app Firebase as expõe no front-end. Quem protege os dados são as **regras** (passo 3).

### 3. Publicar as regras de segurança

As regras já estão nos arquivos `firestore.rules` e `storage.rules`. Você pode publicá-las de duas formas:

**Opção A — copiar e colar (rápido):**
No Console do Firebase, abra **Firestore → Regras**, cole o conteúdo de `firestore.rules` e publique. Faça o mesmo em **Storage → Regras** com `storage.rules`.

**Opção B — pela Firebase CLI:**

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # selecione seu projeto
firebase deploy --only firestore:rules,storage:rules
```

### 4. Liberar o domínio no Storage (CORS)

Para o **"Baixar tudo (.zip)"** funcionar (ele lê os arquivos do Storage via `fetch`), o navegador precisa de CORS liberado. Crie um arquivo `cors.json`:

```json
[{ "origin": ["*"], "method": ["GET"], "maxAgeSeconds": 3600 }]
```

E aplique com a Google Cloud CLI (`gcloud`) ou `gsutil`:

```bash
gsutil cors set cors.json gs://SEU-BUCKET.appspot.com
```

> Se preferir, restrinja `origin` ao seu domínio do Vercel em vez de `*`.

### 5. Subir no GitHub

```bash
git init
git add .
git commit -m "Mesa de Memórias — versão inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/photobooth-casamento.git
git push -u origin main
```

> O `.gitignore` já impede que o `.env` e a `node_modules/` subam. **Nunca** comite o `.env`.

### 6. Deploy no Vercel

1. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório do GitHub.
2. O Vercel detecta **Vite** sozinho (build `npm run build`, saída `dist`).
3. Em **Settings → Environment Variables**, cadastre **as mesmas variáveis do seu `.env`** (as `VITE_...`).
4. Clique em **Deploy**. Ao terminar, você recebe uma URL pública (ex: `https://mesa-de-memorias.vercel.app`).

### 7. Gerar o QR Code

Aponte um gerador de QR Code (ex: o próprio Google, ou qrcode-monkey) para a **URL do Vercel**. Imprima nos cartõezinhos das mesas. Pronto! 🎉

---

## ⚙️ Personalização rápida (no `.env`)

| Variável                | Para quê                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `VITE_NOIVOS`           | Nome dos noivos que aparece no topo e no título.               |
| `VITE_DATA_CASAMENTO`   | Data do casamento (uso livre / futuras telas).                 |
| `VITE_VIDEO_MAX_SECONDS`| Limite de duração dos vídeos (ex.: `15` ou `30`).              |
| `VITE_ADMIN_PIN`        | PIN pedido antes de "Baixar tudo". Deixe vazio para não pedir. |

Para trocar as **tags de momento**, edite os botões em `index.html` (blocos `#tagPicker` e `#filterRow`).

---

## 💡 Notas de produção

- **Vídeos pesados:** o limite de duração já ajuda bastante. Para eventos muito grandes, o ideal futuro é gerar miniaturas e servir vídeo por streaming. Aqui a galeria já usa a URL direta do Storage (com cache do navegador).
- **"Baixar tudo" com muitas mídias:** o zip é montado no navegador. Para centenas de itens em alta, considere gerar o zip no servidor (Cloud Function). Para volumes de um casamento típico, funciona bem.
- **Curtidas:** são salvas no campo `likes` de cada momento (via incremento). O estado "eu curti" é local ao aparelho — sem login, não há como saber quem curtiu, o que é adequado para um evento.
- **Moderação:** se quiser aprovar fotos antes de aparecerem no telão, dá para adicionar um campo `approved` e filtrar. Posso montar isso quando quiser.

---

## 🛠️ Scripts

| Comando           | O que faz                                  |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | Servidor de desenvolvimento (hot reload).  |
| `npm run build`   | Gera a versão de produção em `dist/`.      |
| `npm run preview` | Prévia local do build de produção.         |

---

Feito com carinho pela **Nexus PH · Nexus Moments**.
