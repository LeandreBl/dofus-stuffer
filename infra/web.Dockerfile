ARG NODE_IMAGE
ARG NGINX_IMAGE
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/renderer/package.json packages/renderer/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY packages/shared packages/shared
COPY packages/renderer packages/renderer
COPY apps/web apps/web
RUN npm run build -w @dofus/shared && npm run build -w @dofus/web

FROM ${NGINX_IMAGE}
COPY infra/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
