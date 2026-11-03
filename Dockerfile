FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY . .
ENV NITRO_PRESET=node-server
RUN npm run build

ENV HOST=0.0.0.0
CMD ["node", ".output/server/index.mjs"]
