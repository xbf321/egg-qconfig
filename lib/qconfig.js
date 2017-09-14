'use strict';
const Base = require('sdk-base');
const urllib = require('urllib');
const path = require('path');
const debug = require('debug')('qconfig');
const assert = require('assert');
const fs = require('mz/fs');
const mkdirp = require('mkdirp');
const utils = require('./utils');

/**
 * node 发 HTTP 请求，读取Qconfig
 * 使用方式
 * ```
 * const content = yield app.qconfig.get('key');
 * ```
 * @class QConfig
 */
class QConfig extends Base {

    /**
     * 构造函数
     * @param {Object} config 配置信息
     *  - name {Stirng} 项目Id
     *  - token {String} 访问token
     *  - dir {String} 保存目录，默认保存到 $app$/.qconfig/ 下
     *  - versionFileName {String} 版本文件名称，默认使用 __version__.json
     * @memberof QConfig
     */
    constructor(config) {

        super({
            // 指定异步启动的方法
            initMethod: 'init',
        });
        this.config = Object.assign({}, config, {
            versionFileName: '__version__.json',
        });

        // 缓存__version__.json 文件内容
        // 防止频繁读IO
        this.versionCache = {};

        // 订阅者
        this._registered = new Map();

        assert(this.config.name, 'should pass config.name');
        assert(this.config.token, 'should pass config.token');
        assert(this.config.get_token_url, 'should pass config.get_token_url');
        assert(this.config.get_entrypoint_url, 'should pass config.get_entrypoint_url');
    }

    /**
     * 订阅消息
     * @param {Object} item 订阅对象
     * @param {Function} listener 订阅回调
     * @memberof QConfig
     */
    subscribe(item, listener) {
        const key = item.name;
        debug(`subscribe ${key}`);

        this.on(key, listener);
        // 如果没有注册，则执行从物理文件或远程中获取数据，并触发回调
        if (!this._registered.has(key)) {
            // co(function* () {
            //     const content = yield self.get(key);
            //     listener(content);
            // });
            return;
        }

        const data = this._registered.get(key);
        if (data) {
            process.nextTick(() => listener(data));
        }
    }

    /**
     * 发布消息
     * @param {Array} items 文件信息
     *  - {String} name 文件名
     *  - {String} body 文件内容
     * @memberof QConfig
     */
    publish(items) {
        debug('publish');
        const self = this;
        items.forEach(item => {
            const key = item.name;
            self._registered.set(key, item.body);
            self.emit(key, item.body);
        });
    }

    /**
     * 统一处理请求错误
     * @param {String} url 请求地址
     * @param {Object} options 请求选项
     * @return {Ojbect} 请求结果
     * @memberof QConfig
     */
    * request(url, options) {
        let result;
        try {
            result = yield urllib.request(url, options);
        } catch (err) {
            err.name = `request -> 请求 ${url} 失败,${err.name}`;
            throw err;
        }
        return result;
    }

    /**
     * 初始化
     * 1.请求地址获得token
     * 2.获得访问地址
     * 3.创建保存目录
     * 4.确认所有文件在本地都是最新的
     * 5.执行 ready
     * @memberof QConfig
     */
    * init() {
        yield this.getServerToken();
        yield this.getEntrypoint();

        // 生成目录
        this.baseDir = path.join(this.config.baseDir, '.qconfig', this.config.name, this.serverType);
        // 目录不存在则创建
        const dirExists = yield fs.exists(this.baseDir);
        if (!dirExists) {
            mkdirp.sync(this.baseDir);
        }
        debug('init -> baseDir:', this.baseDir);

        yield this.ensureAllConfigsExist();

        this.ready(true);
    }

    /**
     * 获得 serverToken 和 serverType （/api/app/info.json）
     * 返回的 status 不等于 0 ，将抛出异常
     * @memberof QConfig
     */
    * getServerToken() {
        const postData = {
            token: this.config.token,
            name: this.config.name,
            server: {
                pid: process.pid,
            },
        };
        const result = yield this.request(this.config.get_token_url, {
            method: 'POST',
            data: postData,
            dataType: 'json',
            contentType: 'json',
        });
        const data = result.data;
        if (data.status !== 0) {
            throw new Error(data.message);
        }
        this.serverToken = data.data['server.token'];
        this.serverType = data.data['server.type'];
        debug(`getServerToken -> type：${this.serverType}, token：${this.serverToken}`);
    }

    /**
     * 获得 entrypoint （/entrypoint）
     * 返回值为空，抛出异常
     * @memberof QConfig
     */
    * getEntrypoint() {
        const result = yield this.request(this.config.get_entrypoint_url, {
            dataType: 'text',
        });
        const data = result.data;
        if (!data) {
            throw new Error('获得 getEntrypoint 失败，内容为空');
        }
        this.serverList = data.split(',');
        debug(`getEntrypoint -> entrypoint: ${data}`);
    }

