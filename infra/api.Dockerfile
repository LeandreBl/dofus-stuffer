ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/renderer/package.json packages/renderer/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @dofus/shared && npm run build -w @dofus/api

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/renderer/package.json packages/renderer/package.json
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY data/catalog.json data/catalog.json
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
