# ── Stage 1: Install dependencies ────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate \
    && pnpm install --frozen-lockfile --prod=false

# ── Stage 2: Build ───────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate \
    && pnpm run build

# ── Stage 3: Production image ────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

RUN addgroup -S stewardly && adduser -S stewardly -G stewardly

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/client/dist ./client/dist
COPY package.json ./
COPY drizzle/ ./drizzle/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER stewardly

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
