# Stage 1: Build the React app
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Custom nginx config (SPA + proxy /api/*)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
