# ---------------------------------------------------------------------------
# WhatsApp Multi-Device Controller — single service image
# Next.js 14 (custom server) + Baileys + Socket.io + Prisma
# ---------------------------------------------------------------------------
FROM node:20-slim AS base

# ffmpeg  -> converts browser recordings into real WhatsApp voice notes (OGG/Opus)
# openssl -> required by Prisma's query engine
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ------------------------------- deps --------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY scripts ./scripts
# postinstall runs scripts/prepare-db.mjs + prisma generate
RUN npm install --no-audit --no-fund

# ------------------------------ builder ------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# a placeholder URL is enough for building; the real one is injected at runtime
ENV DATABASE_URL="file:./dev.db"
RUN node scripts/prepare-db.mjs && npx prisma generate && npm run build

# ------------------------------ runtime ------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    WA_AUTH_DIR=/app/data/auth \
    WA_MEDIA_DIR=/app/data/media

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json next.config.mjs tsconfig.json server.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY lib ./lib
COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY postcss.config.mjs tailwind.config.ts ./

RUN mkdir -p /app/data/auth /app/data/media

EXPOSE 3000

# npm start -> prepare-db -> prisma db push -> tsx server.ts (Next + Socket.io + Baileys)
CMD ["npm", "run", "start"]
