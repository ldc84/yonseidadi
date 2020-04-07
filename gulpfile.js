(() => {
  'use strict';

  /**************** Gulp.js 4 configuration ****************/
  const
    // development or production
    devBuild  = ((process.env.NODE_ENV || 'development').trim().toLowerCase() === 'development'),
    // directory locations
    dir = {
      src         : 'src/',
      build       : 'build/'
    },
    // modules
    gulp          = require('gulp'),
    del           = require('del'),
    extender      = require('gulp-html-extend'),
    noop          = require('gulp-noop'),
    newer         = require('gulp-newer'),
    size          = require('gulp-size'),
    base64        = require('gulp-base64'),
    imagemin      = require('gulp-imagemin'),
    sass          = require('gulp-sass'),
    postcss       = require('gulp-postcss'),
    cachebust     = require('gulp-cache-bust'),
    preprocess    = require('gulp-preprocess'),
    concat        = require('gulp-concat'),
    uglify        = require('gulp-uglify'),
    zip           = require('gulp-zip'),
    publish       = require('gulp-gh-pages-will'),
    sourcemaps    = devBuild ? require('gulp-sourcemaps') : null,
    browsersync   = devBuild ? require('browser-sync').create() : null;

  console.log(process.env.NODE_ENV);
  console.log('Gulp', devBuild ? 'development' : 'production', 'build');

  /**************** clean task ****************/
  function clean() {
    return del([ dir.build ]);
  }
  exports.clean = clean;

  /**************** conf task ****************/
  function conf() {
    return gulp.src(dir.src + 'conf/**')
      .pipe(gulp.dest(dir.build))
  }

  /**************** images task ****************/
  const imgConfig = {
    src           : dir.src + 'images/**/*',
    build         : dir.build + 'images/',
    minOpts: {
      interlaced: true,
      progressive: true,
      optimizationLevel: 5
    }
  };

  function images() {
    return gulp.src(imgConfig.src)
      .pipe(newer(imgConfig.build))
      .pipe(imagemin(imgConfig.minOpts))
      .pipe(size({ showFiles:true }))
      .pipe(gulp.dest(imgConfig.build));
  }

  /**************** Fonts task ****************/
  function font() {
    return gulp.src(dir.src + 'fonts/**')
      .pipe(gulp.dest(dir.build + '/fonts'))
  }

  /**************** CSS task ****************/
  const cssConfig = {
    src         : dir.src + 'scss/style.scss',
    watch       : dir.src + 'scss/**/*',
    build       : dir.build + 'css/',
    sassOpts: {
      sourceMap       : devBuild,
      outputStyle     : 'nested',
      imagePath       : '/images/',
      precision       : 3,
      errLogToConsole : true
    },
    postCSS: [
      require('postcss-assets')({
        loadPaths: ['images/'],
        basePath: dir.build
      }),
      require('autoprefixer')({
        browsers: ['> 2%']
      })
    ]
  };

  // remove unused selectors and minify production CSS
  if (!devBuild) {
    cssConfig.postCSS.push(
      // require('usedcss')({ html: ['index.html'] }),
      require('cssnano')
    );
  }

  function css() {
    return gulp.src(cssConfig.src)
      .pipe(sourcemaps ? sourcemaps.init() : noop())
      .pipe(sass(cssConfig.sassOpts).on('error', sass.logError))
      .pipe(postcss(cssConfig.postCSS))
      .pipe(base64({
        maxImageSize: 120 * 1024 // bytes,
      }))
      .pipe(sourcemaps ? sourcemaps.write('./') : noop())
      .pipe(size({ showFiles:true }))
      .pipe(gulp.dest(cssConfig.build))
      .pipe(browsersync ? browsersync.reload({ stream: true }) : noop());
  }
  exports.css = gulp.series(images, css);

  /**************** JS task ****************/
  function js() {
    return gulp.src(dir.src + 'js/*')
      .pipe(concat('ui_js.js'))
      .pipe(uglify())
      .pipe(gulp.dest(dir.build + '/js'))
      .pipe(browsersync ? browsersync.reload({ stream: true }) : noop());
  }

  /**************** HTML task ****************/
  const htmlConfig = {
    template : dir.src + 'template/*.html',
    html : dir.src + 'html/*.html'
  }

  function html() {
    return gulp.src(htmlConfig.html)
      .pipe(extender({
        annotations: true,
        verbose: false,
        root: dir.src
      })) // default options
      .pipe(preprocess({context: { ENV: devBuild, DEBUG: true}})) //To set environment variables in-line
      // .pipe(removeHtmlComment())
      .pipe(cachebust({type: 'timestamp'})) // 캐시 삭제
      .pipe(gulp.dest(dir.build))
      .pipe(browsersync ? browsersync.reload({ stream: true }) : noop());
  }

  /**************** server task (now private) ****************/
  const syncConfig = {
    server: {
      baseDir   : './build',
      index     : 'index.html'
    },
    port        : 9090,
    open        : false
  };

  // browser-sync
  function server(done) {
    if (browsersync) browsersync.init(syncConfig);
    done();
  }

  /**************** watch task ****************/
  function watch(done) {
    // image changes
    gulp.watch(imgConfig.src, images);
    // CSS changes
    gulp.watch(cssConfig.watch, css);
    // HTML changes
    gulp.watch([htmlConfig.template, htmlConfig.html], html);
    // JS changes
    gulp.watch(dir.src + 'js/*', js);
    done();
  }

  /**************** zip task ****************/
  function buildZip() {
    return gulp.src('./build/**')
      .pipe(zip('publish.zip'))
      .pipe(gulp.dest('./'))
  }

  /**************** deploy task ****************/
  function deploy() {
    return gulp.src('./build/**')
      .pipe(publish({
        message: '깃허브 페이지에 반영됨. Published to Github pages'
      }))
  }

  /**************** exports task ****************/
  exports.default = gulp.series(clean, font, conf, exports.css, html, js, watch, server);
  exports.zip = gulp.series(clean, font, conf, exports.css, html, js, buildZip);
  exports.deploy = gulp.series(clean, font, conf, exports.css, html, js, deploy);
})();
