<div align="center">

# WhatsApp Multi-Device Controller

**Self-hosted WhatsApp panel — link numbers with a pairing code, watch chats in realtime, send text / images / video / documents / voice notes.**

Next.js 14 (App Router) · Baileys · Socket.io · Prisma · Tailwind CSS · shadcn/ui · Docker

One repository · one Node process · **one Railway service**

</div>

---

## ✨ Features

| | |
|---|---|
| 🔗 **Pairing-code login** | Enter a phone number → get an 8-character code → type it on the phone. No QR scanning required (a QR fallback is shown automatically when available). |
| 🧩 **Multi-session** | Link and manage several numbers at once. Each session owns its auth state, socket, reconnect backoff and stats. |
| ⚡ **Realtime everything** | Incoming **and** outgoing messages, delivery/read ticks, status changes, unread counters and chat list order stream over Socket.io — no refresh button needed. |
| 💬 **Full chat UI** | Chat list with search, pinned chats, unread badges, day separators, group sender names, typing presence, read receipts, mark-as-read / pin / archive. |
| 📎 **Media** | Send & receive images, videos, documents, stickers and **voice notes** (browser recording is transcoded to OGG/Opus with ffmpeg). Click any image/video for a full-screen lightbox. |
| 🔄 **Auto reconnect** | Exponential backoff on network drops, immediate reconnect after the pairing flow (WhatsApp `515`), session restore on boot, `loggedOut` detection. |
| 🎨 **Modern dark UI** | Glassmorphism + WhatsApp-green gradient, responsive from phone to desktop, toasts, skeletons and loading states everywhere. |
| 🗄️ **SQLite ⇄ PostgreSQL** | SQLite for zero-config local development, PostgreSQL on Railway — the same Prisma schema, switched automatically. |
| 🐳 **Deploy ready** | Multi-stage Dockerfile (with ffmpeg), Railway config, health endpoint and volume-aware session storage. |

---

## 🧱 Tech stack

- **Framework** — Next.js `14.2` App Router + TypeScript (strict)
- **WhatsApp** — [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) `6.7.x`
- **Realtime** — Socket.io `4` server (attached to the custom HTTP server) + Socket.io client in the browser
- **Database** — Prisma ORM `6` → SQLite (local) / PostgreSQL (Railway)
- **UI** — Tailwind CSS `3`, shadcn/ui-style primitives (Radix), `lucide-react`, `sonner`, `swr`, `qrcode`

---

## 🏗️ Architecture — why one service is enough

```
                     ┌──────────────────────────────────────────────┐
  Browser  ⇄  HTTP   │  server.ts  (custom Node HTTP server)        │
  Browser  ⇄  WS     │   ├─ Next.js App Router  (pages + API)       │
                     │   ├─ Socket.io  (path /api/socket/io)        │
                     │   └─ SessionManager  ──► Baileys sockets ──► WhatsApp
                     │         │                                    │
                     │         └─ Prisma ──► SQLite / PostgreSQL    │
                     │         └─ ./data/auth (creds) + ./data/media│
                     └──────────────────────────────────────────────┘
                              ▲ one Railway service, one volume
```

Key implementation details:

1. **`server.ts`** creates the HTTP server, plugs Next.js into it and attaches Socket.io, because Next's built-in server does not expose the websocket upgrade. `npm run dev` and `npm start` both run this file through `tsx`.
2. **Process-wide singletons live on `globalThis`** (`lib/prisma.ts`, `lib/socket-server.ts`, `lib/baileys/session-manager.ts`). Route handlers are bundled by Next into a different module graph than `server.ts`, so a normal module singleton would be duplicated — `globalThis` guarantees the API routes and the socket gateway talk to the **same** Baileys sockets and the same Socket.io server.
3. **Baileys sockets are created and kept in the server process.** API routes only *command* the manager (`connect`, `pairing-code`, `logout`, `send`) and read the database.
4. **Chats you have open are tracked through Socket.io rooms** (`chat:<chatId>`). If a chat is on screen the server skips the unread counter and fires the read receipt immediately.

---

## 📁 Project structure

