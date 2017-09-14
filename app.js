'use strict';

/**
 * 参考：https://eggjs.org/zh-cn/advanced/cluster-client.html
 */
const Client = require('./lib/client');
module.exports = app => {
    const config = app.config.qconfig;
    app.qconfig = new Client(Object.assign({}, config, { cluster: app.cluster.bind(app), baseDir: app.baseDir }));
    app.beforeStart(function* () {
        yield app.qconfig.ready();
    });
};
