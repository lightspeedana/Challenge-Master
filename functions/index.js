const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});
var validator = require('validator');
admin.initializeApp(functions.config().firebase);

//Cloud Functions
exports.initUser = functions.auth.user().onCreate(event => {
	//Adds the Player To Users and Scores Node
	var promises = [];
	const user = event.data;
  	const uid = user.uid;
  	const score = 0;
  	promises.push(admin.database().ref('users/' + uid).child('score').set(score));

  	var name = "";
  	if(user.displayName === undefined) {
    	name = uid;
  	} else {
    	name = validator.escape(user.displayName);
  	}

	promises.push(admin.database().ref('users/' + uid).child('name').set(name));
  	promises.push(admin.database().ref('scores').child(uid).set(score));
  	console.log("Created User: " + name);
  	return Promise.all(promises);
});

exports.updateUser = functions.https.onRequest((req, res) => {
  //Edits The Users Display Name
  cors(req, res, () => {
    validateFirebaseIdToken(req, res, updateUser);
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
  });
});

exports.enterWager = functions.https.onRequest((req, res) => {
	//Enters a User Into A Wager and Puts their Score into the pot
	cors(req, res, () => {
		validateFirebaseIdToken(req, res, enterWager);
		return true;
	});
});

exports.startWager = functions.https.onRequest((req, res) => {
	//Releases the content of a wager and prevents new entrants
	cors(req, res, () => {
		validateFirebaseIdToken(req, res, startWager);
		return true;
	});
});