    /*
     * 获得访问服务器地址，随机产生
     * @return {String} 服务器地址
     * @memberof QConfig
     */
    * getServerAddress() {
        return this.serverList[utils.getRandomInt(0, this.serverList.length)];
    }

    /**
     * 根据名称列表或者名称获得最新内容，内部调用 loadTheLatestConfig
     * @param {Array|String} configNames 名称列表
     *  - ['xx'] | 'xxx'
     * @return {object}
     *  - {Array} success 加载成功的
     *  - {Array} fail  加载失败的
     *  - {Array} notFound 未找到的
     * @memberof QConfig
     */
    * loadConfigs(configNames) {
        if (!Array.isArray(configNames)) {
            configNames = [ configNames ];
        }
        const res = {
            success: [],
            fail: [],
            notFound: [],
        };
        for (let i = 0; i < configNames.length; i++) {
            try {
                const ret = yield this.loadTheLatestConfig(configNames[i]);
                res.success.push(ret);
            } catch (err) {
                if (err.notFound) {
                    res.notFound.push(configNames[i]);
                }
                res.fail.push(configNames[i]);
            }
        }
        return res;
    }

    /**
     * 根据名称获取最新内容（/client/forceloadv2）
     * @param {String} configName 文件名称，eg:'xxx'
     * @return {Object}
     *  - {String} name 文件名称
     *  - {Number} version 版本号
     *  - {String} profile 环境
     *  - {String} checksum md5值
     *  - {String} body 内容
     * @memberof QConfig
     * 请求失败或者文件不存在将抛出错误
     */
    * loadTheLatestConfig(configName) {
        const address = yield this.getServerAddress(),
            url = `${address}/client/forceloadv2`;

        debug(`loadTheLatestConfig -> 开始加载 ${configName}，URL：${url}`);
        const result = yield this.request(url, {
            headers: {
                token: this.serverToken,
            },
            data: {
                group: this.config.name,
                dataId: configName,
            },
            dataType: 'text',
        });
        if (result.status === 404) {
            const err = new Error(`loadTheLatestConfig -> qconfig后台不存在${configName}，请先上传`);
            err.name = 'loadTheLatestConfig';
            err.fileName = configName;
            err.notFound = true;
            throw err;
        }
        const ret = {
            name: configName,
            version: result.headers.version,
            profile: result.headers.profile,
            checksum: result.headers.checksum,
            body: result.data,
        };
        debug(`loadTheLatestConfig -> 加载 ${configName} 完毕，版本号：${ret.version}，profile：${ret.profile}，checksum：${ret.checksum}`);
        return ret;
    }

    /**
     * 获得单个文件内容
     * @param {String} name 文件名
     * @return {String} 文件内容
     * @memberof QConfig
     */
    * get(name) {
        const fileName = path.join(this.baseDir, name);
        let body;
        try {
            body = yield fs.readFile(fileName, 'utf-8');
            debug(`get -> 从物理文件中获取 ${fileName}`);
            return body;
        } catch (err) {
            // 吃掉错误，在从远程数据中获取
        }
        debug(`get -> 从远程数据中获取 ${name}`);
        // 不存在，从远程数据源获取
        const result = yield this.update(name);
        return result[0].body;
    }

    /*
     * 更新配置文件（/client/checkupdatev2）
     * configNames 有值检查特定的值，没值则全量检查
     * @param {Array} configNames 配置文件
     *  - {String} name
     *  - {Number} version
     *  - {String} profile
     * @return null（没有更新） or Array（有更新）
     *  - {String} group
     *  - {String} name
     *  - {Number} version
     *  - {String} profile
     * @memberof QConfig
     * 非200以及304，将抛出错误
     */
    * checkUpdate(configNames = []) {
        const address = yield this.getServerAddress(),
            url = `${address}/client/checkupdatev2`,
            versionsJSON = yield this.loadInfoJson();

        // 没有传值则是全量更新
        // 查询 __version__.json 文件
        if (configNames.length === 0) {
            for (const key in versionsJSON) {
                configNames.push({
                    name: key,
                    version: versionsJSON[key].version,
                    profile: versionsJSON[key].profile,
                });
            }
        }
        // 数组为空，返回 null 不需要更新
        if (configNames.length === 0) {
            return null;
        }
        let postData = '';
        configNames.forEach(item => {
            postData += `${this.config.name},${item.name},${item.version},${item.profile}\n`;
        });

        debug(`checkUpdate -> 开始请求 ${url}, postData: ${JSON.stringify(postData)}`);

        const result = yield this.request(url, {
            method: 'POST',
            headers: {
                token: this.serverToken,
            },
            data: postData,
            dataType: 'text',
        });
        if (result.status === 304) {
            debug('checkUpdate -> 请求完毕，状态码:304，返回 null');
            return null;
        }

        if (result.status !== 200) {
            throw new Error(`checkUpdate -> 请求 ${url} 失败 ，statusCode 为 ${result.status}`);
        }

        // 解析 body
        const arrBody = result.data.split('\n'),
            ret = [];

        // 返回结果空的话，也返回 null，理论上不会出现这种问题
        if (arrBody.length === 0) {
            return null;
        }
        arrBody.forEach(item => {
            const arrInfo = item.split(',');
            if (arrInfo.length === 4) {
                ret.push({
                    group: arrInfo[0],
                    name: arrInfo[1],
                    version: parseInt(arrInfo[2]),
                    profile: arrInfo[3],
                });
            }
        });
        debug(`checkUpdate -> 检查更新完毕，状态码：200，返回：${JSON.stringify(ret)}`);
        return ret;
    }

