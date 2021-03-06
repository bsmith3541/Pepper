var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var gmail = google.gmail('v1');
var base64 = require('js-base64').Base64;
var cheerio = require('cheerio');
var SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
  process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'gmail-api-quickstart-2.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Gmail API.
  authorize(JSON.parse(content), listVirginAmericaMessages);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listVirginAmericaMessages(auth) {
  gmail.users.messages.list({
    auth: auth,
    userId: 'me',
    q: 'from:no-reply@virginamerica.com'
    // q: 'SouthwestAirlines@luv.southwest.com'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var messages = response.messages;
    if (messages.length === 0) {
      console.log('No messages found.');
    } else {
      console.log('Messages: ' + messages.length);
      for (var i = 0; i < messages.length; i++) {
        getMessage(auth, 'me', messages[i].id);
      }
    }
  });
}

function getMessage(auth, userId, messageId) {
  gmail.users.messages.get({
    'auth': auth,
    'userId': userId,
    'format': 'full',
    'id': messageId,
  }, function(err, result) {
    var messageBody;
    var mimeType = result.payload.mimeType;
    if (mimeType === 'text/html') {
      messageBody = result.payload.body.data;
    } else if (mimeType.indexOf('multipart') > -1) {
      messageBody = result.payload.parts[0].body.data;
    } else {
      console.log("Unrecgonized format - " + mimeType);
    }
    var decodedText = base64.decode(messageBody.replace(/-/g, '+').replace(/_/g, '/'));
    logRelevantDetails(decodedText);
  });
}

function logRelevantDetails(message) {
  $ = cheerio.load(message);
  $("font[id*=-departure-date]").each(function(i, element){
      console.log("Departure Date: " + $(this).text().trim());
    });
}
