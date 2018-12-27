/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

require('dotenv').config({silent: true});

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    cfenv = require('cfenv'),
    watson = require('watson-developer-cloud');

// Set up environment variables
// cfenv provides access to your Cloud Foundry environment
var vcapLocal = null;
try {
    vcapLocal = require("./vcap-local.json");
} catch (e) {}

var appEnvOpts = vcapLocal ? {
    vcap: vcapLocal
} : {};
var appEnv = cfenv.getAppEnv(appEnvOpts);

// Configure Express
// serve the files out of ./public as our main files
app.enable('trust proxy');

app.use(bodyParser.urlencoded({
    extended: true,
    limit: '1mb'
}));
app.use(bodyParser.json({
    limit: '1mb'
}));
app.use(express.static(__dirname + '/public'));

// Start listening for connections
app.listen(appEnv.port, function () {
    console.log("server started at", appEnv.url);
});

// Configure Watson Speech to Text service
// var speechCreds = getServiceCreds(appEnv, 'moods-stt');
// speechCreds.version = 'v1';
// var authService = watson.authorization(speechCreds);

// Configure Watson Speech to Text service
const SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
const AuthorizationV1 = require('watson-developer-cloud/authorization/v1');
const IamTokenManagerV1 = require('watson-developer-cloud/iam-token-manager/v1');

// Bootstrap application settings
//require('./config/express')(app);

// Create the token manager
let tokenManager;
let instanceType;
const serviceUrl = process.env.SPEECH_TOTEXT_URL || 'https://stream.watsonplatform.net/speech-to-text/api';

if (process.env.SPEECH_TOTEXT_IAM_APIKEY && process.env.SPEECH_TOTEXT_IAM_APIKEY !== '') {
  instanceType = 'iam';
  tokenManager = new IamTokenManagerV1.IamTokenManagerV1({
    iamApikey: process.env.SPEECH_TOTEXT_IAM_APIKEY || 'undefined var: SPEECH_TOTEXT_IAM_APIKEY',
    iamUrl: process.env.SPEECH_TOTEXT_IAM_URL || 'undefined var: SPEECH_TOTEXT_IAM_URL'
  });
} else {
  instanceType = 'cf';
  const speechService = new SpeechToTextV1({
    username: process.env.SPEECH_TOTEXT_USERNAME || '<username>',
    password: process.env.SPEECH_TOTEXT_PASSWORD || '<password>',
    url: serviceUrl,
  });
  tokenManager = new AuthorizationV1(speechService.getCredentials());
}

// console.log(instanceType + JSON.stringify(tokenManager));

var ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');
var toneAnalyzer = new ToneAnalyzerV3({
	iam_apikey: process.env.TONE_ANALYZER_IAM_APIKEY || 'undefined var: TONE_ANALYZER_IAM_APIKEY',  
	version: process.env.TONE_ANALYZER_VERSION || 'undefined var: TONE_ANALYZER_VERSION'
	});

// console.log('toneAnalyzer '+ JSON.stringify(toneAnalyzer));

// Root page handler
app.get('/', function (req, res) {
    res.render('index', {
        ct: req._csrfToken
    });
});

// Get token using your credentials
app.post('/api/token', function (req, res, next) {
	tokenManager.getToken((err, token) => {
	    if (err) {
	      next(err);
	    } else {
	      let credentials;
	      if (instanceType === 'iam') {
	        credentials = {
	          accessToken: token,
	          serviceUrl,
	        };
	      } else {
	        credentials = {
	          token,
	          serviceUrl,
	        };
	      }
	      console.log('POST api/token' + JSON.stringify(credentials));
	      res.json(credentials);
	    }
	  });
});

// Request handler for tone analysis
app.post('/api/tone', function (req, res, next) {
	toneAnalyzer.tone(req.body, function (err, data) {
        if (err)
            return next(err);
        else {
//            console.log(JSON.stringify(data));
        	return res.json(data);
        }
    });
});

// error-handler settings
require('./config/error-handler')(app);

// Retrieves service credentials for the input service
function getServiceCreds(appEnv, serviceName) {
    var serviceCreds = appEnv.getServiceCreds(serviceName);
    if (!serviceCreds) {
        console.log("service " + serviceName + " not bound to this application");
        return null;
    }
    return serviceCreds;
}
