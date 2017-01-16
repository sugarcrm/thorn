require('babel-polyfill');
require('co-mocha');

let expect = require('chai').expect;

describe('Utils', () => {
    let utils;

    before(() => {
        utils = require('../dist/utils.js');
    });

    describe('constructUrl', () => {
        it('should return a URL relative to API_URL', () => {
            let url = utils.constructUrl('location');
            expect(url.startsWith(process.env.API_URL)).to.be.true;
        });

        it('should join arguments in order with slashes', () => {
            let url = utils.constructUrl('test', 'url', 'directories');
            expect(url).to.match(/\/test\/url\/directories/);
        });
    });
});
