FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Retry npm ci (transient Docker network resets are common on Windows hosts).
RUN for i in 1 2 3; do npm ci && exit 0; echo "npm ci attempt $i failed, retrying..."; sleep 15; done; exit 1

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_BUILD_ID=unknown
ENV NEXT_PUBLIC_BUILD_ID=$NEXT_PUBLIC_BUILD_ID
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN useradd -m -u 10001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
