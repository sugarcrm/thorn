var _ = require('lodash');
var gulp = require('gulp');

var sourceFiles = ['index.js', 'metadatafetcher.js'];

gulp.task('build', () => {
    var babel = require('gulp-babel');
    gulp.src(sourceFiles)
        .pipe(babel())
        .pipe(gulp.dest('dist'));
});

gulp.task('test', () => {
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
    var jsdoc = require('gulp-jsdoc3');
    var jsdocConfig = require('./jsdoc.json');

    gulp.src(_.union(['README.md'], sourceFiles), { read: false })
        .pipe(jsdoc(jsdocConfig, cb));
});

gulp.task('watch', () => {
    var watch = require('gulp-watch');
    watch(sourceFiles, () => {
        gulp.start('default');
    });
});

gulp.task('default', ['build']);
