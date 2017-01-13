let MetadataFetcher = require('./metadata-fetcher.js');
let faker = require('faker');

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
        let val, maxLength, afterDecimal, beforeDecimal;

        switch (field.type) {
        case 'bool':
            val = faker.random.boolean();
            break;
        case 'char':
        case 'password':
        case 'varchar':
            // this is char in the SQL sense, not the C sense
            maxLength = field.len || 30;
            maxLength = maxLength > 30 ? 30 : maxLength;
            val = faker.random.alphaNumeric(maxLength);
            break;
        case 'currency':
        case 'decimal':
            // faker.js has no support for decimal numbers
            maxLength = field.len || '5,2';
            [beforeDecimal, afterDecimal] = this._parsePrecision(maxLength);

            // For sanity, set the max before decimal to 3 and after to 2
            beforeDecimal = beforeDecimal > 3 ? 3 : beforeDecimal;
            afterDecimal = afterDecimal > 2 ? 2 : afterDecimal;

            // To avoid JS floating point issues, build string and cast as float
            val = parseFloat(
                faker.random.number({max: Math.pow(10, beforeDecimal)})
                + '.' +
                faker.random.number({max: Math.pow(10, afterDecimal)})
            );

            break;
        case 'date':
        case 'datetime':
        case 'datetimecombo':
            val = faker.date.recent(5);
            break;
        case 'email':
            val = faker.internet.exampleEmail('Jack', 'Jackson');
            // FIXME: support maximum lengths!
            break;
        case 'enum':
            // for now, we just return an arbitrary random string
            val = faker.lorem.word();
            break;
        case 'int':
            maxLength = field.len || 5;

            // For sanity, set the max number of digits to 5
            maxLength = maxLength > 5 ? 5 : maxLength;
            val = faker.random.number({max:Math.pow(10, maxLength)});
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
        case 'file':
        case 'id':
        case 'image':
        case 'json':
        case 'link':
        case 'relate':
        case 'team_list':
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

        if (process.env.METADATA_FILE) {
            let fileMetadata = require(process.env.METADATA_FILE);
            fileMetadata = this._patchMetadata(fileMetadata);
            
            this._metadata = fileMetadata;
            if (!this._metadata[module]) {
                throw new Error('Unrecognized module: ' + module);
            }
            return Promise.resolve(this._metadata[module].fields);
        }

        return MetadataFetcher.fetch()
            .then((metadata) => {
                metadata = this._patchMetadata(metadata);
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

    /**
     * Updates the passed in metadata with special cases.
     *
     * Special cases include:
     *   Users.user_hash
     *
     * @param {Object} metadata The metadata to patch.
     * @return {Object} The patched metadata.
     */
    _patchMetadata(metadata) {
        // When we want to log in with a created user, the user_hash
        // must be defined. If we want to generate the user_hash automatically,
        // the user_hash field must be required.

        // Currently OOTB user_hash isn't set as required. If this changes
        // in the future, throw warning below. At that point, the patch
        // to the User metadata is no longer necessary.
        let userHash = {
            name: 'user_hash',
            type: 'password'
        };

        if (metadata.Users) {
            if (metadata.Users.fields.user_hash) {
                console.warn('Users user_hash field is required => true on the Mango side. Skipping metadata patch.');
            } else {
                metadata.Users.fields.user_hash = userHash;
            }
        }

        return metadata;
    }
};

module.exports = MetadataHandler;
