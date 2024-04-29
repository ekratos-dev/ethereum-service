const Web3 = require('web3');
const Rabbot = require("rabbot");
const Config = require('./config');
const { Common, CustomChain } = require('@ethereumjs/common');
const RabbotConfig = Config.rabbotConfig;

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Read Params
let modules = {
    validate: false,
    transactions: false,
    calls: false
};

for (let arg of process.argv) {
    if (arg === "validate") {
        modules.validate = true;
    }
    if (arg === "transactions") {
        modules.transactions = true;
    }
    if (arg === "calls") {
        modules.calls = true;
    }
}

// Configure Rabbot
getRabbot = async function (connection = null) {
    // Update rabbot connection user
    if (connection) {
        if (connection.hasOwnProperty("user")) RabbotConfig.connection.user = connection.user;
        if (connection.hasOwnProperty("pass")) RabbotConfig.connection.pass = connection.pass;
        if (connection.hasOwnProperty("host")) RabbotConfig.connection.host = connection.host;
        if (connection.hasOwnProperty("port")) RabbotConfig.connection.port = connection.port;
        if (connection.hasOwnProperty("vhost")) RabbotConfig.connection.vhost = connection.vhost;
    }
    await Rabbot.configure(RabbotConfig);
    return Rabbot;
};

// Start the modules
start = async function () {
    console.log("Connecting to blockchain '" + Config.network_name + "' through host " + Config.web3_host);
    let web3 = new Web3(new Web3.providers.HttpProvider(Config.web3_host));
    let common = Common.custom({ chain: Config.network_name });
    /*if (Config.network_name === "mumbai") common = Common.custom(CustomChain.PolygonMumbai);
    if (Config.network_name === "amoy") {
        common = Common.custom(CustomChain.PolygonMumbai);
        common._chainParams.chainId = 80002;
        common._chainParams.networkId = 80002;
    }*/

    console.log("Connecting to rabbit host '" + Config.rabbit_connection.host + ":" + Config.rabbit_connection.port);

    try {
        if (modules.validate) {
            let rabbot = await getRabbot(Config.validate.connection);
            require('./Core/validate')(Config, web3, rabbot);
        }

        if (modules.transactions) {
            let rabbot = await getRabbot(Config.transactions.connection);
            require('./Core/transactions')(Config, web3, common, rabbot);
        }

        if (modules.calls) {
            let rabbot = await getRabbot(Config.calls.connection);
            require('./Core/calls')(Config, web3, rabbot);
        }
    } catch (e) {
        console.error("ERROR starting Ethereum Service");
        console.error(e);
    }
};

// Run
start().then(() => {
    console.log("Started Ethereum Service:");
    if (modules.validate) console.log("  - validate");
    if (modules.transactions) console.log("  - transactions");
    if (modules.calls) console.log("  - calls");
    console.log("");
}).catch(function(e){
    console.error("ERROR starting Ethereum Service");
    console.error(e);
});
