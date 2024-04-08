module.exports = {
    apps : [{
        name: 'calls',
        script: 'npm',
        args: 'run calls',
        watch: false,
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    },{
        name: 'transactions',
        script: 'npm',
        args: 'run transactions',
        watch: false,
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    },{
        name: 'validate',
        script: 'npm',
        args: 'run validate',
        watch: false,
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    }]
};
