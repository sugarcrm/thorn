/*
 * Copyright (c) 2017 SugarCRM Inc. Licensed by SugarCRM under the Apache 2.0 license.
 */

describe('Utils', () => {
    let _;
    let sinon;
    let expect;
    let utils;

    before(() => {
        _ = require('lodash');
        sinon = require('sinon');
        let chai = require('chai');
        chai.use(require('chai-sinon'));
        expect = require('chai').expect;
        utils = require('../dist/utils.js');
    });

    after(() => {
        _.each(_.keys(require.cache), (key) => {
            delete require.cache[key];
        });
    });

    describe('login', () => {
        let nock;

        before(() => {
            nock = require('nock');
            nock.disableNetConnect();
            nock.emitter.on('no match', (req, fullReq, reqData) => {
                if (fullReq) {
                    throw new Error(`No handler remaining for ${fullReq.method} to ${fullReq.href}`);
                }

                throw new Error('No handler remaining.');
            });
        });

        afterEach(() => {
            nock.cleanAll();
        });

        it('should post to the login endpoint with the right params', function*() {
            let options = {
                username: 'TestUser',
                password: 'TestPass',
                version: 'TestVersion',
                xthorn: 'TestHeader',
            };

            let server = nock(process.env.THORN_SERVER_URL)
                .post(`/rest/${options.version}/oauth2/token`)
                .reply(200, function(uri, requestBody) {
                    expect(requestBody.username).to.equal(options.username);
                    expect(requestBody.password).to.equal(options.password);
                    expect(requestBody.grant_type).to.equal('password');
                    expect(requestBody.client_id).to.equal('sugar');
                    expect(requestBody.client_secret).to.equal('');
                    expect(this.req.headers['x-thorn']).to.equal(options.xthorn);
                });

            yield utils.login(options);
            expect(server.isDone()).to.be.true;
        });
    });

    describe('refresh', () => {
        let nock;

        before(() => {
            nock = require('nock');
            nock.disableNetConnect();
            nock.emitter.on('no match', (req, fullReq, reqData) => {
                if (fullReq) {
                    throw new Error(`No handler remaining for ${fullReq.method} to ${fullReq.href}`);
                }

                throw new Error('No handler remaining.');
            });
        });

        afterEach(() => {
            nock.cleanAll();
        });

        it('should post to the refresh endpoint with the right params', function*() {
            let options = {
                version: 'TestVersion',
                token: 'TestToken',
                xthorn: 'TestHeader',
            };

            let server = nock(process.env.THORN_SERVER_URL)
                .post(`/rest/${options.version}/oauth2/token`)
                .reply(200, function(uri, requestBody) {
                    expect(requestBody.grant_type).to.equal('refresh_token');
                    expect(requestBody.refresh_token).to.equal(options.token);
                    expect(requestBody.client_id).to.equal('sugar');
                    expect(requestBody.client_secret).to.equal('');
                    expect(this.req.headers['x-thorn']).to.equal(options.xthorn);
                });

            yield utils.refresh(options);
            expect(server.isDone()).to.be.true;
        });
    });

    describe('constructUrl', () => {
        it('should return a URL relative to THORN_SERVER_URL', () => {
            let url = utils.constructUrl('location');
            expect(url.startsWith(process.env.THORN_SERVER_URL)).to.be.true;
        });

        it('should join arguments in order with slashes', () => {
            let url = utils.constructUrl('test', 'url', 'directories');
            expect(url).to.match(/\/test\/url\/directories/);
        });

        it('should construct the URL with \'rest\' in the appropriate location', () => {
            let url = utils.constructUrl('test');
            expect(url).to.match(/\/rest\/test/);
        });
    });

    describe('wrapRequest', () => {
        let sandbox;

        beforeEach(() => {
            sandbox = sinon.sandbox.create();
        });

        afterEach(() => {
            sandbox.restore();
        });

        it('should return responses from successful requests', function*() {
            let wrappedResponse = {response: {statusCode: 200}};
            let wrappedMethod = sandbox.stub().returns(Promise.resolve(wrappedResponse));
            let wrappedArgs = ['a'];
            let wrappedOptions = {k: 'v'};

            let response = yield utils.wrapRequest(wrappedMethod, wrappedArgs, wrappedOptions);

            expect(wrappedMethod).to.be.calledOnce;
            expect(wrappedMethod).calledWithExactly('a');
            expect(response).to.equal(wrappedResponse);
        });

        it('should throw an error when invalid response is received', function*() {
            let wrappedMethod = sandbox.stub().returns(Promise.resolve());
            let wrappedArgs = ['a'];
            let wrappedOptions = {k: 'v'};
            let errorMsg;

            try {
                yield utils.wrapRequest(wrappedMethod, wrappedArgs, wrappedOptions);
            } catch (e) {
                errorMsg = e.message;
            }

            expect(wrappedMethod).to.be.calledOnce;
            expect(wrappedMethod).to.be.calledWithExactly('a');
            expect(errorMsg).to.equal('Invalid response received!');
        });

        it('should throw an error on unsuccessful requests', function*() {
            let wrappedResponse = {
                response: {
                    statusCode: 500,
                    statusMessage: 'Internal server error!',
                },
            };
            let wrappedMethod = sandbox.stub().returns(Promise.resolve(wrappedResponse));
            let wrappedArgs = ['a'];
            let wrappedOptions = {k: 'v'};
            let error;

            try {
                yield utils.wrapRequest(wrappedMethod, wrappedArgs, wrappedOptions);
            } catch (e) {
                error = e;
            }

            expect(wrappedMethod).to.be.calledOnce;
            expect(wrappedMethod).to.be.calledWithExactly('a');
            expect(error).to.eql(wrappedResponse);
        });

        it('should perform token refresh on 401\'s and re-execute given method', function*() {
            let wrappedResponses = [
                {response: {statusCode: 401}},
                {response: {statusCode: 200}},
            ];

            let wrappedMethod = sandbox.stub();
            wrappedMethod.onCall(0).returns(Promise.resolve(wrappedResponses[0]));
            wrappedMethod.onCall(1).returns(Promise.resolve(wrappedResponses[1]));
            let wrappedArgs = ['', {}, {headers: {'OAuth-Token': 'Token-1'}}];
            let wrappedOptions = {
                retryVersion: 'a',
                refreshToken: 'b',
                xthorn: 'c',
                afterRefresh: sandbox.stub(),
            };

            sandbox.stub(utils, 'refresh').returns(Promise.resolve({body: {access_token: 'Token-2'}}));

            let expectedRefreshOptions = {
                version: wrappedOptions.retryVersion,
                token: wrappedOptions.refreshToken,
                xthorn: wrappedOptions.xthorn,
            };

            let expectedWrappedArgs = _.cloneDeep(wrappedArgs);
            expectedWrappedArgs[2].headers['OAuth-Token'] = 'Token-2';

            let response = yield utils.wrapRequest(wrappedMethod, wrappedArgs, wrappedOptions);

            expect(wrappedMethod.calledTwice).to.be.true;
            expect(wrappedMethod.firstCall).to.be.calledWithExactly('', {}, {headers: {'OAuth-Token': 'Token-1'}});
            expect(wrappedMethod.secondCall).to.be.calledWithExactly('', {}, {headers: {'OAuth-Token': 'Token-2'}});

            expect(utils.refresh).to.be.calledOnce;
            expect(utils.refresh).to.be.calledWithExactly(expectedRefreshOptions);

            expect(response).to.eql(wrappedResponses[1]);
        });
    });
});
