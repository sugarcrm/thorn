/**
 * Thorn Node.js module for REST API testing SugarCRM with Chakram.
 *
 * @module thorn
 */

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

class DuplicateRecordException {
    constructor(model) {
        this.message = 'Cannot create duplicate record.';
        this.model = model;
    }
}

class DuplicateLinkException {
    constructor(model) {
        this.message = 'Cannot create duplicate link.';
        this.model = model;
    }
}

class EmptyModuleException {
    constructor(model) {
        this.message = 'Must supply a module through model or options.';
        this.model = model;
    }
}

class MissingLinkException {
    constructor(link) {
        this.message = 'Missing link.';
        this.link = link;
    }
}

var MetadataFetcher = {
    /**
     * Generates random values field types.
     *
     * @param {string} type Type of the field.
     * @param {string} module Module of the field.
     * @return {string} Random field value according to type and module.
     */
    // TODO implement generator
    generateFieldValue: (type, module) => {
        // case switch on `type`
        return '';
    },

    /**
     * Returns the required fields of module.
     *
     * @param {string} module Module name.
     * @return {Object} Object of required fields.
     */
     // TODO implement this
    fetchRequiredFields: (module) => {
        return {}
    },

    /**
     * Returns the link name of the module.
     *
     * @param {string} module Module name.
     * @return {string} Link name of the module in vardefs.
     */
    // TODO implement this
    getLinkName: (module) => {
        return module;
    }
};

