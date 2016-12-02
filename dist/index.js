'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
var VERSION = 'v10';

/**
 * Root url of sugar instance to be tested on.
 */
var ROOT_URL = process.env.API_URL;

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
    create: function create(models) {
        var _this = this;

        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        if (_.isUndefined(this._getHeaders().access_token)) {
            if (++this._sessionAttempt > this._maxSessionAttempts) {
                throw new Error('Max number of login attempts exceeded!');
            }

            return this._adminLogin().then(function () {
                return _this.create(models, options);
            });
        }

        // reset #_sessionAttempt
        this._sessionAttempt = 0;

        var url = [ROOT_URL, VERSION, 'bulk'].join('/');
        var params = { headers: this._getHeaders() };
        var bulkRecordCreateDef = this._processModels(models, options);
        var bulkRecordLinkDef = void 0;

        // return Promise
        return chakram.post(url, bulkRecordCreateDef, params).then(function (response) {
            if (response.response.statusCode === 401) {

                return _this._refresh().then(function () {
                    params.headers = _this._getHeaders();

                    return chakram.post(url, bulkRecordCreateDef, params);
                }).then(function (response) {
                    bulkRecordLinkDef = _this._processRecords(response, models);

                    return chakram.post(url, bulkRecordLinkDef, params);
                });
            }

            bulkRecordLinkDef = _this._processRecords(response, models);

            return chakram.post(url, bulkRecordLinkDef, params);
        }).then(function () {
            return cachedRecords;
        }).catch(function (err) {
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
    _processRecords: function _processRecords(response, models) {
        var bulkRecordLinkDef = { requests: [] };
        var records = response.response.body;
        var modelIndex = 0;

        // Loop chakram response for each record
        _.each(records, function (record) {
            var contents = record.contents;
            var recordModule = contents._module;
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
        _.each(models, function (model) {
            var leftID = fixturesMap.get(model).id;
            _.each(model.links, function (moduleLinks, linkToModule) {
                _.each(moduleLinks, function (link) {
                    var cachedRecord = fixturesMap.get(link);
                    if (!cachedRecord) {
                        console.error('Missing link!');
                        throw new Error(link.toString());
                    }
                    var request = {
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
    _processModels: function _processModels(models) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var bulkRecordCreateDef = { requests: [] };
        // Loop models to check if any model has been cached already
        // Fetch module's required fields and pre-fill them
        _.each(models, function (model) {
            model.module = model.module || options.module;
            var requiredFields = void 0;
            var request = {
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
            _.each(requiredFields, function (field) {
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
    cleanup: function cleanup() {
        var _this2 = this;

        if (_.isUndefined(this._getHeaders().access_token)) {
            if (++this._sessionAttempt > this._maxSessionAttempts) {
                throw new Error('Max number of login attempts exceeded!');
            }

            return this._adminLogin().then(function () {
                return _this2.cleanup();
            });
        }

        // reset #_sessionAttempt
        this._sessionAttempt = 0;

        // Create promise for record deletion
        // Clear the cache
        // Return promise
        var bulkRecordDeleteDef = { requests: [] };
        var url = [ROOT_URL, VERSION, 'bulk'].join('/');
        var params = { headers: this._getHeaders() };

        _.each(cachedRecords, function (moduleRecords, module) {
            _.each(moduleRecords, function (record) {
                bulkRecordDeleteDef.requests.push({
                    url: '/' + VERSION + '/' + module + '/' + record.id,
                    method: 'DELETE'
                });
            });
        });

        // Create promise for record deletion
        return chakram.post(url, bulkRecordDeleteDef, params).then(function (response) {
            if (response.response.statusCode === 401) {

                return _this2._refresh().then(function () {
                    params.headers = _this2._getHeaders();
                    chakram.post(url, bulkRecordDeleteDef, params).then(function () {
                        // clear cache
                        cachedRecords = null;
                    });
                });
            }

            // clear cache
            cachedRecords = null;
        }).catch(function (err) {
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
    lookup: function lookup(module, properties) {
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
    link: function link(left, linkName, right) {
        var _this3 = this;

        var url = '/' + VERSION + '/' + left._module + '/' + left.id + '/link';
        var params = { headers: this._getHeaders() };
        var linkDef = {
            link_name: linkName,
            ids: [right.id]
        };

        return chakram.post(url, linkDef, params).then(function (response) {
            if (response.response.statusCode === 401) {

                return _this3._refresh().then(function () {
                    params.headers = _this3._getHeaders();

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
    _getHeaders: function _getHeaders() {
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
    _storeHeaders: function _storeHeaders(auth) {
        AUTH = auth;
    },


    /**
     * Logins as the admin user.
     *
     * @return {Promise} ChakramPromise
     *
     * @private
     */
    _adminLogin: function _adminLogin() {
        var _this4 = this;

        var credentials = {
            username: process.env.ADMIN_USERNAME,
            password: process.env.ADMIN_PASSWORD,
            grant_type: 'password',
            client_id: 'sugar',
            client_secret: ''
        };
        var url = [ROOT_URL, VERSION, 'oauth2/token'].join('/');

        return chakram.post(url, credentials).then(function (response) {
            _this4._storeHeaders(response);
        });
    },


    /**
     * Refreshes the session of the admin user.
     *
     * @return {Promise} ChakramPromise
     *
     * @private
     */
    _refresh: function _refresh() {
        var _this5 = this;

        var credentials = {
            grant_type: 'refresh_token',
            refresh_token: AUTH.body.refresh_token,
            client_id: 'sugar',
            client_secret: ''
        };
        var url = [ROOT_URL, VERSION, 'oauth2/token'].join('/');

        return chakram.post(url, credentials).then(function (response) {
            _this5._storeHeaders();
        });
    }
};

/**
 * @property {Object} cachedAgents Map between usernames and agent instances.
 */
var cachedAgents = {};

// AGENT TO BE WRITTEN BY BOB

var Agent = function () {
    function Agent() {
        _classCallCheck(this, Agent);
    }

    _createClass(Agent, null, [{
        key: 'as',
        value: function as(username) {
            return new UserAgent(username, credentials[username], VERSION).login();
        }
    }]);

    return Agent;
}();

Agent.ADMIN = process.env.ADMIN_USERNAME;
Object.freeze(Agent);

var UserAgent = function () {
    function UserAgent() {
        _classCallCheck(this, UserAgent);

        this.login = function () {};

        this.refresh = function () {};
    }
    //...


    /**
     * Clones agent and swaps API version, if supplied version matches the previously supplied version, same agent instance is returned.
     *
     * @param {string} version
     */


    _createClass(UserAgent, [{
        key: 'on',
        value: function on(version) {}
        //...


        // private login function


        // private refresh function

    }, {
        key: 'get',
        value: function get(endpoint, params) {
            agentsMap.get(this).refresh();
        }
    }, {
        key: 'post',
        value: function post(endpoint, data, params) {}
    }, {
        key: 'put',
        value: function put(endpoint, data, params) {}
    }, {
        key: 'delete',
        value: function _delete(endpoint, data, params) {}
    }]);

    return UserAgent;
}();

exports.Fixtures = Fixtures;
exports.Agent = Agent;