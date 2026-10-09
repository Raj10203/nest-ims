# Production image. Local development uses docker-compose.yml (bind mount + watch mode) instead.
# Nothing from the host is copied except the source files listed below: no .env,
# no node_modules, no dist. Dependencies are installed and the app is compiled here.
# Configuration is supplied at run time through environment variables.

# --- build: install all dependencies and compile TypeScript ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- prod-deps: runtime dependencies only (includes the typeorm CLI used for migrations) ---
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# --- runtime: compiled output + production node_modules, no sources or dev tools ---
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Default: the API. The pipeline overrides the command to run migrations / the seed.
CMD ["node", "dist/main.js"]
