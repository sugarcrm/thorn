process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'asdf';
process.env.API_URL = 'http://localhost/sugarbuild/7.8/ent/sugarcrm/rest';

let chakram = require('chakram');
let expect = chakram.expect;
let _ = require('lodash');
let thorn = require('../dist/index.js');
let Fixtures = thorn.Fixtures;
let Agent = thorn.Agent;

describe.only('Dashboards', () => {
	let createdRecords;
	let jane;
	let john;

	before(() => {
		let users = [
			{
				attributes: {
					user_name: 'John'
				}
			},
			{
				attributes: {
					user_name: 'Jane'
				}
			}
		];
		let dashboards = [
			{
				attributes: {
					name: 'JohnsDashboard',
					assigned_user_id: null
				}
			},
			{
				attributes: {
					name: 'JanesDashboard',
					assigned_user_id: null
				}
			}
		];

		return Fixtures.create(users, {module: 'Users'})
			.then(() => {
				dashboards[0].assigned_user_id = Fixtures.lookup('Users', {user_name: 'John'});
				dashboards[1].assigned_user_id = Fixtures.lookup('Users', {user_name: 'Jane'});

				return Fixtures.create(dashboards, {module: 'Dashboards'});
			})
			.then((cachedRecords) => {
				//console.log(cachedRecords);
				createdRecords = cachedRecords;
				jane = Agent.as('Jane');
				john = Agent.as('John');
			});
	});

	after(() => {
		return Fixtures.cleanup();
	});

	describe('Dasboards visibility', () => {
		let johnsDashboard;

		before(() => {
			johnsDashboard = Fixtures.lookup('Dashboards', {name: 'JohnsDashboard'});
		});

		it('should allow user to manage his own dashboard', () => {
			let testDashboard = {
				definition: {
					name: 'TestDashboard'
				},
				record: null
			};

			return john.post('Dashboards', testDashboard.definition)
				.then((response) => {
					// create test
					expect(response).to.have.status(200);
					testDashboard.record = response.response.body;
					return john.get('Dashboards');
				})
				.then((response) => {
					// read test
					expect(response).to.have.status(200);
					return john.put('Dashboards/' + testDashboard.record.id, {name: 'UpdatedTestDashboard'});
				})
				.then((response) => {
					// edit test
					expect(response).to.have.status(200);
					expect(response.response.body.name).to.equal('UpdatedTestDashboard');
					return john.delete('Dashboards/' + testDashboard.record.id);
				})
				.then((response) => {
					// delete test
					expect(response).to.have.status(200);
					return john.get('Dashboards/' + testDashboard.record.id);
				})
				.then((response) => {
					// delete test verification
					expect(response).to.have.status(404);
				});
		});

		it('should not let a user view another user\'s dashboard', () => {
			return jane.get('Dashboards/' + johnsDashboard.id)
				.then((response) => {
					expect(response).to.have.status(404);
				});
		});

		it('should not let a user edit another user\'s dashboard', () => {
			return jane.put('Dashboards/' + johnsDashboard.id, {name: 'UpdateName'})
				.then((response) => {
					expect(response).to.have.status(404);
				});
		});

		it('should not let a user delete another user\s dashboard', () => {
			return jane.delete('Dashboards/' + johnsDashboard.id)
				.then((response) => {
					expect(response).to.have.status(404);
				});
		});
	});
});
