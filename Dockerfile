# Use RabbitMQ image based on Alpine
FROM rabbitmq:3.13.1-management-alpine

# Set the working directory inside the container
WORKDIR /app

# Install node, npm and pm2
RUN apk add --no-cache nodejs npm \
    && npm install pm2 -g \
    && npm cache clean --force

# Install project dependencies
COPY package*.json ./
RUN npm install --production

# Copy application's code
COPY . .

# Copy the startup script
COPY start.sh start.sh
RUN chmod +x start.sh

# Expose necessary ports
EXPOSE 5672 15672

# Run the script
ENTRYPOINT ["./start.sh"]