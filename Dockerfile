# Use Node.js 22 LTS (Alpine for smaller image size)
FROM node:22-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with npm ci for production builds
RUN --mount=type=cache,id=credit-visual-npm,target=/root/.npm \
    npm ci --only=production=false

# Copy source code
COPY . .

# Build the application
RUN --mount=type=cache,id=credit-visual-build,target=/app/node_modules/.cache \
    npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]