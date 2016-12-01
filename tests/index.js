var chakram = require('chakram');
var expect = require('chai').expect;
var nock = require('nock');
var thorn = require('../dist/index.js');
var Fixtures = thorn.Fixtures;
var requests = [];

process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'asdf';
process.env.API_URL = 'http://thisisnotarealserver.fake';

// TODO Put in correct server
var serverUrl = process.env.API_URL;

describe('Fixtures', () => {
    it('should create a fixture', () => {
        let myFixture = [{
            name: 'FakeRecord',
            module: 'FakeModule'
        }];
        let server1 = nock(serverUrl)
            .post((uri) => {
                return uri.indexOf('oauth2/token') >= 0;
            })
            .reply(200, {
                access_token: 'Test-Access-Token',
                refresh_token: 'Test-Refresh-Token'
            })
            .post('/bulk')
            .reply(200, (uri, requestBody) => {
                console.log(requestBody);
                return [{
                    contents: {
                        id: 'Fake-Record-Id',
                        name: 'FakeRecord',
                        module: 'FakeModule'
                    }
                }]
            });

        let createPromise = Fixtures.create(myFixture);

        expect(createPromise instanceof Promise).to.be.true;
        return createPromise;
    });

    it.skip('should create a fixture using options.module', () => {
        let server = nock(serverUrl)
            .post('/bulk')
            .reply(200, (uri, requestBody) => {
                // TODO Put an expect in here with what we expect to receive
                // TODO Put a response in here that matches what Sugar would send
                console.log(requestBody);
            });
        // TODO Add fixture
        let myFixture = {};
        let createPromise = Fixtures.create(myFixture, {module: 'MyModule'});

        expect(createPromise instanceof Promise).to.be.true;
        return createPromise;
    });

    it.skip('should create a fixture and find it', (done) => {
        let server = nock(serverUrl)
            .post('/bulk')
            .reply(200, 'hello world');

        // TODO Add fixture
        let myFixture = {};
        Fixtures.create(myFixture)
            .then(() => {
                // TODO Put in lookup info
                let myLookup = {};
                let lookedUpModel = Fixtures.lookup(myFixture);
                // TODO Put in lookup expectations
                expect(lookedUpModel)
                done();
            });
    });

    it.skip('should create multiple fixtures', () => {
        let server = nock(serverUrl)
            .post('/bulk')
            .reply(200, (uri, requestBody) => {
                // TODO Put an expect in here with what we expect to receive
                // TODO Put a response in here that matches what Sugar would send
                console.log(requestBody);
            });
        // TODO Add fixture with multiple records
        let myFixture = {};
        let createPromise = Fixtures.create(myFixture, {module: 'MyModule'});

        expect(createPromise instanceof Promise).to.be.true;
        return createPromise;
    });
});

