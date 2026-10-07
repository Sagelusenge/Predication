FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json vitest.config.ts ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg tini \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false \
    && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY database ./database
RUN mkdir -p /app/storage \
    && chown -R node:node /app/storage

USER node
EXPOSE 4000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "run", "start:render"]
