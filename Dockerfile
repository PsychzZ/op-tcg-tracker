# syntax=docker/dockerfile:1

# Base with OpenSSL (required by Prisma's engines on Alpine).
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# --- install ALL deps (dev included; needed to build + to run migrations) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- build the Next standalone bundle + generate the Prisma client ---
# This stage keeps the full node_modules, so the compose "migrate" and "tools" services
# (target: build) can run the Prisma CLI / tsx scripts, which the slim runner cannot.
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy values so the build never fails on missing env; real values come at runtime via env_file.
ENV AUTH_SECRET=build-time-dummy
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- minimal runtime image: just serves the app ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next standalone server + static assets (standalone omits public/static by design).
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Ensure the Prisma query engine + generated client are present (nft can miss the .node binary).
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
# Migrations are applied by the compose "migrate" service before this starts.
CMD ["node", "server.js"]
