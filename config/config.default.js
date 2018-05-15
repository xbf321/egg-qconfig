'use strict';

/**
 * egg-qconfig default config
 * @member Config#qconfig
 * @property {String} SOME_KEY - some description
 */
exports.qconfig = {
    get_token_url: 'http://pbservice.corp.qunar.com/api/app/info.json',
    get_entrypoint_url: 'http://qconfig.corp.qunar.com/entrypoint',
    name: '',
    token: '',
    interval: '1m',
};
