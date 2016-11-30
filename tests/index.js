var request = require('request');
var expect = require('chai').expect;
var nock = require('nock');
var thorn = require('../dist/index.js');
var Fixtures = thorn.Fixtures;
var requests = [];
var scope;

beforeEach(() => {
    scope = nock('http://localhost')
        .post('/bulk')
        .reply(200, 'worked!');
});

describe('Fixtures', () => {
    it('should create and find a fixture', (done) => {
        let myFixture = {};
        let createPromise = Fixtures.create(myFixture);
        // Expect return to be a promise
        //expect(createPromise).to.be.a('ChakramPromise');
        // Expect server hit to be a POST with data
        createPromise.then((response) => {
            console.log(response);
            done();
        });
    });

});

