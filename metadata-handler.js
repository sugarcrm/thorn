let MetadataFetcher = require('./metadata-fetcher.js');

var MetadataHandler = {
    /**
     * @property {Object} _metadata Metadata structure.
     *
     * @private
     */
    _metadata: null,

    /**
     * Generates random values field types.
     *
     * @param {Object} field Field definitions.
     *
     * @return {string} Random field value according to type and module.
     */
    generateFieldValue(field) {
        let val;

        switch (field.type) {
        case 'varchar':
            val = this._generateVarChar(field.len);
            break;
        /**
        TODO
        case 'datetime':
            val = this._generateDateTime();
            break;
        case 'url':
            val = this._generateURL();
            break;
        case 'email':
            val = this._generateEmail();
            break;
        case 'phone':
            val = this._genenrateNumber();
            break;
        case 'text':
            val = this._generateText(reqs.length);
            break;
        case 'id':
            val = this._generateUID();
            break;
        */
        default:
            val = '';
        }

        return val;
    },

    /**
     * Returns an alphanumeric string.
     *
     * @param {number} [length] Length of the string.
     *
     * @return {string}
     *
     * @private
     */
    _generateVarChar(length = 10) {
        // hack to generate a random alphanumeric string.
        return (Math.random() + 1).toString(36).substring(2, length - 1) + 'gen';
    },

    /**
     * Returns the required fields of module.
     *
     * @param {string} module Module name.
     *
     * @return {Promise} Promise that resolves to required fields.
     */
    getRequiredFields(module) {
        let self = this;
        if (this._metadata) {
            if (!this._metadata[module]) {
                throw new Error('Unrecognized module');
            }

            return Promise.resolve(this._metadata[module].fields);
        }

        if (process.env.METADATA_FILE) {
            this._metadata = require(process.env.METADATA_FILE);
            if (!this._metadata[module]) {
                throw new Error('Unrecognized module');
            }
            return Promise.resolve(this._metadata[module].fields);
        }

        return MetadataFetcher.fetch()
            .then((metadata) => {
                self._metadata = metadata;
                if (!self._metadata[module]) {
                    throw new Error('Unrecognized module');
                }
                return self._metadata[module].fields;
            });
    },

    /**
     * Clears the cached metadata
     */
    clearCachedMetadata() {
        this._metadata = null;
    }
};

module.exports = MetadataHandler;
