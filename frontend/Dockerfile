# STEP 1: Build Angular app
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

# STEP 2: Serve with nginx
FROM nginx:stable-alpine
# Copy the Angular build output to nginx html folder
COPY --from=builder /usr/src/app/dist/frontend /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]