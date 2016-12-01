process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'asdf';
process.env.API_URL = 'http://thisisnotarealserver.localdev';

var chakram = require('chakram');
var expect = require('chai').expect;
var nock = require('nock');
var thorn = require('../dist/index.js');
var Fixtures = thorn.Fixtures;
var requests = [];


// TODO Put in correct server
var serverUrl = process.env.API_URL;

describe('Fixtures', () => {
    it('should create a fixture', () => {
        let myFixture = [{
            module: 'FakeModule',
            attributes: {
                name: 'FakeRecord',
                field1: 'field1data',
                field2: 'field2data'
            }
        }];
        let server = nock(serverUrl)
            .post((uri) => {
                return uri.indexOf('oauth2/token') >= 0;
            })
            .reply(200, {
                access_token: 'Test-Access-Token',
                refresh_token: 'Test-Refresh-Token'
            })
            .post((uri) => {
                return uri.indexOf('bulk') >= 0;
            })
            .reply(200, function(uri, requestBody) {
                expect(this.req.headers['x-thorn']).to.equal('Fixtures');
                expect(requestBody.requests[0].data.name).to.equal('FakeRecord');
                expect(requestBody.requests[0].data.field1).to.equal('field1data');
                expect(requestBody.requests[0].data.field2).to.equal('field2data');
                return [{
                    contents: {
                        id: 'Fake-Record-Id',
                        name: 'FakeRecord',
                        field1: 'field1data',
                        field2: 'field2data'
                    }
                }]
            });

        let createPromise = Fixtures.create(myFixture);

        // expect the result to be a promise
        // The only standard for a promise is that is has a `then`
        // http://www.ecma-international.org/ecma-262/6.0/#sec-promise-objects
        expect(createPromise.then).to.be.a('function');
        return createPromise;
    });

    it.skip('should create a fixture using options.module', () => {
        let server = nock(serverUrl)
            .post('/bulk')
            .reply(200, (uri, requestBody) => {
                // TODO Put an expect in here with what we expect to receive
                // TODO Put a response in here that matches what Sugar would send
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
            });
        // TODO Add fixture with multiple records
        let myFixture = {};
        let createPromise = Fixtures.create(myFixture, {module: 'MyModule'});

        expect(createPromise instanceof Promise).to.be.true;
        return createPromise;
    });
});

