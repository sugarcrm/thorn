// THIS IS ALL TEMP CODE
process.env.ADMIN_USERNAME = "admin";
process.env.API_URL = 'http://localhost/builds/7.8/ent/sugarcrm/rest';

var thorn = require('../dist/index.js');
var Agent = thorn.Agent;
var expect = require('chai').expect;

describe('Agent', () => {
    describe('UserAgent', () => {
        var userAgent = Agent.as(Agent.ADMIN);
        
        it('should let you do a get', () => {
            return userAgent.get('Accounts').then(() => {
                console.log("GET BACK");
            });
        });

        it('should let you do a post', () => {
            return userAgent.post('Accounts', {name: 'Bob'}).then(() => {
                console.log("POST BACK");
            });
        });

        it('should let you do a put', () => {
            return userAgent.put('Accounts', {name: 'Not Bob'}).then(() => {
                console.log("PUT BACK");
            });
        });

        it('should let you do a delete', () => {
            return userAgent.delete('Accounts/5', {test: 'i am a test'}).then(() => {
                console.log("DELETE BACK");
            });
        });
    });
});