```
.
├── app/
│   ├── api/                        # all route handlers (REST)
│   │   ├── chats/[chatId]/         #   chat info, messages (GET/POST), media upload
│   │   ├── media/                  #   streams stored media files
│   │   ├── sessions/               #   CRUD + pairing-code/connect/disconnect/logout
│   │   ├── stats/ · health/
│   ├── (pages)/
│   │   ├── chat/[sessionId]/       # chat workspace (list + conversation + composer)
│   │   ├── docs/                   # in-app setup & deploy guide
│   │   └── pair/                   # pairing-code page
│   ├── layout.tsx                  # shell: sidebar + mobile nav + providers
│   ├── page.tsx                    # dashboard
│   └── globals.css
├── components/
│   ├── chat/                       # chat-list, conversation, bubbles, composer, player
│   ├── dashboard/                  # stats-cards, session-card, add-session-dialog
│   ├── layout/app-shell.tsx
│   └── ui/                         # button, card, badge, input, dialog, dropdown, …
├── hooks/                          # use-socket (Socket.io context), use-api (SWR)
├── lib/
│   ├── baileys/
│   │   ├── session-manager.ts      # sockets, pairing, reconnect, send/receive, rooms
│   │   ├── persistence.ts          # message parsing + DTO mappers + chat upserts
│   │   ├── auth-state.ts           # multi-file auth state helpers
│   │   ├── media.ts                # media download → ./data/media
│   │   ├── transcode.ts            # ffmpeg → OGG/Opus voice notes
│   │   └── paths.ts                # storage layout + path-traversal guard
│   ├── prisma.ts · socket-server.ts · api.ts · fetcher.ts · types.ts · utils.ts
│   └── logger.ts
├── prisma/schema.prisma
├── scripts/prepare-db.mjs          # switches sqlite ⇄ postgresql, creates .env
├── scripts/make-zip.mjs            # clean zip for sharing
├── server.ts                       # custom server: Next + Socket.io + Baileys
├── Dockerfile · railway.json · nixpacks.toml
└── .env.example
```

---

## 🚀 Run locally

Requirements: **Node.js ≥ 20** (Baileys requires it) and npm.

```bash
# 1. install (also creates .env from .env.example + generates the Prisma client)
npm install

# 2. create/refresh the SQLite database
npm run db:push

# 3. start the dev server (Next + Socket.io + Baileys in one process)
npm run dev
```

Open **http://localhost:3000** → *Add New Number* → *Generate Pairing Code* → type the code on your phone.

> `npm run dev` starts the **custom server** (`tsx watch server.ts`), not `next dev`, because the app needs Socket.io and Baileys in the same process. HMR still works.

Useful scripts:

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (Next + Socket.io + Baileys) |
| `npm run build` | `prisma generate` + `next build` |
| `npm start` | Production: `prisma db push` + custom server (what Railway runs) |
| `npm run db:push` | Sync Prisma schema to the database |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run zip` | Build a clean ZIP (no node_modules/.next/.env/data) |

Installing **ffmpeg** locally (`apt install ffmpeg`, `brew install ffmpeg`) enables true voice notes; without it recordings are still delivered as audio files.

---

## 🔐 Environment variables

Copy `.env.example` → `.env`. Nothing is required locally (sensible defaults), everything is documented:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | `file:...` → SQLite, `postgresql://...` → PostgreSQL (provider auto-switch) |
| `PORT` | `3000` | HTTP port (Railway injects it) |
| `HOSTNAME` | `0.0.0.0` | Bind address — keep `0.0.0.0` for containers |
| `WA_AUTH_DIR` | `./data/auth` | Baileys credential files (one folder per session) |
| `WA_MEDIA_DIR` | `./data/media` | Downloaded + sent media files |
| `WA_AUTO_RESTORE` | `true` | Reconnect stored sessions automatically on boot |
| `WA_MAX_UPLOAD_MB` | `64` | Max upload size for outgoing media |
| `WA_MAX_MEDIA_MB` | `64` | Skip downloading incoming media above this size |
| `LOG_LEVEL` | `info` | `trace`…`silent` |
| `SOCKET_PATH` | `/api/socket/io` | Socket.io endpoint path |
| `FFMPEG_PATH` | `ffmpeg` | Custom ffmpeg binary path |

