/*
 * Copyright (c) 2017 SugarCRM Inc. Licensed by SugarCRM under the Apache 2.0 license.
 */

describe('Metadata Fetcher', () => {
    let _;
    let expect;
    let nock;
    let MetadataHandler;
    let MetadataFetcher;
    let metadata;
    let expected;

    before(() => {
        _ = require('lodash');
        expect = require('chakram').expect;
        nock = require('nock');

        MetadataHandler = require('../metadata-handler.js');
        MetadataFetcher = require('../metadata-fetcher.js');
        metadata = require('./fixtures/metadata-fetcher-fixture.json');

        expected = {
            Module1: {
                fields: {
                    'field1.1': {
                        name: 'field1.1',
                        required: true,
                    },
                },
            },
            Module2: {
                fields: {
                    'field2.1': {
                        name: 'field2.1',
                        required: true,
                    },
                },
            },
        };

        nock.disableNetConnect();
        nock.emitter.on('no match', (req, fullReq, reqData) => {
            if (fullReq) {
                throw new Error(`No handler remaining for ${fullReq.method} to ${fullReq.href}`);
            }
            throw new Error('No handler remaining.');
        });
    });

    after(() => {
        _.each(_.keys(require.cache), (key) => {
            delete require.cache[key];
        });
    });

    afterEach(() => {
        MetadataHandler.clearCachedMetadata();
        nock.cleanAll();
    });

    describe('metadata retrieval', () => {
        beforeEach(() => {
            nock(process.env.THORN_SERVER_URL)
                .post(url => url.indexOf('oauth2/token') >= 0)
                .reply(200, {
                    access_token: 'Test-Access-Token',
                })
                .get(url => url.indexOf('metadata') >= 0)
                .reply(200, metadata);
        });

        it('should return formatted metadata retrieved from the server', function*() {
            let returnMeta = yield MetadataFetcher.fetch();
            expect(returnMeta).to.eql(expected);
        });
    });

    describe('when two fetches are in progress', () => {
        it('should only trigger a single server request', function*() {
            let server = nock(process.env.THORN_SERVER_URL)
                .post(url => url.indexOf('oauth2/token') >= 0)
                .reply(200, {
                    access_token: 'Test-Access-Token',
                })
                .get(url => url.indexOf('metadata') >= 0)
                .delay(0)
                .reply(200, metadata);

            yield Promise.all([MetadataFetcher.fetch(), MetadataFetcher.fetch()]);
            expect(server.isDone()).to.be.true;
        });
    });

    describe('integration with metadata-helper', () => {
        beforeEach(() => {
            nock(process.env.THORN_SERVER_URL)
                .post(url => url.indexOf('oauth2/token') >= 0)
                .reply(200, {
                    access_token: 'Test-Access-Token',
                })
                .get(url => url.indexOf('metadata') >= 0)
                .reply(200, metadata);
        });

        it('should retrieve metadata from the server', function*() {
            let returnMeta = yield MetadataHandler.getRequiredFields('Module1');
            expect(returnMeta).to.eql(expected.Module1.fields);
        });
    });
});
