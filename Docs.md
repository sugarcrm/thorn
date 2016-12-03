# Thorn

Thorn is a BDD-style testing framework built on [chakram](http://dareid.github.io/chakram/), designed for performing testing on SugarCRM's REST API.

## Thorn::Fixtures

`Thorn::Fixtures` is an object that handles the setup and cleanup process for test sets. It provides methods for creating records, record-relationships, and deleting records in the database.

### Methods

#### **`Fixtures::create(models, options)` => `{Promise}`**  
Method to create and link records in the database.  

| Name      | Type       | Description |
| --------- |:-----------|:------------|
| `models`  | {Object&#124;Object[]} | Object or object array that specifies the records to be created. See [Model Strucutre](#model-structure) for details)|
| `options` | {Object}   | Optional, `options.module` specifies the `module` property of all `models`|    

**Returns:**  

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to an object of created records, indexed by module name|     
      
<br/>

#### **`Fixtures::link(left, linkName, right)` => `{Promise}`**  
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

#### **`Fixtures::cleanup()` => `{Promise}`**  
Method to delete all records specified in `models`(in `Fixtures::create`) in the database.  

**Returns:**  

| Type      | Description |
| --------- |:------------|
| {Promise} | A `Promise` which resolves to `Undefined` |

<br/>

### Model Structure
Models is an object array that specifies the records and record-relationships the tester intends to create. 
**Properties of each model object:**  

|Name          | Type     | Description |
|--------------|:---------|:------------|
| `module`     | {string} | Optional, module name of the record |
| `attributes` | {Object} | Specific fields the record should have, unspecified required fields are auto-generated |
| `links`      | {Object} | Records related to this model, indexed by `link_name` |

**Example without Links:**
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

**Examples with Links:**
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
    },
    links: {
        contact_account: [
            Accounts
        ]
    }
};

// option 1
return Fixtures.create(Account)
    .then((response) => {
        // must be created after Accounts since the link depends on Account's existence
        return Fixtures.create(Contact);
    })
    .then((response) => {
        // Object containing one account and one contact. Relationship is established in database.
        console.log(response);
        return response;
    });


// OR

// option 2
return Fixtures.create([Account, Contact])
    .then((response) => {
        // Object containing one account and one contact. Relationship is established in database.
        console.log(reponse);
        return response;
    });


// OR

// option 3
let NoLinkContact = {
    module: 'Contact',
    attributes: {
        last_name: 'LinkedContact'
    }
};

return Fixtures.create([Account, NoLinkContact])
    .then((cachedRecords) {
        return Fixtures.link(cachedRecords.Contacts[0], 'contact_account', cachedRecords.Accounts[0]);
    })
    .then((response) {
        // Server response containing the Contacts record with a `related_records` property,
        // which contains the Accounts record.
        console.log(response);
        return response;
    });
```

<br/>

### Best Practices & Tips

* In the `before` and `after` functions, as well as in `Promise` chains, every `Promise` created must be `returned` in
order for server requests to effectuate. Not returning `Promises` could lead to test failures and false positives.

* `Fixtures` designed to be a tool that facilitates the setup and cleanup of test cases. Its methods are *not* meant to
be provide means of testing the correctness of SugarCRM's record creation, linking, and deletion APIs. Such tests should
make use of the request methods of `UserAgent`.

* The same model object cannot be used to create multiple records; this will lead to collisions in `Fixtures` internal
ways of storing records. To reuse the same model to create multiple records, all but the first model must be cloned (
i.e. using `_.clone`).

* Linking records require that the records have already been created in the database. To avoid exceptions, structure the
record creations such that dependencies are met before `Fixtures` tries to make links. Alternatively, pass all models to
`Fixtures::create` in one aggregated array, and `Fixtures::create` would automatically handle the dependencies.



