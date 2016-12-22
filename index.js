/**
 * Thorn Node.js module for REST API testing SugarCRM with Chakram.
 *
 * @module thorn
 */

let chakram = require('chakram');
let MetadataHandler = require('./metadata-handler.js');
let _ = require('lodash');

/**
 * Root URL of SugarCRM instance to test.
 * @type {string}
 * @private
 */
const ROOT_URL = process.env.API_URL;
if (!ROOT_URL) {
    throw new Error('Please set process.env.API_URL!');
}

// Verbose mode support for debugging tests
if (process.env.THORN_VERBOSE) {
    chakram.startDebug((type, data, r) => {
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
    });
}

/**
 * Mimics default version until we have a way to get it from the instance being tested.
 * @type {string}
 * @private
 */
const VERSION = 'v10';

/**
 * Record map indexed by module names.
 *
 * Note that each record is the response body from the API server.
 *
 * Example:
 *     {
 *       Accounts: [ob1, ob2],
 *       Contacts: [ob1, ob2],
 *       //...
 *     }
 *
 * @type {Object}
 * @private
 */
let cachedRecords;

/**
 * Credentials for created records.
 *
 * Example:
 *  {
 *      jon: 'jon',
 *      jane: 'jane'
 *  }
 *
 * @type {Object}
 * @private
 */
let credentials;

/**
 * Inserts username and userhash into `credentials`.
 *
 * @param {string} username Username of the user.
 * @param {string} userhash Password of the user.
 *
 * @private
 */
function _insertCredentials(username, userhash) {
    if (credentials[username]) {
        throw new Error('Duplicate username: ' + username);
    }

    credentials[username] = userhash;
}

/**
 * Restores `cachedRecords` and `credentials` to their initial states.
 *
 * @private
 */
