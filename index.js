/*
 * Copyright (c) 2017 SugarCRM Inc. Licensed by SugarCRM under the Apache 2.0 license.
 */

/**
 * Thorn Node.js module for REST API testing SugarCRM with Chakram.
 *
 * @module thorn
 */

let chakram = require('chakram');
let MetadataHandler = require('./metadata-handler.js');
let _ = require('lodash');
let uuidv4 = require('uuid/v4');

let utils = require('./utils.js');

// Verbose mode support for debugging tests
let verbosity = Number.parseInt(process.env.THORN_VERBOSE, 10);
if (verbosity) {
    const VERBOSE_FUNCTIONS = require('./debug.js').VERBOSE_FUNCTIONS;
    chakram.startDebug((type, data, r) => {
        for (let i = 0; i < verbosity; i++) {
            VERBOSE_FUNCTIONS[i](type, data, r);
        }
    });
}

/**
 * Mimics default version until we have a way to get it from the instance being tested.
 * @type {string}
 *
 * @private
 */
const VERSION = 'v11_1';

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
 *
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
 *
 * @private
 */
let credentials;

/**
 * Maps between passed in user name and internal user name.
 *
 * @type {Object}
 *
 * @private
 */
let cachedUsernames;

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
        throw new Error(`Duplicate username: ${username}`);
    }

    credentials[username] = userhash;
}

/**
 * Map between usernames and agent instances.
 *
 * @type {Object}
 * @private
 */
let cachedAgents;

/**
 * Generates and maps an internal username to the given username.
 *
 * To protect against username collisions, this function takes
 * a passed in username and adds a hash to it, generating an
 * internal username.
 *
 * @param {string} username Username of the user.
 *
 * @return {string} Internal username.
 *
 * @private
 */
function _generateInternalUsername(username) {
    if (cachedUsernames[username]) {
        throw new Error(`User ${username} already exists`);
    }

    let generatedUsername = `${username}${uuidv4()}`;
    cachedUsernames[username] = generatedUsername;
    return generatedUsername;
}

/**
 * Restores `cachedRecords`, `cachedAgents` and `credentials` to their initial
 * states.
 *
 * @private
 */
function _restore() {
    cachedRecords = {};
    cachedAgents = {};
    credentials = {
        [process.env.THORN_ADMIN_USERNAME]: process.env.THORN_ADMIN_PASSWORD,
    };
    cachedUsernames = {
        [process.env.THORN_ADMIN_USERNAME]: process.env.THORN_ADMIN_USERNAME,
    };
}

// initialize `cachedRecords` and `credentials`.
_restore();

/**
 * Record map indexed by fixture.
 *
 * @type WeakMap<Object, Object>
 *
 * @private
 */
let fixturesMap = new WeakMap();

/**
 * Fixtures for pre-creating records.
 * @namespace
 */
