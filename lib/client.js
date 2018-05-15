'use strict';

const Base = require('sdk-base');
const cluster = require('cluster-client');
const QConfig = require('./qconfig');
const debug = require('debug')('qconfig');

/**
 * 对外提供的接口
 * 在多进程模式下，会重复 n 次（n个进程）
 * 参考：https://eggjs.org/zh-cn/advanced/cluster-client.html
 */
class Client extends Base {
    constructor(options) {
        super(options);
        // options.cluster 用于给 Egg 的插件传递 app.cluster 进来
        this._client = (options.cluster || cluster)(QConfig).create(options);
        this._client.ready(() => this.ready(true));

        // 缓存数据
        this._cache = {};
    }

    /**
     * 获得单个文件内容
     * @param {String} key 文件名
     * @return {String} content 文件内容
     * @memberof Client
     */
    async get(key) {
        let content = this._cache[key];
        if (content) {
            debug(`Client -> get 从缓存中获取 ${key}`);
            return content;
        }

        if (!content) {
            // 如果没有则订阅
            this._client.subscribe({
                name: key,
            }, val => {
                this._cache[key] = val;
            });

            // 从物理文件中获取
            content = await this._client.get(key);
            this._cache[key] = content;
            debug(`Client -> get 从物理文件中获取 ${key}`);
        }
        return content;
    }

    /**
     * 发布信息
     * @param {Array} items 文件信息
     *  - {String} name 文件名
     *  - {String} body 文件内容
     * @memberof Client
     */
    publish(items) {
        this._client.publish(items);
    }

    /**
     * 检查更新（主要用在定时器中）
     * @param {Array} names 文件名（可以传空）
     * @return {Boolean} 是/否
     * @memberof Client
     */
    async checkUpdate(names) {
        debug(`APIClient checkUpdate ${names}`);
        return await this._client.checkUpdate(names);
    }

    /**
     * 更新特定的文件（主要用在定时器中）
     * @param {Array} names 文件名称 eg.['xxx', 'yyy']
     * @return {Array} 文件信息
     *  - {String} name 文件名
     *  - {String} body 文件内容
     * @memberof Client
     */
    async update(names) {
        debug(`APIClient update ${names}`);
        return await this._client.update(names);
    }
}
module.exports = Client;
