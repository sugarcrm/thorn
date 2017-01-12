let MetadataFetcher = require('./metadata-fetcher.js');
let faker = require('faker');
let _ = require('lodash');

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
        let val, length, afterDecimal, beforeDecimal;

        switch (field.type) {
        case 'bool':
            val = faker.random.boolean();
            break;
        case 'char':
        case 'password':
        case 'varchar':
            // this is char in the SQL sense, not the C sense
            length = field.len || 30;
            if (length > 30) {
                length = 30;
            }
            val = faker.random.alphaNumeric(length);
            break;
        case 'date':
        case 'datetime':
        case 'datetimecombo':
            val = faker.date.recent(5);
            break;
        case 'int':
            let maxLength = field.len || 5;

            // For sanity, set the max number of digits to 5
            maxLength = maxLength > 5 ? 5 : maxLength;
            val = faker.random.number({max:Math.pow(10, maxLength)});
            break;
        case 'currency':
        case 'decimal':
            // faker.js has no support for decimal numbers
            let splitLen = field.len || "5,5";
            [beforeDecimal, afterDecimal] = this._parsePrecision(splitLen);

            // For sanity, set the max number of digits to 5
            beforeDecimal = beforeDecimal > 5 ? 5 : beforeDecimal;
            afterDecimal = afterDecimal > 5 ? 5 : afterDecimal;
            val = faker.random.number({max: Math.pow(10, beforeDecimal)}) +
                (faker.random.number({max: Math.pow(10, afterDecimal)}) / Math.pow(10, afterDecimal));
            break;
        case 'email':
            val = faker.internet.exampleEmail('Jack', 'Jackson');
            // FIXME: support maximum lengths!
            break;
        case 'enum':
            // for now, we just return an arbitrary random string
            val = faker.lorem.word();
            break;
        case 'name':
            val = faker.name.firstName();
            break;
        case 'phone':
            // these are used with callto: URLs
            val = faker.phone.phoneNumber().replace(/\D/g, '');
            if (field.len) {
                val = val.substring(0, field.len);
            }
            break;
        case 'text':
        case 'longtext':
            val = faker.lorem.paragraph();
            break;
        case 'url':
            val = faker.internet.url();
            if (field.len) {
                /* the minimum length of an HTTPS URL is 9 ("https://a").
                   Other protocols could obviously allow shorter ones,
                   but Faker only supports HTTP(S). So forbid any lengths
                   shorter than that. */
                if (field.len < 9) {
                    throw new Error('URLs with fewer than 9 characters are not supported.');
                }
                val = val.substring(0, field.len);
            }
            break;
        case 'assigned_user_name':
        case 'id':
        case 'image':
        case 'link':
        case 'relate':
        case 'team_list':
        case 'file':
        case 'json':
        case 'username':
            throw new Error('Fields of type ' + field.type + ' are not supported. Please define them manually.');
        default:
            throw new Error('Field type ' + field.type + ' is not recognized.');
        }

        return val;
    },

    /**
     * Parse an SQL precision specification.
     *
     * @param {string} prec The precision specification.
     *
     * @return {number[]} The maximum number of digits expected on
     *     either end of the decimal point.
     * @see https://msdn.microsoft.com/en-us/library/ms187746.aspx
     * @private
     */
    _parsePrecision(prec) {
        let [precision, scale] = prec.split(',');
        if (scale) {
            let afterDecimal = Number.parseInt(scale);
            let beforeDecimal = Number.parseInt(precision) - afterDecimal;
            return [beforeDecimal, afterDecimal];
        }

        // FIXME!!!
        throw new Error('Single-digit precision specifications are not currently supported!');
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
                throw new Error('Unrecognized module: ' + module);
            }

            return Promise.resolve(this._metadata[module].fields);
        }

        let userHash = {
            name: 'user_hash',
            type: 'password'
        };

        if (process.env.METADATA_FILE) {
            let fileMetadata = require(process.env.METADATA_FILE);
            if (fileMetadata.Users) {
                fileMetadata.Users.fields.user_hash = userHash;
            }
            this._metadata = require(process.env.METADATA_FILE);
            if (!this._metadata[module]) {
                throw new Error('Unrecognized module: ' + module);
            }
            return Promise.resolve(this._metadata[module].fields);
        }

        return MetadataFetcher.fetch()
            .then((metadata) => {
                if (metadata.Users) {
                    metadata.Users.fields.user_hash = userHash;
                }
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
    },
};

module.exports = MetadataHandler;
