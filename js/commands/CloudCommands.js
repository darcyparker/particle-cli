/**

 */
var when = require('when');
var sequence = require('when/sequence');
var pipeline = require('when/pipeline');

var readline = require('readline');
var SerialPortLib = require("serialport");
var SerialPort = SerialPortLib.SerialPort;
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var prompts = require('../lib/prompts.js');
var ApiClient = require('../lib/ApiClient.js');
var fs = require('fs');
var path = require('path');

var CloudCommand = function (cli, options) {
    CloudCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(CloudCommand, BaseCommand);
CloudCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "cloud",
    description: "simple interface for common cloud functions",


    init: function () {
        this.addOption("claim", this.claimCore.bind(this), "Register a core with your user account with the cloud");
        this.addOption("remove", this.removeCore.bind(this), "Release a core from your account so that another user may claim it");
        this.addOption("name", this.nameCore.bind(this), "Give a core a name!");
        this.addOption("flash", this.flashCore.bind(this), "Pass a binary, source file, or source directory to a core!");
        this.addOption("login", this.login.bind(this), "Lets you login to the cloud and stores an access token locally");
        this.addOption("logout", this.logout.bind(this), "Logs out your session and clears your saved access token");
    },

    claimCore: function (coreid) {
        if (!coreid) {
            console.error("Please specify a coreid");
            return;
        }

        //TODO: replace with better interactive init
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;
        api.claimCore(coreid);
    },

    removeCore: function (coreid) {
        if (!coreid) {
            console.error("Please specify a coreid");
            return;
        }

        when(prompts.areYouSure())
            .then(function (yup) {
                //TODO: replace with better interactive init
                var api = new ApiClient(settings.apiUrl);
                api._access_token = settings.access_token;

                api.removeCore(coreid).then(function () {
                        console.log("Okay!");
                        process.exit(0);
                    },
                    function (err) {
                        console.log("Didn't remove the core " + err);
                        process.exit(1);
                    });
            },
            function (err) {
                console.log("Didn't remove the core " + err);
                process.exit(1);
            });
    },

    nameCore: function (coreid, name) {
        if (!coreid) {
            console.error("Please specify a coreid");
            return;
        }

        if (!name) {
            console.error("Please specify a name");
            return;
        }

        //TODO: replace with better interactive init
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;

        api.renameCore(coreid, name);
    },

    flashCore: function (coreid, filePath) {
        if (!coreid) {
            console.error("Please specify a coreid");
            return;
        }

        if (!filePath) {
            console.error("Please specify a binary file, source file, or source directory");
            return;
        }

        if (!fs.existsSync(filePath)) {
            console.error("I couldn't find that: " + filePath);
            return;
        }
        var files = {};
        var stats = fs.statSync(filePath);
        if (stats.isFile()) {
            files['file'] = filePath;
        }
        else if (stats.isDirectory()) {
            var dirFiles = fs.readdirSync(filePath);
            for(var i=0;i<dirFiles.length;i++) {
                var filename = path.join(filePath, dirFiles[i]);
                var filestats = fs.statSync(filename);
                if (filestats.size > settings.MAX_FILE_SIZE) {
                    console.log("Skipping " + filename + " it's too big! " + stats.size);
                    continue;
                }

                if (i == 0) {
                    files['file'] = filename;
                }
                else {
                    files['file' + i] = filename;
                }
            }
        }
        else {
            console.log("was that a file or directory?");
            return;
        }


        //TODO: replace with better interactive init
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;
        api.flashCore(coreid, files);
    },

    login: function() {
        var allDone = pipeline([

            //prompt for creds
            prompts.getCredentials,

            //login to the server
            function(creds) {
                var api = new ApiClient(settings.apiUrl);
                return api.login("spark-cli", creds[0], creds[1]);
            }
        ]);

        when(allDone).then(function (access_token) {
                console.log("logged in! ", arguments);
                //console.log("Successfully logged in as " + username);
                settings.override("access_token", access_token);

                setTimeout(function() {
                    process.exit(-1);
                }, 2500);
            },
            function (err) {
                console.error("Error logging in " + err);
                process.exit(-1);
            });


    },
    logout: function() {
        settings.override("access_token", null);
        console.log("You're now logged out!");
    },


    _: null
});

module.exports = CloudCommand;
