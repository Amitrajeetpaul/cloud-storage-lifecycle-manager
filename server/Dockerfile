FROM node:20-bookworm-slim

WORKDIR /app

# build-essential + python3 cover the node-gyp fallback path if better-sqlite3
# has no prebuilt binary for the container's exact platform/arch.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=4000
ENV DB_PATH=/app/data/lifecycle.db
EXPOSE 4000

CMD ["node", "index.js"]
