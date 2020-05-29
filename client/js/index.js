var socket = io();
var host = <Your PeerServer URL>;
var screens = [];
screens.push(document.getElementById('homeContainer'));
screens.push(document.getElementById('lobbyContainer'));
screens.push(document.getElementById('roomContainer'));
screens.push(document.getElementById('gameContainer'));
screens.push(document.getElementById('leaderboardContainer'));
var db;
var fileNames = ['height.png', 'diffuse.png'];
var fileURLs = ['https://tank-me.herokuapp.com/assets/arena/height.png', 'https://tank-me.herokuapp.com/assets/arena/diffuse.png'];
var gameFileURLs = {};
var percentComplete = {};
var progress = document.getElementById('progress');

var isNavOpened = false;
var navBar = document.getElementById("navBar");
var avatarContainer = document.getElementById('avatarContainer');
var userProfile = null;

var welcome1, welcome2, welcome3, welcome4;
welcome1 = document.getElementById("welcome1");
welcome2 = document.getElementById("welcome2");
welcome3 = document.getElementById("welcome3");
welcome4 = document.getElementById("welcome4");
var lastWelcome = welcome1, i = 0;
window.onload = () => {
    setInterval(() => {
        i = (i%4 + 1);
        lastWelcome.style.opacity = 0;
        eval("welcome" + i + ".style.opacity = '1';");
        lastWelcome = eval("welcome" + i);
    }, 3000);

    // Setup DB to cache game files
    if (!window.indexedDB) {
        console.log('Indexed DB not supported');
    } else {
        const request = indexedDB.open('tankmeDB');
        request.onerror = () => {
            console.log('Indexed DB usage rejected');
        };
        request.onsuccess = (event) => {
            console.log('Connected to IndexedDB');
            db = event.target.result;
            db.onerror = (e) => {
                console.log('DB Error : ');
                console.log(e);
            };
        };
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            db.onerror = (e) => {
                console.log('DB Error : ');
                console.log(e);
            };

            var fileStore = db.createObjectStore('file');
            fileStore.transaction.oncomplete = () => {
                console.log('Created fileStore');
            };
        };
    }
}

var isMatching = false;
var peer, peerId;
var enemyPeers = [];
var enemyPeerIds = [];
var peerIdToUser = {};
var noOfConnections = 0;
var startPosition;

socket.on('receivePeerId', (data) => {
    peer = new Peer(data.id, {
        key: 'peerjs',
        host: host,
        secure: true,
        port: 443
    });
    peer.on('open', (id) => {
        peerId = id;
        console.log('Received PeerId : ' + peerId);
        socket.emit('peerId', {
            peerId: id
        });
        showScreen('room');
    });
    peer.on('error', (error) => {
        console.log(error);
        isMatching = false;
        document.getElementById('startButton').classList.remove('matching');
        document.getElementById('startButton').innerHTML = 'Start';
    });
    peer.on('connection', (conn) => {
        conn.on('data', (data) => {
            if (data.topic == 'playerInfo') {
                addPlayerInList(data.name, data.photoURL);
                peerIdToUser[data.peerId] = {
                    uid: data.uid,
                    name: data.name
                }
                noOfConnections += 1;
                socket.emit('noOfConnections', {
                    peerId: peerId,
                    connections: noOfConnections
                });
            } else if (data.topic == 'update') {
                enemyUpdate(data.id, data.position, data.rotation, data.turretRotation);
            } else if (data.topic == 'fire') {
                enemyFire(data.id);
            } else if (data.topic == 'points') {
                updatePlayerDetail(data.from, data.to, data.kill);
            }
        });
        conn.on('close', () => {
            console.log('disconnected');
        });
    });
});

socket.on('enemyIds', (enemyIds) => {
    console.log('Received enemyIds');
    console.log(enemyIds);
    for (var enemyId of enemyIds) {
        if (enemyPeerIds.includes(enemyId)) continue;
        enemyPeerIds = enemyPeerIds.concat([enemyId]);
        console.log('Connecting to ' + enemyId);
        var enemyPeer = peer.connect(enemyId);
        enemyPeers.push(enemyPeer);
        enemyPeer.on('open', () => {
            console.log('Connected');
            enemyPeer.on('data', (data) => {
                
            });
            enemyPeer.send({
                topic: 'playerInfo',
                name: firebase.auth().currentUser.displayName.split(' ')[0],
                photoURL: firebase.auth().currentUser.photoURL,
                uid: firebase.auth().currentUser.uid,
                peerId: peerId
            });
        });
    }
});