var Fixtures = {
    /**
     * Using the supplied models, create records and links on the server cache those records locally.
     *
     * @param {Object[]} An array of objects, containing a list of attributes for each new model.
     * @param {Object} options
     * @param {string} options.module The module of all modules (if not specified in the models' object).
     *
     * @return {Promise} The ChakramResponse from the creation of the records and/or links
     * TODO: We'll need dev docs for how to create a user and log in with him/her
     */


     /**************************************************************************
      ****************** PROPOSED IMPLEMENTATION PSEUDOCODE ********************
      *************************************************************************/
    // Get a unique ID used to identify records created within either a test-run or at least a test-suite

    // Loop models to handle record creation
        // Check if cux rrent model has been handled (cached) already
        // Get module's metadata + list of required fields based of model.module || options.module so that we can pre-fill them automatically based on their type
    // end loop
    
    // Use chakram.post (with Header X-Fixtures: true) to create the record(s), trigger bulk call independentely of the of models.length 
        // Loop chakram response for each record
            // Cache record into fixturesMap
            // Cache record into cachedRecords indexed by supplied module
            // TODO later: Runs hooks for specific module so that we can solve exceptions like users and store their credentials separately: 
            //    e.g.: if (typeof Fixtures['hookUsers'] === 'function') { Fixtures.hookUsers(fixtureObject, responseObject); }
        // end loop
      
    // Loop models to handle links
        // Check if current link has been handled (cached) already
    // end loop
    // Use chakram.post (with Header X-Fixtures: true) to create the link(s), trigger bulk call independentely of the amount of links supplied 
        // Loop chakram response for each record
            // Cache record into fixturesMap
            // Cache record into cachedRecords indexed by supplied module
        // end loop
      
    // Return promise with the record(s) that we've just created


    create: (models, options = {}) => {
        let bulkRecordCreateDef = {requests: []};
        let bulkRecordLinkDef = {requests: []};
        let url = [ROOT_URL, version, 'bulk'].join('/');
        let params = {headers: this._getHeaders()};
        let leftLinkArray = [];

        // Loop models to check if any model has been cached already
        // Fetch module's required fields and pre-fill them
        _.each(models, (model) => {
            let requiredFields;
            let request = {
                url: '/' + VERSION + '/' + module,
                method: 'POST',
                data: model.attributes
            };
            model.module = model.module || options.module;

            if (!model.module) {
                throw new EmptyModuleException(model);
            }
            if (fixturesMap.has(model)) {
                // We can `continue` if we dont want to throw
                throw new DuplicateRecordException(model);
            }

            // TODO implement function to fetch required fields based on metadata.
            requiredFields = MetadataFetcher.fetchRequiredFields(model.module);
            _.each(requiredFields, (field) => {
                request.data[field.name] = MetadataFetcher.generateFieldValue(field.type, model.module);
            });

            // Use chakram.post (with Header X-Fixtures: true) to bulk create the record(s).
            bulkRecordCreateDef.requests.push(request);
        });

        // return Promise
        return chakram.post(url, bulkRecordCreateDef, params).then((response) => {
            let records = response.response.body;
            let modelIndex = 0;

            // Loop chakram response for each record
            _.each(records, (record) => {
                let recordModule = record._module;
                // Cache record into fixturesMap
                // We are assuming the bulk response is in the same order as the supplied requests.
                // TODO verify this assumption
                fixturesMap.set(models[modelIndex++], record);
                // Cache record into cachedRecords indexed by supplied module
                if (cachedRecords[recordModule]) {
                    cachedRecords[recordModule].push(record);
                } else {
                    cachedRecords[recordModule] = [record];
                }
            });
        }).then(() => {
            // Loop models to handle links
            _.each(models, (model) => {
                let leftID = fixturesMap.get(model).id;

                _.each(model.links, (link) => {
                    let cachedRecord = fixturesMap.get(link);
                    let request = {
                        url: '/' + VERSION + '/' + model.module + '/record/link',
                        method: 'POST',
                        data: {
                            link_name: MetadataFetcher.getLinkName(cachedRecord._module),
                            ids: [
                                leftID,
                                {
                                    id: cachedRecord.id
                                }
                            ]
                        }
                    };

                    bulkRecordLinkDef.requests.push(request);
                    leftLinkArray.push(model);
                });
            });

            return chakram.post(url, bulkRecordLinkDef, params);
        }, (error) => {
            // error handling
            console.error(error);
            throw error;
        }).then((response) => {
            let records = response.response.body;
            let leftLinkIndex = 0;

            // Loop chakram response for each record
            _.each(records, (record) => {
                let relatedRecords = record.related_records;
                
                // Cache record into fixturesMap
                // This is pretty terrible. But we need to establish a link between the models and the response from
                //   the bulk link call, in order to cache into #fixturesMap.
                fixturesMap.get(leftLinkArray[leftLinkIndex++]).related_records = relatedRecords;
                // Cache record into cachedRecords
                this.lookup(record.record._module, {id: record.record.id})[0].related_records = relatedRecords;
            });

            return cachedRecords;
        }, (error) => {
            // error handling
            console.error(error);
            throw error;
        });
    },

    /**
     * Removes all cached records from the server. Additionally, clears the local cache.
     *
     * @return {Promise} The ChakramResponse for the delete request to the server.
     */
    cleanup: () => {
        // Create promise for record deletion
        // Clear the cache
        // Return promise
        let bulkRecordDeleteDef = {requests: []};
        let url = [ROOT_URL, version, 'bulk'].join('/');
        let params = {headers: this._getHeaders()};

        _.each(cachedRecords, (moduleRecords) => {
            let module = moduleRecords[0]._module;

            _.each(moduleRecords, (record) => {
                bulkRecordDeleteDef.push({
                    url: '/' + VERSION + '/' + module + '/' + record.id,
                    method: 'DELETE'
                });
            });
        });

        // Create promise for record deletion
        return chakram.post(url, bulkRecordDeleteDef, params).then(() => {
            // clear cache
            delete cachedRecords;
        }, (error) => {
            // error handling
            console.error(error);
            throw error;
        });
    },

    /**
     * Mimics _.findWhere and using the supplied arguments, returns the cached record(s).
     *
     * @param {string} Module The module of the record(s) to find
     * @param {Object} Properties The properties to search for
     * @return {Object[]} Array of records that match properties
     */
    lookup: (module, properties) => {
        // Mimics _.findWhere and looks up through cache
        let ret = [];

        _.each(cachedRecords, (moduleRecords) => {
            ret = ret.concat(_.findWhere(moduleRecords, properties));
        });
    },

    /**
     * @param {Object} left Record retrieved from cache or fixture.
     * @param {string} linkName Relationship link name.
     * @param {Object} right Record retrieved from cache or fixture.
     */
    link: (left, linkName, right) => {
        let leftLink;
        let rightLink;
        let url;
        let params = {headers: this._getHeaders()};
        let linkDef = {
            link_name: linkName,
            id: []
        };

        // search left and right on fixturesMap
        // if not found search them on cachedRecords
        leftLink = fixturesMap.get(left) || this.lookup(left);
        rightLink = fixturesMap.get(right) || this.lookup(left);

        if (!leftLink) {
            throw new MissingLinkException(left);
        }
        if (!rightLink) {
            throw new MissingLinkException(right);
        }
    
        url = '/' + VERSION + '/' + leftLink._module + '/record/link';
        linkDef.id = [
            leftLink.id,
            {
                id: rightLink.id
            }
        ];

        return chakram.post(url, linkDef, params);
    },

    /**
     * Get ADMIN headers required for record creation
     *
     * @return {Object} Headers including authentification information.
     */
    _getHeaders: () => {
        return {
            'Content-Type': 'application/json',
            'Oauth-Token': AUTH.body.access_token,
            'X-Fixtures': true
        };
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
