var express = require('express');
var app = express();
var cors = require('cors');
var http = require('http');
var server = http.createServer(app);
var port = process.env.PORT || 8000;
app.use(cors());
app.use(express.static('client'));
var io = require('socket.io')(server);

var firebaseAdmin = require('firebase-admin');
var serviceAccount = require('./firebaseAdminKey.json');
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: <Firebase Database URL>
});

server.listen(port);

var rooms = {};

io.on('connection', (socket) => {
    socket.on('getPeerId', () => {
        socket.emit('receivePeerId', {
            id: generatePeerID()
        });
    });
    socket.on('peerId', (data) => {
        console.log('peerId');
        console.log(data);
        var roomId = data.peerId.split('_')[1];
        rooms[roomId].members[data.peerId] = socket.id;
        var enemyIds = [...Object.keys(rooms[roomId].members)]
        enemyIds.splice(enemyIds.indexOf(data.peerId), 1);
        socket.emit('enemyIds', enemyIds);
        for (var enemyId of enemyIds) {
            io.to(rooms[roomId].members[enemyId]).emit('enemyIds', [data.peerId]);
        }
    });
    socket.on('noOfConnections', (data) => {
        rooms[data.peerId.split('_')[1]].connections = data.connections;
        var roomId = data.peerId.split('_')[1];
        if (!rooms[roomId].started && !rooms[roomId].timerStarted && checkConnections(roomId) && Object.keys(rooms[roomId].members).length >= 2) {
            startTimer(Object.values(rooms[roomId].members));
            setTimeout(startMatch, 10000, Object.values(rooms[roomId].members), roomId);
            rooms[roomId].timerStarted = true;
        }
    });
    socket.on('points', (data) => {
        firebaseAdmin.database().ref('users/' + data.enemyUID + '/stats').once('value')
            .then((snap) => {
                var stats = snap.val();
                stats.points = parseInt(stats.points) + parseInt(data.points);
                if (data.kill) stats.kills = parseInt(stats.kills) + 1;
                firebaseAdmin.database().ref('users/' + data.enemyUID + '/stats').set(stats)
                    .catch((error) => {
                        console.log(error);
                    });
            })
            .catch((error) => {
                console.log(error);
            });
        if (data.kill) {
            firebaseAdmin.database().ref('users/' + data.playerUID + '/stats').once('value')
            .then((snap) => {
                var stats = snap.val();
                stats.deaths = parseInt(stats.deaths) + 1;
                firebaseAdmin.database().ref('users/' + data.playerUID + '/stats').set(stats)
                .catch((error) => {
                    console.log(error);
                });
            })
            .catch((error) => {
                console.log(error);
            });
        }
    });

    socket.on('matchEnd', (data) => {
        var promises = [];
        for (var uid of data.uids) {
            promises.push(incrementMatches(uid, (uid == data.winner)));
        }
        Promise.all(promises)
            .then(() => {
                delete rooms[data.roomId]
            })
            .catch((error) => {
                console.log(error);
            })
    });

    socket.on('disconnect', () => {
    });
});

function generatePeerID() {
    var S4 = function() { return (((1+Math.random())*0x10000)|0).toString(16).substring(1);};
    var playerId = S4();
    if (Object.keys(rooms).length == 0) {
        var roomId = S4() + '-' + S4() + '-' + S4() + '-' + S4();
        playerId += '_' + roomId;
        rooms[roomId] = {
            members: {[playerId]: null},
            connections: {[playerId]: 0},
            started: false,
            timerStarted: false
        };
        return playerId;
    } else {
        for (var roomId of Object.keys(rooms)) {
            if (!rooms[roomId].started && Object.keys(rooms[roomId].members).length < 4) {
                rooms[roomId].members[playerId + '_' + roomId] = null;
                rooms[roomId].connections[playerId + '_' + roomId] = 0;
                return (playerId + '_' + roomId);
            }
        }
        // All rooms full
        var roomId = S4() + '-' + S4() + '-' + S4() + '-' + S4();
        playerId += '_' + roomId;
        rooms[roomId] = {
            members: {[playerId]: null},
            connections: {[playerId]: 0},
            started: false,
            timerStarted: false
        };
        return playerId;
    }
}

function startTimer(socketIds) {
    for (var socketId of socketIds) {
        io.to(socketId).emit('timerStart');
    }
}

function startMatch(socketIds, roomId) {
    rooms[roomId].started = true;
    for (var socketId of socketIds) {
        io.to(socketId).emit('matchStart', {
            startPosition: {
                x: getRandomInRange(-240, 240),
                y: 26,
                z: getRandomInRange(-240, 240)
            }
        });
    }
}

function getRandomInRange(min, max){
    return Math.random() * (max - min) + min; 
}

function incrementMatches(uid, winner) {
    return new Promise((resolve, reject) => {
        firebaseAdmin.database().ref('users/' + uid + '/stats').once('value')
            .then((snap) => {
                var stats = snap.val();
                stats.matches = parseInt(stats.matches) + 1;
                if (winner) stats.wins = parseInt(stats.wins) + 1;
                firebaseAdmin.database().ref('users/' + uid + '/stats').set(stats)
                    .then(() => {
                        resolve();
                    });
            })
            .catch((error) => {
                console.log(error);
                reject();
            });
    });
}

function checkConnections(roomId) {
    var noOfMembers = Object.keys(rooms[roomId].members).length;
    for (var connections of Object.values(rooms[roomId].connections)) {
        if (connections != (noOfMembers.length - 1)) return false;
    }
    return true;
}