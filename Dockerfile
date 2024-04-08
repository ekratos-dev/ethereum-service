# Use RabbitMQ image based on Alpine
FROM rabbitmq:3.13.1-management-alpine

# Set the working directory inside the container
WORKDIR /app

# Install node and npm
RUN apk add --update nodejs npm

# Install project dependencies
COPY package*.json ./
RUN npm install

# Copy application's code
COPY . .

# Install PM2 globally
RUN npm install pm2 -g

EXPOSE 5672
EXPOSE 15672

# Copy the startup script
COPY start.sh start.sh

# Make the script executable
RUN chmod +x start.sh

# Run the script
ENTRYPOINT ["./start.sh"]