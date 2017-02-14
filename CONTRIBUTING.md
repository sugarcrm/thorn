# Contributing to Thorn

Think twice, code once.

Pull requests are accepted under the discretion of Thorn maintainer(s). Improve the chances of your pull requests getting merged by following the requirements and guidelines below. For any questions, please e-mail developers@sugarcrm.com.

## Requirements
- By creating a pull request, you are agreeing to [SugarCRM Open Source Contributor terms](CONTRIBUTOR_TERMS.pdf).

## Guidelines
- Make sure your pull request contains quality code. We will certainly provide constructive feedback on works in progress but we will not merge incomplete pull requests.
- Make sure your pull requests is properly tested and maintains current code coverage.
- Make sure your pull request is fully documented.
- Reference related Github issues within commit messages and pull request comments where appropriate.

## Bugs
- File bugs or feature requests using our []Github Issue Tracker](https://github.com/sugarcrm/thorn/issues).

## Setup

You'll need [Node.js], [yarn], and [gulp-cli] installed.

```bash
$ git clone https://github.com/sugarcrm/thorn
$ yarn
```

You should also add `dist` to your .git/info/exclude file.
It is not included in `.gitignore` because [this interferes with properly publishing Thorn as an npm module](https://docs.npmjs.com/misc/developers#keeping-files-out-of-your-package).

```bash
$ echo "dist" >> .git/info/exclude
```

## Compiling

```bash
$ gulp
```

## Linting

```bash
$ gulp lint
```

## Building the Documentation

```bash
$ gulp doc
```

## Testing

```bash
$ gulp test [--coverage]
```

[gulp-cli]: https://github.com/gulpjs/gulp-cli
[Node.js]: https://nodejs.org/
[yarn]: https://github.com/yarnpkg/yarn
