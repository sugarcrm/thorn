describe('Thorn', () => {
    let _ = require('lodash');
    let nock = require('nock');
    let serverUrl;
    let thorn;
    let Fixtures;
    let Agent;
    let expect = require('chakram').expect;
    let thornFile = '../dist/index.js';

    before(() => {
        process.env.ADMIN_USERNAME = 'foo';
        process.env.ADMIN_PASSWORD = 'bar';
        process.env.API_URL = 'http://thisisnotarealserver.localdev';
        process.env.METADATA_FILE = '../metadata.json';
        // TODO Put in correct server
        serverUrl = process.env.API_URL;

        nock.disableNetConnect();
        nock.emitter.on('no match', function(req, fullReq, reqData) {
            if (fullReq) {
                throw new Error('No handler remaining for ' + fullReq.method + ' to ' + fullReq.href);
            }

            throw new Error('No handler remaining.');
        });
    });

    // expect the result to be a promise
    // The only standard for a promise is that is has a `then`
    // http://www.ecma-international.org/ecma-262/6.0/#sec-promise-objects
    function isPromise(input) {
        if (input.then) {
            return input.then instanceof Function;
        }

        return false;
    }

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

    function constructBulkResponse(responses) {
        if (!_.isArray(responses)) {
            responses = [responses];
        }

        let bulkResponseWrapper = [];
        _.each(responses, (response) => {
            bulkResponseWrapper.push({
                contents: response,
                status: 200
            });
        });

        return bulkResponseWrapper;
    }

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
                nock(serverUrl)
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
                        return constructBulkResponse({
                            _module: 'TestModule1',
                            id: 'TestId1',
                            name: 'TestRecord1',
                            testField1: 'TestField1data',
                            testField2: 'TestField2data'
                        });
                    });
                let createPromise = Fixtures.create(myFixture);

                expect(isPromise(createPromise)).to.be.true;

                return createPromise;
            });

            it('should create a fixture using options.module', () => {
                let fixtureWithoutModule = _.clone(myFixture);
                delete fixtureWithoutModule[0].module;
                nock(serverUrl)
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
                        return constructBulkResponse({
                            id: 'TestId1',
                            name: 'TestRecord1',
                            testField1: 'TestField1data',
                            testField2: 'TestField2data'
                        });
                    });
                let createPromise = Fixtures.create(fixtureWithoutModule, {module: 'TestModule2'});

                expect(isPromise(createPromise)).to.be.true;

                return createPromise;
            });

            it('should create a fixture and find it', (done) => {
                nock(serverUrl)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk)
                    .reply(200, function(uri, requestBody) {
                        return constructBulkResponse({
                            _module: 'TestModule1',
                            id: 'TestId1',
                            name: 'TestRecord1',
                            testField1: 'TestField1data',
                            testField2: 'TestField2data'
                        });
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

            it('should retry fixture creation on 401\'s', () => {
                let originalRequestBody;

                nock(serverUrl)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk, function(requestBody) {
                        originalRequestBody = requestBody;
                        return true;
                    })
                    .reply(401)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk, function(requestBody) {
                        expect(requestBody).to.eql(originalRequestBody);
                        return true;
                    })
                    .reply(200, function(uri, requestBody) {
                        return constructBulkResponse({
                            _module: 'TestModule1',
                            id: 'TestId1',
                            name: 'TestRecord1',
                            testField1: 'TestField1data',
                            testField2: 'TestField2data'
                        });
                    });

                return Fixtures.create(myFixture);
            });

            it('should retry fixture creation until maximum login attempts are reached', () => {
                nock(serverUrl)
                    .post(isTokenReq)
                    .reply(401)
                    .post(isTokenReq)
                    .reply(401)
                    .post(isTokenReq)
                    .reply(401);

                return Fixtures.create(myFixture).catch((e) => {
                    return expect(e.message).to.equal('Max number of login attempts exceeded!');
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
            nock(serverUrl)
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

                    return constructBulkResponse([
                        contents1,
                        contents2,
                    ]);
                });
            let myFixture = [record1, record2];
            let createPromise = Fixtures.create(myFixture, {module: 'TestModule1'}).then((records) => {
                let testModuleRecords = records.TestModule1;
                expect(testModuleRecords.length).to.equal(2);
                expect(testModuleRecords[0]).to.eql(contents1);
                expect(testModuleRecords[1]).to.eql(contents2);
            });
            expect(isPromise(createPromise)).to.be.true;
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

            it('should create fixtures and link them', () => {});

            it('should retry fixture creation and linking on 401\'s', () => {});

            describe('with pre-existing records', () => {
                let records, left, right;
                let linkTestId1Regex = /TestId1\/link$/;

                beforeEach(() => {
                    nock(serverUrl)
                        .post(isTokenReq)
                        .reply(200, ACCESS)
                        .post(isBulk)
                        .reply(200, function() {
                            return constructBulkResponse([
                                LEFT_RESPONSE,
                                RIGHT_RESPONSE
                            ]);
                        });

                    return Fixtures.create([LEFT_FIXTURE, RIGHT_FIXTURE]).then((response) => {
                        records = response;
                        left = records.TestModule1[0];
                        right = records.TestModule2[0];
                    });
                });

                it('should link fixtures', () => {
                    nock(serverUrl)
                        .post(linkTestId1Regex)
                        .reply(200, function(uri, requestBody) {
                            expect(this.req.headers['x-thorn']).to.equal('Fixtures');
                            expect(requestBody.link_name).to.equal('leftToRight');
                            expect(requestBody.ids.length).to.equal(1);
                            expect(requestBody.ids[0]).to.equal('TestId2');
                            return {
                                record: LEFT_RESPONSE,
                                relatedRecords: [RIGHT_RESPONSE]
                            };
                        });

                    return Fixtures.link(left, 'leftToRight', right);
                });

                it('should retry linking fixtures on 401\'s', () => {
                    let originalRequestBody;

                    nock(serverUrl)
                        .post(linkTestId1Regex, function(requestBody) {
                            originalRequestBody = requestBody;
                            return true;
                        })
                        .reply(401)
                        .post(isTokenReq)
                        .reply(200, ACCESS)
                        .post(linkTestId1Regex, function(requestBody) {
                            expect(requestBody).to.eql(originalRequestBody);
                            return true;
                        })
                        .reply(200, function(uri, requestBody) {
                            return {
                                record: LEFT_RESPONSE,
                                relatedRecords: [RIGHT_RESPONSE]
                            };
                        });

                    return Fixtures.link(left, 'leftToRight', right);
                });
            });
        });

        describe('cleanup', () => {

            it('should retry clean up until maximum login attempts are reached', () => {
                nock(serverUrl)
                    .post(isTokenReq)
                    .reply(401)
                    .post(isTokenReq)
                    .reply(401)
                    .post(isTokenReq)
                    .reply(401);

                return Fixtures.cleanup().catch((e) => {
                    return expect(e.message).to.equal('Max number of login attempts exceeded!');
                });
            });

            describe('with pre-existing records', () => {
                beforeEach(() => {
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
                    nock(serverUrl)
                        .post(isTokenReq)
                        .reply(200, ACCESS)
                        .post(isBulk)
                        .reply(200, function() {
                            return constructBulkResponse([
                                {
                                    _module: 'TestModule1',
                                    name: 'TestRecord1',
                                    testField1: 'TestField1data1',
                                    id: 'TestId1'
                                },
                                {
                                    _module: 'TestModule1',
                                    name: 'TestRecord2',
                                    testField1: 'TestField1data2',
                                    id: 'TestId2'
                                },
                                {
                                    _module: 'TestModule2',
                                    name: 'TestRecord3',
                                    testField2: 'TestField2data',
                                    id: 'TestId3'
                                }
                            ]);
                        });

                    return Fixtures.create(bigFixture);
                });

                it('should clean up after itself when you call cleanup', () => {

                    nock(serverUrl)
                        .post(isBulk, function(requestBody) {
                            let requests = requestBody.requests;

                            expect(requests[0].url).to.contain('TestModule1/TestId1');
                            expect(requests[0].method).to.equal('DELETE');

                            expect(requests[1].url).to.contain('TestModule1/TestId2');
                            expect(requests[1].method).to.equal('DELETE');

                            expect(requests[2].url).to.contain('TestModule2/TestId3');
                            expect(requests[2].method).to.equal('DELETE');

                            return requestBody;
                        })
                        .reply(200, function() {
                            return constructBulkResponse([
                                {id: 'TestId1'},
                                {id: 'TestId2'},
                                {id: 'TestId3'}
                            ]);
                        });

                    return Fixtures.cleanup().then(() => {
                        try {
                            Fixtures.lookup();
                        } catch (e) {
                            return expect(e.message).to.equal('No cached records are currently available!');
                        }
                    });
                });

                it('should retry clean up on 401\'s', () => {
                    let originalRequestBody;

                    nock(serverUrl)
                        .post(isBulk, function(requestBody) {
                            originalRequestBody = requestBody;
                            return true;
                        })
                        .reply(401)
                        .post(isTokenReq)
                        .reply(200, ACCESS)
                        .post(isBulk, function(requestBody) {
                            expect(requestBody).to.eql(originalRequestBody);
                            return true;
                        })
                        .reply(200, function() {
                            return constructBulkResponse([
                                {id: 'TestId1'},
                                {id: 'TestId2'},
                                {id: 'TestId3'}
                            ]);
                        });

                    return Fixtures.cleanup();
                });
            });
        });
    });

    describe('Agent', () => {
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

                let myOtherAgentV11 = myAgent.on('v11');
                expect(myOtherAgentV11).to.equal(myAgentV11);
            });
        });

        describe('request methods', () => {
            let myAgent;
            let endpoint = 'not/real/endpoint';

            function isNotRealEndpoint(uri) {
                return uri.indexOf(endpoint) >= 0;
            }

            before(() => {
                myAgent = Agent.as(process.env.ADMIN_USERNAME);
            });

            it('should send GET request', () => {
                nock(serverUrl)
                    .get(isNotRealEndpoint)
                    .reply(200, function(uri, requestBody) {
                        expect(this.req.headers['x-thorn']).to.equal('Agent');
                        return [];
                    });
                let getRequest = myAgent.get(endpoint);

                expect(isPromise(getRequest)).to.be.true;

                return getRequest;
            });

            it('should send POST request', () => {
                let data = {
                    myField: 'myValue'
                };
                nock(serverUrl)
                    .post(isNotRealEndpoint)
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
                let data = {
                    myField: 'myUpdatedValue'
                };
                nock(serverUrl)
                    .put(isNotRealEndpoint)
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
                let data = {
                    myField: 'myValue'
                };
                nock(serverUrl)
                    .delete(isNotRealEndpoint)
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
});
