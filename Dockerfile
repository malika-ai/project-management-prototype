# Stage 1: Build stage
FROM oven/bun:1.3 AS builder
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN bun run build

# Stage 2: Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]