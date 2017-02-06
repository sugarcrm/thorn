describe('Thorn', () => {
    // These are set once for the test suite
    let _, expect, nock, thornFile;

    // These are set up for each individual test
    let thorn, Fixtures, Agent;

    before(() => {
        _ = require('lodash');
        expect = require('chakram').expect;
        nock = require('nock');
        thornFile = '../dist/index.js';

        process.env.THORN_METADATA_FILE = '../metadata.json';

        nock.disableNetConnect();
        nock.emitter.on('no match', function(req, fullReq, reqData) {
            if (fullReq) {
                throw new Error('No handler remaining for ' + fullReq.method + ' to ' + fullReq.href);
            }

            throw new Error('No handler remaining.');
        });
    });

    after(() => {
        // After the test suite is done, clean up the require cache.
        // Some of our required files (Thorn, metadata-handler, etc)
        // contain state information. This ensures that changes to
        // our required objects are not shared across tests.
        // This cleanup should happen at the end of each test suite for Thorn.
        _.each(_.keys(require.cache), (key) => {
            delete require.cache[key];
        });
        delete process.env.THORN_METADATA_FILE;
    });

    // The only way to reset the state of Thorn & Thorn.fixtures is to do the below.
    // Each test assumes a clean version of Thorn, which is why we need to reset between tests.
    // See https://nodejs.org/api/globals.html#globals_require_cache for more info.
    beforeEach(() => {
        thorn = require(thornFile);
        Agent = thorn.Agent;
        Fixtures = thorn.Fixtures;
    });

    afterEach(() => {
        delete require.cache[require.resolve(thornFile)];
        nock.cleanAll();
        Agent = null;
        Fixtures = null;
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
        refresh_token: 'Test-Refresh-Token',
    };

    function constructBulkResponse(responses) {
        if (!_.isArray(responses)) {
            responses = [responses];
        }

        let bulkResponseWrapper = [];
        _.each(responses, (response) => {
            bulkResponseWrapper.push({
                contents: response,
                status: 200,
            });
        });

        return bulkResponseWrapper;
    }

    describe('Fixtures', () => {
        describe('creation', () => {
            let fixture;

            beforeEach(() => {
                fixture = {
                    module: 'TestModule1',
                    attributes: {
                        name: 'TestRecord1',
                        testField1: 'TestField1data',
                        testField2: 'TestField2data',
                    },
                };
            });

            it('should create a fixture', function*() {
                let server = nock(process.env.THORN_SERVER_URL)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk)
                    .reply(200, function(uri, requestBody) {
                        let request = requestBody.requests[0];

                        expect(request.url).to.contain(fixture.module);
                        expect(request.method).to.equal('POST');
                        expect(request.data).to.eql(fixture.attributes);

                        expect(this.req.headers['x-thorn']).to.equal('Fixtures');

                        return constructBulkResponse({
                            _module: fixture.module,
                            id: 'TestId1',
                            name: fixture.attributes.name,
                            testField1: fixture.attributes.testField1,
                            testField2: fixture.attributes.testField2,
                        });
                    });
                let createPromise = Fixtures.create(fixture);

                expect(isPromise(createPromise)).to.be.true;

                yield createPromise;
                expect(server.isDone()).to.be.true;
            });

            it('should create a fixture using options.module', function*() {
                let module = 'TestModule2';
                let fixtureWithoutModule = _.clone(fixture);
                delete fixtureWithoutModule.module;

                let server = nock(process.env.THORN_SERVER_URL)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk)
                    .reply(200, function(uri, requestBody) {
                        let request = requestBody.requests[0];

                        expect(request.url).to.contain(module);
                        expect(request.method).to.equal('POST');
                        expect(request.data).to.eql(fixtureWithoutModule.attributes);

                        expect(this.req.headers['x-thorn']).to.equal('Fixtures');

                        return constructBulkResponse({
                            _module: module,
                            id: 'TestId1',
                            name: fixtureWithoutModule.name,
                            testField1: fixtureWithoutModule.attributes.testField1,
                            testField2: fixtureWithoutModule.attributes.testField2,
                        });
                    });
                let createPromise = Fixtures.create(fixtureWithoutModule, {module: module});

                expect(isPromise(createPromise)).to.be.true;

                yield createPromise;
                expect(server.isDone()).to.be.true;
            });

            it('should create multiple fixtures', function*() {
                let module = 'TestModule1';
                let fixture1 = {
                    attributes: {
                        name: 'TestRecord1',
                        testField1: 'TestField1data1',
                    },
                };
                let fixture2 = {
                    attributes: {
                        name: 'TestRecord2',
                        testField1: 'TestField1data2',
                    },
                };
                let contents1 = {
                    _module: module,
                    name: fixture1.attributes.name,
                    testField1: fixture1.attributes.testField1,
                };
                let contents2 = {
                    _module: module,
                    name: fixture2.attributes.name,
                    testField1: fixture2.attributes.testField1,
                };

                let server = nock(process.env.THORN_SERVER_URL)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk)
                    .reply(200, function(uri, requestBody) {
                        let requests = requestBody.requests;

                        let request1 = requests[0];
                        expect(request1.url).to.contain(module);
                        expect(request1.method).to.equal('POST');
                        expect(request1.data).to.eql(fixture1.attributes);

                        let request2 = requests[1];
                        expect(request2.url).to.contain(module);
                        expect(request2.method).to.equal('POST');
                        expect(request2.data).to.eql(fixture2.attributes);

                        expect(this.req.headers['x-thorn']).to.equal('Fixtures');

                        return constructBulkResponse([
                            contents1,
                            contents2,
                        ]);
                    });

                let records = yield Fixtures.create([fixture1, fixture2], {module: module});
                let testModuleRecords = records[module];
                expect(testModuleRecords).to.eql([contents1, contents2]);
                expect(server.isDone()).to.be.true;
            });

            it('should retry fixture creation on 401\'s', function*() {
                let originalRequestBody;

                let server = nock(process.env.THORN_SERVER_URL)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk, (requestBody) => {
                        originalRequestBody = requestBody;
                        return true;
                    })
                    .reply(401)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk, (requestBody) => {
                        expect(requestBody).to.eql(originalRequestBody);
                        return true;
                    })
                    .reply(200, constructBulkResponse({
                        _module: fixture.module,
                        id: 'TestId1',
                        name: fixture.attributes.name,
                        testField1: fixture.attributes.testField1,
                        testField2: fixture.attributes.testField2,
                    }));

                yield Fixtures.create(fixture);
                expect(server.isDone()).to.be.true;
            });

            it('should retry fixture creation until maximum login attempts are reached', function*() {
                let server = nock(process.env.THORN_SERVER_URL)
                    .post(isTokenReq)
                    .reply(401)
                    .post(isTokenReq)
                    .reply(401)
                    .post(isTokenReq)
                    .reply(401);

                yield Fixtures.create(fixture).catch((e) => {
                    expect(e.message).to.equal('Max number of login attempts exceeded!');
                });
                expect(server.isDone()).to.be.true;
            });
        });

        describe('lookup', () => {
            let fixture;

            beforeEach(() => {
                fixture = {
                    module: 'TestModule1',
                    attributes: {
                        name: 'TestRecord1',
                        testField1: 'TestField1data',
                        testField2: 'TestField2data',
                    },
                };
            });

            it('should throw an error if no records have been created', () => {
                expect(() => Fixtures.lookup(fixture.module, {name: fixture.attributes.name})).to.throw('No cached records are currently available!');
            });

            describe('with pre-existing records', () => {
                beforeEach(function*() {
                    nock(process.env.THORN_SERVER_URL)
                        .post(isTokenReq)
                        .reply(200, ACCESS)
                        .post(isBulk)
                        .reply(200, constructBulkResponse({
                            _module: fixture.module,
                            id: 'TestId1',
                            name: fixture.attributes.name,
                            testField1: fixture.attributes.testField1,
                            testField2: fixture.attributes.testField2,
                        }));

                    yield Fixtures.create(fixture);
                });

                it('should be able to find previously created records', () => {
                    let lookup1 = Fixtures.lookup(fixture.module, {name: fixture.attributes.name});
                    expect(lookup1.name).to.equal(fixture.attributes.name);
                    expect(lookup1.testField1).to.equal(fixture.attributes.testField1);
                    expect(lookup1.testField2).to.equal(fixture.attributes.testField2);

                    let lookup2 = Fixtures.lookup(fixture.module, {testField1: fixture.attributes.testField1});
                    let lookup3 = Fixtures.lookup(fixture.module, {testField2: fixture.attributes.testField2});
                    expect(lookup1 == lookup2).to.be.true;
                    expect(lookup1 == lookup3).to.be.true;
                });

                it('should throw an error if no records have been created for given module', () => {
                    let module = 'TestModule2';
                    expect(() => Fixtures.lookup(module, {name: 'TestRecord2'})).to.throw('No cached records found for module: ' + module);
                });
            });
        });

        describe('linking', () => {
            let fixture1, fixture2, contents1, contents2, link;

            beforeEach(() => {
                fixture1 = {
                    module: 'TestModule1',
                    attributes: {
                        name: 'TestRecord1',
                        testField1: 'TestField1data1',
                        testField2: 'TestField2data1',
                    },
                };
                fixture2 = {
                    module: 'TestModule2',
                    attributes: {
                        name: 'TestRecord2',
                        testField1: 'TestField1data2',
                        testField2: 'TestField2data2',
                    },
                };
                contents1 = {
                    _module: fixture1.module,
                    id: 'TestId1',
                    name: fixture1.attributes.name,
                    testField1: fixture1.attributes.testField1,
                    testField2: fixture1.attributes.testField2,
                };
                contents2 = {
                    _module: fixture2.module,
                    id: 'TestId2',
                    name: fixture2.attributes.name,
                    testField1: fixture2.attributes.testField1,
                    testField2: fixture2.attributes.testField2,
                };
                link = 'link-to-testmodule2';
            });

            it('should create fixtures and link them', function*() {
                let fixture1WithLinks = _.clone(fixture1);
                fixture1WithLinks.links = {};
                fixture1WithLinks.links[link] = [fixture2];

                let server = nock(process.env.THORN_SERVER_URL)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk)
                    .reply(200, () => {
                        return constructBulkResponse([contents1, contents2]);
                    })
                    .post(isBulk)
                    .reply(200, function(uri, requestBody) {
                        let request = requestBody.requests[0];

                        expect(request.url).to.contain(fixture1.module + '/' + contents1.id + '/link');
                        expect(request.method).to.equal('POST');
                        expect(request.data.link_name).to.equal(link);
                        expect(request.data.ids).to.eql([contents2.id]);

                        expect(this.req.headers['x-thorn']).to.equal('Fixtures');

                        return constructBulkResponse({
                            record: contents1,
                            related_records: [contents2],
                        });
                    });

                yield Fixtures.create([fixture1WithLinks, fixture2]);
                expect(server.isDone()).to.be.true;
            });

            it('should retry fixture creation and linking on 401\'s', function*() {
                let fixture1WithLinks = _.clone(fixture1);
                fixture1WithLinks.links = {};
                fixture1WithLinks.links[link] = [fixture2];

                let originalRequestBody;

                let server = nock(process.env.THORN_SERVER_URL)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk)
                    .reply(200, () => {
                        return constructBulkResponse([contents1, contents2]);
                    })
                    .post(isBulk, (requestBody) => {
                        originalRequestBody = requestBody;
                        return true;
                    })
                    .reply(401)
                    .post(isTokenReq)
                    .reply(200, ACCESS)
                    .post(isBulk, (requestBody) => {
                        expect(requestBody).to.eql(originalRequestBody);
                        return true;
                    })
                    .reply(200, function(uri, requestBody) {
                        let request = requestBody.requests[0];

                        expect(request.url).to.contain(fixture1.module + '/' + contents1.id + '/link');
                        expect(request.method).to.equal('POST');
                        expect(request.data.link_name).to.equal(link);
                        expect(request.data.ids).to.eql([contents2.id]);

                        expect(this.req.headers['x-thorn']).to.equal('Fixtures');

                        return constructBulkResponse({
                            record: contents1,
                            related_records: [contents2],
                        });
                    });

                yield Fixtures.create([fixture1WithLinks, fixture2]);
                expect(server.isDone()).to.be.true;
            });

            describe('with pre-existing records', () => {
                let left, right, linkTestId1Regex;

                beforeEach(function*() {
                    nock(process.env.THORN_SERVER_URL)
                        .post(isTokenReq)
                        .reply(200, ACCESS)
                        .post(isBulk)
                        .reply(200, constructBulkResponse([
                            contents1,
                            contents2,
                        ]));

                    let records = yield Fixtures.create([fixture1, fixture2]);

                    left = records.TestModule1[0];
                    right = records.TestModule2[0];
                    linkTestId1Regex = /TestId1\/link$/;
                });

                it('should link records', function*() {
                    let server = nock(process.env.THORN_SERVER_URL)
                        .post(linkTestId1Regex)
                        .reply(200, function(uri, requestBody) {
                            expect(requestBody.link_name).to.equal(link);
                            expect(requestBody.ids).to.eql([contents2.id]);

                            expect(this.req.headers['x-thorn']).to.equal('Fixtures');

                            return {
                                record: contents1,
                                related_records: [contents2],
                            };
                        });

                    yield Fixtures.link(left, link, right);
                    expect(server.isDone()).to.be.true;
                });

                it('should retry linking records on 401\'s', function*() {
                    let originalRequestBody;

                    let server = nock(process.env.THORN_SERVER_URL)
                        .post(linkTestId1Regex, (requestBody) => {
                            originalRequestBody = requestBody;
                            return true;
                        })
                        .reply(401)
                        .post(isTokenReq)
                        .reply(200, ACCESS)
                        .post(linkTestId1Regex, (requestBody) => {
                            expect(requestBody).to.eql(originalRequestBody);
                            return true;
                        })
                        .reply(200, {
                            record: contents1,
                            related_records: [contents2],
                        });

                    yield Fixtures.link(left, link, right);
                    expect(server.isDone()).to.be.true;
                });
            });
        });

        describe('cleanup', () => {
            it('should retry clean up until maximum login attempts are reached', function*() {
                let server = nock(process.env.THORN_SERVER_URL)
                    .post(isTokenReq)
                    .reply(401)
                    .post(isTokenReq)
                    .reply(401)
                    .post(isTokenReq)
                    .reply(401);

                yield Fixtures.cleanup().catch((e) => {
                    expect(e.message).to.equal('Max number of login attempts exceeded!');
                });
                expect(server.isDone()).to.be.true;
            });

            describe('with pre-existing records', () => {
                let fixture1, fixture2, fixture3, contents1, contents2, contents3;

                beforeEach(function*() {
                    fixture1 = {
                        module: 'TestModule1',
                        attributes: {
                            name: 'TestRecord1',
                            testField1: 'TestField1data1',
                        },
                    };
                    fixture2 = {
                        module: 'TestModule1',
                        attributes: {
                            name: 'TestRecord2',
                            testField1: 'TestField1data2',
                        },
                    };
                    fixture3 = {
                        module: 'TestModule2',
                        attributes: {
                            name: 'TestRecord3',
                            testField2: 'TestField2data',
                        },
                    };
                    contents1 = {
                        _module: fixture1.module,
                        id: 'TestId1',
                        name: fixture1.attributes.name,
                        testField1: fixture1.attributes.testField1,
                    };
                    contents2 = {
                        _module: fixture2.module,
                        id: 'TestId2',
                        name: fixture2.attributes.name,
                        testField1: fixture2.attributes.testField1,
                    };
                    contents3 = {
                        _module: fixture3.module,
                        id: 'TestId3',
                        name: fixture3.attributes.name,
                        testField2: fixture3.attributes.testField2,
                    };

                    nock(process.env.THORN_SERVER_URL)
                        .post(isTokenReq)
                        .reply(200, ACCESS)
                        .post(isBulk)
                        .reply(200, constructBulkResponse([contents1, contents2, contents3]));

                    yield Fixtures.create([fixture1, fixture2, fixture3]);
                });

                it('should clean up after itself when you call cleanup', function*() {
                    let server = nock(process.env.THORN_SERVER_URL)
                        .post(isBulk, (requestBody) => {
                            let requests = requestBody.requests;

                            let request1 = requests[0];
                            expect(request1.url).to.contain(fixture1.module + '/' + contents1.id);
                            expect(request1.method).to.equal('DELETE');

                            let request2 = requests[1];
                            expect(request2.url).to.contain(fixture2.module + '/' + contents2.id);
                            expect(request2.method).to.equal('DELETE');

                            let request3 = requests[2];
                            expect(request3.url).to.contain(fixture3.module + '/' + contents3.id);
                            expect(request3.method).to.equal('DELETE');

                            return requestBody;
                        })
                        .reply(200, constructBulkResponse([
                            {id: contents1.id},
                            {id: contents2.id},
                            {id: contents3.id},
                        ]));

                    yield Fixtures.cleanup();
                    expect(server.isDone()).to.be.true;

                    //FIXME: We need an integration test making sure the
                    //`cachedRecords` and the `cachedAgents` are emptied.
                    //The test could be:
                    // 1) Create a User fixture and set it as an agent.
                    // 2) clean up the fixtures
                    // 3) Create a User fixture with the same username and set
                    //    it as an agent
                    // 4) Do a request with this user and make sure you get a 200.
                });

                it('should retry clean up on 401\'s', function*() {
                    let originalRequestBody;

                    let server = nock(process.env.THORN_SERVER_URL)
                        .post(isBulk, (requestBody) => {
                            originalRequestBody = requestBody;
                            return true;
                        })
                        .reply(401)
                        .post(isTokenReq)
                        .reply(200, ACCESS)
                        .post(isBulk, (requestBody) => {
                            expect(requestBody).to.eql(originalRequestBody);
                            return true;
                        })
                        .reply(200, constructBulkResponse([
                            {id: contents1.id},
                            {id: contents2.id},
                            {id: contents3.id},
                        ]));

                    yield Fixtures.cleanup();
                    expect(server.isDone()).to.be.true;
                });
            });
        });
    });

    describe('Agent', () => {
        beforeEach(() => {
            nock(process.env.THORN_SERVER_URL)
                .post(isTokenReq)
                .reply(200, ACCESS);
        });

        describe('as', () => {
            it('should return an Agent with cached username and password', () => {
                let myAgent = Agent.as(process.env.THORN_ADMIN_USERNAME);

                expect(myAgent.username).to.equal(process.env.THORN_ADMIN_USERNAME);
                expect(myAgent.password).to.equal(process.env.THORN_ADMIN_PASSWORD);
            });

            it('should throw an error if no username given', () => {
                expect(() => Agent.as('')).to.throw('Tried to create a user agent with no username!');
            });

            it('should throw an error if given username is not found', () => {
                expect(() => Agent.as('nonexistent')).to.throw('No credentials available for user: nonexistent');
            });
        });

        describe('on', () => {
            let myAgent;

            beforeEach(() => {
                myAgent = Agent.as(process.env.THORN_ADMIN_USERNAME);
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
            let myAgent, endpoint;

            function isNotRealEndpoint(uri) {
                return uri.indexOf(endpoint) >= 0;
            }

            beforeEach(() => {
                myAgent = Agent.as(process.env.THORN_ADMIN_USERNAME);
                endpoint = 'not/real/endpoint';
            });

            it('should send GET request', function*() {
                let server = nock(process.env.THORN_SERVER_URL)
                    .get(isNotRealEndpoint)
                    .reply(200, function(uri, requestBody) {
                        expect(this.req.headers['x-thorn']).to.equal('Agent');
                        return [];
                    });
                let getRequest = myAgent.get(endpoint);

                expect(isPromise(getRequest)).to.be.true;

                yield getRequest;
                expect(server.isDone()).to.be.true;
            });

            it('should send POST request', function*() {
                let data = {
                    myField: 'myValue',
                };
                let server = nock(process.env.THORN_SERVER_URL)
                    .post(isNotRealEndpoint)
                    .reply(200, function(uri, requestBody) {
                        expect(this.req.headers['x-thorn']).to.equal('Agent');
                        expect(requestBody).to.eql(data);

                        return [];
                    });
                let postRequest = myAgent.post(endpoint, data);

                expect(isPromise(postRequest)).to.be.true;

                yield postRequest;
                expect(server.isDone()).to.be.true;
            });

            it('should send PUT request', function*() {
                let data = {
                    myField: 'myUpdatedValue',
                };
                let server = nock(process.env.THORN_SERVER_URL)
                    .put(isNotRealEndpoint)
                    .reply(200, function(uri, requestBody) {
                        expect(this.req.headers['x-thorn']).to.equal('Agent');
                        expect(requestBody).to.eql(data);

                        return [];
                    });
                let putRequest = myAgent.put(endpoint, data);

                expect(isPromise(putRequest)).to.be.true;

                yield putRequest;
                expect(server.isDone()).to.be.true;
            });

            it('should send DELETE request', function*() {
                let data = {
                    myField: 'myValue',
                };
                let server = nock(process.env.THORN_SERVER_URL)
                    .delete(isNotRealEndpoint)
                    .reply(200, function(uri, requestBody) {
                        expect(this.req.headers['x-thorn']).to.equal('Agent');
                        expect(requestBody).to.eql(data);

                        return [];
                    });
                let deleteRequest = myAgent.delete(endpoint, data);

                expect(isPromise(deleteRequest)).to.be.true;

                yield deleteRequest;
                expect(server.isDone()).to.be.true;
            });
        });
    });
});