`prisma/schema.prisma` is rewritten on every `install`/`build`/`start` by `scripts/prepare-db.mjs`: it flips `provider` between `sqlite` and `postgresql` based on `DATABASE_URL`, so you never edit it by hand.

---

## 📲 Pairing flow

1. **Dashboard → Add New Number** — enter the number in international format (`6281234567890`; a leading `0` is converted to `62` for Indonesian numbers, and `+`, spaces and dashes are stripped).
2. **Generate Pairing Code** — Baileys opens an unregistered socket and WhatsApp returns an 8-character code (shown as `ABCD-1234`, valid ±3 minutes, countdown in the UI, one-tap copy).
3. **On the phone:** WhatsApp → **Settings → Linked devices → Link a device → Link with phone number instead** → type the code.
4. WhatsApp closes the socket with `restartRequired (515)`; the panel reconnects instantly with the new credentials → the badge flips to **Connected** and the dashboard/chat UI update in realtime.

If WhatsApp returns a QR instead (shown automatically on the pairing page), you can scan it — both flows end in the same connected session.

---

## ☁️ Deploy to Railway (step by step)

The repository is ready to deploy: `railway.json` selects the **Dockerfile** builder, `npm start` runs `prisma db push` and boots the single service.

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "feat: WhatsApp multi-device controller (Next.js + Baileys + Socket.io)"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 2. Create the Railway project

