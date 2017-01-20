/**
 * Root URL of SugarCRM instance to test.
 * @type {string}
 * @private
 */
const ROOT_URL = process.env.THORN_SERVER_URL;
if (!ROOT_URL) {
    throw new Error('Please set process.env.THORN_SERVER_URL!');
}

let _ = require('lodash');
let chakram = require('chakram');

/**
 * Thorn-private utility functions.
 * @namespace
 */
var utils = {
    /**
     * Construct a URL relative to the base URL.
     * Each argument is joined with a `/`.
     *
     * @param {...string} pathParts URL path component.
     * @return {string} The full URL.
     */
    constructUrl: function constructUrl(...pathParts) {
        return _.flatten([
            ROOT_URL,
            'rest',
            pathParts,
        ]).join('/');
    },

    /**
     * Log in as any user.
     *
     * @param {Object} options Login options.
     * @param {string} options.username Username of the user to log in as.
     * @param {string} options.password Password of the user to log in as.
     * @param {string} options.version API version to use to log in.
     * @param {string} options.xthorn Value of the X-Thorn header.
     * @return {ChakramPromise} Promise that resolves to the result of the login request.
     */
    login: function login(options) {
        return this._oauthRequest({
            credentials: {
                username: options.username,
                password: options.password,
                grant_type: 'password',
                client_id: 'sugar',
                client_secret: '',
            },
            version: options.version,
            xthorn: options.xthorn,
        });
    },

    /**
     * Refresh the user with the given refresh token.
     *
     * @param {Object} options Refresh options.
     * @param {string} options.version API version to do the refresh request on.
     * @param {string} options.token The refresh token of the user you wish to refresh.
     * @param {string} options.xthorn Value of the X-Thorn header.
     * @return {ChakramPromise} A promise which resolves to the Chakram refresh response.
     */
    refresh: function refresh(options) {
        return this._oauthRequest({
            credentials: {
                grant_type: 'refresh_token',
                refresh_token: options.token,
                client_id: 'sugar',
                client_secret: '',
            },
            version: options.version,
            xthorn: options.xthorn,
        });
    },

    /**
     * Tries a request. If it fails because of HTTP 401, do a refresh and then
     * try again. If it fails because of some other HTTP status code, throw an exception.
     *
     * @param {function} chakramMethod Chakram request method to call.
     * @param {array} args Arguments to call the chakram request method with.
     *   The last member of the array must be a `params`-like object.
     * @param {Object} options Additional configuration options.
     * @param {string} options.refreshToken Refresh token to use if you have to do a refresh.
     * @param {function} options.afterRefresh Additional tasks to be performed after
     *   a refresh occurs. Passed the chakram response object from the refresh.
     * @param {string} options.retryVersion API version to make the retry request on.
     *   Non-retry requests are made on whatever version is specified by `args`.
     * @param {string} options.xthorn Value of the X-Thorn header.
     * @return {ChakramPromise} A promise resolving to the result of the request.
     *   If the first try failed, it will resolve to the result of the second,
     *   whether it succeeded or not.
     */
    wrapRequest: function wrapRequest(chakramMethod, args, options) {
        let retryVersion = options.retryVersion;
        return chakramMethod.apply(chakram, args).then((response) => {
            if (!response || !response.response) {
                throw new Error('Invalid response received!');
            }

            if (response.response.statusCode === 200) {
                return response;
            }

            if (response.response.statusCode !== 401) {
                throw response;
            }

            return utils.refresh({
                version: retryVersion,
                token: options.refreshToken,
                xthorn: options.xthorn,
            }).then((response) => {
                options.afterRefresh(response);

                // FIXME Currently, we have to update the HTTP parameters after the refresh
                // to include the OAuth Token.
                // Ideally, we would not have to mess with the parameters.
                let updatedArgs = _.cloneDeep(args);
                let paramIndex = updatedArgs.length - 1;
                updatedArgs[paramIndex].headers['OAuth-Token'] = response.body.access_token;

                return chakramMethod.apply(chakram, updatedArgs);
            });
        });
    },

    /**
     * Perform a request against the oauth2/token endpoint.
     *
     * @param {Object} options OAuth request options.
     * @param {Object} options.credentials Request credentials.
     * @param {string} options.version API version to make the request against.
     * @param {string} options.xthorn Value of the X-Thorn header.
     * @return {ChakramPromise} Promise resolving to the result of the request.
     *
     * @private
     */
    _oauthRequest: function _oauthRequest(options) {
        let url = utils.constructUrl(options.version, 'oauth2/token');
        return chakram.post(url, options.credentials, {
            headers: {
                'X-Thorn': options.xthorn,
            },
        });
    },
};

module.exports = utils;