socket.on('timerStart', () => {
    var deadline = new Date((new Date()).getTime() + 10000);
    var timerId = setInterval(() => {
        var diff = deadline - (new Date()).getTime();
        if (diff < 0) {
            clearInterval(timerId);
            return;
        }
        document.getElementById('footerContainer').innerHTML = (Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))) + ':' + (Math.floor((diff % (1000 * 60)) / 1000));
    }, 1000);
});

socket.on('matchStart', (data) => {
    console.log('Match Started');
    startPosition = data.startPosition;
    showScreen('game');
})

function burgerClicked(){
    if(isNavOpened){
        navBar.style.left = "-25%";
        isNavOpened = !isNavOpened;
    }
    else{
        navBar.style.left = "0%";
        isNavOpened = !isNavOpened;
    }
}

function signIn() {
    if (firebase.auth().currentUser == null) {
        var provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider).then(function(result) {
            var user = firebase.auth().currentUser;
            firebase.database().ref('users/' + user.uid + '/stats').once('value')
                .then((snap) => {
                    if (snap.val() == null) {
                        firebase.database().ref('users/' + user.uid + '/stats')
                            .set({
                                matches: 0,
                                kills: 0,
                                deaths: 0,
                                points: 0,
                                wins: 0
                            });
                    }
                })
                .catch((error) => {
                    console.log(error);
                });
        }).catch(function(error) {
            console.log(error);
        });
    }
}

function setUserProfile(user) {
    avatarContainer.style.backgroundImage = 'url(\'' + user.photoURL + '\')';
    avatarContainer.setAttribute('title', user.displayName);
    showScreen('lobby');
}

function showScreen(screen) {
    var screenId;
    if (screen == 'home') {
        screenId = 'homeContainer';
    } else if (screen == 'lobby') {
        screenId = 'lobbyContainer';
        initiateLobby();
    } else if (screen == 'room') {
        screenId = 'roomContainer';
        initiateRoom();
    } else if (screen == 'game') {
        screenId = 'gameContainer';
        initiateGame();
    } else if (screen == 'leaderboard') {
        screenId = 'leaderboardContainer';
    } else {
        screenId = 'homeContainer';
    }

    for (var screenElement of screens) {
        if (screenElement.id == screenId) {
            screenElement.style.visibility = 'visible';
            screenElement.style.pointerEvents = 'all';
        } else {
            screenElement.style.visibility = 'hidden';
            screenElement.style.pointerEvents = 'none';
        }
    }
}

function initiateLobby() {
    // fetch big files
    checkGameFiles(fileNames)
        .then(() => {
            storeFileURLs(fileNames)
                .then(() => {
                    console.log(gameFileURLs);
                    initiatePostLobby();
                })
                .catch((error) => {
                    console.log(error);
                });
        })
        .catch(() => {
            document.getElementById('fetchingFiles').style.opacity = '1';
            document.getElementById('fetchingFiles').style.pointerEvents = 'all';
            fetchFilesAndStore(fileURLs, fileNames)
                .then(() => {
                    storeFileURLs(fileNames)
                        .then(() => {
                            console.log(gameFileURLs);
                            document.getElementById('fetchingFiles').style.opacity = '0';
                            document.getElementById('fetchingFiles').style.pointerEvents = 'none';
                            initiatePostLobby();
                        })
                        .catch((error) => {
                            console.log(error);
                        });
                })
                .catch((error) => {
                    console.log(error);
                });
        });
}

function initiateRoom() {
    document.getElementById('footerContainer').innerHTML = '';
    document.getElementById('playerListContainer').innerHTML = '';
    addPlayerInList(firebase.auth().currentUser.displayName.split(' ')[0], firebase.auth().currentUser.photoURL);
}

function initiateGame() {
    if (BABYLON.Engine.isSupported()) {
        initScene();
    } else {
        console.log('Babylon Engine not supported');
    }
}

function addPlayerInList(name, photoURL) {
    var playerListItem = document.createElement('div');
    var playerIcon = document.createElement('div');
    var playerName = document.createElement('div');
    playerListItem.classList.add('playerListItem');
    playerIcon.classList.add('playerIcon');
    playerIcon.style.backgroundImage = 'url(\'' + photoURL + '\')';
    playerName.classList.add('playerName');
    playerName.innerHTML = name;
    playerListItem.append(playerIcon);
    playerListItem.append(playerName);
    document.getElementById('playerListContainer').append(playerListItem);
}

