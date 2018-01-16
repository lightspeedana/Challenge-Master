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
  console.log("Created User: " + name);
  return true;
});

exports.updateUser = functions.https.onRequest((req, res) => {
  //Edits The Users Display Name
  cors(req, res, () => {
    validateFirebaseIdToken(req, res, updateUser);
    return true;
  });
});

exports.uploadChallenge = functions.https.onRequest((req, res) => {
	//Uploads a Challenge form an Authed User
	cors(req, res, () => {
		validateFirebaseIdToken(req, res, createChallenge);
    return true;
  });
});

exports.editChallenge = functions.https.onRequest((req, res) => {
  //Edits an Exsisting Challenge
  cors(req, res, () => {
    validateFirebaseIdToken(req, res, editChallenge);
    return true;
  });
});

exports.deleteChallenge = functions.https.onRequest((req, res) => {
  //Delets a challenge if it is unsolved and created by the requst sender
  cors(req, res, () => {
    validateFirebaseIdToken(req, res, deleteChallenge);
    return true;
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
function updateUser(req, res) {
  var name = validator.escape(req.headers.name);
  if (name.length < 37) {
    admin.database().ref('users/' + req.user.uid).child("name").set(name);
    console.log("Updated Name: " + validator.escape(req.headers.name));
    res.status(200).send("Your Name Has Been Changed");
  } else {
    res.status(403).send("Invalid Request");
  }
}

function createChallenge(req, res) {
  var title = validator.escape(req.body.Title + '');
  var description = validator.escape(req.body.Description + '');
  var content = validator.escape(req.body.Content + '');
  var solution = validator.escape(req.body.Solution + '');
  var entryFee = validator.isInt(req.body.EntryFee + '', {gt: 1});

  var uid = req.user.uid;
  var type = req.headers.type;

  if (type === "challenge") {

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

	  database = admin.database().ref('users/' + uid + '/created');
	  var key = database.push().key;
	  database.child(challengeID).set(key);

	  console.log("Uploaded Challenge : " + challengeID);
	  res.status(200).send(challengeID);
	  return true;
  }else if (type === "wager") {
	  //Removes Bad Request
	  if (title == "" || description == "" || content == "" || solution == "" || entryFee == false) {
	    res.status(400).send("Fill in the entire form");
	    return true;
	  }

	  entryFee = parseInt(req.body.EntryFee);

	  //Creates Challenge
	  var wagerData = {
	    wagerTitle:title,
	    wagerDescription:description,
	    wagerContent:content,
		wagerPot: 0,
		wagerEntryFee: entryFee,
		wagerStarted: false,
	    wagerCreator:uid,
	    wagerSolved:false
	  };

	  var database = admin.database().ref('wagers');
	  var wagerID = database.push().key;
	  database.child(wagerID).set(wagerData);
	  database = admin.database().ref('solutions');
	  database.child(wagerID).set(solution);

	  database = admin.database().ref('users/' + uid + '/hosted');
	  var key = database.push().key;
	  database.child(wagerID).set(key);

	  console.log("Uploaded Wager : " + wagerID);
	  res.status(200).send(wagerID);
	  return true;
  }

}

function editChallenge(req, res) {
  var title = validator.escape(req.body.challengeTitle + '');
  var description = validator.escape(req.body.challengeDescription + '');
  var content = validator.escape(req.body.challengeContent + '');
  var solution = validator.escape(req.body.challengeSolution + '');
  var cid = req.headers.cid;
  var uid = req.user.uid;

  //Removes Bad Request
  if (title == "" || description == "" || content == "" || solution == ""  || cid == null || uid == null) {
    res.status(400).send("Fill in the entire form");
    return true;
  }

  //Checks if user is allowed to modify this challenge
  var database = admin.database();
  database.ref('/challenges/' + cid).once('value').then((challengeSnapshot) => {
    var data = challengeSnapshot.val()
    var creator = data.challengeCreator;
    var solves = data.challengeSolved;

    if (uid === creator) {
      //Can Edit Challenge
      if (solves === 0) {
        //Can Edit Solution
        var challengeRef = database.ref('/challenges/' + cid);
        challengeRef.child("challengeTitle").set(title);
        challengeRef.child("challengeDescription").set(description);
        challengeRef.child("challengeContent").set(content);
        database.ref("/solutions/").child(cid).set(solution);
        console.log("Users:" + uid + " Updated the challenge and solution of " + cid);
        res.status(200).send(cid);
        return true;
      } else {
        //Can't Edit Solution
        var challengeRef = database.ref('/challenges/' + cid);
        challengeRef.child("challengeTitle").set(title);
        challengeRef.child("challengeDescription").set(description);
        challengeRef.child("challengeContent").set(content);
        console.log("User: " + uid + " Updated the challenge of " + cid);
        res.status(200).send(cid);
        return true;
      }
    } else {
      //Did Not Create Challenge
      res.status(403).send("You Did not Create This Challenge");
      return true;
    }
  });
}

function deleteChallenge(req, res) {
  //Delets a challenge if it is unsolved and created by the request sender
  var cid = req.headers.cid;
  var database = admin.database();
  database.ref('challenges/' + cid).once('value').then((challengeSnapshot) => {
    //Checks if Users Owns Challenge
    if (req.user.uid == challengeSnapshot.val().challengeCreator) {
      //If Challenge Is Unsolved
      if (0 == challengeSnapshot.val().challengeSolved) {
        //Delete
        database.ref('/challenges/' + cid).remove();
        database.ref('/solutions/' + cid).remove();
        database.ref('/users/' + req.user.uid + '/created/' + cid).remove();
        console.log("Deleted: " + cid);
        res.status(200).send("Challenge Deleted");
        return true;
      } else {
        res.status(403).send("Challenges that have been solved can't be deleted");
        return true;
      }
    } else {
      res.status(403).send("You did not create this challenge");
      return true;
    }
  });
}

function checkSolution(req, res) {
  //Gets Attempt and Token ID
  var attempt = validator.escape(req.headers.attempt);
  var challengeID = req.headers.challenge;
  console.log("Checked: " + attempt + " for " + challengeID);
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
			console.log("Correct - First");
            res.status(200).send("Correct You Will Recieve Your Points Shortly");
            //Award Score To Creator
            awardScore(csnapshot.val().challengeCreator, 1);
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
				console.log("Correct - Not First");
                res.status(200).send("Correct You Will Recieve Your Points Shortly");
              }else {
				console.log("Already Solved");
            	res.status(200).send("You Have Already Solved This Challenge");
              }
            });
          }
        }
      });
    }else {
		console.log("Incorrect");
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
    console.log("Awarded " + amount + " score to " + uid);
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
