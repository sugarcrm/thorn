process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'asdf';
process.env.API_URL = 'http://thisisnotarealserver.localdev';

var chakram = require('chakram');
var expect = require('chai').expect;
var nock = require('nock');
var requests = [];


// TODO Put in correct server
var serverUrl = process.env.API_URL;

describe('Fixtures', () => {
    let myFixture;
    let thorn;
    let Fixtures;
    let thornFile = '../dist/index.js';

    // The only way to reset the state of thorn & thorn.fixtures is to do the below.
    // See https://nodejs.org/api/globals.html#globals_require_cache for more info.
    beforeEach(() => {
        thorn = require(thornFile);
        Fixtures = thorn.Fixtures;
    });

    afterEach(() => {
        delete require.cache[require.resolve(thornFile)];
    });

    describe('creating one record', () => {
        beforeEach(() => {
            myFixture = [{
                module: 'TestModule',
                attributes: {
                    name: 'FakeRecord',
                    field1: 'field1data',
                    field2: 'field2data'
                }
            }];
        });

        it('should create a fixture', () => {
            let thisServer = nock(serverUrl)
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
                    expect(requestBody.requests[0].url).to.contain('TestModule');
                    expect(requestBody.requests[0].method).to.equal('POST');
                    expect(requestBody.requests[0].data.name).to.equal('FakeRecord');
                    expect(requestBody.requests[0].data.field1).to.equal('field1data');
                    expect(requestBody.requests[0].data.field2).to.equal('field2data');
                    return [{
                        contents: {
                            _module: 'TestModule',
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

        it('should create a fixture using options.module', () => {
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
                    expect(requestBody.requests[0].url).to.contain('TestModule');
                    expect(requestBody.requests[0].method).to.equal('POST');
                    expect(requestBody.requests[0].data.name).to.equal('FakeRecord');
                    expect(requestBody.requests[0].data.field1).to.equal('field1data');
                    expect(requestBody.requests[0].data.field2).to.equal('field2data');
                    return [{
                        contents: {
                            _module: 'TestModule',
                            id: 'Fake-Record-Id',
                            name: 'FakeRecord',
                            field1: 'field1data',
                            field2: 'field2data'
                        }
                    }]
                });

            let createPromise = Fixtures.create(myFixture, {module: 'TestModule'});

            // expect the result to be a promise
            // The only standard for a promise is that is has a `then`
            // http://www.ecma-international.org/ecma-262/6.0/#sec-promise-objects
            expect(createPromise.then).to.be.a('function');
            return createPromise;
        });

        it('should create a fixture and find it', (done) => {
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
                    return [{
                        contents: {
                            _module: 'TestModule',
                            id: 'Fake-Record-Id',
                            name: 'FakeRecord',
                            field1: 'field1data',
                            field2: 'field2data'
                        }
                    }]
                });

            let createPromise = Fixtures.create(myFixture);
            createPromise.then(() => {
                let lookup1 = Fixtures.lookup('TestModule', {name: 'FakeRecord'});
                expect(lookup1.name).to.equal('FakeRecord');
                expect(lookup1.field1).to.equal('field1data');
                expect(lookup1.field2).to.equal('field2data');

                let lookup2 = Fixtures.lookup('TestModule', {field1: 'field1data'});
                let lookup3 = Fixtures.lookup('TestModule', {field2: 'field2data'});
                expect(lookup1 == lookup2).to.be.true;
                expect(lookup1 == lookup3).to.be.true;
                done();
            });

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

