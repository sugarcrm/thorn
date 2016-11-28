/**
 * Thorn Node.js module for REST API testing SugarCRM with Chakram.
 *
 * @module thorn
 */

var chakram = require('chakram');
var MetadataFetcher = require('./metadatafetcher.js');
var _ = require('lodash');

/**
 * Mimics default version until we have a way to get it from the instance being tested.
 */
const VERSION = 'v10';

/**
 * Root url of sugar instance to be tested on.
 */
const ROOT_URL = process.env.API_URL;

/**
 * Authentification information of admin user.
 */
// TODO function to login as admin user before doing anything else.
var AUTH = {};

/**
 * @property {Object} cachedRecords Record map indexed by module names.
 *
 * Note that each record is the response body from the API server.
 *
 * Example:
 *     {
 *       Accounts: [ob1, ob2],
 *       Contacts: [ob1, ob2],
 *       //...
 *     }
 * @private
 */
var cachedRecords = {};

/**
 * @property {Object} credentials Credentials for created records.
 *
 * Example:
 *  {
 *      jon: 'jon',
 *      jane: 'jane'
 *  }
 */
var credentials = {};

/**
 * @property WeakMap<{Object} fixture,{Object} cachedRecord> fixturesMap Record map indexed by fixture.
 *
 * For more information on WeakMap, see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
 * @private
 */
var fixturesMap = new WeakMap();

// FIXTURES TO BE WRITTEN BY RICHARD

