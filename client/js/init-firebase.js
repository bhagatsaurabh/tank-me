var firebaseConfig = <Your Firebase API Key>

firebase.initializeApp(firebaseConfig);

firebase.auth().onAuthStateChanged((user) => {
    if (user != null) {
        setUserProfile(user);
    } else {
        
    }
});