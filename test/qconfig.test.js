'use strict';
// const request = require('supertest');
const mm = require('egg-mock');
// const assert = require('assert');

describe('test/qconfig.test.js', () => {
    let app;
    before(function* () {

        app = mm.app({
            baseDir: 'apps/qconfig-test',
            cache: false,
            workers: 2,
        });
        return app.ready();
    });

    after(() => {
        app.close();
    });
    afterEach(mm.restore);

    it('checkUpdate', function* () {
        const updateConfigs = yield app.qconfig.checkUpdate();
        console.info(updateConfigs);
    });
    it('get', function* () {
        const content = yield app.qconfig.get('test.properties');
        console.info(content);
    });

    // it('test', function* () {
    //     console.info(app.qconfig);
    // });
});
