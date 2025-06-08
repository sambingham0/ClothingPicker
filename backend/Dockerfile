# Use official Node.js image (LTS)
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package manifests & install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy source files
COPY . .

# Ensure upload directory exists
RUN mkdir -p /usr/src/app/uploads

# Expose port
EXPOSE 3000

# Default environment variables
ENV PORT=3000
ENV UPLOAD_DIR=/usr/src/app/uploads

# Start the server
CMD ["node", "src/app.js"]
