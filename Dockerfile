FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ && \
    npm ci --omit=dev && \
    apk del .build-deps

COPY server.js index.html ./

RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV PORT=3000
ENV DB_PATH=/app/data/incident.db

EXPOSE 3000

CMD ["node", "server.js"]
