# Ethereum Service

This project is a fork of https://github.com/CentreEasy/Ethereum-Nodes

The project contains three processes: calls, transactions and validate.

The processes run in separate threads, and process inputs sent by external projects through a queue system.

- The calls service performs calls to a given smart contract.
- The transactions service performs transactions to a contract.
- The validate process checks if the transactions have been validated and send a completed or error event back to the project.

# Requirements

- Erlang

http://www.erlang.org/downloads

- RabbitMQ

https://www.rabbitmq.com/install-windows.html

Useful commands in RabbitMQ:

- rabbitmqctl.bat stop_app
- rabbitmqctl.bat reset
- rabbitmqctl.bat start_app

# Usage

Start the services with these commands:

```
npm run calls
npm run transactions
npm run validate
```

# Docker

A Dockerfile is provided to run this project in a container.

Build the docker image with this command.

```
docker build --no-cache -t ekratos/ethereum-service:1.0 .
```

Then start a container, and you can use its exposed port 5672 to connect to the Rabbit as a client, and 15672 to connect to the RabbitMQ management interface: http://localhost:15672

The default user and password is "guest".

# Configuration

This service connects by default to Sepolia blockchain.

You can use the environment parameters to connect to any other blockchain.
- network_name
- network_host

Also configure the rabbit connection.
- rabbit_host
- rabbit_port

Or, in local, you can also use customize the config.local.js file.
