# Stage 1: Build Stage
FROM node:20.10.0-alpine3.19 AS build

# Set the working directory inside the container
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package.json and package-lock.json
COPY package*.json ./

# Install project dependencies (only production dependencies)
RUN npm install --omit=dev \
    && npm cache clean --force

# Copy the application's code
COPY . .

# Stage 2: Runtime Stage
FROM rabbitmq:3.13.1-management-alpine

# Install Node.js, npm, and pm2
RUN apk add --no-cache nodejs npm \
    && npm install -g pm2 \
    && npm cache clean --force \
    && rm -rf /root/.npm /tmp/*

# Set the working directory inside the container
WORKDIR /app

# Copy the built application from the build stage
COPY --from=build /app /app

# Ensure start.sh is executable
RUN chmod +x /app/start.sh

# Expose necessary ports
EXPOSE 5672 15672

# Run the script
ENTRYPOINT ["./start.sh"]
