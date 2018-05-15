# egg-qconfig

在 eggjs 中使用 qconfig.
<!--
Description here.
-->

## Install

```bash
$ npm i egg-qconfig --save
```

## Usage

```js
// {app_root}/config/plugin.js
exports.qconfig = {
  enable: true,
  package: 'egg-qconfig',
};
```

## Configuration

```js
// {app_root}/config/config.default.js
exports.qconfig = {
    // 项目名
    name: '',
    // 项目 token
    token: '',
    // 获得 token 的URL
    get_token_url: '',
    // 获得访问地址的URL
    get_entrypoint_url: '',
    // 默认1分钟
    interval: '1m',
};
```

## Example

```js
// 在代码中使用
// 请注意,出现错误将会抛出异常.
const content = await app.qconfig.get('key');
```

<!-- example here -->

## Questions & Suggestions

Please open an issue [here](https://github.com/eggjs/egg/issues).

## License

[MIT](LICENSE)
