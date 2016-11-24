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

// TEMP
var Fixtures = {};

/**
 * Using the supplied models, create records and links on the server cache those records locally.
 *
 * @param {Object|Object[]} models Object or an array of objects, containing a list of attributes for each new model.
 * @param {Object} options
 * @param {string} options.module The module of all modules (if not specified in the models' object).
 *
 * @return {Promise} The ChakramResponse from the creation of the records and/or links
 * TODO: We'll need dev docs for how to create a user and log in with him/her
 */
Fixtures.create = function(models, options = {}) {
    // Get a unique ID used to identify records created within either a test-run or at least a test-suite

  // Loop models to handle record creation
    // Check if current model has been handled (cached) already
    // Get module's metadata + list of required fields based of model.module || options.module so that we can pre-fill them automatically based on their type
  // end loop
  // Use chakram.post (with Header X-Fixtures: true) to create the record(s), trigger bulk call independentely of the of models.length
  // Loop chakram response for each record
    // Cache record into fixturesMap
      // Cache record into cachedRecords indexed by supplied module
        // TODO later: Runs hooks for specific module so that we can solve exceptions like users and store their credentials separately: e.g.: if (typeof Fixtures['hookUsers'] === 'function') { Fixtures.hookUsers(fixtureObject, responseObject); }
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
};


/**
 * Removes all cached records from the server. Additionally, clears the local cache.
 *
 * @return {Promise} The ChakramResponse for the delete request to the server.
 */
Fixtures.cleanup = function() {
  // Create promise for record deletion
  // Clear the cache
    // Return promise
};

/**
 * Mimics _.findWhere and using the supplied arguments, returns the cached record(s).
 *
 * @param {string} Module The module of the record(s) to find
 * @param {Object} Properties The properties to search for
 */
Fixtures.lookup = function(module, properties) {
    // Mimics _.findWhere and looks up through cache
};

/**
 * @param object left Record retrieved from cache or fixture.
 * @param string linkName Relationship link name.
 * @param object right Record retrieved from cache or fixture.
 */
Fixtures.link = function(left, linkName, right) {
  // search left and right on fixturesMap
  // if not found search them on cachedRecords
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
