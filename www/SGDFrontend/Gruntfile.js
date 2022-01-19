var crypto = require("crypto");
var fs = require("fs");

// cache assets on browser for 1 month
var CACHE_TTL = 2629740;
var CLOUDFRONT_ROOT = "https://d1x6jdqbvd5dr.cloudfront.net/";

module.exports = function (grunt) {
    var BUILD_PATH = "src/sgd/frontend/yeastgenome/static/";

    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),

        s3: {
            options: {
                accessKeyId: "<%= awsKey %>",
                secretAccessKey: "<%= awsSecret %>",
                bucket: "sgd-prod-assets",
                headers: {
                    "CacheControl": CACHE_TTL
                },
                region: "us-west-2"
            },
            build: {
                cwd: "src/sgd/frontend/yeastgenome/static/",
                dest: "<%= awsDestDir %>/",
                src: ["**", "!**/*.jinja2"]
            }
        },

        replace: {
            datatables_images: {
                src: ["bower_components/datatables-plugins/integration/foundation/dataTables.foundation.css"],
                overwrite: true,
                replacements: [{
                    from: "images/",
                    to: "../img/"
                }]
            }
        },

        concat: {
            options: {
                separator: ''
            },
            dist: {
                src: [
                    'bower_components/foundation/js/foundation/foundation.js',
                    'bower_components/foundation/js/foundation/foundation.abide.js',
                    'bower_components/foundation/js/foundation/foundation.accordion.js',
                    'bower_components/foundation/js/foundation/foundation.alert.js',
                    'bower_components/foundation/js/foundation/foundation.clearing.js',
                    'bower_components/foundation/js/foundation/foundation.dropdown.js',
                    'bower_components/foundation/js/foundation/foundation.equalizer.js',
                    'bower_components/foundation/js/foundation/foundation.interchange.js',
                    'bower_components/foundation/js/foundation/foundation.joyride.js',
                    'src/sgd/frontend/yeastgenome/static/js/vendor/foundation/foundation.magellan.js',
                    'bower_components/foundation/js/foundation/foundation.offcanvas.js',
                    'bower_components/foundation/js/foundation/foundation.orbit.js',
                    'bower_components/foundation/js/foundation/foundation.reveal.js',
                    'bower_components/foundation/js/foundation/foundation.slider.js',
                    'bower_components/foundation/js/foundation/foundation.tab.js',
                    'bower_components/foundation/js/foundation/foundation.tooltip.js',
                    'bower_components/foundation/js/foundation/foundation.topbar.js'
                ],
                dest: 'bower_components/foundation/js/foundation.js'
            },
        },

        uglify: {
            dynamicJs: {
                files: {
                    "src/sgd/frontend/yeastgenome/static/js/application.js": ["src/sgd/frontend/yeastgenome/static/js/application.js"],
                }
            }
        },

        bowercopy: {
            refresh: {
                js: {
                    options: {
                        destPrefix: "src/sgd/frontend/yeastgenome/static/js/build"
                    },
                    files: {
                        "cytoscape.min.js": "cytoscape/dist/cytoscape.min.js",
                        "arbor.js": "cytoscape/lib/arbor.js",
                        "jquery.min.js": "jquery/dist/jquery.min.js",
                        "kinetic.min.js": "kineticjs/kinetic.min.js",
                        "respond.min.js": "respond/dest/respond.min.js",
                        "rem.min.js": "rem-unit-polyfill/js/rem.min.js",
                        "nouislider.min.js": "nouislider/jquery.nouislider.min.js"
                    }
                },
                scss: {
                    options: {
                        destPrefix: "client/scss"
                    },
                    files: {
                        "build/_nouislider.scss": "nouislider/jquery.nouislider.css",
                        "build/_dataTables.foundation.scss": "datatables-plugins/integration/foundation/dataTables.foundation.css"
                    }
                },
            },
            build: {
                files: {
                    "src/sgd/frontend/yeastgenome/static/fonts": "font-awesome/fonts",
                    "src/sgd/frontend/yeastgenome/static/img": "datatables-plugins/integration/foundation/images"
                }
            }
        },

        compass: {
            dev: {
                options: {
                    cssDir: BUILD_PATH + "css",
                    fontsPath: "src/sgd/frontend/yeastgenome/static/fonts",
                    httpPath: "/",
                    imagesPath: "src/sgd/frontend/yeastgenome/static/img",
                    importPath: ["bower_components/foundation/scss", "bower_components/font-awesome/scss"],
                    outputStyle: "compressed",
                    sassDir: "client/scss"
                }
            }
        },

        browserify: {
            dev: {
                dest: BUILD_PATH + "js/application.js",
                src: "client/jsx/application.jsx",
                options: {
                    browserifyOptions: {
                        debug: true
                    },
                    transform: [
                        "babelify",
                        ["envify", { global: true, NODE_ENV: "development" }]
                    ]
                }
            },
            production: {
                dest: BUILD_PATH + "js/application.js",
                src: "client/jsx/application.jsx",
                options: {
                    browserifyOptions: {
                        debug: false
                    },
                    transform: [
                        "babelify",
                        ["uglifyify", { global: true }],
                        ["envify", { global: true, NODE_ENV: "production" }]
                    ]
                }
            }
        },

        watch: {
            options: {
                livereload: true
            },
            jsx: {
                files: ["client/**/*.jsx", "client/**/*.js"],
                tasks: ["browserify:dev"]
            },
            scss: {
                files: ["client/**/*.scss"],
                tasks: ["compass:dev"]
            },
        },

        // define some parallel tasks to speed up compilation
        concurrent: {
            dev: {
                tasks: ["browserify:dev", "compass:dev"]
            },
            production: {
                tasks: ["dynamicJs:production", "compass:dev"]
            },
            options: {
                logConcurrentOutput: true
            }
        }
    });

    // change write new asset URL to production_asset_url.json, and upload to s3.  Cloudfront will get new copy automatically.
    grunt.registerTask("uploadToS3", "Change the production_asset_url.json file to have a new random string", function () {
        var done = this.async();

        var _random = crypto.randomBytes(10).toString("hex");
        var _url = CLOUDFRONT_ROOT + _random;
        var obj = { url: _url };
        fs.writeFile("production_asset_url.json", JSON.stringify(obj), function (err) {
            grunt.config("awsKey", process.env.AWS_ACCESS_KEY_ID)
            grunt.config("awsSecret", process.env.AWS_SECRET_ACCESS_KEY)
            grunt.config("awsDestDir", _random);
            grunt.task.run("s3:build");
            return done(err);
        });
    });

    grunt.loadNpmTasks("grunt-aws");
    grunt.loadNpmTasks("grunt-text-replace");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-compass");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-bowercopy");
    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-concurrent");


    // production helper tasks
    grunt.registerTask("dynamicJs:production", ["browserify:production"]);
    grunt.registerTask("static", ["replace", "concat", "bowercopy:build"]);

    // dev helper task
    grunt.registerTask("compileDev", ["static", "concurrent:dev"]);

    // compile dev, then watch and trigger live reload
    grunt.registerTask("dev", ["compileDev", "watch"]);

    grunt.registerTask("default", ["static", "concurrent:production"]);
    grunt.registerTask("deployAssets", ["static", "concurrent:production", "uglify", "uploadToS3"]);
    grunt.registerTask("deployAssetsTest", ["static", "concurrent:dev", "uploadToS3"]);

};
