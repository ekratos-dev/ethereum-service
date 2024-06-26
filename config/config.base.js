let configuration = {
    /**
     * Global Configuration
     */
    network_name: 'localhost',
    web3_host: "http://localhost:8545",
    mining_time: 1000,
    max_number_retries: 100,

    /**
     * Rabbit base connection. Can be reimplemented in each module configuration
     */
    rabbit_connection: {
        user: 'guest',
        pass: 'guest',
        host: 'localhost',
        port: 5672,
        vhost: '',
    },

    /**
     * Validate Node Configuration
     */
    validate: {
        // The number of confirmations to wait for a transaction to be valid
        confirmations: 1,

        // The number of messages to process in parallel
        threads: 10,
    },

    /**
     * Transactions Node Configuration
     */
    transactions: {
        // The number of messages to process in parallel
        threads: 10,
    },

    /**
     * Calls Node Configuration
     */
    calls: {
        // The number of messages to process in parallel
        threads: 10,

        // The timeout in milliseconds
        timeout: 5000
    }

};

// Export configuration
module.exports = configuration;
