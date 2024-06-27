const util = require("util");
const Rabbus = require("rabbus");
const ActionsUtility = require('./ActionsUtility');
const { LegacyTransaction, FeeMarketEIP1559Transaction } = require('@ethereumjs/tx');
const Transaction = require('ethereumjs-tx');

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

module.exports = function (Config, Web3, Common, Rabbot) {
    // Web3 Timeout function
    let Web3TimeoutError = "TIMEOUT-ERROR";
    let TimeoutWeb3 = function (ms) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(Web3TimeoutError);
            }, ms)
        });
    };

    // Set transaction Receiver
    let transactionReceiver;
    function TransactionReceiver(){
        Rabbus.Receiver.call(this, Rabbot, {
            exchange:  Config.rabbitMQ.exchanges["transactions"],
            queue:  Config.rabbitMQ.queues["transactions"],
            routingKey: Config.network_name
        });
    }
    util.inherits(TransactionReceiver, Rabbus.Receiver);

    //set pending transactions sender
    let pendingTransactionsSender=null;
    function PendingTransactionsSender(){
        Rabbus.Sender.call(this, Rabbot, {
            exchange:  Config.rabbitMQ.exchanges["transactions-pending"],
            routingKey: Config.network_name
        });
    }
    util.inherits(PendingTransactionsSender, Rabbus.Sender);

    //set Action sender
    function ActionSender(key){
        Rabbus.Sender.call(this, Rabbot, {
            exchange:  Config.rabbitMQ.exchanges["actions"],
            routingKey: key
        });
    }
    util.inherits(ActionSender, Rabbus.Sender);

    // Send signed transaction as promise
    let sendSignedTransaction = function (serializedTxHex) {
        return new Promise((resolve, reject) => {
            Web3.eth.sendSignedTransaction(serializedTxHex, async function (error, hash) {
                if (error) {
                    if (error.receipt) {
                        console.error('Transaction receipt:', error.receipt);
                        try {
                            const tx = await Web3.eth.getTransaction(error.receipt.transactionHash);
                            const result = await Web3.eth.call(tx, tx.blockNumber);
                            const reason = web3.utils.toAscii(result).replace(/\u0000/g, ''); // Decode the revert reason and remove null chars
                            console.error('Revert reason (transaction): ' + reason);
                        } catch (err) {
                            console.error('Error fetching revert reason (transaction):', err);
                        }
                    }
                    reject(error);
                }
                resolve(hash);
            });
        })
    };

    //set Transaction Receiver
    pendingTransactionsSender = new PendingTransactionsSender();
    transactionReceiver = new TransactionReceiver();

    transactionReceiver.receive(async function(message, properties, actions_, next){
        // Better actions object
        let actions = new ActionsUtility(actions_);
        try {
            if (message !== null) {
                console.log('Received transaction message: ' + message.transactionId);
                //Check if the transaction is finished
                if(typeof message.sendRetry !== "undefined"){
                    // Get transaction details
                    const trx = await Promise.race([Web3.eth.getTransaction(message.hash), TimeoutWeb3(1000)]);
                    if (trx === Web3TimeoutError) {
                        console.log('  Send Message back to queue transaction : ' + message.transactionId + ' (Timeout web3.getTransaction)');
                        actions.nack();
                        return;
                    }

                    if (trx) {
                        //Send to validate again
                        pendingTransactionsSender.send(message, function(){
                            console.log('  Send transaction to validate: '+ message.transactionId );
                        });
                        actions.ack();
                        return;
                    }
                }

                // Check private key
                if (typeof message.senderPrivateKey === "undefined") {
                    message.event = {name: 'error', params: {}};
                    const actionSender = new ActionSender(message.project);
                    actionSender.send(message, function () {
                        console.log('  Send error action to project: ' + message.transactionId + ' Reject for ever');
                    });
                    console.error("Error in parameters. Sender private key is undefined");
                    actions.reject();
                    return;
                }

                // Check address
                if (typeof message.senderAddress === "undefined") {
                    message.event = {name: 'error', params: {}};
                    const actionSender = new ActionSender(message.project);
                    actionSender.send(message, function () {
                        console.log('  Send error action to project: ' + message.transactionId + ' Reject for ever');
                    });
                    console.error("Error in parameters. Sender address is undefined");
                    actions.reject();
                    return;
                }

                //Check if the destiny address is a contract or not
                let codeResult = await Web3.eth.getCode(message.toAddress);
                if(codeResult === '0x'){
                    // is User Account
                    message.event = {name: 'error', params: {}};
                    const actionSender = new ActionSender(message.project);
                    actionSender.send(message, function () {
                      console.log(' Send error action to project: ' + message.transactionId + ' Reject for ever');
                    });

                    console.error("Transaction Node: The destiny address is not a contract");
                    actions.reject();
                    return;
                }

                let nonce =null;
                let gasPrice = null;

                try {
                    nonce = await Promise.race([TimeoutWeb3(1000), Web3.eth.getTransactionCount(message.senderAddress, "pending")]);
                    console.log('  Transaction nonce: ' + nonce);
                    if (nonce === Web3TimeoutError) {
                        console.log('  Send transaction back to queue: ' + message.transactionId + ' (Timeout in tx count)');
                        actions.nack();
                        return;
                    }
                    gasPrice = await Promise.race([TimeoutWeb3(1000), Web3.eth.getGasPrice()]);
                    console.log('  Gas price: ' + gasPrice);
                    if (gasPrice === Web3TimeoutError) {
                        console.log('  Send transaction back to queue: ' + message.transactionId + ' (Timeout in gas price)');
                        actions.nack();
                        return;
                    }
                } catch (e) {
                    console.error(e);
                    actions.reject();
                    return;
                }

                const txData = {
                    nonce: Web3.utils.toHex(nonce),
                    gasLimit: Web3.utils.toHex(6500000), // Set the gas limit for a simple transaction; adjust accordingly for contract interactions
                    gasPrice: Web3.utils.toHex(gasPrice),
                    to: message.toAddress,
                    value: Web3.utils.toHex(message.value || '0'),
                    data: message.data
                };

                // Create a new legacy transaction
                let signedTx;
                signedTx = new Transaction(txData);
                signedTx.sign(Buffer.from(message.senderPrivateKey, 'hex'));
                /*if (Common._chainParams.name === "polygon-mumbai") {
                    const tx = FeeMarketEIP1559Transaction.fromTxData(txData, {Common});
                    signedTx = tx.sign(Buffer.from(message.senderPrivateKey, 'hex'));
                }*/
                //tx = LegacyTransaction.fromTxData(txData, {Common});

                // Serialize transaction
                const serializedTx = signedTx.serialize();
                // const hexString = serializedTx.toString('hex');
                const hexString = Array.from(serializedTx)
                    .map(byte => byte.toString(16).padStart(2, '0'))
                    .join('');
                /**
                 * Send transaction
                 */
                try {
                    console.log('  Sending signed transaction with nonce ' + nonce);
                    let hash = await Promise.race([TimeoutWeb3(1000), sendSignedTransaction('0x' + hexString)]);
                    console.log('  Received hash ' + hash);

                    if (hash === Web3TimeoutError) {
                        // Web3 Timeout
                        console.log('  Send transaction back to queue: ' + message.transactionId + ' (Timeout in send transaction)');
                        actions.nack();
                        return;
                    }

                    message.hash = hash;
                    message.event = {name:'hash', params:{'hash': hash}};

                    pendingTransactionsSender.send(message, function(){
                        console.log('  Send transaction to validate: '+ message.transactionId );
                    });

                    const actionSender = new ActionSender(message.project);
                    actionSender.send(message, function(){
                        console.log('  Send hash action to project: '+ message.project + ' ' + message.transactionId );
                    });

                    actions.ack();
                } catch (error) {
                    if (typeof error.message !== "undefined" && error.message.indexOf("the tx doesn't have the correct nonce") !== -1) {
                        // Nonce error, wait node mining time
                        console.log('  Send transaction back to queue: ' + message.transactionId + ' (Nonce error)');
                        await sleep(Config.mining_time);
                        actions.nack();
                    } else if (typeof error.message !== "undefined" && error.message.indexOf("invalid sender") !== -1) {
                        // Invalid sender
                        message.event = {name: 'error', params: {}};
                        const actionSender = new ActionSender(message.project);
                        actionSender.send(message, function () {
                            console.log('  Send error action to project: ' + message.transactionId + ' Reject for ever');
                        });
                        console.error("Error in transaction (invalid sender): " + error.message);
                        console.error(error);
                        actions.reject();
                    } else if (typeof error.message !== "undefined" && error.message.indexOf("only replay-protected (EIP-155) transactions allowed over RPC") !== -1) {
                        // Invalid sender
                        message.event = {name: 'error', params: {}};
                        const actionSender = new ActionSender(message.project);
                        actionSender.send(message, function () {
                            console.log('  Send error action to project: ' + message.transactionId + ' Reject for ever');
                        });
                        console.error("Error in transaction (eip-155 error): " + error.message);
                        console.error(error);
                        actions.reject();
                    } else if (typeof error.message !== "undefined" && error.message.indexOf("already known") !== -1) {
                        // Transaction already known
                        message.event = {name: 'error', params: {}};
                        const actionSender = new ActionSender(message.project);
                        actionSender.send(message, function () {
                            console.log('  Send error action to project: ' + message.transactionId + ' Reject for ever');
                        });
                        console.error("Transaction already known " + error.message);
                        console.error(error);
                        actions.reject();
                    } else if(typeof error.message !== "undefined") {
                        const canRetry = error.message.indexOf("is not a contract address") < 0;

                        if (canRetry) {
                            console.log(error);
                            console.log('  Send transaction back to queue: ' + message.transactionId + ' (' + error.message + ') with price: ' + message.value);
                            actions.nack();
                        } else {
                            message.event = {name: 'error', params: {}};
                            const actionSender = new ActionSender(message.project);
                            actionSender.send(message, function () {
                                console.log('  Send error action to project: ' + message.transactionId + ' Reject for ever');
                            });
                            console.error("Error in transaction: " + error.message);
                            console.error(error);
                            actions.reject();
                        }
                    } else if (typeof error.error !== "undefined" && typeof error.error.message !== "undefined"){
                        //Timeout exceeded during the transaction confirmation process. Be aware the transaction could still get confirmed!
                        if(error.error.message.indexOf("Timeout exceeded during the transaction confirmation process") >= 0){
                            message.event = {name: 'error', params: {}};
                            const actionSender = new ActionSender(message.project);
                            actionSender.send(message, function () {
                                console.log('  Send error action to project: ' + message.transactionId + ' Reject for ever');
                            });
                            console.error("Error in transaction: " + message.transactionId + " Error: " + error.error.message);
                            actions.reject();
                        }else{
                            console.log('  Send transaction back to queue (error): ' + message.transactionId + ' Retry later');
                            console.error("Error in transaction: " + message.transactionId + " Error: " + error.error.message);
                            console.error(error);
                            actions.nack();
                        }
                    }else{
                        console.log('  Send transaction back to queue (error): ' + message.transactionId + ' Retry later');
                        console.error("Error in transaction: " + message.transactionId + " Error: unknown");
                        console.error(error);
                        actions.nack();
                    }
                }
            }
        } catch (error) {
            console.log('  Send transaction back to queue (error): ' + message.transactionId + ' Retry later');
            console.error("Error unexpected processing the transaction message: " + message.transactionId);
            console.error(error);
            actions.nack();
        }
    });
};
