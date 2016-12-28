let RP = require('request-promise');
let _ = require('lodash');

var MetadataFetcher = {

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
        let _this = this;
        
        let loginOptions = {
            method: 'POST',
            uri: process.env.API_URL + '/rest/v10/oauth2/token',
            headers: {
                'X-Thorn': 'MetadataFetcher'
            },
            body: {
                username: process.env.ADMIN_USERNAME,
                password: process.env.ADMIN_PASSWORD,
                grant_type: 'password',
                client_id: 'sugar',
                client_secret: ''
            },
            json: true
        }

        let self = this;
        // Log into server as admin
        this.currentRequest = RP(loginOptions)
            .then((response) => {
                authToken = response.access_token;

                let metadataOptions = {
                    method: 'GET',
                    uri: process.env.API_URL + '/rest/v10/metadata?modules',
                    headers: {
                        'X-Thorn': 'MetadataFetcher',
                        'OAuth-token': authToken
                    },
                };
                // Make request for metadata
                return RP(metadataOptions)
            })
            .then((response) => {
                // Then, format the metadata
                let metadata = {};
                var responseJson = JSON.parse(response);
                _.forEach(responseJson.modules, function(data, module) {
                    metadata[module] = _this._filterByRequiredFields(data.fields);
                });

                self.currentRequest = null;

                return metadata;
            });

        return this.currentRequest;

    },

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
    }
};

module.exports = MetadataFetcher;

