describe('Metadata Fetcher', () => {
    let _ = require('lodash');
    let nock = require('nock');
    let fs = require('fs');
    let expect = require('chai').expect;
    let metadataHandlerFile = '../dist/metadata-handler.js';

    delete require.cache[require.resolve(metadataHandlerFile)];

    let MetadataHandler = require(metadataHandlerFile);
    let MetadataFetcher = require('../dist/metadata-fetcher.js');
    let ReturnMetadata = require('./metadata-fetcher-fixture.json');

    before(() => {
        process.env.ADMIN_USERNAME = 'foo';
        process.env.ADMIN_PASSWORD = 'bar';
        process.env.API_URL = 'http://thisisnotarealserver.localdev';
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
                .reply(200, ReturnMetadata);

        });
        it('should return formatted metadata retrieved from the server', () => {
            return MetadataFetcher.fetchMetadata()
            .then((metadata) => {
                // Expect:
                // 
                // {
                //     "Module1": {
                //         "fields": {
                //             "field1.1": {
                //                 "name": "field1.1",
                //                 "required": true
                //             }
                //         }
                //     },
                //     "Module2": {
                //         "fields": {
                //             "field2.1": {
                //                 "name": "field2.1",
                //                 "required": true
                //             }
                //         }
                //     }
                // }

                expect(Object.keys(metadata).length).to.equal(2);

                expect(metadata.Module1).to.be.an.object;
                expect(Object.keys(metadata.Module1).length).to.equal(1);
                expect(metadata.Module1.fields).to.be.an.object;
                expect(Object.keys(metadata.Module1.fields).length).to.equal(1);
                expect(metadata.Module1.fields['field1.1']).to.be.an.object;
                expect(Object.keys(metadata.Module1.fields['field1.1']).length).to.equal(2);
                expect(metadata.Module1.fields['field1.1'].name).to.equal('field1.1');
                expect(metadata.Module1.fields['field1.1'].required).to.be.true;

                expect(metadata.Module2).to.be.an.object;
                expect(Object.keys(metadata.Module2).length).to.equal(1);
                expect(metadata.Module2.fields).to.be.an.object;
                expect(Object.keys(metadata.Module2.fields).length).to.equal(1);
                expect(metadata.Module2.fields['field2.1']).to.be.an.object;
                expect(Object.keys(metadata.Module2.fields['field2.1']).length).to.equal(2);
                expect(metadata.Module2.fields['field2.1'].name).to.equal('field2.1');
                expect(metadata.Module2.fields['field2.1'].required).to.be.true;
            });
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
                .reply(200, ReturnMetadata);

        });
        it('should retrieve metadata from the server', () => {
            return MetadataHandler.getRequiredFields('Module1')
                .then((metadata) => {
                    // expected metadata:
                    expect(Object.keys(metadata).length).to.equal(1);
                    expect(metadata['field1.1']).to.be.an.object;
                    expect(metadata['field1.1'].name).to.equal('field1.1');
                    expect(metadata['field1.1'].required).to.be.true;
                    console.log(metadata);
                });
        });
    });
});

