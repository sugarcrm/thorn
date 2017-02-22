# Thorn

Thorn is composed of a set of helper abstractions built to ease the process of
setting up a SugarCRM's REST API testing environment and interacting with it.

## Prerequisites

You should be familiar with [mocha][mocha] and [JavaScript Promises][google-js-promises].

## Setup

```javascript
const { Agent, Fixtures } = require('@sugarcrm/thorn');
```

## Thorn.Fixtures

`Thorn.Fixtures` is an object that handles the setup and cleanup process for test sets. It provides methods for creating records, record-relationships, and deleting records in the database.

### Methods

#### **`Fixtures.create(models, options)` => `{Promise}`**
Method to create records in the database.

| Name      | Type       | Description |
| --------- |:-----------|:------------|
| `models`  | {Object&#124;Object[]} | Object or object array that specifies the records to be created. See [Model Structure](#model-structure) for details. |
| `options` | {Object}   | Optional, `options.module` is the default `module` for objects in `models` that do not specify one. |

**Returns:**

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to a map of module names to records created by this method call. |

<br/>

**Example:**
```javascript
let AccountsContacts = [
    {
        module: 'Accounts',
        attributes: {
            name: 'MyAccount'
        }
    },
    {
        module: 'Contacts',
        attributes: {
            first_name: 'FirstName'
        }
    }
];

let DashboardsOnly = [
    {
        attributes: {
            name: 'MyDashboard'
        }
    }
];

let response = yield Fixtures.create(AccountsContacts);
console.log(response); // Map containing one account, and one contact
/*
{
    Accounts: [
        {
            id: '12257c7c-bb40-11e6-afb2-a0937b020fc9',
            name: 'MyAccount',
            ...
            _module: 'Accounts'
        }
    ],
    Contacts: [
        {
            id: '11232c7c-bb40-11e6-bfb2-a0937b020sc9',
            first_name: 'FirstName'
            ...
            _module: 'Contacts'
        }
    ]
}
*/

response = yield Fixtures.create(DashboardsOnly, {module: 'Dashboard'});
console.log(response);
/*
{
    Dashboards: [
        {
            id: '11232c7c-bb40-11e6-bfb2-a0937b020sc9',
            name: 'MyDashboard',
            ...
            _module: 'Dashboards'
        }
    ]
}
*/
```

<br/>

#### **`Fixtures.link(left, linkName, right)` => `{Promise}`**
Method to link records in the database.

| Name       | Type       | Description |
| ---------- |:-----------|:------------|
| `left`     | {Object}   | A record from the resolution of `Fixtures.create`.  |
| `linkName` | {string}   | Relationship's link name.  |
| `right`    | {Object}   | A record from the resolution of `Fixtures.create`. |

**Returns:**

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to the body of the server response. |

<br/>

**Example:**
```javascript
let Account = {
    module: 'Accounts',
    attributes: {
        name: 'LinkedAccount'
    }
};

let Contact = {
    module: 'Contacts',
    attributes: {
        last_name: 'LinkedContact'
    }
};

let cachedRecords = yield Fixtures.create([Account, Contact]);
console.log(cachedRecords); // Map containing one Account and one Contact

let response = yield Fixtures.link(cachedRecords.Accounts[0], 'accounts_contacts', cachedRecords.Contacts[0]);
// Server response containing the Accounts record and a `related_records` property,
// which contains the Contacts record.
console.log(response);
/*
{
    record: {
        id: '12257c7c-bb40-11e6-afb2-a0937b020fc9',
        name: 'LinkedAccount',
        ...
        _module: 'Accounts'
    },
    related_records: [
        {
            id: '12557c7c-bd40-11e6-afb2-a0345b020fc9',
            last_name: 'LinkedContact',
            ...
            _module: 'Contacts'
        }
    ]
}
*/
```

<br/>

#### **`Fixtures.cleanup()` => `{Promise}`**
Method to delete all records previously created through `Fixtures.create`.
After cleanup, `Fixtures.lookup` will throw an error unless more records are created
with `Fixtures.create`.

**Returns:**

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to the server response to the delete request(s).

<br/>

#### **`Fixtures.lookup(module, properties)` => `{Object}`**
Method that looks through the created records and retrieves the first record
that matches module and the key-value pairs in properties.

| Name         | Type     | Description |
| ------------ |:---------|:------------|
| `module`     | {string} | Module name of the record. |
| `properties` | {Object} | Object of key-value pairs the record should contain. |

**Returns:**

| Type     | Description |
| -------- |:------------|
| {Object} | A single record object. |

<br/>

### Model Structure
Models is an object or array of objects that specifies the records the tester
intends to create.
**Properties of each model object:**

|Name          | Type     | Description |
|--------------|:---------|:------------|
| `module`     | {string} | Optional, module name of the record. |
| `attributes` | {Object} | Specific fields the record should have. Unspecified required field values are auto-generated. |


<br/>

### Tips

* `Fixtures` is designed to be a tool that facilitates the setup and cleanup of test cases. Its methods are *not* meant
to provide a means of testing the correctness of SugarCRM's record creation, linking, and deletion APIs. Such tests
should make use of the request methods of `UserAgent`.

* The same model object cannot be used to create multiple records; this will lead to collisions in `Fixtures` internal
ways of storing records. To reuse the same model to create multiple records, all but the first model must be cloned (
e.g. using `_.clone`).

* Linking records requires that the records have already been created in the database. To avoid exceptions, structure the
record creations such that dependencies are met before `Fixtures` tries to make links.

## Thorn.Agent

Thorn provides an Agent class that simulates a REST API user agent.
You should use this class for all of your Thorn tests except those which test the Users API directly (in which case you should use the [chakram API](chakram) directly).

### Creating Agents

An Agent corresponds directly to a user that exists in the SugarCRM instance you are testing. All users except for the admin user specified by the `THORN_ADMIN_USERNAME` environment variable *must* be created by `Fixtures.create` before you attempt to create a user agent for it. Please refer to [Thorn Fixtures API](#thorn::fixtures) to create the needed users.

User agents are created with `Agent.as`:

```javascript
// assuming a user called "Dashboards.John" already exists
let john = Agent.as('Dashboards.John');
```

**This also logs the user in if they have not been logged in already.**

### Making requests

Agents can make HTTP GET, POST, PUT, and DELETE requests against any SugarCRM REST API endpoint. Each request method has a corresponding function, which makes the desired request and returns a JavaScript Promise which resolves to a [Chakram response object][chakram response] corresponding to the server's response to the request:

```javascript
let response = yield john.get('Accounts');
console.log('%j', response.response.body);
// displays response body
```

Required user refreshes are handled automatically by an agent. If a request fails with HTTP status 401, the agent's authentication is refreshed and the request is automatically retried. However, each request is only retried once to prevent infinite loops.

### Request Methods

#### get

```javascript
let response = yield john.get('Accounts');
console.log(response.response.body);
/*
{
    next_offset: -1,
    records: [
        {
            id: '12257c7c-bb40-11e6-afb2-a0999b020fc9',
            name: 'Accounts.Samantha',
            date_entered: '2016-12-05T15:10:53-08:00',
            date_modified: '2016-12-05T15:10:53-08:00',
            ...
            _module: 'Accounts'
        },
        ...
    ]
*/
```

#### post

```javascript
let response = yield john.post('Accounts', { name: 'Accounts.Smith' });
console.log(response.response.body);
/*
{
    id: '10e42218-bb41-11e6-82c7-a0999b020fc9',
    name: 'Accounts.Smith',
    date_entered: '2016-12-05T15:18:00-08:00',
    date_modified: '2016-12-05T15:18:00-08:00',
    ...
}
*/
```

#### put

```javascript
// assuming "id" is the the ID of Accounts.Smith
let response = yield john.put('Accounts/' + id, { industry: 'Not For Profit' });
console.log(response.response.body);
/*
{
    id: '10e42218-bb41-11e6-82c7-a0999b020fc9',
    name: 'Accounts.Smith',
    date_entered: '2016-12-05T15:54:26-08:00',
    date_modified: '2016-12-05T15:54:27-08:00',
    industry: 'Not For Profit',
    ...
}
*/
```

#### delete

```javascript
let response = yield john.delete('Accounts' + id);
console.log(response.response.body);
/*
{ id: '10e42218-bb41-11e6-82c7-a0999b020fc9' }
*/
```

### Request Arguments

All request methods accept an endpoint and HTTP request parameters; `Agent.put`, `Agent.post`, and `Agent.delete` additionally accept a request body.

##### Endpoints

Endpoints are specified relative to `/rest/<version>/` (see [API versioning](#api-versioning)), so example endpoints might be `'Accounts'`, `'Contacts/<contactId>'`, or `'Forecasts/<timePeriodId>/progressRep/<userId>'`.

##### Request Bodies

Request bodies must be JSON-serializable JavaScript objects. They are passed directly to the SugarCRM server.

##### Parameters

See [the parameter documentation][requests-parameters] for details of possible parameters.

It is *NOT* necessary to explicitly include OAuth tokens or other authentication details in your requests; this is handled transparently by Thorn. **Attempting to do so may interfere with Thorn's proper operation.**

#### API versioning

Agents make requests against the default API version (currently, `v10`) by default. To make requests against a different API version, use `Agent.on`:

```javascript
let johnV11 = john.on('v11');

// all requests made against API version 11
let response = yield johnV11.get('Dashboards');
...

let response = yield johnV11.get('KBContents');
...
```

Note that the original Agent remains valid and can continue to make requests against the default API version with no additional effort:

```javascript
let response = yield john.get('Notifications')
...
```

## Best Practices

* Every test file should be wrapped in a `describe` block to protect against cross-test contamination.

* In the `before` and `after` functions, as well as in `Promise` chains, every `Promise` created must be `returned` in
order for server requests to effectuate. Not returning `Promises` could lead to test failures and false positives.

## Debugging Tests

While developing or debugging a test, you can set the environment variable `THORN_VERBOSE` to enable
verbose output from Thorn.

Users of Thorn seeking to debug their tests should set `THORN_VERBOSE=1`.
`THORN_VERBOSE=2` is intended for those developing Thorn itself and is not intended for users.

Before commiting tests, **please ensure you run them with THORN_VERBOSE=1** so you can be sure you are making the
HTTP requests and getting the responses back that you expect.

[chakram]: http://dareid.github.io/chakram/
[chakram API]: https://dareid.github.io/chakram/jsdoc/module-chakram.html
[chakram response]: https://dareid.github.io/chakram/jsdoc/global.html#ChakramResponse
[expect]: https://dareid.github.io/chakram/jsdoc/module-chakram-expectation.html
[requests-parameters]: https://github.com/request/request#requestoptions-callback
[google-js-promises]: https://developers.google.com/web/fundamentals/getting-started/primers/promises
[mocha]: https://mochajs.org/