exports.checkWager = functions.https.onRequest((req, res) => {
	//Checks the users attempt against the solution for a wager and awards points if correct
	cors(req, res, () => {
		validateFirebaseIdToken(req, res, checkWager);
		return true;
	});
});
//Functions
function updateUser(req, res) {
  var name = validator.escape(req.headers.name);
  var promises = [];
  if (name.length < 37) {
    promises.push(admin.database().ref('users/' + req.user.uid).child("name").set(name));
    console.log("Updated Name: " + validator.escape(req.headers.name));
    res.status(200).send("Your Name Has Been Changed");
	return Promise.all(promises);
  } else {
    res.status(403).send("Invalid Request");
	return true;
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
		console.log("Invalid Request");
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

	  var promises = [];
	  var database = admin.database().ref('challenges');
	  var challengeID = database.push().key;
	  promises.push(database.child(challengeID).set(challengeData));
	  database = admin.database().ref('solutions');
	  promises.push(database.child(challengeID).set(solution));

	  database = admin.database().ref('users/' + uid + '/created');
	  var key = database.push().key;
	  promises.push(database.child(challengeID).set(key));

	  console.log("Uploaded Challenge : " + challengeID);
	  res.status(200).send(challengeID);
	  return Promise.all(promises);
  }else if (type === "wager") {
	  //Removes Bad Request
	  if (title == "" || description == "" || content == "" || solution == "" || entryFee == false) {
		  	console.log("Invalid Request");
			res.status(400).send("Fill in the entire form");
	    	return true;
	  }

	  entryFee = parseInt(req.body.EntryFee);

	  //Creates Challenge
	  var wagerDetails = {
		  wagerTitle:title,
  	  	  wagerDescription:description,
		  wagerCreator:uid,
		  wagerEntryFee: entryFee,
		  wagerPot: 0,
		  wagerStarted: false,
		  wagerSolved: false
	  };

	  var wagerData = {};
	  wagerData["wagerDetails"] = wagerDetails;
	  wagerData["wagerContent"] = content;
	  var promises = [];

	  var database = admin.database().ref('wagers');
	  var wagerID = database.push().key;
	  promises.push(database.child(wagerID).set(wagerData));
	  database = admin.database().ref('solutions');
	  promises.push(database.child(wagerID).set(solution));

	  database = admin.database().ref('users/' + uid + '/hosted');
	  var key = database.push().key;
	  promises.push(database.child(wagerID).set(key));

	  console.log("Uploaded Wager : " + wagerID);
	  res.status(200).send(wagerID);
	  return Promise.all(promises);
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
		var promises = [];
        promises.push(challengeRef.child("challengeTitle").set(title));
        promises.push(challengeRef.child("challengeDescription").set(description));
        promises.push(challengeRef.child("challengeContent").set(content));
        promises.push(database.ref("/solutions/").child(cid).set(solution));
        console.log("Users:" + uid + " Updated the challenge and solution of " + cid);
        res.status(200).send(cid);
        return Promise.all(promises);
      } else {
        //Can't Edit Solution
        var challengeRef = database.ref('/challenges/' + cid);
		var promises = [];
        promises.push(challengeRef.child("challengeTitle").set(title));
        promises.push(challengeRef.child("challengeDescription").set(description));
        promises.push(challengeRef.child("challengeContent").set(content));
        console.log("User: " + uid + " Updated the challenge of " + cid);
        res.status(200).send(cid);
        return Promise.all(promises);
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
    	if (req.user.uid === challengeSnapshot.val().challengeCreator) {
      		//If Challenge Is Unsolved
      		if (0 === challengeSnapshot.val().challengeSolved) {
        		//Delete
				var promises = [];
        		promises.push(database.ref('/challenges/' + cid).remove());
        		promises.push(database.ref('/solutions/' + cid).remove());
        		promises.push(database.ref('/users/' + req.user.uid + '/created/' + cid).remove());
        		console.log("Deleted: " + cid);
        		res.status(200).send("Challenge Deleted");
        		return Promise.all(promises);
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
  	console.log("Checked: '" + attempt + "' for " + challengeID);
  	//Gets Solution
  	admin.database().ref('solutions/').child(challengeID).once("value").then((ssnapshot) => {
    	var solution = ssnapshot.val();
    	if(solution === attempt) {
      		//User Is Correct
      		admin.database().ref('challenges/').child(challengeID).once("value").then((csnapshot) => {
        		if(csnapshot.val().challengeCreator === req.user.uid) {
          			res.status(200).send("You Can't Solve Your Own Challenge");
					return true;
        		}else {
          			if(csnapshot.val().challengeSolved === 0) {
            			//First Person
            			//Add To Solved List
						var promises = [];
            			promises.push(admin.database().ref('challenges/' + challengeID).child("challengeSolved").set(csnapshot.val().challengeSolved + 1));
            			promises.push(admin.database().ref('challenges/' + challengeID + '/challengeSolvers').child(req.user.uid).set(csnapshot.val().challengeSolved + 1));
            			promises.push(admin.database().ref('users/' + req.user.uid + '/solves').child(challengeID).set(10));
            			//Award Score
            			promises.push(awardScore(req.user.uid, 10));
						//Award Score To Creator
            			promises.push(awardScore(csnapshot.val().challengeCreator, 1));
						console.log("Correct - First");
            			res.status(200).send("Correct You Will Recieve Your Points Shortly");
						return Promise.all(promises);
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
						var promises = [];
                		promises.push(admin.database().ref('challenges/' + challengeID).child("challengeSolved").set(csnapshot.val().challengeSolved + 1));
                		promises.push(admin.database().ref('challenges/' + challengeID + '/challengeSolvers').child(req.user.uid).set(csnapshot.val().challengeSolved + 1));
                		promises.push(admin.database().ref('users/' + req.user.uid + '/solves').child(challengeID).set(2));
                		promises.push(awardScore(req.user.uid, 2));
						console.log("Correct - Not First");
                		res.status(200).send("Correct You Will Recieve Your Points Shortly");
						return Promise.all(promises);
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
}

function enterWager(req, res) {
	var wagerID = req.headers.wid;
	var uid = req.user.uid;
	admin.database().ref('/users/' + uid).child("score").once("value").then((usnapshot) => {
		admin.database().ref('/wagers/' + wagerID + '/wagerDetails').once("value").then((wsnapshot) => {
			var wdata = wsnapshot.val();
			if (wdata.wagerStarted === false) {
				if (usnapshot.val() >= wdata.wagerEntryFee) {
					var entrant = wsnapshot.child("wagerEntrants").forEach(entrant => {
						if (entrant.key === uid) {
							return true;
						}
					});
					if (entrant !== true) {
						var database = admin.database().ref('wagers/' + wagerID + '/wagerDetails').child('wagerEntrants');
						var promises = [];
						data = admin.database.ServerValue.TIMESTAMP;
						promises.push(database.child(uid).set(data));
						promises.push(revokeScore(uid, wdata.wagerEntryFee));
						promises.push(admin.database().ref('/wagers/' + wagerID + '/wagerDetails').child('wagerPot').set(wdata.wagerPot + wdata.wagerEntryFee));
						console.log(uid + " entered the wager");
						res.status(200).send("You are now in the wager");
						return Promise.all(promises);
					}
					console.log("Failed - Player Already In The Wager")
					res.status(403).send("You are already entered in this wager");
					return true;
				}
				console.log("Failed - Player Doesn't Have Enough Score")
				res.status(403).send("You don't have enough score to enter this wager");
				return true;
			}
			console.log("Failed - Wager Has Started")
			res.status(403).send("You Can't Join a Wager That Has Already Started");
			return true;
		});
	});
};

function startWager(req, res) {
	var wagerID = req.headers.wid;
	admin.database().ref('wagers/' + wagerID + '/wagerDetails').once("value").then((wsnapshot) => {
		var wdata = wsnapshot.val();
		if (req.user.uid === wdata.wagerCreator) {
			if (wsnapshot.child("wagerEntrants").numChildren() >= 2) {
				//Start Wager
				var promises = [];
				promises.push(admin.database().ref('wagers/' + wagerID + '/wagerDetails').child("wagerStarted").set(true));
				console.log("Wager " + wagerID + " has begun")
				res.status(200).send("The wager has begun");
				return Promise.all(promises);
			}
			console.log("Failed - Not Enough Players")
			res.status(403).send("There must be at least 2 entrants to start a wager");
			return true;
		}
		console.log("Failed - Permision Denied")
		res.status(403).send("You do not own this wager - Permision Denied");
		return true;
	});
}

function checkWager(req, res) {
	var uid = req.user.uid;
	var wid = req.headers.wid;
	var attempt = validator.escape(req.headers.attempt);
	var database = admin.database();
	database.ref('/wagers/' + wid + '/wagerDetails').once("value").then(wsnapshot => {
		database.ref('/solutions/' + wid).once("value").then(answerSnapshot => {
			wdata = wsnapshot.val();
			if (wdata.wagerStarted === true) {
				if (wdata.wagerSolved === false) {
					var entrant = wsnapshot.child("wagerEntrants").forEach(entrant => {
						if (entrant.key === uid) {
							return true;
						}
					});
					if (entrant === true) {
						//User Is Eligible
						if (attempt === answerSnapshot.val()) {
							//Attempt is Correct
							var promises = [];
							promises.push(database.ref('/wagers/' + wid + '/wagerDetails').child('wagerSolved').set(true));
							promises.push(database.ref('/wagers/' + wid + '/wagerDetails').child('wagerSolver').set(uid));
							promises.push(awardScore(uid, wdata.wagerPot));
							promises.push(awardScore(wdata.wagerCreator, Math.floor(wdata.wagerPot/10)));
							console.log("Correct");
					        res.status(200).send("Correct - You Will Recieve Your Score Shortly");
							return Promise.all(promises);
						}
						console.log("Incorrect '" + attempt + "'");
				        res.status(200).send("Incorrect - Please do not guess");
						return true;
					}
					console.log("Failed - Permision Denied")
					res.status(403).send("You Have to be Entered in the Wager to Submit Answers");
					return true;
				}
				console.log("Failed - Already Solved")
				res.status(403).send("This wager has finished");
				return true;
			}
			console.log("Failed - Not Started")
			res.status(403).send("The Wager Has Not Started");
			return true;
		});
	});
}

function awardScore(uid, amount) {
  var database = admin.database().ref('scores/').child(uid).once("value").then((snapshot) => {
    var score = snapshot.val();
    var newScore = score + amount;
	var promises = [];
    promises.push(admin.database().ref('scores').child(uid).set(newScore));
    promises.push(admin.database().ref('users/' + uid).child("score").set(newScore));
    console.log("Awarded " + amount + " score to " + uid);
	return promises;
  });
}

function revokeScore(uid, amount) {
	var database = admin.database().ref('scores/').child(uid).once("value").then((snapshot) => {
    	var score = snapshot.val();
      	var newScore = score - amount;
		var promises = [];
      	promises.push(admin.database().ref('scores').child(uid).set(newScore));
      	promises.push(admin.database().ref('users/' + uid).child("score").set(newScore));
      	console.log("Revoked " + amount + " score from " + uid);
		return promises;
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
