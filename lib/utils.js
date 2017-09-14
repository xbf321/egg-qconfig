'use strict';

module.exports = {
    getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min;
    },

    isEmptyObject(obj) {
        let item;
        for (item in obj) {
            return !1;
        }
        return !0;
    },
};
