FROM node:24-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm ci
COPY . .
RUN npm run build

FROM build AS production-dependencies
RUN npm prune --omit=dev --ignore-scripts

FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
