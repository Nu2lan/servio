# ── Stage 1: Build Frontend ──
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 2: Build Backend ──
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build

# ── Stage 3: Production ──
FROM node:20-alpine
WORKDIR /app

# Copy backend build + production deps
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/package*.json ./
RUN npm ci --omit=dev

# Copy frontend build into backend's public folder
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server.js"]
