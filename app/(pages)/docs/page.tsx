import Link from 'next/link'
import {
  CloudUpload,
  Database,
  HardDrive,
  KeyRound,
  Rocket,
  Terminal,
  TriangleAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = {
  title: 'Setup guide — WA Multi-Device Controller',
}

const localSteps = [
  'npm install',
  'cp .env.example .env   (Windows: copy .env.example .env)',
  'npm run db:push',
  'npm run dev',
  'Open http://localhost:3000 → Add New Number → Generate Pairing Code',
]

const railwaySteps = [
  {
    title: 'Push the project to GitHub',
    body: 'git init && git add . && git commit -m "feat: WA multi-device controller" && git push',
  },
  {
    title: 'Create a Railway project',
    body: 'railway.app → New Project → Deploy from GitHub repo → pick your repository.',
  },
  {
    title: 'Add PostgreSQL',
    body: 'In the project: New → Database → Add PostgreSQL. Railway creates DATABASE_URL automatically.',
  },
  {
    title: 'Link the database to your service',
    body: 'Service → Variables → New Variable → Add Reference → DATABASE_URL (from the Postgres service).',
  },
  {
    title: 'Add a Volume for session storage',
    body: 'Service → Settings → Volumes → New Volume with mount path /app/data so Baileys sessions survive redeploys.',
  },
  {
    title: 'Deploy',
    body: 'Railway builds the Dockerfile, runs prisma db push and starts one service (HTTP + websockets + Baileys).',
  },
]

export default function DocsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-8 md:px-8 md:pb-16">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-3 py-1 text-[11px] text-[#4ade80]">
          <Rocket className="h-3 w-3" /> One service, zero external workers
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Local &amp; <span className="gradient-text">Railway</span> setup
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Everything — Next.js 14 App Router, Baileys, Socket.io, Prisma and the background session
          manager — runs inside a single Node process started by <code>server.ts</code>.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[#25D366]" /> Run locally
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="space-y-2 text-sm text-muted-foreground">
              {localSteps.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="text-[#4ade80]">{index + 1}.</span>
                  <code className="break-all rounded bg-black/40 px-1.5 py-0.5 text-xs">{step}</code>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              Local development uses SQLite (<code>prisma/dev.db</code>) — no database server needed.
              Auth files and media land in <code>data/</code>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[#25D366]" /> Environment variables
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {[
              ['DATABASE_URL', 'file:./dev.db locally, PostgreSQL URL on Railway'],
              ['PORT', 'HTTP port (Railway injects it automatically)'],
              ['HOSTNAME', 'bind address, keep 0.0.0.0'],
              ['WA_AUTH_DIR', 'Baileys auth state folder (default ./data/auth)'],
              ['WA_MEDIA_DIR', 'downloaded media folder (default ./data/media)'],
              ['WA_AUTO_RESTORE', 'true → reconnect stored sessions on boot'],
              ['WA_MAX_UPLOAD_MB', 'max size for uploaded media (default 64)'],
              ['LOG_LEVEL', 'trace | debug | info | warn | error | silent'],
            ].map(([key, description]) => (
              <div key={key} className="flex flex-col gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <code className="font-mono text-[11px] text-[#4ade80]">{key}</code>
                <span className="text-muted-foreground">{description}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudUpload className="h-4 w-4 text-[#25D366]" /> Deploy to Railway — step by step
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {railwaySteps.map((step, index) => (
            <div key={step.title} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[11px] font-semibold text-[#4ade80]">
                {index + 1}
              </span>
              <div>
                <div className="text-sm font-medium">{step.title}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.body}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-3 text-xs text-amber-200">
            <HardDrive className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Volume matters.</strong> Without a volume mounted at <code>/app/data</code> the
              Baileys auth files are wiped on every redeploy, so you would have to pair every number
              again. Chat history lives in Postgres and survives regardless.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#25D366]" /> Pairing flow in 4 steps
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
          {[
            'Dashboard → Add New Number (international format, e.g. 6281234567890).',
            'Generate Pairing Code — an 8-character code appears (valid ~3 minutes).',
            'On the phone: WhatsApp → Linked devices → Link a device → Link with phone number instead.',
            'Type the code. The status badge flips to Connected and chats start streaming in.',
          ].map((text, index) => (
            <div key={text} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-1 text-[11px] font-semibold text-[#4ade80]">STEP {index + 1}</div>
              {text}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-300" /> Troubleshooting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          {[
            [
              '“Failed to get pairing code”',
              'The socket was not ready yet. Wait 2 seconds and tap Regenerate. Also make sure the number is in international format without “+”.',
            ],
            [
              'Voice note arrives as a file',
              'ffmpeg is missing on the server. The Dockerfile installs it automatically; on bare-metal hosts run `apt install ffmpeg`.',
            ],
            [
              'Session drops after a redeploy',
              'Add the Railway Volume at /app/data (see above) and keep WA_AUTO_RESTORE=true.',
            ],
            [
              'Chats never appear',
              'syncFullHistory is disabled on purpose (only new traffic + your own sends are stored). Send a test message from the phone.',
            ],
            [
              'Build fails on Prisma',
              'Make sure DATABASE_URL exists in the service variables before deploying — db push runs at container start.',
            ],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-sm font-medium text-foreground/90">{title}</div>
              <p className="mt-1">{body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-center">
        <Link
          href="/"
          className="text-sm text-[#4ade80] underline-offset-4 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}
