FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATA_DIR=/app/data
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json index.html admin.html privacy.html styles.css admin.css app.js admin.js ./
COPY --chown=node:node assets ./assets
COPY --chown=node:node server ./server
COPY --chown=node:node content ./content
RUN mkdir -p /app/data && chown node:node /app /app/data
USER node
EXPOSE 4173
CMD ["node", "server/index.js"]
