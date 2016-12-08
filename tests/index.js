process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'asdf';
process.env.API_URL = 'http://thisisnotarealserver.localdev';

let chakram = require('chakram');
let expect = require('chai').expect;
let nock = require('nock');

// TODO Put in correct server
var serverUrl = process.env.API_URL;

// expect the result to be a promise
// The only standard for a promise is that is has a `then`
// http://www.ecma-international.org/ecma-262/6.0/#sec-promise-objects
function isPromise(input) {
    if (input.then) {
        return input.then instanceof Function;
    }

    return false;
}

let thorn;
let Fixtures;
let Agent;
let thornFile = '../dist/index.js';
// The only way to reset the state of thorn & thorn.fixtures is to do the below.
// See https://nodejs.org/api/globals.html#globals_require_cache for more info.
beforeEach(() => {
    thorn = require(thornFile);
    Agent = thorn.Agent;
    Fixtures = thorn.Fixtures;
});

afterEach(() => {
    delete require.cache[require.resolve(thornFile)];
    nock.cleanAll();
});

describe('Fixtures', () => {

    before(() => {
        nock.disableNetConnect();
        nock.emitter.on('no match', function(req, fullReq, reqData) {
            if (fullReq) {
                throw new Error('No handler remaining for ' + fullReq.method + ' to ' + fullReq.href);
            }

            throw new Error('No handler remaining.');
        });
    });

    describe('creating one record', () => {
        let myFixture;
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

            expect(isPromise(createPromise)).to.be.true;

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
                            id: 'Fake-Record-Id',
                            name: 'FakeRecord',
                            field1: 'field1data',
                            field2: 'field2data'
                        }
                    }]
                });
            let createPromise = Fixtures.create(myFixture, {module: 'TestModule'});

            expect(isPromise(createPromise)).to.be.true;

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


describe('Agent', () => {
    before(() => {
        nock.disableNetConnect();
        nock.emitter.on('no match', function(req, fullReq, reqData) {
            if (fullReq) {
                throw new Error('No handler remaining for ' + fullReq.method + ' to ' + fullReq.href);
            }

            throw new Error('No handler remaining.');
        });
    });

    beforeEach(() => {
        nock(serverUrl)
            .post((uri) => {
                return uri.indexOf('oauth2/token') >= 0;
            })
            .reply(200, {
                access_token: 'Test-Access-Token',
                refresh_token: 'Test-Refresh-Token'
            });
    });

    describe('as', () => {
        it('should return an Agent with cached username and password', () => {
            let myAgent = Agent.as(process.env.ADMIN_USERNAME);

            expect(myAgent.username).to.equal(process.env.ADMIN_USERNAME);
            expect(myAgent.password).to.equal(process.env.ADMIN_PASSWORD);
        });
    });

    describe('on', () => {
        let myAgent;

        beforeEach(() => {
            myAgent = Agent.as(process.env.ADMIN_USERNAME);
        });

        it('should return the original agent if version is unchanged', () => {
            let myAgentV10 = myAgent.on('v10');

            expect(myAgentV10).to.equal(myAgent);
        });

        it('should return a clone of the original agent with updated version', () => {
            let myAgentV11 = myAgent.on('v11');

            expect(myAgentV11.version).to.equal('v11');
            expect(myAgentV11).to.not.equal(myAgent);
        });
    });

    describe('request methods', () => {
        let myAgent;

        before(() => {            
            myAgent = Agent.as(process.env.ADMIN_USERNAME);
        });

        it('should send GET request', () => {
            let endpoint = 'not/real/endpoint';
            let server = nock(serverUrl)
                .get((uri) => {
                    return uri.indexOf('not/real/endpoint') >= 0;
                })
                .reply(200, function(uri, requestBody) {
                    expect(this.req.headers['x-thorn']).to.equal('Agent');

                    return [];
                });
            let getRequest = myAgent.get(endpoint);

            expect(isPromise(getRequest)).to.be.true;

            return getRequest;
        });

        it('should send POST request', () => {
            let endpoint = 'not/real/endpoint';
            let data = {
                myField: 'myValue'
            };
            let server = nock(serverUrl)
                .post((uri) => {
                    return uri.indexOf('not/real/endpoint') >= 0;
                })
                .reply(200, function(uri, requestBody) {
                    expect(this.req.headers['x-thorn']).to.equal('Agent');
                    expect(requestBody).to.eql(data);

                    return [];
                });
            let postRequest = myAgent.post(endpoint, data);

            expect(isPromise(postRequest)).to.be.true;

            return postRequest;
        });

        it('should send PUT request', () => {
            let endpoint = 'not/real/endpoint';
            let data = {
                myField: 'myUpdatedValue'
            };
            let server = nock(serverUrl)
                .put((uri) => {
                    return uri.indexOf('not/real/endpoint') >= 0;
                })
                .reply(200, function(uri, requestBody) {
                    expect(this.req.headers['x-thorn']).to.equal('Agent');
                    expect(requestBody).to.eql(data);

                    return [];
                });
            let putRequest = myAgent.put(endpoint, data);

            expect(isPromise(putRequest)).to.be.true;

            return putRequest;
        });

        it('should send DELETE request', () => {
            let endpoint = 'not/real/endpoint';
            let data = {
                myField: 'myValue'
            };
            let server = nock(serverUrl)
                .delete((uri) => {
                    return uri.indexOf('not/real/endpoint') >= 0;
                })
                .reply(200, function(uri, requestBody) {
                    expect(this.req.headers['x-thorn']).to.equal('Agent');
                    expect(requestBody).to.eql(data);

                    return [];
                });
            let deleteRequest = myAgent.delete(endpoint, data);

            expect(isPromise(deleteRequest)).to.be.true;

            return deleteRequest;
        });
    });
});
