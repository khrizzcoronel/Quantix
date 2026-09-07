# ---------------------------------------------
# Base Stage (Dependencias)
# ---------------------------------------------
FROM node:20-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------
# Target: development (Vite dev server con HMR)
# ---------------------------------------------
FROM base AS development

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---------------------------------------------
# Target: build (Compilacion SPA para produccion)
# ---------------------------------------------
FROM base AS build

COPY . .
RUN npm run build

# ---------------------------------------------
# Target: production (Nginx estatico)
# ---------------------------------------------
FROM nginx:alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
