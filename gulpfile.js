const _ = require('lodash');
const gulp = require('gulp');

const sourceFiles = ['debug.js', 'index.js', 'metadata-handler.js', 'utils.js', 'metadata-fetcher.js'];

gulp.task('build', () => {
    const babel = require('gulp-babel');
    return gulp.src(sourceFiles)
        .pipe(babel())
        .pipe(gulp.dest('dist'));
});

gulp.task('test', ['build'], () => {
    const commander = require('commander');
    const os = require('os');
    const mocha = require('gulp-spawn-mocha');

    commander
        .option('--coverage', 'Enable code coverage')
        .option('--path <path>', 'Set base output path')
        .parse(process.argv);

    let path = commander.path || process.env.WORKSPACE || os.tmpdir();

    let options = {
        timeout: '5000',
    };

    if (commander.coverage) {
        options.istanbul = {
            dir: `${path}/coverage`,
        };
    }

    return gulp.src(['tests/**/*.js'], {read: false})
        .pipe(mocha(options));
});

gulp.task('doc', (cb) => {
    const commander = require('commander');
    const jsdoc = require('gulp-jsdoc3');
    const jsdocConfig = require('./jsdoc.json');

    commander
        .option('-p, --private', 'Include private API documentation')
        .parse(process.argv);

    if (commander.private) {
        jsdocConfig.opts.private = true;
    }

    gulp.src(_.union(['Docs.md'], sourceFiles), {read: false})
        .pipe(jsdoc(jsdocConfig, cb));
});

gulp.task('lint', () => {
    const eslint = require('gulp-eslint');
    return gulp.src(_.union(sourceFiles, ['tests/**/*.js', 'gulpfile.js']))
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('watch', () => {
    const watch = require('gulp-watch');
    watch(sourceFiles, () => {
        gulp.start('default');
    });
});

gulp.task('default', ['lint', 'build']);
