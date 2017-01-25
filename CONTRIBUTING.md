# Contributing to thorn

Think twice, code once.

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

[gulp-cli]: https://github.com/gulpjs/gulp-cli
[Node.js]: https://nodejs.org/
[yarn]: https://github.com/yarnpkg/yarn
