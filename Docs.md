# Thorn

Thorn is composed by a set of helper abstractions built to ease the process of
setting up a SugarCRM's REST API testing environment and interacting with it.

## Thorn::Fixtures

`Thorn::Fixtures` is an object that handles the setup and cleanup process for test sets. It provides methods for creating records, record-relationships, and deleting records in the database.

### Methods

#### **`Fixtures::create(models, options)` => `{Promise}`**  
Method to create records in the database.  

| Name      | Type       | Description |
| --------- |:-----------|:------------|
| `models`  | {Object&#124;Object[]} | Object or object array that specifies the records to be created. See [Model Structure](#model-structure) for details. |
| `options` | {Object}   | Optional, `options.module` specifies the `module` property of all `models` if it is not specified in the models' object. |    

**Returns:**  

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to an object of created records, indexed by module name. |     
      
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

return Fixtures.create(AccountsContacts)
    .then((response) => {
        console.log(response); // Object containing one account, and one contact
        return Fixtures.create(DashboardsOnly, {module: 'Dashboard'});
    })
    .then((response) => {
        console.log(response); // Object containing one account, one contact, and one dashboard
    });
```

<br/>

#### **`Fixtures::link(left, linkName, right)` => `{Promise}`**  
Method to link records in the database.  

| Name       | Type       | Description |
| ---------- |:-----------|:------------|
| `left`     | {Object}   | A record from the resolution of `Fixtures.create`.  |
| `linkName` | {string}   | Relationship's link name.  |
| `right`    | {Object}   | A record from the resolution of `Fixtures.create`. |

**Returns:**  

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to the [Chakram-wrapped](http://dareid.github.io/chakram/jsdoc/global.html#ChakramResponse) response from server. |

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

return Fixtures.create([Account, Contact])
    .then((cachedRecords) => {
        console.log(cachedRecords); // Object containing one Account and one Contact
        return Fixtures.link(cachedRecords.Contacts[0], 'contact_account', cachedRecords.Accounts[0]);
    })
    .then((response) => {
        // Server response containing the Contacts record with a `related_records` property,
        // which contains the Accounts record.
        console.log(response);
        return response;
    });
```

<br/>

#### **`Fixtures::cleanup()` => `{Promise}`**  
Method to delete all records previously created through `Fixtures::create`. 

**Returns:**  

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to `Undefined`. |

<br/>

#### **`Fixtures::lookup(module, properties)` => `{Object}`**
Method that looks through the created records and retrieves the first record
matching module and the key-value pairs in properties.

| Name         | Type     | Description |
| ------------ |:---------|:------------|
| `module`     | {string} | Module name of the record. |
| `properties` | {Object} | Object containing key-value pairs the record should contain. |    

**Returns:**  

| Type     | Description |
| -------- |:------------|
| {Object} | A singular record object |  

<br/>

### Model Structure
Models is an object array that specifies the records the tester intends to create. 
**Properties of each model object:**  

|Name          | Type     | Description |
|--------------|:---------|:------------|
| `module`     | {string} | Optional, module name of the record. |
| `attributes` | {Object} | Specific fields the record should have, unspecified required fields are auto-generated. |


<br/>

### Best Practices & Tips

* In the `before` and `after` functions, as well as in `Promise` chains, every `Promise` created must be `returned` in
order for server requests to effectuate. Not returning `Promises` could lead to test failures and false positives.

* `Fixtures` is designed to be a tool that facilitates the setup and cleanup of test cases. Its methods are *not* meant
to be provide means of testing the correctness of SugarCRM's record creation, linking, and deletion APIs. Such tests
should make use of the request methods of `UserAgent`.

* The same model object cannot be used to create multiple records; this will lead to collisions in `Fixtures` internal
ways of storing records. To reuse the same model to create multiple records, all but the first model must be cloned (
i.e. using `_.clone`).

* Linking records require that the records have already been created in the database. To avoid exceptions, structure the
record creations such that dependencies are met before `Fixtures` tries to make links. Alternatively, pass all models to
`Fixtures::create` in one aggregated array, and `Fixtures::create` would automatically handle the dependencies.
