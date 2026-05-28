# --- Build client ---
FROM node:22-slim AS client-build
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- Build server ---
FROM node:22-slim AS server-build
WORKDIR /server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./

# --- Runtime ---
FROM node:22-slim
WORKDIR /app

COPY --from=server-build /server ./
COPY --from=client-build /client/dist ./public

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
