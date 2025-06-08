# Stage 1: Build Angular app
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Add this line to see what's being built
RUN ls -la
RUN npm run build -- --configuration=production
# Add this line to verify the build output
RUN ls -la dist/

# Stage 2: Serve with Nginx
FROM nginx:stable-alpine
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html
# Add this to verify files are copied
RUN ls -la /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80