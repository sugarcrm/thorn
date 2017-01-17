require('babel-polyfill');
require('co-mocha');

describe('Utils', () => {
    let _, sinon, expect, utils;

    before(() => {
        _ = require('lodash');
        utils = require('../dist/utils.js');
        _ = require('lodash');
        sinon = require('sinon');
        let chai = require('chai');
        chai.use(require('chai-sinon'));
        expect = require('chai').expect;
    });

    after(() => {
        _.each(_.keys(require.cache), (key) => {
            delete require.cache[key];
        });
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
            let wrappedOptions = {'k': 'v'};

            let response = yield utils.wrapRequest(wrappedMethod, wrappedArgs, wrappedOptions);

            expect(wrappedMethod).to.be.calledOnce;
            expect(wrappedMethod).calledWithExactly('a');
            expect(response).to.equal(wrappedResponse);
        });

        it('should throw an error when invalid response is received', function*() {
            let wrappedMethod = sandbox.stub().returns(Promise.resolve());
            let wrappedArgs = ['a'];
            let wrappedOptions = {'k': 'v'};
            let errorMsg;

            try {
                yield utils.wrapRequest(wrappedMethod, wrappedArgs, wrappedOptions);

            } catch(e) {
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
            let wrappedOptions = {'k': 'v'};
            let error;

            try {
                yield utils.wrapRequest(wrappedMethod, wrappedArgs, wrappedOptions);

            } catch(e) {
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

            sandbox.stub(utils, 'refresh').returns(Promise.resolve({body: {'access_token': 'Token-2'}}));

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

