FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY server.js ./server.js
COPY trading-engine.js ./trading-engine.js
COPY config.yaml ./config.yaml

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