1. Go to **[railway.app](https://railway.app)** → *New Project* → **Deploy from GitHub repo** → pick the repository.
2. Railway detects the `Dockerfile` and starts building. Let the first build finish (it may fail — the database is not attached yet).

### 3. Add PostgreSQL

In the project canvas: **New → Database → Add PostgreSQL**.

### 4. Give the service access to the database

Open the **web service → Variables → New Variable → Add Reference → `DATABASE_URL`** and select the Postgres service.
(Reference keeps credentials in sync automatically — do not paste them by hand unless you prefer to.)

### 5. Add a volume for the WhatsApp session files

**Service → Settings → Volumes → New Volume** → mount path **`/app/data`**.

> ⚠️ Without this volume, the Baileys credential files die with the container and you must re-pair every number after each redeploy. Chat history & media metadata live in PostgreSQL and survive regardless.

### 6. (Optional) tune the variables

| Variable | Value | Why |
|---|---|---|
| `WA_AUTO_RESTORE` | `true` | reconnect sessions after a deploy/restart |
| `LOG_LEVEL` | `info` | quieter logs; use `debug` while troubleshooting |
| `PORT` | *leave empty* | Railway injects it |
| `HOSTNAME` | `0.0.0.0` | already set in the Dockerfile |

### 7. Deploy & expose

- Railway redeploys automatically on every `git push`.
- **Settings → Networking → Generate Domain** to get a public `https://…up.railway.app` URL. Websockets work out of the box on the same domain.
- Health check: `GET /healthz` (used by Railway) and `GET /api/health` (DB + uptime).

### 8. First login

Open the generated domain → *Add New Number* → *Generate Pairing Code* → type it on the phone → **Connected**.

### Using Nixpacks instead of Docker?

Delete `railway.json` and keep `nixpacks.toml` (already includes Node 20, openssl and ffmpeg), or set `build.builder` to `NIXPACKS` in `railway.json`.

### Deploying somewhere else

Any Docker host works: `docker build -t wa-controller . && docker run -p 3000:3000 -v $PWD/data:/app/data -e DATABASE_URL=file:/app/data/prod.db wa-controller`.
On bare-metal/VPS, run `npm ci && npm run build && npm start` behind a reverse proxy that forwards websockets (nginx needs `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`).

---

## 🔌 API reference

All endpoints are JSON; errors always return `{ "error": "message" }`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthz` · `/api/health` | Liveness probes (plain / DB check) |
| `GET` | `/api/stats` | Aggregate counters for the dashboard |
| `GET` `POST` | `/api/sessions` | List sessions with stats / create a session |
| `GET` `PATCH` `DELETE` | `/api/sessions/:id` | Detail / rename / delete (unlink + wipe data) |
| `POST` | `/api/sessions/:id/pairing-code` | Request an 8-char pairing code `{ phoneNumber? }` |
| `POST` | `/api/sessions/:id/connect` | Reopen the socket with stored credentials |
| `POST` | `/api/sessions/:id/disconnect` | Close the socket, keep credentials |
| `POST` | `/api/sessions/:id/logout` | Unlink the device and wipe local auth |
| `GET` | `/api/sessions/:id/avatar?jid=` | WhatsApp profile picture URL |
| `GET` `POST` | `/api/sessions/:id/chats` | List/search chats / open a 1:1 chat by number |
| `GET` `PATCH` | `/api/chats/:chatId` | Chat detail / pin · archive · mark read |
| `GET` `POST` | `/api/chats/:chatId/messages` | Paginated history / send (JSON text or multipart media) |
| `GET` | `/api/media?id=<messageId>&download=1` | Stream stored media (path-traversal safe) |

Sending media (multipart): `file` (required), `kind` (`image|video|audio|document`), `caption`, `ptt=true` for a voice note.

### Realtime events (Socket.io, path `/api/socket/io`)

**Server → client:** `session:status`, `session:pairing-code`, `session:qr`, `session:message`, `session:chat`, `session:message-status`, `session:created`, `session:deleted`, `sessions:changed`, `server:ready`.

**Client → server:** `subscribe {sessionId}` / `unsubscribe`, `chat:typing {sessionId, chatId, state}`, `chat:read`, `chat:open` / `chat:close` (used for unread counting + auto read receipts).

---

## 🗃️ Database schema (Prisma)

```
WaSession 1─n Chat 1─n Message
```

- **WaSession** — name, phoneNumber (unique), status (`disconnected|connecting|pairing|connected|error`), pairingCode + expiry, pushName, lastError, connectedAt.
- **Chat** — jid (unique per session), name, isGroup, unreadCount, lastMessagePreview/At, pinned, archived.
- **Message** — waMessageId, fromMe, senderJid/Name, type (`text|image|video|audio|document|sticker|other`), text, mediaPath/Mime/Name/Size/Duration, status (`pending|sent|delivered|read|failed`), timestamp.

---

## 🛠️ Troubleshooting

| Symptom | Fix |
|---|---|
| *“Failed to get pairing code”* | The socket was not ready yet — wait 2 seconds and hit **Regenerate**. Make sure the number is in international format without `+`. |
| Session shows **Disconnected** after a redeploy | Add the Railway Volume at `/app/data` and keep `WA_AUTO_RESTORE=true`. |
| Voice notes arrive as files | `ffmpeg` is missing on the server. The Dockerfile installs it; on a VPS run `apt install ffmpeg`. |
| Old chats are missing | `syncFullHistory` is intentionally off (memory/CPU friendly). New traffic and everything you send from the panel is stored from the moment you link. |
| `prisma db push` fails on Railway | `DATABASE_URL` is not attached to the service (step 4). |
| Build fails with "Environment variable not found: DATABASE_URL" | Same cause — the DB reference must exist **before** the build runs. |
| Messages stop after ~30 min | Check the logs for `connection closed` + reconnect attempts; the manager retries up to 12 times with backoff, then flags the session as `error`. |
| WhatsApp unlinked the device | Use **Logout / unlink** in the panel, then pair again — a number stays linked until you unlink it. |

---

## 🔒 Security & privacy

- **Never commit `.env`, `data/auth` or `data/media`.** `.gitignore` and `.dockerignore` already exclude them, and `npm run zip` strips them too.
- The panel has **no built-in authentication** (it is meant to be self-hosted / behind a private network or an auth proxy). Put it behind Railway's private networking, Cloudflare Access, an nginx `auth_basic`, or any SSO proxy before exposing it publicly.
- `data/auth` contains the equivalent of your WhatsApp login — treat it like a password and only attach volumes you control.
- Media is streamed from your own disk with a path-traversal guard and correct content types.

---

## ⚠️ Disclaimer

This project is **not affiliated with, endorsed by or connected to WhatsApp Inc.** It uses the unofficial [Baileys](https://github.com/WhiskeySockets/Baileys) library. Automating WhatsApp may violate its Terms of Service — use it for your own account and legitimate purposes only. **No bulk, spam or unsolicited messaging.** You are responsible for how you use it.

---

## 📄 License

MIT — do whatever you want, no warranty of any kind.