function _restore() {
    cachedRecords = {};
    credentials = {
        [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD
    };
}

// initialize `cachedRecords` and `credentials`.
_restore();

/**
 * Record map indexed by fixture.
 *
 * @type WeakMap<Object, Object>
 * @private
 */
let fixturesMap = new WeakMap();

/**
 * Fixtures for pre-creating records.
 * @namespace
 */
let Fixtures = {
    /**
     * @property {number} _sessionAttempt Number of attempts made to login as
     *   admin.
     *
     * @private
     */
    _sessionAttempt: 0,

    /**
     * @property {number} _maxSessionAttempts Maximum number of login attempts
     *   allowed.
     *
     * @private
     */
    _maxSessionAttempts: 3,

    /**
     * @property {object} _headers Default HTTP headers.
     *
     * @private
     */
    _headers: {
        'Content-Type': 'application/json',
        'X-Thorn': 'Fixtures'
    },

    /**
     * Using the supplied models, create records and links on the server cache those records locally.
     *
     * @param {Object|Object[]} models An object or array of objects.
     *   Each object contains a list of attributes for each new model.
     * @param {Object} [options] Additional information about `models`.
     * @param {string} [options.module] The module of all models (if not specified in the models' object).
     *
     * @return {Promise} The ChakramResponse from the creation of the records and/or links
     */
    create(models, options = {}) {
        if (_.isUndefined(this._headers['OAuth-Token'])) {
            if (++this._sessionAttempt > this._maxSessionAttempts) {
                throw new Error('Max number of login attempts exceeded!');
            }

            return this._adminLogin().then(() => {
                return this.create(models, options);
            });
        }

        if (! _.isArray(models)) {
            models = [models];
        }

        // reset `_sessionAttempt`
        this._sessionAttempt = 0;

        let url = _constructUrl('bulk', VERSION);
        let params = {headers: this._headers};
        let bulkRecordCreateDef = this._processModels(models, options);
        let bulkRecordLinkDef;
        let createdRecords;

        // return Promise
        return _wrap401(chakram.post, [url, bulkRecordCreateDef, params], this._refreshToken, _.bind(this._afterRefresh, this))
            .then((response) => {
                createdRecords = this._cacheResponse(response, models);
                bulkRecordLinkDef = this._processLinks(response, models);
                if (bulkRecordLinkDef.requests.length) {
                    return chakram.post(url, bulkRecordLinkDef, params);
                }

                return response;
            })
            .then(() => {
                return createdRecords;
            });
    },

    /**
     * Cache records from given `response`.
     *
     * @param {Object} response Response object from record creation bulk call.
     * @param {Object[]} models An array of objects, each containing a list of
     *   attributes for each new model.
     *
     * @return {Object} Map between module names and created records from the `response`.
     *
     * @private
     */
    _cacheResponse(response, models) {
        let createdRecords = {};
        let records = response.response.body;
        let modelIndex = 0;

        // Loop chakram response for each record
        _.each(records, (record) => {
            let contents = record.contents;
            let recordModule = contents._module;
            // Cache record into fixturesMap
            // The bulk response is in the same order as the supplied requests
            fixturesMap.set(models[modelIndex++], contents);
            // Cache record into createdRecords, indexed by supplied module
            if (createdRecords[recordModule]) {
                createdRecords[recordModule].push(contents);
            } else {
                createdRecords[recordModule] = [contents];
            }
        });

        // Extend createdRecords into cachedRecords
        _.each(createdRecords, (records, moduleName) => {
            if (cachedRecords[moduleName]) {
                cachedRecords[moduleName] = cachedRecords[moduleName].concat(records);
            } else {
                cachedRecords[moduleName] = records;
            }
        });

        return createdRecords;
    },

    /**
     * Generates the bulk call object for linking based on response from record
     * creation.
     *
     * @param {Object} response Response object from record creation bulk call.
     * @param {Object[]} models An array of objects, each containing a list of
     *   attributes for each new model.
     *
     * @return {Object} Bulk call object for links.
     *
     * @private
     */
    _processLinks(response, models) {
        let bulkRecordLinkDef = { requests: [] };

        // Loop models to handle links
        _.each(models, (model) => {
            let leftRecord = fixturesMap.get(model);
            if (!leftRecord) {
                throw new Error('Left-hand model cannot be found!');
            }
            let leftID = leftRecord.id;
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
     * @param {Object[]} models An array of objects, each containing a list of
     *   attributes for each new model.
     * @param {Object} [options] Additional information about `models`.
     * @param {string} [options.module] The module of all models (if not specified in the models' object).
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

            requiredFields = MetadataHandler.getRequiredFields(model.module);
            _.each(requiredFields, (field) => {
                if (!request.data[field.name]) {
                    request.data[field.name] = MetadataHandler.generateFieldValue(field);
                }
            });

            // Populate the `credentials` object.
            if (model.module === 'Users') {
                _insertCredentials(request.data.user_name, request.data.user_hash);
            }

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
        if (_.isUndefined(this._headers['OAuth-Token'])) {
            if (++this._sessionAttempt > this._maxSessionAttempts) {
                throw new Error('Max number of login attempts exceeded!');
            }

            return this._adminLogin().then(() => {
                return this.cleanup();
            });
        }

        // reset `_sessionAttempt`
        this._sessionAttempt = 0;

        // Create promise for record deletion
        // Clear the cache
        // Return promise
        let bulkRecordDeleteDef = { requests: [] };
        let url = _constructUrl('bulk', VERSION);
        let params = {headers: this._headers};

        _.each(cachedRecords, (moduleRecords, module) => {
            _.each(moduleRecords, (record) => {
                bulkRecordDeleteDef.requests.push({
                    url: '/' + VERSION + '/' + module + '/' + record.id,
                    method: 'DELETE'
                });
            });
        });

        // Create promise for record deletion
        return _wrap401(chakram.post, [url, bulkRecordDeleteDef, params], this._refreshToken, _.bind(this._afterRefresh, this))
            .then(() => {
                _restore();
            });
    },

    /**
     * Mimics _.find and using the supplied arguments, returns the cached record.
     *
     * @param {string} module The module of the record to find.
     * @param {Object} properties The properties to search for.
     *
     * @return {Object} The first record in `cachedRecords` that match properties.
     */
    lookup(module, properties) {
        if (!cachedRecords) {
            throw new Error('No cached records are currently available!');
        }

        let records = cachedRecords[module];
        if (!records) {
            throw new Error('No cached records found for module: ' + module);
        }

        return _.find(records, properties);
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
        let url = process.env.API_URL + '/' + VERSION + '/' + left._module + '/' + left.id + '/link';
        let params = {headers: this._headers};
        let linkDef = {
            link_name: linkName,
            ids: [right.id]
        };

        return _wrap401(chakram.post, [url, linkDef, params], this._refreshToken, _.bind(this._afterRefresh, this))
            .then((response) => {
                return response.response.body;
            });
    },

    /**
     * Stores the login response.
     *
     * @param {Object} auth The login response.
     *
     * @private
     */
    _storeAuth(auth) {
        this._headers['OAuth-Token'] = auth.body.access_token;
        this._refreshToken = auth.body.refresh_token;
    },

    /**
     * Logs in as the admin user.
     *
     * @return {Promise} ChakramPromise
     *
     * @private
     */
    _adminLogin() {
        let credentials = {
            username: process.env.ADMIN_USERNAME,
            password: process.env.ADMIN_PASSWORD,
            grant_type: 'password',
            client_id: 'sugar',
            client_secret: ''
        };
        let url = _constructUrl('oauth2/token', VERSION);

        return chakram.post(url, credentials).then((response) => {
            if (response.response.statusCode === 200) {
                this._storeAuth(response);
            }
        });
    },

    /**
     * Callback to be performed after a refresh.
     *
     * @param {object} response Chakram refresh response.
     * @private
     */
    _afterRefresh(response) {
        this._headers['OAuth-Token'] = response.body.access_token;
        this._refreshToken = response.body.refresh_token;
    }
};

// ********************************************************************************************************************

/**
 * Tries a request. If it fails because of HTTP 401, do a refresh and then try again.
 *
 * @param {function} chakramMethod Chakram request method to call.
 * @param {array} args Arguments to call the chakram request method with.
 *   The last member of the array must be a `params`-like object.
 * @param {string} refreshToken Refresh token to use if you have to do a refresh.
 * @param {function} afterRefresh Additional tasks to be performed after
 *   a refresh occurs. Passed the chakram response object from the refresh.
 * @param {string} [retryVersion=VERSION] API version to make the retry request on.
 *   Non-retry requests are made on whatever version is specified by `args`.
 * @return {ChakramPromise} A promise resolving to the result of the request.
 *   If the first try failed, it will resolve to the result of the second,
 *   whether it succeeded or not.
 *
 * @private
 */
function _wrap401(chakramMethod, args, refreshToken, afterRefresh, retryVersion = VERSION) {
    return chakramMethod.apply(chakram, args).then((response) => {
        if (!response || !response.response) {
            throw new Error('Invalid response received!');
        }

        if (response.response.statusCode !== 401) {
            return response;
        }

        return _refresh(retryVersion, refreshToken).then((response) => {
            afterRefresh(response);

            // FIXME THIS SUCKS
            // have to update parameters after a refresh
            let paramIndex = args.length - 1;
            args[paramIndex].headers['OAuth-Token'] = response.body.access_token;

            return chakramMethod.apply(chakram, args);
        });
    });
}

/**
 * Refresh the user with the given refresh token.
 *
 * @param {string} version API version to do the refresh request on.
 * @param {string} token The refresh token of the user you wish to refresh.
 * @return {ChakramPromise} A promise which resolves to the Chakram refresh response.
 *
 * @private
 */
function _refresh(version, token) {
    let credentials = {
        grant_type: 'refresh_token',
        refresh_token: token,
        client_id: 'sugar',
        client_secret: ''
    };
    let url = _constructUrl('oauth2/token', version);
    return chakram.post(url, credentials);
}

/**
 * Return the URL needed to access the given endpoint.
 *
 * @param {string} endpoint API endpoint to access.
 * @param {string} version API version to make the request against.
 * @return {string} The full URL to access that endpoint.
 * @private
 */
// FIXME: argument order feels backwards!
// but we could give the version a default value this way...
function _constructUrl(endpoint, version) {
    return [
        ROOT_URL,
        version,
        endpoint
    ].join('/');
}

// ********************************************************************************************************************

/**
 * Map between usernames and agent instances.
 *
 * @type {Object}
 * @private
 */
let cachedAgents = {};

/**
 * Namespace for UserAgent access methods.
 */
class Agent {
    /**
     * Return a UserAgent with the given user name and log them in.
     *
     * @param {string} username Username of the user agent.
     * @return {UserAgent} A UserAgent corresponding to the user with the given username.
     */
    static as(username) {
        if (!username) {
            throw new Error('Tried to create a user agent with no username!');
        }

        let cachedAgent = cachedAgents[username];
        if (cachedAgent) {
            return cachedAgent[VERSION];
        }
        let password = credentials[username];
        if (!password) {
            throw new Error('No credentials available for user agent ' + username);
        }
        let agent = new UserAgent(username, password, VERSION);
        agent._login();
        return agent;
    }
}

/**
 * Username for the SugarCRM administrative user.
 *
 * @property {string}
 */
Agent.ADMIN = process.env.ADMIN_USERNAME;
Object.freeze(Agent);

/**
 * Class simulating a web browser user.
 */
class UserAgent {
    /**
     * Create a new UserAgent.
     *
     * @param {string} username User name.
     * @param {string} password Password.
     * @param {string} version API version.
     */
    constructor(username, password, version) {
        this.username = username;
        this.password = password;
        this.version = version;

        this._cacheMe();
    }

    /**
     * Returns a user agent with the same username and password as this one,
     * with the given `version`. If such an agent does not exist, clone this
     * one.
     *
     * @param {string} version API version to use.
     * @return {Agent} A UserAgent set to use the given API version.
     */
    on(version) {
        if (version === this.version) {
            return this;
        }

        let cachedAgent = cachedAgents[this.username];
        if (cachedAgent && cachedAgent[version]) {
            return cachedAgent[version];
        }

        return new UserAgent(this.username, this.password, version);
    }

    /**
     * Log this user agent in.
     * After calling this function,
     * `cachedAgents[this.username]._state.loginPromise` is set to a promise
     * that, when resolved, will verify that the OAuth token is available.
     *
     * @private
     */
    _login = () => {
        let credentials = {
            username: this.username,
            password: this.password,
            grant_type: 'password',
            client_id: 'sugar',
            client_secret: ''
        };

        let url = _constructUrl('oauth2/token', this.version);
        this._setState('loginPromise', chakram.post(url, credentials).then(this._updateAuthState));
    };

    /**
     * Skeleton method for making a chakram request.
     *
     * @param {function} chakramMethod Chakram request method to call.
     * @param {array} args Arguments to call the chakram request method with.
     *   The first member of the array must be the desired endpoint;
     *   the last must be a `params`-like object.
     * @return {ChakramPromise} A promise resolving to the result of the request.
     * @private
     */
    _requestSkeleton = (chakramMethod, args) => {
        args[0] = _constructUrl(args[0], this.version);

        return this._getState('loginPromise').then(() => {
            // must wait for login promise to resolve or else OAuth-Token may not be available
            let paramIndex = args.length - 1;
            // FIXME: eventually will want to support multiple types of headers
            args[paramIndex] = args[paramIndex] || {};
            args[paramIndex].headers = {};
            _.extend(args[paramIndex].headers, this._getState('headers'));

            return _wrap401(chakramMethod, args, this._getState('refreshToken'), _.bind(this._updateAuthState, this), this.version);
        });
    };

    /**
     * Callback to be performed after a refresh.
     *
     * @param {object} response Chakram login/refresh response.
     * @private
     */
    _updateAuthState = (response) => {
        let headers = this._getState('headers');
        headers['OAuth-Token'] = response.body.access_token;
        this._setState('headers', headers);
        this._setState('refreshToken', response.body.refresh_token);
    };

    /**
     * Add this UserAgent to the cache.
     *
     * @private
     */
    _cacheMe = () => {
        if (!cachedAgents[this.username]) {
            cachedAgents[this.username] = {
                [this.version]: this,
                _state: {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Thorn': 'Agent'
                    }
                }
            };
        }

        if (!cachedAgents[this.username][this.version]) {
            cachedAgents[this.username][this.version] = this;
        }
    };

    /**
     * Retrieve shared state for this UserAgent.
     *
     * @param {string} key State parameter to receive.
     * @return {*} The value of the specified shared state parameter.
     *
     * @private
     */
    _getState = (key) => {
        return cachedAgents[this.username]._state[key];
    };

    /**
     * Set shared state for this UserAgent.
     *
     * @param {string} key State parameter to update.
     * @param {*} value Value to set it to.
     *
     * @private
     */
    _setState = (key, value) => {
        cachedAgents[this.username]._state[key] = value;
    };

    /**
     * Perform a GET request as this user.
     *
     * @param {string} endpoint API endpoint to make the request to.
     * @param {Object} [params] Request parameters.
     * @return {ChakramPromise} A promise which resolves to the Chakram GET response.
     */
    get(endpoint, params) {
        return this._requestSkeleton(chakram.get, [endpoint, params]);
    }

    /**
     * Perform a POST request as this user.
     *
     * @param {string} endpoint API endpoint to make the request to.
     * @param {Object} data POST body.
     * @param {Object} [params] Request parameters.
     * @return {ChakramPromise} A promise which resolves to the Chakram POST response.
     */
    post(endpoint, data, params) {
        return this._requestSkeleton(chakram.post, [endpoint, data, params]);
    }

    /**
     * Perform a PUT request as this user.
     *
     * @param {string} endpoint API endpoint to make the request to.
     * @param {Object} data PUT body.
     * @param {Object} [params] Request parameters.
     * @return {ChakramPromise} A promise which resolves to the Chakram PUT response.
     */
    put(endpoint, data, params) {
        return this._requestSkeleton(chakram.put, [endpoint, data, params]);
    }

    /**
     * Perform a DELETE request as this user.
     *
     * @param {string} endpoint API endpoint to make the request to.
     * @param {Object} [data] DELETE body.
     * @param {Object} [params] Request parameters.
     * @return {ChakramPromise} A promise which resolves to the Chakram DELETE response.
     */
    delete(endpoint, data, params) {
        return this._requestSkeleton(chakram.delete, [endpoint, data, params]);
    }
}

// ********************************************************************************************************************

/**
 * Assertions for Thorn tests.
 * @namespace
 * @see {@link https://dareid.github.io/chakram/jsdoc/module-chakram-expectation.html}
 */
let Expect = chakram.expect;

export {Fixtures, Agent, Expect};