    /**
     * 确认__version__.json中的文件都是最新的
     * 在程序启动时调用
     * @memberof QConfig
     */
    * ensureAllConfigsExist() {
        const infoJson = yield this.loadInfoJson(true),

            // 存在的文件
            existConfigs = [];

        debug('ensureAllConfigsExist -> 开始执行');
        debug(`ensureAllConfigsExist -> ${this.config.versionFileName} 内容：${JSON.stringify(infoJson)}`);

        // 1.检查已存在的文件是否需要更新
        for (const key in infoJson) {
            existConfigs.push({
                name: key,
                version: infoJson[key].version,
                profile: infoJson[key].profile,
            });
        }
        const updateConfigs = yield this.checkUpdate(existConfigs);
        // 不需要更新
        if (!updateConfigs) {
            return;
        }

        // 更新
        yield this.update(updateConfigs.map(item => {
            return item.name;
        }));
    }

    /**
     * 主要根据名字获得文件信息，并保存到文件
     * @param {Array} configNames 配置文件列表 ['xx'] | 'xxx'
     * @return {Array} 返回成功的数据
     *  - {String} name 文件名
     *  - {String} body 文件内容
     * @memberof QConfig
     */
    * update(configNames) {
        // 根据 name 加载详细信息
        const res = yield this.loadConfigs(configNames);

        // 未找到，抛出错误
        if (res.notFound.length > 0) {
            throw new Error(`update -> 在qconfig后台未找到${res.notFound.join(',')}，请先上传。`);
        }

        // 加载失败，抛出错误
        if (res.fail.length > 0) {
            throw new Error(`update -> 加载「${res.notFound.join(',')}」出错，具体原因请查看qconfig错误日志。`);
        }

        debug(`update -> 共 ${res.success.length} 个文件需要写入`);

        let hasError;
        // 保存到物理文件
        for (let i = 0, len = res.success.length; i < len; i++) {
            const item = res.success[i],
                fileName = path.join(this.baseDir, item.name);

            try {
                yield fs.writeFile(fileName, item.body);
            } catch (err) {
                // 出错了跳出循环
                hasError = err;
                debug(err);
                break;
            }
            debug(`update -> 保存 ${fileName} 到文件成功`);
        }

        if (hasError) {
            hasError.name = 'update -> 批量写文件时有异常，请检查重试！';
            throw hasError;
        }

        // 保存到 __version__.json
        // 如果有更新，这里获得还是之前的老内容，不过没关系
        // 下面就是更新这个内容
        const infoJson = yield this.loadInfoJson(true);
        res.success.forEach(item => {
            infoJson[item.name] = {
                version: parseInt(item.version),
                checksum: item.checksum,
                profile: item.profile,
            };
        });
        // 有值才写入 JSON
        if (res.success.length > 0) {
            const fileName = path.join(this.baseDir, this.config.versionFileName);
            // 写入 __version__.json
            yield fs.writeFile(fileName, JSON.stringify(infoJson, null, 4));

            // 保存到缓存
            this.versionCache = infoJson;
            debug(`update -> 写入 ${fileName} 成功`);
        }
        return res.success;
    }

    /*
     * 加载 __version__.json 文件
     * 加载文件失败，不会抛异常，直接返回 {}
     * @param {Boolean} loadFile 是否从文件中直接加载
     * @return 文件内容，已JSON.parse
     * @memberof QConfig
     */
    * loadInfoJson(loadFile = false) {

        // 从缓存中加载
        if (!loadFile) {
            // 先判断缓存是否是空对象
            // 如果是空对象，还是直接走文件
            if (!utils.isEmptyObject(this.versionCache)) {
                debug(`loadInfoJson -> 从缓存中加载，文件内容：${JSON.stringify(this.versionCache)}`);
                return this.versionCache;
            }
        }
        const fileName = path.join(this.baseDir, this.config.versionFileName);
        let json = {};

        try {
            const content = yield fs.readFile(fileName, 'utf-8');
            json = JSON.parse(content);
        } catch (err) {
            // 可能文件不存在
        }
        debug(`loadInfoJson -> loadFile:${loadFile},文件内容：${JSON.stringify(json)}`);
        // 放入缓存
        this.versionCache = json;
        return json;
    }
}
module.exports = QConfig;
