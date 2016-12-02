var MetadataFetcher = {
    /**
     * Generates random values field types.
     *
     * @param {string} type Type of the field.
     * @param {Object} [reqs] Requirements of the field.
     *
     * @return {string} Random field value according to type and module.
     */
    generateFieldValue(type, reqs = {}) {
        let val;

        switch (type) {
            case 'varchar':
                val = this._generateVarChar(reqs.length);
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
     * @return {Object} Object of required fields.
     */
    fetchRequiredFields(module) {
        if (!metadata[module]) {
            throw 'Unrecognized module';
        }

        return metadata[module].requiredFields;
    }
};

var metadata = {
    Accounts: {
        requiredFields: [
            {
                name: 'name',
                type: 'varchar',
                reqs: {}
            }
        ]
    },
    Contacts: {
        requiredFields: [
            {
                name: 'last_name',
                type: 'varchar',
                reqs: {}
            }
        ]
    },
    TestModule: {
        requiredFields: []
    }
};

module.exports = MetadataFetcher;