function start() {
    console.log('StartClicked');
    if (!isMatching) {
        isMatching = true;
        document.getElementById('startButton').classList.add('matching');
        document.getElementById('startButton').innerHTML = 'Matching...';
        socket.emit('getPeerId');
    }
}

function lobbyClicked() {
    clearInterval(lobbyTimerID);
    if (player.idleSound.isPlaying) player.idleSound.pause();
    if (player.runSound.isPlaying) player.runSound.pause();
    scene.dispose();
    showScreen('lobby');
}

function fetchFilesAndStore(urls, fileNames) {
    return new Promise((resolve, reject) => {
        var promises = [];
        for (var i = 0 ; i < urls.length ; i++) {
            promises.push(
                blobRequest(urls[i], fileNames[i])
                    .then((fileData) => {
                        var newFile = new File([fileData.data], fileData.fileName);
                        db.transaction("file", "readwrite").objectStore("file").put(newFile, fileData.fileName);
                    })
                    .catch((error) => {
                        console.log(error);
                    })
            );
        }
        Promise.all(promises)
            .then(() => {
                resolve();
            })
            .catch((error) => {
                console.log(error);
                reject();
            });
    });
}

function blobRequest(url, fileName) {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.responseType = "blob";
        xhr.addEventListener('progress', (event) => {
            percentComplete[fileName] = (event.loaded / event.total) * 100;
            var sum = 0;
            for (var fileProgress of Object.values(percentComplete)) {
                sum += fileProgress;
            }
            progress.value = sum;
        });
        xhr.addEventListener("load", (event) => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve({
                    data: xhr.response,
                    fileName: fileName,
                });
            } else {
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText,
                });
            }
        });
        xhr.addEventListener("error", (error) => {
            reject({
                status: xhr.status,
                statusText: xhr.statusText,
            });
        });
        xhr.open("GET", url);
        xhr.send();
    });
}

function checkGameFiles(fileNames) {
    return new Promise((resolve, reject) => {
        var promises = [];
        for (var i = 0 ; i < fileNames.length ; i++) {
            promises.push(checkFile(fileNames[i]));
        }
        Promise.all(promises)
            .then(() => {
                resolve();
            })
            .catch(() => {
                reject();
            })
    });
}

function checkFile(fileName) {
    return new Promise((resolve, reject) => {
        var request = db.transaction("file", "readwrite").objectStore("file").count(fileName);
        request.onsuccess = (event) => {
            if (event.target.result <= 0) {
                reject();
            } else {
                resolve();
            }
        };
        request.onerror = (error) => {
            console.log(error);
            reject();
        };
    });
}

function initiatePostLobby() {
    isMatching = false;
    document.getElementById('startButton').classList.remove('matching');
    document.getElementById('startButton').innerHTML = 'Start';
    var user = firebase.auth().currentUser;
    document.getElementById('userHeader').innerHTML = user.displayName.split(' ')[0];
    firebase.database().ref('users/' + user.uid + '/stats').once('value')
        .then((snap) => {
            if (snap.val() != null) {
                document.getElementById('matches').innerHTML = snap.val().matches;
                document.getElementById('kills').innerHTML = snap.val().kills;
                document.getElementById('deaths').innerHTML = snap.val().deaths;
                var kdRatio = (parseInt(snap.val().deaths) == 0) ? parseInt(snap.val().kills) : (parseInt(snap.val().kills) / parseInt(snap.val().deaths)) ;
                document.getElementById('kdRatio').innerHTML = kdRatio.toFixed(2);
                document.getElementById('points').innerHTML = snap.val().points;
                document.getElementById('wins').innerHTML = snap.val().wins;
            }
        })
        .catch((error) => {
            console.log(error);
        });
}

function storeFileURLs(fileNames) {
    return new Promise((resolve, reject) => {
        var promises = [];
        for (var fileName of fileNames) {
            promises.push(storeURL(fileName));
        }
        Promise.all(promises)
            .then(() => {
                resolve();
            })
            .catch((error) => {
                reject();
            });
    });
}

function storeURL(fileName) {
    return new Promise((resolve, reject) => {
        db.transaction("file").objectStore("file").get(fileName)
            .onsuccess = (event) => {
                gameFileURLs[fileName] = window.URL.createObjectURL(event.target.result);
                resolve();
            };
    });
}