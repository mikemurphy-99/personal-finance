# Stage 1: Build frontend
FROM node:20-bookworm AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Runtime
FROM node:20-bookworm-slim

WORKDIR /app

# Backend deps (sql.js is pure JS, no native compile needed)
COPY backend/package.json ./
RUN npm install --omit=dev

# Backend source
COPY backend/src ./src

# Frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Data directory for SQLite
RUN mkdir -p /app/data
ENV DATA_DIR=/app/data
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
