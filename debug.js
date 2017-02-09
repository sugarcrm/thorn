/*
 * Copyright (c) 2017 SugarCRM Inc. Licensed by SugarCRM under the Apache 2.0 license.
 */

let _ = require('lodash');

let bulkDataCache = {};

const VERBOSE_FUNCTIONS = [
    (type, data, r) => {
        let msg;
        switch (type) {
            case 'request':
                msg = `Request  ${data.debugId} ${r.headers['X-Thorn']}: ${r.method} ${r.uri.pathname}`;
                break;
            case 'response':
                msg = `Response ${data.debugId} ${r.headers['X-Thorn']}: ${r.method} ${r.uri.pathname} ${
                    data.statusCode}`;
                break;
            case 'redirect':
            case 'auth':
                msg = `Redirect: ${data.statusCode} ${data.uri}`;
                break;
            default:
                msg = `Unidentified event ${type}`;
                break;
        }
        console.info(msg);
    },
    (type, data, r) => {
        let requests;
        let responses;
        if (r.method === 'POST' && r.uri.pathname.indexOf('bulk') >= 0) {
            switch (type) {
                case 'request':
                // cache the method and URL of each part of the bulk request,
                // because the response doesn't disclose that information
                    bulkDataCache[data.debugId] = [];
                    requests = JSON.parse(data.body).requests;
                    _.each(requests, (req, index) => {
                        bulkDataCache[data.debugId].push({ method: req.method, url: req.url });
                        console.info(`\tBulk Request ${index + 1}: ${req.method} ${req.url}`);
                    });
                    break;
                case 'response':
                    if (!data.body) {
                        console.warn('\tBulk Response: no body');
                        break;
                    }
                    responses = data.body;
                    if (typeof responses === 'string') {
                        responses = JSON.parse(responses);
                    }
                    if (!_.isArray(responses)) {
                        responses = [responses];
                    }
                    _.each(responses, (resp, index) => {
                        let req = bulkDataCache[data.debugId][index];
                        let msg = `\tBulk Response ${index + 1}: ${req.method} ${req.url} ${
                            resp.status}`;
                        console.info(msg);
                    });
                    delete bulkDataCache[data.debugId];
                    break;
                default:
                    break;
            }
        }
    },
];

export { VERBOSE_FUNCTIONS };
