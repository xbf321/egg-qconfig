'use strict';

module.exports = app => {
    return {
        schedule: {
            interval: app.config.qconfig.interval || '5m',
            type: 'worker',
        },
        async task(ctx) {
            const updateConfigs = await ctx.app.qconfig.checkUpdate();
            if (!updateConfigs) return;

            // 获得更新的信息（包含文件内容）
            const result = await app.qconfig.update(updateConfigs.map(item => {
                return item.name;
            }));

            // 发布信息
            app.qconfig.publish(result);
        },
    };
};
