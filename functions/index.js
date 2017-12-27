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
  admin.database().ref('users/' + uid).child('score').set(score);
	
  var name = "";
  if(user.displayName === undefined) {
    name = uid;
  } else {
    name = validator.escape(user.displayName);
  }
	
	admin.database().ref('users/' + uid).child('name').set(name);
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
    return true;
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
  admin.database().ref('solutions/').child(challengeID).once("value").then((ssnapshot) => {
    var solution = ssnapshot.val();
    if(solution === attempt) {
      //User Is Correct
      admin.database().ref('challenges/').child(challengeID).once("value").then((csnapshot) => {
        if(csnapshot.val().challengeCreator === req.user.uid) {
          res.status(200).send("You Can't Solve Your Own Challenge");
        }else {
          if(csnapshot.val().challengeSolved === 0) {
            //First Person
            //Add To Solved List
            admin.database().ref('challenges/' + challengeID).child("challengeSolved").set(csnapshot.val().challengeSolved + 1);
            admin.database().ref('challenges/' + challengeID + '/challengeSolvers').child(req.user.uid).set(csnapshot.val().challengeSolved + 1);
            admin.database().ref('users/' + req.user.uid + '/solves').child(challengeID).set(10);
            //Award Score
            awardScore(req.user.uid, 10);
            res.status(200).send("Correct You Will Recieve Your Points Shortly");
            //Award Score To Creator

          }else {
            //Not First Person
            //Check If UID Solved it before
            admin.database().ref('users/' + req.user.uid + '/solves').once('value').then((usnapshot) => {
              var hasSolved = false;
              usnapshot.forEach(function(childSnapshot) {
                if (childSnapshot.key === challengeID) {
                  hasSolved = true;
                }
              });
              if (hasSolved === false) {
                admin.database().ref('challenges/' + challengeID).child("challengeSolved").set(csnapshot.val().challengeSolved + 1);
                admin.database().ref('challenges/' + challengeID + '/challengeSolvers').child(req.user.uid).set(csnapshot.val().challengeSolved + 1);
                admin.database().ref('users/' + req.user.uid + '/solves').child(challengeID).set(2);
                awardScore(req.user.uid, 2);
                res.status(200).send("Correct You Will Recieve Your Points Shortly");
              }else {
                res.status(200).send("You Have Already Solved This Challenge");
              }
            });
          }
        }
      });  
    }else {
      res.status(200).send("Incorrect - Please do not guess");
    }
  });
  //Awards Score
  //Display That Challenge Has Been Solved
}

function awardScore(uid, amount) {
  var database = admin.database().ref('scores/').child(uid).once("value").then((snapshot) => {
    //Get Currnt Score
    var score = snapshot.val();
    //Add amount to score
    var newScore = score + amount;
    //Write Score
    admin.database().ref('scores').child(uid).set(newScore);
    admin.database().ref('users/' + uid).child("score").set(newScore);
  });
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