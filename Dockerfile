FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY server.js ./server.js
COPY app-server.js ./app-server.js
COPY api-docs.js ./api-docs.js
COPY redis-store.js ./redis-store.js
COPY trading-engine.js ./trading-engine.js
COPY config.yaml ./config.yaml
COPY analysis ./analysis
COPY data ./data
COPY dividends ./dividends
COPY explainer ./explainer
COPY fundamentals ./fundamentals
COPY portfolio ./portfolio
COPY risk ./risk
COPY scanner ./scanner

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