let Fixtures = {
    /**
     * Using the supplied models, create records and links on the server
     * and cache those records locally.
     *
     * @param {Object|Object[]} models An object or array of objects.
     *   Each object contains a list of attributes for each new model.
     * @param {Object} [options] Additional information about `models`.
     * @param {string} [options.module] The module of all models (if not specified in the models' object).
     *
     * @return {Promise} The ChakramResponse from the creation of the records and/or links
     */
    create(models, options = {}) {
        if (!_.isArray(models)) {
            models = [models];
        }

        let url = 'bulk';

        return this._processModels(models, options).then((bulkRecordCreateDef) => {
            let bulkRecordLinkDef;
            let createdRecords;

            return Agent.as(Agent.ADMIN).post(url, bulkRecordCreateDef).then((response) => {
                createdRecords = this._cacheResponse(response, models);

                bulkRecordLinkDef = this._processLinks(response, models);
                if (!bulkRecordLinkDef.requests.length) {
                    return createdRecords;
                }

                return Agent.as(Agent.ADMIN).post(url, bulkRecordLinkDef);
            }).then(() => createdRecords);
        });
    },

    /**
     * Cache records from given `response`.
     *
     * @param {Object} response Response object from record creation bulk call.
     * @param {Object[]} models An array of objects, each containing a list of
     *   attributes for each new model.
     *
     * @return {Object} Map between module names and created records from the response.
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
        let bulkRecordLinkDef = {requests: []};

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
                        throw new Error(`Missing link! link: ${JSON.stringify(link)}`);
                    }
                    let request = {
                        url: `/${VERSION}/${model.module}/${leftID}/link`,
                        method: 'POST',
                        data: {
                            link_name: linkToModule,
                            ids: [cachedRecord.id],
                        },
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
     * @return {ChakramPromise} Promise that resolves to the bulk call object
     *   for record creation.
     *
     * @private
     */
    _processModels(models, options = {}) {
        let getRequiredFieldsPromises = [];
        let bulkRecordCreateDef = {requests: []};
        // Loop models to check if any model has been cached already
        // Fetch module's required fields and pre-fill them
        _.each(models, (model) => {
            model.module = model.module || options.module;
            let request = {
                url: `/${VERSION}/${model.module}`,
                method: 'POST',
                data: _.cloneDeep(model.attributes) || {},
            };

            if (!model.module) {
                throw new Error(`Missing module name! model: ${JSON.stringify(model)}`);
            }
            if (fixturesMap.has(model)) {
                throw new Error(`Record already exists! model: ${JSON.stringify(model)}`);
            }

            let getRequiredFieldPromise = MetadataHandler.getRequiredFields(model.module)
                .then((requiredFields) => {
                    _.each(requiredFields, (field) => {
                        if (_.isUndefined(request.data[field.name])) {
                            request.data[field.name] = MetadataHandler.generateFieldValue(field);
                        }
                    });

                    // Populate the `credentials` object.
                    if (model.module === 'Users') {
                        request.data.user_name = _generateInternalUsername(request.data.user_name);
                        _insertCredentials(request.data.user_name, request.data.user_hash);
                    }

                    // Use chakram.post to bulk create the record(s).
                    bulkRecordCreateDef.requests.push(request);
                });
            getRequiredFieldsPromises.push(getRequiredFieldPromise);
        });

        return Promise.all(getRequiredFieldsPromises).then(() => bulkRecordCreateDef);
    },

    /**
     * Removes all cached records from the server. Additionally, clears the local cache.
     *
     * @return {Promise} The ChakramResponse for the delete request to the server.
     */
    cleanup() {
        // Create promise for record deletion
        // Clear the cache
        // Return promise
        let bulkRecordDeleteDef = {requests: []};
        let url = 'bulk';

        _.each(cachedRecords, (moduleRecords, module) => {
            _.each(moduleRecords, (record) => {
                bulkRecordDeleteDef.requests.push({
                    url: `/${VERSION}/${module}/${record.id}`,
                    method: 'DELETE',
                });
            });
        });

        // Create promise for record deletion
        return Agent.as(Agent.ADMIN).post(url, bulkRecordDeleteDef).then((response) => {
            _restore();
            return response;
        });
    },

    /**
     * Mimics `_.find` and using the supplied arguments, returns the cached record.
     *
     * @param {string} module The module of the record to find.
     * @param {Object} properties The properties to search for.
     *
     * @return {Object} The first record in `cachedRecords` that matches `properties`.
     */
    lookup(module, properties) {
        if (_.isEmpty(cachedRecords)) {
            throw new Error('No cached records are currently available!');
        }

        let records = cachedRecords[module];
        if (!records) {
            throw new Error(`No cached records found for module: ${module}`);
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
     * @return {ChakramPromise} The result of the request to link the records.
     */
    link(left, linkName, right) {
        let url = [left._module, left.id, 'link'].join('/');
        let linkDef = {
            link_name: linkName,
            ids: [right.id],
        };

        return Agent.as(Agent.ADMIN).post(url, linkDef).then(response => response.response.body);
    },
};

// ********************************************************************************************************************

/**
 * Namespace for `UserAgent` access methods.
 * @namespace
 * @property {string} ADMIN Username for the SugarCRM administrative user.
 */
let Agent = {
    /**
     * Return a `UserAgent` with the given user name and log them in.
     *
     * @param {string} username Username of the user agent.
     * @return {UserAgent} A `UserAgent` corresponding to the user with the given username.
     */
    as: (username) => {
        if (!username) {
            throw new Error('Tried to create a user agent with no username!');
        }

        let internalUsername = cachedUsernames[username];
        let cachedAgent = cachedAgents[internalUsername];
        if (cachedAgent) {
            return cachedAgent[VERSION];
        }

        let password = credentials[internalUsername];
        if (!password) {
            throw new Error(`No credentials available for user: ${username}`);
        }

        let agent = new UserAgent(internalUsername, password, VERSION);
        agent._login();
        return agent;
    },

    ADMIN: process.env.THORN_ADMIN_USERNAME,
};

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

        this._maxSessionAttempts = 3;
        this._setState('sessionAttempt', 0);
    }

    /**
     * Returns a user agent with the same username and password as this one,
     * with the given `version`. If such an agent does not exist, clone this
     * one.
     *
     * @param {string} version API version to use.
     * @return {UserAgent} A `UserAgent` set to use the given API version.
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
     * If the login is unsuccessful, it is retried a maximum of two additional
     * times, after which it throws an error.
     *
     * @return {ChakramPromise} A promise resolving to the result of the login
     *   request.
     *
     * @private
     */
    _login = () => {
        let loginPromise = this._getState('loginPromise');
        if (loginPromise) {
            return loginPromise;
        }

        let sessionAttempt = this._getState('sessionAttempt') + 1;
        this._setState('sessionAttempt', sessionAttempt);
        if (sessionAttempt > this._maxSessionAttempts) {
            throw new Error(`Max number of login attempts exceeded for user: ${this.username}`);
        }

        loginPromise = utils.login({
            username: this.username,
            password: this.password,
            version: this.version,
            xthorn: this._xthorn(),
        }).then((response) => {
            this._updateAuthState(response);
            this._setState('sessionAttempt', 0);
        }).catch(() => {
            this._setState('loginPromise', null);
            return this._login();
        });
        this._setState('loginPromise', loginPromise);
        return loginPromise;
    };

    /**
     * Skeleton method for making a chakram request.
     *
     * @param {function} chakramMethod Chakram request method to call.
     * @param {Array} args Arguments to call the chakram request method with.
     *   The first member of the array must be the desired endpoint;
     *   the last must be a `params`-like object.
     * @return {ChakramPromise} A promise resolving to the result of the request.
     *
     * @private
     */
    _requestSkeleton = (chakramMethod, args) => {
        let paramIndex = args.length - 1;
        args[paramIndex] = args[paramIndex] || {};
        this._validateParams(args[paramIndex]);

        args[0] = utils.constructUrl(this.version, args[0]);

        return this._login().then(() => {
            // must wait for login promise to resolve or else OAuth-Token may not be available
            // FIXME: eventually will want to support multiple types of headers

            args[paramIndex].headers = {};
            _.extend(args[paramIndex].headers, this._getState('headers'));
            return utils.wrapRequest(chakramMethod, args, {
                refreshToken: this._getState('refreshToken'),
                afterRefresh: _.bind(this._updateAuthState, this),
                xthorn: this._xthorn(),
                retryVersion: this.version,
            });
        });
    };

    /**
     * Validate request parameters.
     * Throws an error if any of the parameters are invalid.
     *
     * @param {Object} params Request parameters.
     *
     * @see https://github.com/request/request#requestoptions-callback
     * @private
     */
    _validateParams = (params) => {
        if (params && !_.isObject(params)) {
            throw new Error('Please only use Objects for request parameters.');
        }

        if (params.headers && params.headers['OAuth-Token']) {
            throw new Error(
                'Please do not explicitly provide OAuth tokens. ' +
                'Thorn handles authentication and refreshing automatically.'
            );
        }

        if (params.method) {
            throw new Error(
                'Please do not explicitly set an HTTP method. ' +
                'Instead, please use the appropriate top-level Thorn API method.'
            );
        }
    };

    /**
     * Callback to be performed after a login or refresh.
     *
     * @param {Object} response Chakram login/refresh response.
     *
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
                        'X-Thorn': this._xthorn(),
                    },
                },
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
    _getState = key => cachedAgents[this.username]._state[key];

    /**
     * Set shared state for this UserAgent.
     *
     * @param {string} key State parameter to update.
     * @param {*} value The value to assign to the provided `key`.
     *
     * @private
     */
    _setState = (key, value) => {
        cachedAgents[this.username]._state[key] = value;
    };

    /**
     * Return the desired value for the X-Thorn header.
     *
     * @return {string} The value of the X-Thorn header.
     *
     * @private
     */
    _xthorn = () => `Agent-${this.username}`;

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

export {Fixtures, Agent};
