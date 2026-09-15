FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma generate only needs DATABASE_URL to be present as a string, not a reachable database.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate
COPY nest-cli.json tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
USER node
# Render's free tier doesn't support preDeployCommand, so migrations run on container
# startup instead. Idempotent (no-op when there's nothing pending), safe on every restart.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
