'use strict';

var MetadataFetcher = {
    /**
     * Generates random values field types.
     *
     * @param {string} type Type of the field.
     * @param {Object} [fieldDefs] Requirements of the field.
     *
     * @return {string} Random field value according to type and module.
     */
    generateFieldValue: function generateFieldValue(type) {
        var fieldDefs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var val = void 0;

        switch (type) {
            case 'varchar':
                val = this._generateVarChar(fieldDefs.length);
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
    _generateVarChar: function _generateVarChar() {
        var length = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10;

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
    fetchRequiredFields: function fetchRequiredFields(module) {
        if (!metadata[module]) {
            throw 'Unrecognized module';
        }

        return metadata[module].requiredFields;
    }
};

var metadata = {
    Accounts: {
        requiredFields: [{
            name: 'name',
            type: 'varchar'
        }]
    },
    Contacts: {
        requiredFields: [{
            name: 'last_name',
            type: 'varchar'
        }]
    },
    Dashboards: {
        requiredFields: []
    },
    Users: {
        requiredFields: [{
            name: 'user_name',
            type: 'varchar'
        }, {
            name: 'user_hash', // Not actually required. But to handle logins, we will generate user hashes.
            type: 'varchar'
        }, {
            name: 'last_name',
            type: 'varchar'
        }]
    },
    TestModule: {
        requiredFields: []
    }
};

module.exports = MetadataFetcher;