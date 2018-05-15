'use strict';

/**
 * 参考：https://eggjs.org/zh-cn/advanced/cluster-client.html
 */
const Client = require('./lib/client');
module.exports = agent => {
    const config = agent.config.qconfig;
    agent.qconfig = new Client(Object.assign({}, config, { cluster: agent.cluster.bind(agent), baseDir: agent.baseDir }));
    agent.beforeStart(async function() {
        await agent.qconfig.ready();
    });
};
