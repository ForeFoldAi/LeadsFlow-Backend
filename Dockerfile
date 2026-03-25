# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine

# Run as non-root user (security)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Own the files
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# Graceful shutdown support
STOPSIGNAL SIGTERM

CMD ["node", "dist/main"]
