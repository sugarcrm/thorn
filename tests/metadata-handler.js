describe('Metadata Handler', () => {
    let _ = require('lodash');
    let Meta = require('../dist/metadata-handler.js');
    let expect = require('chakram').expect;

    describe('generateFieldValue', () => {
        describe('unsupported types', () => {
            it('should throw an error', () => {
                let types = [
                    'assigned_user_name',
                    'id',
                    'image',
                    'link',
                    'relate',
                    'team_list',
                    'file',
                    'json',
                    'username'
                ];
                _.each(types, (type) => {
                    let msg = 'Fields of type ' + type + ' are not supported. Please define them manually.';
                    expect(() => Meta.generateFieldValue({type: type})).to.throw(msg);
                });
            });
        });

        describe('unrecognized types', () => {
            it('should throw an error', () => {
                let msg = 'Field type i_am_not_a_real_type is not recognized.';
                expect(() => Meta.generateFieldValue({type: 'i_am_not_a_real_type'})).to.throw(msg);
            });
        });

        describe('varchars', () => {
            it('should return a string of maximum length', () => {
                let field = {
                    type: 'varchar',
                    len: 15,
                };
                let value = Meta.generateFieldValue(field);
                expect(value).to.be.a.string;
                expect(value.length).to.be.at.most(field.len);
            });

            it('should have a default length of 30', () => {
                let value = Meta.generateFieldValue({type: 'varchar'});
                expect(value).to.have.lengthOf(30);
            });
        });

        describe('passwords', () => {
            it('should return a string', () => {
                let value = Meta.generateFieldValue({type: 'password'});
                expect(value).to.be.a.string;
            });
        });

        describe('chars', () => {
            it('should return a string of specified length', () => {
                let field = {
                    type: 'char',
                    len: 15,
                };
                let value = Meta.generateFieldValue(field);
                expect(value).to.be.a.string;
                expect(value).to.have.lengthOf(field.len);
            });

            it('should have a default length of 30', () => {
                let value = Meta.generateFieldValue({type: 'char'});
                expect(value).to.have.lengthOf(30);
            });
        });

        describe('bools', () => {
            it('should return a boolean', () => {
                expect(Meta.generateFieldValue({type: 'bool'})).to.be.a.boolean;
            });
        });

        describe('ints', () => {
            it('should return an integer with the proper number of digits', () => {
                let value = Meta.generateFieldValue({type: 'int', len: '4'});
                expect(value).to.be.a.number;
                expect(value).to.be.at.most(9999);
            });

            it('should only return a number with at most 5 digits', () => {
                let value = Meta.generateFieldValue({type: 'int', len: '6'});
                expect(value).to.be.a.number;
                expect(value).to.be.at.most(99999);
            });
        });

        describe('decimals', () => {
            it('should return a number with the proper number of digits', () => {
                let value = Meta.generateFieldValue({type: 'decimal', len: '5,2'});
                expect(value).to.be.a.number;
                // Number.toString() always uses a ".", even in European locales
                let [intPart, decimalPart] = value.toString().split('.');
                expect(intPart.length).to.be.at.most(3);
                expect(decimalPart.length).to.be.at.most(2);
            });

            it('should only return a number with at most 5 digits before and after the decimal', () => {
                let value = Meta.generateFieldValue({type: 'decimal', len: '6,6'});
                // Number.toString() always uses a ".", even in European locales
                let [intPart, decimalPart] = value.toString().split('.');
                expect(intPart.length).to.be.at.most(5);
                expect(decimalPart.length).to.be.at.most(5);
            });
        });

        describe('datetimes', () => {
            it('should return a Date', () => {
                let value = Meta.generateFieldValue({type: 'datetime'});
                expect(value instanceof Date).to.be.true;
            });
        });

        describe('urls', () => {
            it('should return an HTTP(S) URL', () => {
                let url = require('url');
                let value = url.parse(Meta.generateFieldValue({type: 'url'}));
                expect(value.protocol).to.have.string('http');
            });

            it('should support a maximum length', () => {
                let field = {
                    type: 'url',
                    len: 12,
                };
                let value = Meta.generateFieldValue(field);
                expect(value.length).to.be.at.most(field.len);
            });
        });

        describe('emails', () => {
            it('should return an email address', () => {
                // validating emails is arduous. Just check it's word@domain.tld
                let value = Meta.generateFieldValue({type: 'email'});
                expect(value).to.match(/\w*@\w*\.\w*/);
            });
        });

        describe('phone numbers', () => {
            it('should return a string of digits', () => {
                let value = Meta.generateFieldValue({type: 'phone'});
                expect(value).to.be.a.string;
                expect(value).to.match(/\d*/);
            });

            it('should support a maximum length', () => {
                let field = {
                    type: 'phone',
                    len: 7,
                };
                let value = Meta.generateFieldValue(field);
                expect(value).to.be.a.string;
                expect(value.length).to.be.at.most(field.len);
            });
        });

        describe('texts', () => {
            it('should return a string', () => {
                expect(Meta.generateFieldValue({type: 'text'})).to.be.a.string;
            });
        });

        describe('longtexts', () => {
            it('should return a string', () => {
                expect(Meta.generateFieldValue({type: 'longtext'})).to.be.a.string;
            });
        });

        describe('enums', () => {
            it('should return a string', () => {
                expect(Meta.generateFieldValue({type: 'enum'})).to.be.a.string;
            });
        });

        describe('names', () => {
            it('should return a string', () => {
                expect(Meta.generateFieldValue({type: 'name'})).to.be.a.string;
            });
        });
    });
});
