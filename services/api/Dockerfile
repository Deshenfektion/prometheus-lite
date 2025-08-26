FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY services/api/package.json ./services/api/
RUN npm ci --workspace services/api --include-workspace-root

COPY services/api ./services/api
RUN npm run build --workspace services/api

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY package.json package-lock.json ./
COPY services/api/package.json ./services/api/
RUN npm ci --workspace services/api --include-workspace-root --omit=dev \
    && npm cache clean --force

COPY --from=build /app/services/api/dist ./services/api/dist
COPY db/migrations ./db/migrations
COPY deploy ./deploy

ENV MIGRATIONS_DIR=/app/db/migrations
USER app
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "services/api/dist/index.js"]
