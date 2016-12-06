var MetadataFetcher = {
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
     * @return {Object} Object of required fields.
     */
    fetchRequiredFields(module) {
        if (!metadata[module]) {
            throw new Error('Unrecognized module');
        }

        return metadata[module].requiredFields;
    }
};

var metadata = {
    Accounts: {
        requiredFields: [
            {
                name: 'name',
                type: 'varchar'
            }
        ]
    },
    Contacts: {
        requiredFields: [
            {
                name: 'last_name',
                type: 'varchar'
            }
        ]
    },
    Dashboards: {
        requiredFields: []
    },
    Users: {
        requiredFields: [
            {
                name: 'user_name',
                type: 'varchar'
            },
            {
                name: 'user_hash', // Not actually required. But to handle logins, we will generate user hashes.
                type: 'varchar'
            },
            {
                name: 'last_name',
                type: 'varchar'
            }
        ]
    },
    TestModule1: {
        requiredFields: []
    },
    TestModule2: {
        requiredFields: []
    }
};

module.exports = MetadataFetcher;
