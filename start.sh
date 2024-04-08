#!/bin/sh
# start.sh

# Start RabbitMQ server in the background
rabbitmq-server -detached

# Wait for RabbitMQ to fully start
echo "Waiting for RabbitMQ to start..."
while ! nc -z localhost 5672; do
  sleep 1
done
echo "RabbitMQ started."

# Start project ecosystem
exec pm2-runtime start ecosystem.config.js
