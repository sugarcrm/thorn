/*
 * Copyright (c) 2017 SugarCRM Inc. Licensed by SugarCRM under the Apache 2.0 license.
 */

let _ = require('lodash');
let utils = require('./utils');
let chakram = require('chakram');

const VERSION = 'v10';

let MetadataFetcher = {

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
            username: process.env.THORN_ADMIN_USERNAME,
            password: process.env.THORN_ADMIN_PASSWORD,
            version: VERSION,
            xthorn: 'MetadataFetcher',
        };

        let self = this;
        // Log into server as admin
        this.currentRequest = utils.login(loginOptions)
            .then((response) => {
                authToken = response.body.access_token;

                let url = `${utils.constructUrl(VERSION, 'metadata')}?modules`;
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
                let responseJson = response.body;
                _.each(responseJson.modules, (data, module) => {
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
        let filteredFields = { fields: {} };
        _.each(fields, (field, fieldName) => {
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
