let _ = require('lodash');

let bulkDataCache = {};

const VERBOSE_FUNCTIONS = [
    (type, data, r) => {
        switch(type) {
        case 'request':
            console.info('Request  ' + data.debugId + ' ' + r.headers['X-Thorn'] + ': ' + r.method + ' ' + r.uri.pathname);
            break;
        case 'response':
            console.info('Response ' + data.debugId + ' ' + r.headers['X-Thorn'] + ': ' + r.method + ' ' + r.uri.pathname + ' ' + data.statusCode);
            break;
        case 'redirect':
        case 'auth':
            console.info('Redirect: ' + data.statusCode + ' ' + data.uri);
            break;
        default:
            console.info('Unidentified event ' + type);
            break;
        }
    },
    (type, data, r) => {
        let requests, responses;
        if (r.method === 'POST' && r.uri.pathname.indexOf('bulk') >= 0) {
            switch(type) {
            case 'request':
                // cache the method and URL of each part of the bulk request,
                // because the response doesn't disclose that information
                bulkDataCache[data.debugId] = [];
                requests = JSON.parse(data.body).requests;
                _.each(requests, (req, index) => {
                    bulkDataCache[data.debugId].push({ method: req.method, url: req.url });
                    console.info('\tBulk Request ' + (index + 1) + ': ' + req.method + ' ' + req.url);
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
                    let msg = '\tBulk Response ' + (index + 1) + ': ' + req.method + ' ' + req.url + ' ' +  resp.status;
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
