process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'asdf';
process.env.API_URL = 'http://thisisnotarealserver.localdev';

let _ = require('lodash');
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

function isTokenReq(url) {
    return url.indexOf('oauth2/token') >= 0;
}

function isBulk(url) {
    return url.indexOf('bulk') >= 0;
}

const ACCESS = {
    access_token: 'Test-Access-Token',
    refresh_token: 'Test-Refresh-Token'
};

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
                module: 'TestModule1',
                attributes: {
                    name: 'TestRecord1',
                    testField1: 'TestField1data',
                    testField2: 'TestField2data'
                }
            }];
        });

        it('should create a fixture', () => {
            let thisServer = nock(serverUrl)
                .post(isTokenReq)
                .reply(200, ACCESS)
                .post(isBulk)
                .reply(200, function(uri, requestBody) {
                    expect(this.req.headers['x-thorn']).to.equal('Fixtures');
                    expect(requestBody.requests[0].url).to.contain('TestModule1');
                    expect(requestBody.requests[0].method).to.equal('POST');
                    expect(requestBody.requests[0].data.name).to.equal('TestRecord1');
                    expect(requestBody.requests[0].data.testField1).to.equal('TestField1data');
                    expect(requestBody.requests[0].data.testField2).to.equal('TestField2data');
                    return [{
                        contents: {
                            _module: 'TestModule1',
                            id: 'TestId1',
                            name: 'TestRecord1',
                            testField1: 'TestField1data',
                            testField2: 'TestField2data'
                        }
                    }];
                });
            let createPromise = Fixtures.create(myFixture);

            expect(isPromise(createPromise)).to.be.true;

            return createPromise;
        });

        it('should create a fixture using options.module', () => {
            let fixtureWithoutModule = _.clone(myFixture);
            delete fixtureWithoutModule[0].module;
            let server = nock(serverUrl)
                .post(isTokenReq)
                .reply(200, ACCESS)
                .post(isBulk)
                .reply(200, function(uri, requestBody) {
                    expect(this.req.headers['x-thorn']).to.equal('Fixtures');
                    expect(requestBody.requests[0].url).to.contain('TestModule2');
                    expect(requestBody.requests[0].method).to.equal('POST');
                    expect(requestBody.requests[0].data.name).to.equal('TestRecord1');
                    expect(requestBody.requests[0].data.testField1).to.equal('TestField1data');
                    expect(requestBody.requests[0].data.testField2).to.equal('TestField2data');
                    return [{
                        contents: {
                            id: 'TestId1',
                            name: 'TestRecord1',
                            testField1: 'TestField1data',
                            testField2: 'TestField2data'
                        }
                    }];
                });
            let createPromise = Fixtures.create(fixtureWithoutModule, {module: 'TestModule2'});

            expect(isPromise(createPromise)).to.be.true;

            return createPromise;
        });

        it('should create a fixture and find it', (done) => {
            let server = nock(serverUrl)
                .post(isTokenReq)
                .reply(200, ACCESS)
                .post(isBulk)
                .reply(200, function(uri, requestBody) {
                    return [{
                        contents: {
                            _module: 'TestModule1',
                            id: 'TestId1',
                            name: 'TestRecord1',
                            testField1: 'TestField1data',
                            testField2: 'TestField2data'
                        }
                    }];
                });

            let createPromise = Fixtures.create(myFixture);
            createPromise.then(() => {
                let lookup1 = Fixtures.lookup('TestModule1', {name: 'TestRecord1'});
                expect(lookup1.name).to.equal('TestRecord1');
                expect(lookup1.testField1).to.equal('TestField1data');
                expect(lookup1.testField2).to.equal('TestField2data');

                let lookup2 = Fixtures.lookup('TestModule1', {testField1: 'TestField1data'});
                let lookup3 = Fixtures.lookup('TestModule1', {testField2: 'TestField2data'});
                expect(lookup1 == lookup2).to.be.true;
                expect(lookup1 == lookup3).to.be.true;
                done();
            });
        });
    });

    it('should create multiple fixtures', () => {
        let record1 = {
            attributes: {
                name: 'TestRecord1',
                testField1: 'TestField1data1'
            }
        };
        let record2 = {
            attributes: {
                name: 'TestRecord2',
                testField1: 'TestField1data2'
            }
        };
        let contents1 = {
            _module: 'TestModule1',
            name: 'TestRecord1',
            testField1: 'TestField1data1'
        };

        let contents2 = {
            _module: 'TestModule1',
            name: 'TestRecord2',
            testField1: 'TestField1data2'
        };
        let server = nock(serverUrl)
            .post(isTokenReq)
            .reply(200, ACCESS)
            .post(isBulk)
            .reply(200, function(uri, requestBody) {
                let requests = requestBody.requests;
                let request1 = requests[0];
                expect(request1.url).to.contain('/TestModule1');
                expect(request1.method).to.equal('POST');
                expect(request1.data).to.eql(record1.attributes);

                let request2 = requests[1];
                expect(request2.url).to.contain('/TestModule1');
                expect(request2.method).to.equal('POST');
                expect(request2.data).to.eql(record2.attributes);

                expect(this.req.headers['x-thorn']).to.equal('Fixtures');

                return [
                    {
                        contents: contents1
                    },
                    {
                        contents: contents2
                    }
                ];
            });
        let myFixture = [record1, record2];
        let createPromise = Fixtures.create(myFixture, {module: 'TestModule1'}).then((records) => {
            let testModuleRecords = records.TestModule1;
            expect(testModuleRecords.length).to.equal(2);
            expect(testModuleRecords[0]).to.eql(contents1);
            expect(testModuleRecords[1]).to.eql(contents2);
        });
        expect(createPromise.then).to.be.a('function');
        return createPromise;
    });

    describe('linking', () => {
        const LEFT_FIXTURE = {
            module: 'TestModule1',
            attributes: {
                name: 'TestRecord1',
                testField1: 'TestField1data1',
                testField2: 'TestField2data1'
            }
        };
        const RIGHT_FIXTURE = {
            module: 'TestModule2',
            attributes: {
                name: 'TestRecord2',
                testField1: 'TestField1data2',
                testField2: 'TestField2data2'
            }
        };
        const LEFT_RESPONSE = {
            _module: 'TestModule1',
            id: 'TestId1',
            name: 'TestRecord1',
            testField1: 'TestField1data1',
            testField2: 'TestField2data1'
        };
        const RIGHT_RESPONSE = {
            _module: 'TestModule2',
            id: 'TestId2',
            name: 'TestRecord2',
            testField1: 'TestField1data2',
            testField2: 'TestField2data2'
        };

        it('should create fixtures and link them in a single call', () => {
            let linkedLeft = _.extend(_.clone(LEFT_FIXTURE), {
                links: {
                    leftToRight: [
                        RIGHT_FIXTURE
                    ]
                }
            });
            let server = nock(serverUrl)
                .post(isTokenReq)
                .reply(200, ACCESS)
                .post(isBulk)
                .reply(200, function(uri, requestBody) {
                    // FIXME: at the moment, Fixtures only includes the X-Thorn header
                    // on the bulk, not on its constitutient requests
                    // we should probably change that in the future
                    expect(this.req.headers['x-thorn']).to.equal('Fixtures');

                    let requests = requestBody.requests;
                    let leftRequest = requests[0];
                    expect(leftRequest.url).to.contain('TestModule1');
                    expect(leftRequest.data).to.eql(LEFT_FIXTURE.attributes);

                    let rightRequest = requests[1];
                    expect(rightRequest.url).to.contain('TestModule2');
                    expect(rightRequest.data).to.eql(RIGHT_FIXTURE.attributes);

                    return [
                        {
                            contents: LEFT_RESPONSE
                        },
                        {
                            contents: RIGHT_RESPONSE
                        }
                    ];
                })
                .post(isBulk)
                .reply(200, function(uri, requestBody) {
                    let requests = requestBody.requests;
                    expect(requests.length).to.equal(1);
                    let request = requests[0];
                    expect(request.url).to.contain('TestModule1/TestId1/link');
                    let data = request.data;
                    expect(data.link_name).to.equal('leftToRight');
                    let ids = data.ids;
                    expect(ids.length).to.equal(1);
                    expect(ids[0]).to.equal('TestId2');
                });
            return Fixtures.create([linkedLeft, RIGHT_FIXTURE]);
        });

        it('should create fixtures and link them in 2 calls', () => {
            let fixture = [
                LEFT_FIXTURE,
                RIGHT_FIXTURE
            ];
            let server = nock(serverUrl)
                .post(isTokenReq)
                .reply(200, ACCESS)
                .post(isBulk)
                .reply(200, function(uri, requestBody) {
                    return [
                        {
                            contents: LEFT_RESPONSE
                        },
                        {
                            contents: RIGHT_RESPONSE
                        }
                    ];
                })
                .post(/TestId1\/link$/)
                .reply(200, function(uri, requestBody) {
                    expect(this.req.headers['x-thorn']).to.equal('Fixtures');
                    expect(requestBody.link_name).to.equal('leftToRight');
                    expect(requestBody.ids.length).to.equal(1);
                    expect(requestBody.ids[0]).to.equal('TestId2');
                    return {
                       record: LEFT_RESPONSE,
                        relatedRecords: [
                            RIGHT_RESPONSE
                        ]
                    };
                });
            return Fixtures.create(fixture).then((records) => {
                let left = records.TestModule1[0];
                let right = records.TestModule2[0];
                return Fixtures.link(left, 'leftToRight', right);
            });
        });
    });

    it('should clean up after itself when you call cleanup', () => {
        let record1 = {
            module: 'TestModule1',
            attributes: {
                name: 'TestRecord1',
                testField1: 'TestField1data1'
            }
        };
        let record2 = {
            module: 'TestModule1',
            attributes: {
                name: 'TestRecord2',
                testField1: 'TestField1data2'
            }
        };
        let record3 = {
            module: 'TestModule2',
            attributes: {
                name: 'TestRecord3',
                testField2: 'TestField2data'
            }
        };
        let bigFixture = [record1, record2, record3];
        let server = nock(serverUrl)
            .post(isTokenReq)
            .reply(200, ACCESS)
            .post(isBulk)
            .reply(200, function(uri, requestBody) {
                return [
                    {
                        contents: {
                            _module: 'TestModule1',
                            name: 'TestRecord1',
                            testField1: 'TestField1data1',
                            id: 'TestId1'
                        }
                    },
                    {
                        contents: {
                            _module: 'TestModule1',
                            name: 'TestRecord2',
                            testField1: 'TestField1data2',
                            id: 'TestId2'
                        }
                    },
                    {
                        contents: {
                            _module: 'TestModule2',
                            name: 'TestRecord3',
                            testField2: 'TestField2data',
                            id: 'TestId3'
                        }
                    }
                ];
            })
            .post(isBulk)
            .reply(200, function(uri, requestBody) {
                let requests = requestBody.requests;
                let request1 = requests[0];
                expect(request1.url).to.contain('TestModule1/TestId1');
                expect(request1.method).to.equal('DELETE');
                let request2 = requests[1];
                expect(request2.url).to.contain('TestModule1/TestId2');
                expect(request2.method).to.equal('DELETE');
                let request3 = requests[2];
                expect(request3.url).to.contain('TestModule2/TestId3');
                expect(request3.method).to.equal('DELETE');
                return [
                    {
                        contents: {
                            id: 'TestId1'
                        }
                    },
                    {
                        contents: {
                            id: 'TestId2'
                        }
                    },
                    {
                        contents: {
                            id: 'TestId3'
                        }
                    }
                ];
            });

        return Fixtures.create(bigFixture).then(() => {
            return Fixtures.cleanup().then((response) => {
                expect(_.isUndefined(response)).to.be.true;
                let gets = [
                    () => { return Fixtures.lookup('TestModule1', { name: 'TestRecord1' }); },
                    () => { return Fixtures.lookup('TestModule1', { name: 'TestRecord2' }); },
                    () => { return Fixtures.lookup('TestModule2', { name: 'TestRecord3' }); }
                ];
                _.each(gets, (get) => {
                    expect(get).to.throw(Error);
                });
            });
        });
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
            .post(isTokenReq)
            .reply(200, ACCESS);
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
