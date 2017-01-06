describe('Metadata Fetcher', () => {
    process.env.ADMIN_USERNAME = 'foo';
    process.env.ADMIN_PASSWORD = 'bar';
    process.env.API_URL = 'http://thisisnotarealserver.localdev';
    let _ = require('lodash');
    let nock = require('nock');
    let fs = require('fs');
    let expect = require('chai').expect;
    let fail = require('chai').fail;
    let metadataHandlerFile = '../dist/metadata-handler.js';

    delete require.cache[require.resolve(metadataHandlerFile)];

    let MetadataHandler = require(metadataHandlerFile);
    let MetadataFetcher = require('../dist/metadata-fetcher.js');
    let metadata = require('./metadata-fetcher-fixture.json');

    let expected = {
        "Module1": {
             "fields": {
                 "field1.1": {
                     "name": "field1.1",
                     "required": true
                 }
             }
         },
         "Module2": {
             "fields": {
                 "field2.1": {
                     "name": "field2.1",
                     "required": true
                }
            }
        }
    };

    before(() => {
        process.env.METADATA_FILE = '';

        nock.disableNetConnect();
        nock.emitter.on('no match', function(req, fullReq, reqData) {
            if (fullReq) {
                throw new Error('No handler remaining for ' + fullReq.method + ' to ' + fullReq.href);
            }
            throw new Error('No handler remaining.');
        });
    });

    afterEach(() => {
        MetadataHandler.clearCachedMetadata();
        nock.cleanAll();
    });

    describe('metadata retrieval', () => {
        beforeEach(() => {
            nock(process.env.API_URL)
                .post((url) => {
                    return url.indexOf('oauth2/token') >= 0;
                })
                .reply(200, {
                    access_token: 'Test-Access-Token',
                })
                .get((url) => {
                    return url.indexOf('metadata') >= 0;
                })
                .reply(200, metadata);

        });

        it('should return formatted metadata retrieved from the server', () => {
            return MetadataFetcher.fetch()
                .then((metadata) => {
                    expect(metadata).eql(expected);
                });
        });
    });

    describe('when two fetches are in progress', () => {
        it('should only trigger a single server request', () => {
            nock(process.env.API_URL)
                .post((url) => {
                    return url.indexOf('oauth2/token') >= 0;
                })
                .reply(200, {
                    access_token: 'Test-Access-Token',
                })
                .get((url) => {
                    return url.indexOf('metadata') >= 0;
                })
                .delay(0)
                .reply(200, metadata)
                .post((url) => {
                    fail('two requests', 'one request');
                    return true;
                })
                .reply(200);
            return Promise.all([
                MetadataFetcher.fetch(), 
                MetadataFetcher.fetch()
            ]);
        });

    });
    describe('integration with metadata-helper', () => {
        beforeEach(() => {
            nock(process.env.API_URL)
                .post((url) => {
                    return url.indexOf('oauth2/token') >= 0;
                })
                .reply(200, {
                    access_token: 'Test-Access-Token',
                })
                .get((url) => {
                    return url.indexOf('metadata') >= 0;
                })
                .reply(200, metadata);

        });

        it('should retrieve metadata from the server', () => {
            return MetadataHandler.getRequiredFields('Module1')
                .then((metadata) => {
                    expect(metadata).eql(expected.Module1.fields);
                });
        });
    });

});

