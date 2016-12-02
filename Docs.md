# Thorn

Thorn is a BDD-style testing framework built on [chakram](http://dareid.github.io/chakram/), designed for performing testing on SugarCRM's REST API.

## Thorn::Fixtures

`Thorn::Fixtures` is an object that handles the setup and cleanup process for test sets. It provides methods for creating records, record-relationships, and deleting records in the database.

### Methods
**`Fixtures::create(models, options)` => `{Promise}`**  
Method to create and link records in the database.  

| Name      | Type       | Description |
| --------- |:-----------|:------------|
| `models`  | {Object[]} | Object array that specifies the records to be created. See [Model Strucutre](#model_structure) for details)|
| `options` | {Object}   | Optional, `options.module` specifies the `module` property of all `models`|    

**Returns:**  

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to an object of created records, indexed by module name|     
      
<br/>

**`Fixtures::link(left, linkName, right)` => `{Promise}`**  
Method to link records with a custom link name in the database.  

| Name       | Type       | Description |
| ---------- |:-----------|:------------|
| `left`     | {Object}   | A record from the resolution of `Fixtures.create` |
| `linkName` | {string}   | Name of the relationship |
| `right`    | {Object}   | A reord from the resolution of `Fixtures.create` |

**Returns:**  

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to the [Chakram-wrapped](http://dareid.github.io/chakram/jsdoc/global.html#ChakramResponse) response from server. |

<br/>

**`Fixtures::cleanup()` => `{Promise}`**  
Method to delete all records specified in `models`(in `Fixtures::create`) in the database.  

**Returns:**  

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to `Undefined` |


### Model Structure
Models is an object array that specifies the records and record-relationships the tester intends to create. 
**Properties of each model object:**  

|Name | Type | Description |
|-----|:-----|:------------|
| `module`| {string} | Optional, module name of the record |
| `attributes` | {Object} | Specific fields the record should have, unspecified required fields are auto-generated |
| `links` | {Object} | Records related to this model, indexed by `link_name` |

**Example without Links:**
```js
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

**Examples with Links:**
```js
let Accounts = [
    {
        module: 'Accounts',
        attributes: {
            name: 'LinkedAccount'
        }
    }
];

let Contacts = [
    {
        module: 'Contacts',
        attributes: {
            last_name: 'LinkedContact'
        },
        links: {
            contact_account: [
                Accounts[0]
            ]
        }
    }
];

return Fixtures.create(Accounts)
    .then((response) => {
        // must be created after Accounts since the link depends on Account's existence
        return Fixtures.create(Contacts);
    })
    .then((response) => {
        console.log(response); // Object containing one account and contact. Relationship is established in database.
        return response;
    });
```
### Best Practices
