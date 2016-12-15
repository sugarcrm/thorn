var _ = require('lodash');
var gulp = require('gulp');

var sourceFiles = ['index.js', 'metadata-handler.js'];

gulp.task('build', () => {
    var babel = require('gulp-babel');
    gulp.src(sourceFiles)
        .pipe(babel())
        .pipe(gulp.dest('dist'));
});

gulp.task('test', ['build'], () => {
    var commander = require('commander');
    var os = require('os');
    var mocha = require('gulp-spawn-mocha');

    commander
        .option('--ci', 'Enable CI specific options')
        .option('--path <path>', 'Set base output path')
        .parse(process.argv);

    var path = commander.path || process.env.WORKSPACE || os.tmpdir();

    var options = {};
    if (commander.ci) {
        var testResultPath = path + '/test-results.xml';
        options.reporter = 'mocha-junit-reporter';
        options.reporterOptions = 'mochaFile=' + testResultPath;
        process.stdout.write('Test reports will be generated to: ' + testResultPath + '\n');
    }

    options.timeout = '5000';

    return gulp.src(['tests/**/*.js'], {read: false})
        .pipe(mocha(options));
});

gulp.task('doc', (cb) => {
    var commander = require('commander');
    var jsdoc = require('gulp-jsdoc3');
    var jsdocConfig = require('./jsdoc.json');

    commander
        .option('-p, --private', 'Include private API documentation')
        .parse(process.argv);

    if (commander.private) {
        jsdocConfig.opts.private = true;
    }

    gulp.src(_.union(['Docs.md'], sourceFiles), { read: false })
        .pipe(jsdoc(jsdocConfig, cb));
});

gulp.task('lint', () => {
    var eslint = require('gulp-eslint');
    return gulp.src(_.union(sourceFiles, ['tests/**/*.js', 'gulpfile.babel.js']))
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('watch', () => {
    var watch = require('gulp-watch');
    watch(sourceFiles, () => {
        gulp.start('default');
    });
});

gulp.task('default', ['build']);
