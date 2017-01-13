let _ = require('lodash');
let utils = require('./utils');
let chakram = require('chakram');

const VERSION = 'v10';

var MetadataFetcher = {

    /**
     * @property {string} currentRequest The current request to
     *   fetch metadata, if a request is ongoing.
     */
    currentRequest: null,

    /**
     * Returns a promise that resolves to the formatted metadata.
     *
     * @return {Promise} A promise that resolves to formatted metadata.
     */
    fetch() {
        // If there is already a request in progress, return that immediately.
        if (this.currentRequest) {
            return this.currentRequest;
        }

        let authToken;

        let loginOptions = {
            username: process.env.ADMIN_USERNAME,
            password: process.env.ADMIN_PASSWORD,
            version: VERSION,
            xthorn: 'MetadataFetcher',
        };

        let self = this;
        // Log into server as admin
        this.currentRequest = utils.login(loginOptions)
            .then((response) => {
                authToken = response.access_token;

                let url = process.env.API_URL + '/rest/' + VERSION + '/metadata?modules';
                let metadataOptions = {
                    headers: {
                        'X-Thorn': 'MetadataFetcher',
                        'OAuth-Token': authToken,
                    },
                };
                // Make request for metadata
                return chakram.get(url, metadataOptions);
            }).then((response) => {
                // Format the metadata
                let metadata = {};
                var responseJson = response.body;
                _.forEach(responseJson.modules, function(data, module) {
                    metadata[module] = self._filterByRequiredFields(data.fields);
                });

                self.currentRequest = null;

                return metadata;
            });

        return this.currentRequest;
    },

    /**
     * Given an object containing the metadata fields,
     *  returns the fields that are required.
     *
     * @param {Object} fields The fields to search
     *
     * @return {Object} The required fields
     *
     * @private
     */
    _filterByRequiredFields(fields) {
        let filteredFields = {fields: {}};
        _.forEach(fields, (field, fieldName) => {
            if (
                !_.isUndefined(field.required) &&
                field.required &&
                _.isUndefined(field.source) &&
                _.isUndefined(field.readonly) &&
                (_.isUndefined(field.type) || field.type !== 'id')
            ) {
                filteredFields.fields[fieldName] = field;
            }
        });
        return filteredFields;
    },
};

module.exports = MetadataFetcher;
