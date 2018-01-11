var config = {
    apiKey: "AIzaSyDCEk4vF4WeVLmYIorsXZuMwvMDDLJC5xs",
    authDomain: "challenge-master.firebaseapp.com",
    databaseURL: "https://challenge-master.firebaseio.com",
    projectId: "challenge-master",
    storageBucket: "challenge-master.appspot.com",
    messagingSenderId: "378652612392"
};
firebase.initializeApp(config);

firebase.auth().getRedirectResult().then(function(result) {
    if (result.credential) {
        var token = result.credential.accessToken;
    }
    var user = result.user;
}).catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log(errorMessage);
});

function init() {
    const userKey = Object.keys(window.localStorage).filter(it => it.startsWith('firebase:authUser'))[0];
    const user = userKey ? JSON.parse(localStorage.getItem(userKey)) : undefined;
    var signIn = document.getElementById("signIn");
    if (user) {
        signIn.innerHTML = "Sign Out";
    } else {
        signIn.innerHTML = "Sign In";
    }
    return user;
}

function signIn() {
    var display = document.getElementById("signIn").innerHTML;
    if (display === "Sign Out") {
        //Sign Out
        firebase.auth().signOut();
        display.innerHTML = "Sign In";
    }else {
        //Sign In
        var provider = new firebase.auth.GithubAuthProvider();
        firebase.auth().signInWithRedirect(provider);
    }
}

function viewProfile() {
    try {
        document.location.href = "user.html?uid=" + firebase.auth().currentUser.uid;
    }catch(e) {
        signIn();
    }
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}
