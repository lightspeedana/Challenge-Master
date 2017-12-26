const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});
var validator = require('validator');
admin.initializeApp(functions.config().firebase);

//Cloud Functions
exports.initUser = functions.auth.user().onCreate(event => {
	//Adds the Player To Users Database and Scores Database
	const user = event.data;
	const uid = user.uid;
	const score = 0;
  console.log(user.displayName);
	const name = validator.escape(String(user.displayName));
	admin.database().ref('users/' + uid).set({
    name : name,
    score : score
  });
  admin.database().ref('scores').child(uid).set(score);
  return true;
});

exports.uploadChallenge = functions.https.onRequest((req, res) => {
	//Uploads a Challenge form an Authed User
	cors(req, res, () => {
		validateFirebaseIdToken(req, res, createChallenge);
  });
});

exports.checkSolution = functions.https.onRequest((req, res) => {
  //Checks if a solution is correct and awards points
  cors(req, res, () => {
    validateFirebaseIdToken(req, res, checkSolution);
  });
});

//Functions
function createChallenge(req, res) {
  var title = validator.escape(req.body.challengeTitle + '');
  var description = validator.escape(req.body.challengeDescription + '');
  var content = validator.escape(req.body.challengeContent + '');
  var uid = req.user.uid;
  var solution = validator.escape(req.body.challengeSolution + '');

  //Removes Bad Request
  if (title == "" || description == "" || content == "" || solution == "") {
    res.status(400).send("Fill in the entire form");
    return true;
  }

  //Creates Challenge
  var challengeData = {
    challengeTitle:title,
    challengeDescription:description,
    challengeContent:content,
    challengeCreator:uid,
    challengeSolved:0
  };
  
  var database = admin.database().ref('challenges');
  var challengeID = database.push().key;
  database.child(challengeID).set(challengeData);
  database = admin.database().ref('solutions');
  database.child(challengeID).set(solution);
  console.log("Uploaded Challenge : " + challengeID);
  res.status(200).send(challengeID);
  return true;
}

function checkSolution(req, res) {
  //Gets Attempt and Token ID
  var attempt = req.headers.attempt;
  var challengeID = req.headers.challenge;

  //Gets Solution
  var database = admin.database().ref('solutions/').child(challengeID).once("value").then((snapshot) => {
    var solution = snapshot.val();
    if(String(solution).equals(String(attempt))) {
      //User Is Correct
      res.status(200).send("Correct You Will Recieve Your Points Shortly")
      //Award Score if has not solved this challenge before

    }else {
      res.status(200).send("Incorrect - Please do not guess");
    }
  });
  //Awards Score
  //Display That Challenge Has Been Solved
}

function awardScore(uid, amount) {
  //Get Currnt Score
  var database = admin.database().ref('scores/').child(uid).once("value").then((snapshot) => {
    var solution = snapshot.val();
  });
  //Add amount to score
  //Write Score
}

const validateFirebaseIdToken = (req, res, next) => {
  //Validate Users is Logged in a who they are
  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) && !req.cookies.__session) {
    console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.  Make sure you authorize your request by providing the following HTTP header:  Authorization: Bearer <Firebase ID Token> or by passing a "__session" cookie.');
    res.status(403).send('Unauthorized');
    return;
  }
  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      // Read the ID Token from the Authorization header.
      idToken = req.headers.authorization.split('Bearer ')[1];
  } else {
      // Read the ID Token from cookie.
      idToken = req.cookies.__session;
  }
  admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
    console.log('ID Token correctly decoded', decodedIdToken);
    req.user = decodedIdToken;
    next(req, res);      
  }).catch(error => {
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized');
  });
};