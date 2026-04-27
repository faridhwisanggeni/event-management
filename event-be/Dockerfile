# syntax=docker/dockerfile:1.7

# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma's schema/query engines are native binaries that dynamically link
# against OpenSSL. On Alpine (musl) we must install them explicitly.
RUN apk add --no-cache openssl libc6-compat

# Install ALL deps (incl. dev) from the lockfile for reproducible builds.
COPY package.json package-lock.json* ./
RUN npm ci

# Copy sources needed for build + prisma client generation.
COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

# ---------- Runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Same OpenSSL runtime deps as the builder.
RUN apk add --no-cache openssl libc6-compat

# Bring across the already-installed deps so the `prisma` CLI is available
# for `migrate deploy` at startup. Size trade-off is acceptable for this
# project; a tighter image could be produced via `npm prune --production`.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

EXPOSE 3001
# Apply any pending migrations, then boot the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