var Fixtures = {
    /**
     * @property {number} _sessionAttempt Number of attempts made to login as
     *   admin.
     *
     * @private
     */
    _sessionAttempt: 0,

    /**
     * @property {number} _maxSessionAttempts Maximum number login attempts
     *   allowed.
     *
     * @private
     */
     _maxSessionAttempts: 0,

    /**
     * Using the supplied models, create records and links on the server cache those records locally.
     *
     * @param {Object[]} models An array of objects, containing a list of attributes for each new model.
     * @param {Object} [options]
     * @param {string} [options.module] The module of all models (if not specified in the models' object).
     *
     * @return {Promise} The ChakramResponse from the creation of the records and/or links
     */
    create(models, options = {}) {
        if (_.isUndefined(this._getHeaders().access_token)) {
            if (++this._sessionAttempt > this._maxSessionAttempts) {
                throw new Error('Max number of login attempts exceeded!');
            }

            return this._adminLogin().then(() => {
                return this.create(models, options);
            });
        }

        // reset #_sessionAttempt
        this._sessionAttempt = 0;

        let url = [ROOT_URL, VERSION, 'bulk'].join('/');
        let params = {headers: this._getHeaders()};
        let bulkRecordCreateDef = this._processModels(models, options);
        let bulkRecordLinkDef;

        // return Promise
        return chakram.post(url, bulkRecordCreateDef, params).then((response) => {
            if (response.response.statusCode === 401) {

                return this._refresh().then(() => {
                    params.headers = this._getHeaders();

                    return chakram.post(url, bulkRecordCreateDef, params);
                }).then((response) => {
                    bulkRecordLinkDef = this._processRecords(response, models);

                    return chakram.post(url, bulkRecordLinkDef, params);
                });
            
            }

            bulkRecordLinkDef = this._processRecords(response, models);

            return chakram.post(url, bulkRecordLinkDef, params);
        }).then(() => {
            return cachedRecords;
        }).catch((err) => {
            console.error(err);
        });
    },

    /**
     * Generates the bulk call object for linking based on response from record
     * creation.
     *
     * @param {Object} response Response object from record creation bulk call.
     * @param {Object[]} models
     *
     * @return {Object} Bulk call object for links.
     *
     * @private
     */
    _processRecords(response, models) {
        let bulkRecordLinkDef = { requests: [] };
        let records = response.response.body;
        let modelIndex = 0;

        // Loop chakram response for each record
        _.each(records, (record) => {
            let contents = record.contents;
            let recordModule = contents._module;
            // Cache record into fixturesMap
            // The bulk response is in the same order as the supplied requests.
            fixturesMap.set(models[modelIndex++], contents);
            // Cache record into cachedRecords indexed by supplied module
            if (cachedRecords[recordModule]) {
                cachedRecords[recordModule].push(contents);
            } else {
                cachedRecords[recordModule] = [contents];
            }
        });

        // Loop models to handle links
        _.each(models, (model) => {
            let leftID = fixturesMap.get(model).id;
            _.each(model.links, (moduleLinks, linkToModule) => {
                _.each(moduleLinks, (link) => {
                    let cachedRecord = fixturesMap.get(link);
                    if (!cachedRecord) {
                        console.error('Missing link!');
                        throw new Error(link.toString());
                    }
                    let request = {
                        url: '/' + VERSION + '/' + model.module + '/' + leftID + '/link',
                        method: 'POST',
                        data: {
                            link_name: linkToModule,
                            ids: [cachedRecord.id]
                        }
                    };

                    bulkRecordLinkDef.requests.push(request);
                });
            });
        });

        return bulkRecordLinkDef;
    },

    /**
     * Generates the bulk call object for object creation based on models.
     *
     * @param {Object[]} models
     * @param {Object} [options]
     *
     * @return {Object} Bulk call object for record creation.
     *
     * @private
     */
    _processModels(models, options = {}) {
        let bulkRecordCreateDef = { requests: [] };
        // Loop models to check if any model has been cached already
        // Fetch module's required fields and pre-fill them
        _.each(models, (model) => {
            model.module = model.module || options.module;
            let requiredFields;
            let request = {
                url: '/' + VERSION + '/' + model.module,
                method: 'POST',
                data: model.attributes || {}
            };

            if (!model.module) {
                console.error('Missing module name!');
                throw new Error(model.toString());
            }
            if (fixturesMap.has(model)) {
                console.error('Record already exists!');
                throw new Error(model.toString());
            }

            requiredFields = MetadataFetcher.fetchRequiredFields(model.module);
            _.each(requiredFields, (field) => {
                if (!request.data[field.name]) {
                    request.data[field.name] = MetadataFetcher.generateFieldValue(field.type, field.reqs);
                }
            });

            // Use chakram.post (with Header X-Fixtures: true) to bulk create the record(s).
            bulkRecordCreateDef.requests.push(request);
        });

        return bulkRecordCreateDef;
    },

    /**
     * Removes all cached records from the server. Additionally, clears the local cache.
     *
     * @return {Promise} The ChakramResponse for the delete request to the server.
     */
    cleanup() {
        if (_.isUndefined(this._getHeaders().access_token)) {
            if (++this._sessionAttempt > this._maxSessionAttempts) {
                throw new Error('Max number of login attempts exceeded!');
            }

            return this._adminLogin().then(() => {
                return this.cleanup();
            });
        }

        // reset #_sessionAttempt
        this._sessionAttempt = 0;

        // Create promise for record deletion
        // Clear the cache
        // Return promise
        let bulkRecordDeleteDef = { requests: [] };
        let url = [ROOT_URL, VERSION, 'bulk'].join('/');
        let params = {headers: this._getHeaders()};

        _.each(cachedRecords, (moduleRecords, module) => {
            _.each(moduleRecords, (record) => {
                bulkRecordDeleteDef.requests.push({
                    url: '/' + VERSION + '/' + module + '/' + record.id,
                    method: 'DELETE'
                });
            });
        });

        // Create promise for record deletion
        return chakram.post(url, bulkRecordDeleteDef, params).then((response) => {
            if (response.response.statusCode === 401) {

                return this._refresh().then(() => {
                    params.headers = this._getHeaders();
                    chakram.post(url, bulkRecordDeleteDef, params).then(() => {
                        // clear cache
                        cachedRecords = null;
                    });
                });

            }

            // clear cache
            cachedRecords = null;
        }).catch((err) => {
            console.error(err);
        });
    },

    /**
     * Mimics _.findWhere and using the supplied arguments, returns the cached record(s).
     *
     * @param {string} module The module of the record(s) to find
     * @param {Object} properties The properties to search for
     *
     * @return {Object} The first record in #cachedRecords that match properties
     */
    lookup(module, properties) {
        return _.findWhere(cachedRecords[module], properties);
    },

    /**
     * Creates link between `left` and `right` in the database.
     *
     * @param {Object} left Record retrieved from cache.
     * @param {string} linkName Relationship link name.
     * @param {Object} right Record retrieved from cache.
     *
     * @return {Promise} ChakramPromise
     */
    link(left, linkName, right) {
        let url = '/' + VERSION + '/' + left._module + '/' + left.id + '/link';
        let params = {headers: this._getHeaders()};
        let linkDef = {
            link_name: linkName,
            ids: [right.id]
        };

        return chakram.post(url, linkDef, params).then((response) => {
            if (response.response.statusCode === 401) {

                return this._refresh().then(() => {
                    params.headers = this._getHeaders();

                    return chakram.post(url, linkDef, params);
                });

            }

            return response;
        });
    },

    /**
     * Get ADMIN headers required for record creation
     *
     * @return {Object} Headers including authentification information.
     */
    _getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Oauth-Token': AUTH.body ? AUTH.body.access_token : undefined,
            'X-Thron': 'Fixtures'
        };
    },

    /**
     * Stores the login response.
     *
     * @param {Object} auth The login response.
     */
    _storeHeaders(auth) {
        AUTH = auth;
    },

    /**
     * Logins as the admin user.
     *
     * @return {Promise} ChakramPromise
     *
     * @private
     */
    _adminLogin() {
        var credentials = {
            username: process.env.ADMIN_USERNAME,
            password: process.env.ADMIN_PASSWORD,
            grant_type: 'password',
            client_id: 'sugar',
            client_secret: ''
        };
        var url = [ROOT_URL, VERSION, 'oauth2/token'].join('/');

        return chakram.post(url, credentials).then((response) => {
            this._storeHeaders(response);
        });
    },

    /**
     * Refreshes the session of the admin user.
     *
     * @return {Promise} ChakramPromise
     *
     * @private
     */
    _refresh() {
        var credentials = {
            grant_type: 'refresh_token',
            refresh_token: AUTH.body.refresh_token,
            client_id: 'sugar',
            client_secret: ''
        };
        var url = [ROOT_URL, VERSION, 'oauth2/token'].join('/');

        return chakram.post(url, credentials).then((response) => {
            this._storeHeaders();
        });
    }
};


/**
 * @property {Object} cachedAgents Map between usernames and agent instances.
 */
var cachedAgents = {};

// AGENT TO BE WRITTEN BY BOB
class Agent {
    static as(username) {
        return new UserAgent(username, credentials[username], VERSION).login();
    }
}

Agent.ADMIN = process.env.ADMIN_USERNAME;
Object.freeze(Agent);

class UserAgent {
    constructor() {
        //...
    }

    /**
     * Clones agent and swaps API version, if supplied version matches the previously supplied version, same agent instance is returned.
     *
     * @param {string} version
     */
    on(version) {
        //...
    }

    // private login function
    login = () => {
    }

    // private refresh function
    refresh = () => {
    }

    get(endpoint, params) {
        agentsMap.get(this).refresh();
    };
    post(endpoint, data, params) {};
    put(endpoint, data, params) {};
    delete(endpoint, data, params) {};
}

export {Fixtures, Agent};
