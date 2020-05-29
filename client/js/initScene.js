var canvas, engine, scene, tppCamera, fppCamera, arcRotateCam, glowLayer;
var matchStats = {
    points: 0,
    kills: 0
}
var rotateCamera = false;
var upsideDown = false;
var sightImage;
var cameraChangeDelay = 1000;
var lastCameraChange = 0;
var advancedTexture;
var player, health = 100;
var healthBar, killFeedStack, killText;
var showKillTimeout = null;
var killFeed = [];
var bulletDamage = 15;
var ground;
var light, shadowGenerator;
var map = {};
var loaded = false;
var firingDelay = 2000;
var lastFired = 0;
var bulletMaterial;
var enemies = {};
var fpsLabel = document.getElementById("fpsLabel");
var blastSound;
var lobbyTimerID, lobbyDeadline;
var movement = {
    left:false,
    right:false,
    forward:false,
    backward:false
};
var gameID = "";
var health = 100;
var kills = 0;

function initScene() {
    // Set scene
    canvas = document.getElementById("renderCanvas");
    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.8, 0), new BABYLON.CannonJSPlugin());
    scene.actionManager = new BABYLON.ActionManager(scene);
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, function (evt) {
        map[evt.sourceEvent.key] = true;

    }));
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, function (evt) {
        map[evt.sourceEvent.key] = false;
    }));
    glowLayer = new BABYLON.GlowLayer("glow", scene);
    glowLayer.intensity = 2;
    //scene.debugLayer.show();
    // Set UI
    advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    
    healthBar = new BABYLON.GUI.Slider();
    healthBar.minimum = 0;
    healthBar.maximum = 100;
    healthBar.value = 100;
    healthBar.height = "4%";
    healthBar.width = "30%";
    healthBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    healthBar.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    healthBar.displayThumb = false;
    healthBar.background = '#00000000';
    healthBar.color = 'gray';
    healthBar.isEnabled = false;
    healthBar.top = '94%';
    advancedTexture.addControl(healthBar);

    killFeedStack = new BABYLON.GUI.StackPanel();
    killFeedStack.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    killFeedStack.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    killFeedStack.width = '98%';
    advancedTexture.addControl(killFeedStack);

    killText = new BABYLON.GUI.TextBlock();
    killText.text = '';
    killText.width = '100%'
    killText.height = '20px';
    killText.color = "#bababa";
    killText.fontSize = '17px';
    killText.fontFamily = 'Isocpeur';
    killText.top = '70%';
    killText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    killText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    advancedTexture.addControl(killText);

    sightImage = new BABYLON.GUI.Image("sight", "../assets/img/ads.png");
    sightImage.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    sightImage.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    sightImage.width = '35%'
    sightImage.height = '40%';
    sightImage.isVisible = false;
    sightImage.alpha = .3;
    advancedTexture.addControl(sightImage);

    // Set light
    light = new BABYLON.DirectionalLight("DirectionalLight", new BABYLON.Vector3(0, -1, 0), scene);
    light.intensity = 1;
    light.position.x = -300
    light.direction = new BABYLON.Vector3(-1, -1, 0);
    shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
    shadowGenerator.usePoissonSampling = true;
    // Set TPP Camera
    tppCamera = new BABYLON.FollowCamera("tppCam", new BABYLON.Vector3(0, 10, -10), scene);
    tppCamera.radius = 13;
    tppCamera.heightOffset = 4;
    tppCamera.rotationOffset = 180;
    tppCamera.cameraAcceleration = 0.05;
    tppCamera.maxCameraSpeed = 10;
    scene.activeCamera = tppCamera;
    // Set skybox
    var skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size:1000.0}, scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("../assets/cubemap/cubemap", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skybox.material = skyboxMaterial;
    // Set ground
    var groundMaterial = new BABYLON.StandardMaterial("ground", scene);
    groundMaterial.diffuseTexture = new BABYLON.Texture(gameFileURLs['diffuse.png'], scene);
    groundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    groundMaterial.ambientColor = new BABYLON.Color3(1, 1, 1);
    ground = BABYLON.Mesh.CreateGroundFromHeightMap("ground", gameFileURLs['height.png'], 500, 500, 500, 0, 25, scene, false, () => {
        ground.material = groundMaterial;
        ground.physicsImpostor = new BABYLON.PhysicsImpostor(ground, BABYLON.PhysicsImpostor.HeightmapImpostor, { mass: 0, restitution: 0 }, scene);
        ground.position.y = 0;
        shadowGenerator.getShadowMap().renderList.push(ground);
        ground.receiveShadows = true;
        createPlayerTank().then((playerTank) => {
            player = playerTank;
            // Set FPP Camera
            fppCamera = new BABYLON.FreeCamera("fppCam", new BABYLON.Vector3(0, 2.1, 5.2), scene);
            fppCamera.parent = player.turret;
        });
        for (var enemyId of enemyPeerIds) {
            createEnemyTank(enemyId);
        }
    });
    // Set Bullet Material
    bulletMaterial = new BABYLON.StandardMaterial("fire", scene);
    var fireTexture = new BABYLON.Texture("../assets/textures/explosion/explosion.jpg", scene);
    fireTexture.uScale = fireTexture.vScale = 10;
    bulletMaterial.diffuseTexture = fireTexture;
    bulletMaterial.specularColor = BABYLON.Color3.Black();
    bulletMaterial.emissiveColor = BABYLON.Color3.Yellow();
    // Set Render Loop
    engine.runRenderLoop(function () {
        scene.render();
        fpsLabel.innerHTML = engine.getFps().toFixed() + " FPS";
    });
    // Code to run before frame render
    scene.registerBeforeRender(function () {
        if (loaded) {
            if ((map["w"] || map["W"]) && !upsideDown) {
                player.translate(BABYLON.Axis.Z, 0.2, BABYLON.Space.LOCAL);
            }
            if ((map["d"] || map["D"]) && !upsideDown) {
                if (map["Shift"]) {
                    player.rotate(BABYLON.Axis.Y, 0.01, BABYLON.Space.LOCAL);
                } else {
                    player.rotate(BABYLON.Axis.Y, 0.02, BABYLON.Space.LOCAL);
                }
            }
            if ((map["a"] || map["A"]) && !upsideDown) {
                if(map["Shift"]) {
                    player.rotate(BABYLON.Axis.Y, -0.01, BABYLON.Space.LOCAL);
                } else {
                    player.rotate(BABYLON.Axis.Y, -0.02, BABYLON.Space.LOCAL);
                }
            }
            if ((map["s"] || map["S"]) && !upsideDown) {
                player.translate(BABYLON.Axis.Z, -0.2, BABYLON.Space.LOCAL);
            }
            if (map["w"] || map["a"] || map["s"] || map["d"]) {
                if (!player.runSound.isPlaying) player.runSound.play();
                if (player.idleSound.isPlaying) player.idleSound.pause();
            } else {
                if (player.runSound.isPlaying) player.runSound.pause();
                if (!player.idleSound.isPlaying) player.idleSound.play();
            }
            if (map["ArrowLeft"]) {
                if (map["Shift"]) {
                    player.turret.rotation = new BABYLON.Vector3(player.turret.rotation.x, player.turret.rotation.y - 0.01, player.turret.rotation.z);
                } else {
                    player.turret.rotation = new BABYLON.Vector3(player.turret.rotation.x, player.turret.rotation.y - 0.02, player.turret.rotation.z);
                }
            }
            if (map["ArrowRight"]) {
                if (map["Shift"]) {
                    player.turret.rotation = new BABYLON.Vector3(player.turret.rotation.x, player.turret.rotation.y + 0.01, player.turret.rotation.z);
                } else {
                    player.turret.rotation = new BABYLON.Vector3(player.turret.rotation.x, player.turret.rotation.y + 0.02, player.turret.rotation.z);
                }
            }
            if (map["ArrowUp"]) {
                if (player.turret.rotation.x < 0.05)
                player.turret.rotation = new BABYLON.Vector3(player.turret.rotation.x + 0.01, player.turret.rotation.y, player.turret.rotation.z);
            }
            if (map["ArrowDown"]) {
                if (player.turret.rotation.x > -0.1) {
                    player.turret.rotation = new BABYLON.Vector3(player.turret.rotation.x - 0.01, player.turret.rotation.y, player.turret.rotation.z);
                }
            }
            // Reset Tank
            if ((map["t"] || map["T"]) && upsideDown) {
                var euler = player.rotationQuaternion.toEulerAngles();
                euler.z = 0;
                euler = euler.toQuaternion();
                player.rotationQuaternion = new BABYLON.Quaternion(euler.x, euler.y, euler.z, euler.w);
                upsideDown = false;
            }
            // Reset Turret
            if (map["r"] || map["R"]) {
                if (player.turret.rotation.y > -0.001 && player.turret.rotation.y < 0.001)
                    player.turret.rotation = new BABYLON.Vector3(player.turret.rotation.x, 0, player.turret.rotation.z);

                var degrees = ((player.turret.rotation.y % (2 * Math.PI)) * 180) / Math.PI;
                if (Math.abs(degrees) > 180) {
                    if (degrees > 180) {
                        degrees = degrees - 360;
                    } else if (degrees < -180) {
                        degrees = 360 + degrees;
                    }
                }
                degrees = (degrees * Math.PI) / 180;
                if (degrees < 0) {
                    player.turret.rotation = new BABYLON.Vector3(player.turret.rotation.x, degrees + 0.02, player.turret.rotation.z);
                } else if (degrees > 0) {
                    player.turret.rotation = new BABYLON.Vector3(player.turret.rotation.x, degrees - 0.02, player.turret.rotation.z);
                }
            }
            if (map[" "]) {
                if ((new Date()).getTime() - lastFired > firingDelay) {
                    fireBullet(player);
                    for (var enemyPeer of enemyPeers) {
                        enemyPeer.send({
                            topic: 'fire',
                            id: peerId
                        });
                    }
                    lastFired = (new Date()).getTime();
                }
            }
            if (map['v'] || map['V']) {
                if ((new Date()).getTime() - lastCameraChange > cameraChangeDelay) {
                    if (scene.activeCamera.name == 'tppCam') {
                        scene.activeCamera = fppCamera;
                        sightImage.isVisible = true;
                    } else {
                        scene.activeCamera = tppCamera;
                        sightImage.isVisible = false;
                    }
                    lastCameraChange = (new Date()).getTime();
                }
            }
            if (player.up.y < 0) upsideDown = true;
            for (var enemyPeer of enemyPeers) {
                enemyPeer.send({
                    topic: 'update',
                    id: peerId,
                    position: {
                        x: player.position.x,
                        y: player.position.y,
                        z: player.position.z
                    },
                    rotation: {
                        x: player.rotationQuaternion.x,
                        y: player.rotationQuaternion.y,
                        z: player.rotationQuaternion.z,
                        w: player.rotationQuaternion.w
                    },
                    turretRotation: {
                        x: player.turret.rotation.x,
                        y: player.turret.rotation.y,
                        z: player.turret.rotation.z
                    }
                });
            }
        }
        if (rotateCamera) {
            arcRotateCam.alpha += 0.007;
        }
    });
}

function createPlayerTank() {
    return new Promise((resolve, reject) => {
        BABYLON.SceneLoader.ImportMesh("", "../assets/tanks/German/", "German.babylon", scene, function (meshes) {
            // scaling bounding box
            var minimum = meshes[0].getBoundingInfo().boundingBox.minimum.clone();
            var maximum = meshes[0].getBoundingInfo().boundingBox.maximum.clone();
            var scaling = BABYLON.Matrix.Scaling(1, 0.75, 1);
            minimum = BABYLON.Vector3.TransformCoordinates(minimum, scaling);
            maximum = BABYLON.Vector3.TransformCoordinates(maximum, scaling);
            meshes[0]._boundingInfo = new BABYLON.BoundingInfo(minimum, maximum);
            meshes[0].computeWorldMatrix(true);
            // scaling bounding box end
            shadowGenerator.getShadowMap().renderList.push(meshes[0]);
            for (var i = 1; i < meshes.length; i++) {
                shadowGenerator.getShadowMap().renderList.push(meshes[i]);
                meshes[i].parent = meshes[0];
            }
            meshes[0].position = new BABYLON.Vector3(startPosition.x, startPosition.y, startPosition.z);
            meshes[0].scaling.y = .8;
            meshes[0].turret = meshes[2];
            meshes[0].turret.rotation.y = 0;
            meshes[0].physicsImpostor = new BABYLON.PhysicsImpostor(meshes[0], BABYLON.PhysicsImpostor.BoxImpostor, { mass: 5, restitution: 0 }, scene);
            tppCamera.lockedTarget = meshes[0];
            var cannonSound = new BABYLON.Sound("cannon_sound", "../assets/sounds/cannon.mp3", scene, null, { loop: false, autoplay: false, spatialSound: true, maxDistance: 50, volume: 1 });
            var idleSound = new BABYLON.Sound("cannon_sound", "../assets/sounds/idle.mp3", scene, null, { loop: true, autoplay: false, spatialSound: true, maxDistance: 20 });
            var runSound = new BABYLON.Sound("cannon_sound", "../assets/sounds/run.mp3", scene, null, { loop: true, autoplay: false, spatialSound: true, maxDistance: 25 });
            var blastSound = new BABYLON.Sound("cannon_sound", "../assets/sounds/blast.mp3", scene, null, { loop: false, autoplay: false, spatialSound: true, maxDistance: 70 });
            cannonSound.attachToMesh(meshes[0]);
            idleSound.attachToMesh(meshes[0]);
            runSound.attachToMesh(meshes[0]);
            blastSound.attachToMesh(meshes[0]);
            loaded = true;
            meshes[0].id = peerId;
            meshes[0].cannonSound = cannonSound;
            meshes[0].idleSound = idleSound;
            meshes[0].runSound = runSound;
            meshes[0].blastSound = blastSound;
            meshes[0].idleSound.play();

            resolve(meshes[0]);
        });
    });
}

function createEnemyTank(enemyId) {
    BABYLON.SceneLoader.ImportMesh("", "../assets/tanks/German/", "German.babylon", scene, function (meshes) {
        // scaling bounding box
        var minimum = meshes[0].getBoundingInfo().boundingBox.minimum.clone();
        var maximum = meshes[0].getBoundingInfo().boundingBox.maximum.clone();
        var scaling = BABYLON.Matrix.Scaling(1, 0.75, 1);
        minimum = BABYLON.Vector3.TransformCoordinates(minimum, scaling);
        maximum = BABYLON.Vector3.TransformCoordinates(maximum, scaling);
        meshes[0]._boundingInfo = new BABYLON.BoundingInfo(minimum, maximum);
        meshes[0].computeWorldMatrix(true);
        // scaling bounding box end
        shadowGenerator.getShadowMap().renderList.push(meshes[0]);
        for (var i = 1; i < meshes.length; i++) {
            shadowGenerator.getShadowMap().renderList.push(meshes[i]);
            meshes[i].parent = meshes[0];
        }
        meshes[0].position = new BABYLON.Vector3(getRandomInRange(-250, 250), -10, getRandomInRange(-250, 250));
        meshes[0].scaling.y = .8;
        meshes[0].turret = meshes[2];
        meshes[0].physicsImpostor = new BABYLON.PhysicsImpostor(meshes[0], BABYLON.PhysicsImpostor.BoxImpostor, { mass: 5, restitution: 0 }, scene);
        shadowGenerator.getShadowMap().renderList.push(meshes[0]);
        var cannonSound = new BABYLON.Sound("cannon_sound", "../assets/sounds/cannon.mp3", scene, null, { loop: false, autoplay: false, spatialSound: true, maxDistance: 50 });
        var idleSound = new BABYLON.Sound("cannon_sound", "../assets/sounds/idle.mp3", scene, null, { loop: true, autoplay: false, spatialSound: true, maxDistance: 20 });
        var runSound = new BABYLON.Sound("cannon_sound", "../assets/sounds/run.mp3", scene, null, { loop: true, autoplay: false, spatialSound: true, maxDistance: 25 });
        var blastSound = new BABYLON.Sound("cannon_sound", "../assets/sounds/blast.mp3", scene, null, { loop: false, autoplay: false, spatialSound: true, maxDistance: 70 });
        cannonSound.attachToMesh(meshes[0]);
        idleSound.attachToMesh(meshes[0]);
        runSound.attachToMesh(meshes[0]);
        blastSound.attachToMesh(meshes[0]);
        meshes[0].id = enemyId;
        meshes[0].cannonSound = cannonSound;
        meshes[0].idleSound = idleSound;
        meshes[0].runSound = runSound;
        meshes[0].blastSound = blastSound;
        meshes[0].runSound.play();
        enemies[enemyId] = meshes[0];
    });
}

function showPlasma(tank) {
    var particleSystem = new BABYLON.ParticleSystem("particles", 2000, scene);

    particleSystem.particleTexture = new BABYLON.Texture("../assets/textures/fire/fire.jpg", scene);
    particleSystem.emitter = tank.turret;
    particleSystem.minEmitBox = new BABYLON.Vector3(0, 2.2, 6.3);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0, 2.2, 6.4);
    particleSystem.color1 = new BABYLON.Color4(0.7, 0.8, 1.0, 1.0);
    particleSystem.color2 = new BABYLON.Color4(0.2, 0.5, 1.0, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 1.0);
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.2;
    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 1;
    particleSystem.emitRate = 7000;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    particleSystem.gravity = new BABYLON.Vector3(0, 0, 0);
    particleSystem.direction1 = new BABYLON.Vector3(-0.005, 0.005, 0.05);
    particleSystem.direction2 = new BABYLON.Vector3(0.005, -0.005, 0.05);
    particleSystem.minAngularSpeed = 0;
    particleSystem.maxAngularSpeed = Math.PI;
    particleSystem.minEmitPower = 20;
    particleSystem.maxEmitPower = 50;
    particleSystem.updateSpeed = 0.1;
    particleSystem.targetStopDuration = 0.4;
    particleSystem.disposeOnStop = true;
    particleSystem.start();
}

function showBlast(blastOrigin)
{
    var particleSystem = new BABYLON.ParticleSystem("particles", 2000, scene);
    particleSystem.particleTexture = new BABYLON.Texture("../assets/textures/flare/flare.png", scene);
    particleSystem.emitter = blastOrigin;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.3, -0.3, -0.3);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.3, 0.3, 0.3);
    particleSystem.color1 = new BABYLON.Color4(0.953, 0.503, 0, 1.0);
    particleSystem.color2 = new BABYLON.Color4(1, 0.66, 0.113, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 1.0);
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.2;
    particleSystem.minLifeTime = 3;
    particleSystem.maxLifeTime = 5;
    particleSystem.emitRate = 6000;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    particleSystem.gravity = new BABYLON.Vector3(0, -0.2, 0);
    particleSystem.direction1 = new BABYLON.Vector3(-0.05, -0.05, -0.05);
    particleSystem.direction2 = new BABYLON.Vector3(0.05, 0.05, 0.05);
    particleSystem.minAngularSpeed = 0;
    particleSystem.maxAngularSpeed = Math.PI;
    particleSystem.minEmitPower = 20;
    particleSystem.maxEmitPower = 26;
    particleSystem.updateSpeed = 0.05;
    particleSystem.targetStopDuration = 1;
    particleSystem.disposeOnStop = true;
    particleSystem.start();
}

function getRandomInRange(min, max){
    return Math.random() * (max - min) + min;
}

function enemyUpdate(id, position, rotation, turretRotation) {
    if (enemies[id]) {
        enemies[id].position = new BABYLON.Vector3(position.x, position.y, position.z);
        enemies[id].rotationQuaternion = new BABYLON.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
        enemies[id].turret.rotation = new BABYLON.Vector3(turretRotation.x, turretRotation.y, turretRotation.z);
    }
}

function enemyFire(id) {
    if (enemies[id]) fireBullet(enemies[id]);
}

function fireBullet(tank) {
    var bullet = BABYLON.MeshBuilder.CreateBox('bullet' + getRandomInRange(0, 1000), { height: 0.1, width: 0.1, depth: 1 }, scene);
    bullet.position = new BABYLON.Vector3(tank.position.x, tank.position.y + 1.75, tank.position.z);
    bullet.rotationQuaternion = new BABYLON.Quaternion(tank.turret.absoluteRotationQuaternion.x, tank.turret.absoluteRotationQuaternion.y, tank.turret.absoluteRotationQuaternion.z, tank.turret.absoluteRotationQuaternion.w);
    bullet.translate(BABYLON.Axis.Z, 6.5, BABYLON.Space.LOCAL);
    bullet.isVisible = true;
    showPlasma(tank);
    bullet.material = bulletMaterial;
    bullet.id = tank.id;
    bullet.physicsImpostor = new BABYLON.PhysicsImpostor(bullet, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0.01, restitution: 0 }, scene);
    var collidingImpostors = [];
    for (var enemy of Object.keys(enemies)) {
        collidingImpostors.push(enemies[enemy].physicsImpostor);
    }
    collidingImpostors.push(player.physicsImpostor);
    collidingImpostors.push(ground.physicsImpostor);
    bullet.physicsImpostor.registerOnPhysicsCollide(collidingImpostors, (collider, collidedAgainst) => {
        bullet.physicsImpostor.sleep();
        var blastOrigin = bullet.position;
        bullet.bulletWhistle.pause();
        bullet.bulletWhistle.dispose();
        bullet.dispose();
        var blastSound = new BABYLON.Sound("cannon_sound", "../assets/sounds/blast.mp3", scene, () => {
            blastSound.setPosition(new BABYLON.Vector3(blastOrigin.x, blastOrigin.y, blastOrigin.z));
            blastSound.onended = () => {
                blastSound.dispose();
            }
            blastSound.play();
        }, { loop: false, autoplay: true, spatialSound: true, maxDistance: 70 });
        showBlast(blastOrigin);
        if (collidedAgainst.object.id != 'ground') collidedAgainst.object.physicsImpostor.applyImpulse(collider.object.getDirection(new BABYLON.Vector3(0, 0, 1)).normalize().scale(8), blastOrigin);
        if (collidedAgainst.object.id == peerId) {
            // bullet hit on player
            health -= bulletDamage;
            healthBar.value = health;
            if (health <= 75) healthBar.color = 'white';
            if (health <= 25) healthBar.color = 'red';
            socket.emit('points', {
                playerUID: firebase.auth().currentUser.uid,
                enemyUID: peerIdToUser[collider.object.id].uid,
                points: bulletDamage,
                kill: (health <= 0)
            });
            for (var enemyPeer of enemyPeers) {
                enemyPeer.send({
                    topic: 'points',
                    from: collider.object.id,
                    to: peerId,
                    kill: (health <= 0)
                });
            }
            updatePlayerDetail(collider.object.id, peerId, (health <= 0));
            if (health <= 0) {
                showMatchEnd(false);
            }
        }
    });
    bullet.registerBeforeRender(function (mesh) {
        if (mesh.position.x > 300 || mesh.position.x < -300 || mesh.position.z > 300 || mesh.position.z < -300) {
            mesh.physicsImpostor.mass = 0;
            mesh.physicsImpostor.sleep();
            mesh.dispose();
        }
    });
    var bulletWhistle = new BABYLON.Sound("cannon_sound", "../assets/sounds/bulletWhistle.mp3", scene, null, { loop: true, autoplay: true, spatialSound: true, maxDistance: 8 });
    bulletWhistle.volume = .9;
    bulletWhistle.attachToMesh(bullet);
    bullet.bulletWhistle = bulletWhistle;
    bullet.physicsImpostor.applyImpulse(bullet.getDirection(new BABYLON.Vector3(0, 0, 1)).normalize().scale(1.2), bullet.getAbsolutePosition());
    var pointLight = new BABYLON.PointLight("pointLight" + getRandomInRange(0, 1000), new BABYLON.Vector3(0, 0, 0), scene);
    pointLight.intensity = 3;
    pointLight.range = 20;
    pointLight.parent = bullet;
    pointLight.setEnabled(true);
    tank.cannonSound.play();
}

function showFire(tank) {
    var smokeSystem = new BABYLON.ParticleSystem("particles", 1000, scene);
	smokeSystem.particleTexture = new BABYLON.Texture("../assets/textures/flare/flare.png", scene);
	smokeSystem.emitter = new BABYLON.Vector3(tank.position.x, tank.position.y, tank.position.z);
    smokeSystem.minEmitBox = new BABYLON.Vector3(-1, 1, -1); // Starting all from
    smokeSystem.maxEmitBox = new BABYLON.Vector3(1, 1, 1); // To...
	smokeSystem.color1 = new BABYLON.Color4(0.02, 0.02, 0.02, .02);
    smokeSystem.color2 = new BABYLON.Color4(0.02, 0.02, 0.02, .02);
    smokeSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
	smokeSystem.minSize = 1;
    smokeSystem.maxSize = 3;
    smokeSystem.minLifeTime = 0.3;
    smokeSystem.maxLifeTime = 1.5;
    smokeSystem.emitRate = 350;
    smokeSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    smokeSystem.gravity = new BABYLON.Vector3(0, 0, 0);
    smokeSystem.direction1 = new BABYLON.Vector3(-1.5, 8, -1.5);
    smokeSystem.direction2 = new BABYLON.Vector3(1.5, 8, 1.5);
    smokeSystem.minAngularSpeed = 0;
	smokeSystem.maxAngularSpeed = Math.PI;
    smokeSystem.minEmitPower = 0.5;
    smokeSystem.maxEmitPower = 1.5;
    smokeSystem.updateSpeed = 0.005;
    smokeSystem.start();

    var fireSystem = new BABYLON.ParticleSystem("particles", 2000, scene);
    fireSystem.particleTexture = new BABYLON.Texture("../assets/textures/flare/flare.png", scene);
    fireSystem.emitter = new BABYLON.Vector3(tank.position.x, tank.position.y, tank.position.z);
    fireSystem.minEmitBox = new BABYLON.Vector3(-1, 1, -1); // Starting all from
    fireSystem.maxEmitBox = new BABYLON.Vector3(1, 1, 1); // To...
    fireSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1.0);
    fireSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1.0);
    fireSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
    fireSystem.minSize = 0.3;
    fireSystem.maxSize = 1;
    fireSystem.minLifeTime = 0.2;
    fireSystem.maxLifeTime = 0.4;
    fireSystem.emitRate = 600;
    fireSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE
    fireSystem.gravity = new BABYLON.Vector3(0, 0, 0);
    fireSystem.direction1 = new BABYLON.Vector3(0, 4, 0);
    fireSystem.direction2 = new BABYLON.Vector3(0, 4, 0);
    fireSystem.minAngularSpeed = 0;
    fireSystem.maxAngularSpeed = Math.PI;
    fireSystem.minEmitPower = 1;
    fireSystem.maxEmitPower = 3;
    fireSystem.updateSpeed = 0.007;
    fireSystem.start();
}

function updatePlayerDetail(from, to, kill) {
    if (from == peerId) {
        matchStats.points += bulletDamage;
        if (kill) matchStats.kills += 1;
    }
    var killFeedControl = createKillFeed((from == peerId) ? firebase.auth().currentUser.displayName.split(' ')[0] : peerIdToUser[from].name, (to == peerId) ? firebase.auth().currentUser.displayName.split(' ')[0] : peerIdToUser[to].name, kill);
    if (killFeed.length == 5) {
        var control = killFeed.shift();
        killFeedStack.removeControl(control);
        control.dispose();
    }
    killFeed.push(killFeedControl);
    killFeedStack.addControl(killFeedControl);

    if (typeof(kill) == 'undefined') return;
    if (kill && (to != peerId)) {
        enemies[to].physicsImpostor.sleep();
        enemies[to].physicsImpostor.mass = 0;
        showFire(enemies[to]);
        if (from == peerId) showKill('You killed ' + peerIdToUser[to].name);
        if (typeof(enemyPeers[enemyPeerIds.indexOf(enemies[to].id)]) != 'undefined') {
            enemyPeers[enemyPeerIds.indexOf(enemies[to].id)].close();
            enemyPeers.splice(enemyPeerIds.indexOf(enemies[to].id), 1);
            enemyPeerIds.splice(enemyPeerIds.indexOf(enemies[to].id), 1);
        }
    }
    if (kill && (to == peerId)) {
        showKill('You were killed by ' + peerIdToUser[from].name);
    }
    if (enemyPeers.length == 0) {
        showMatchEnd(true);
    }
}

function createKillFeed(fromName, toName, kill) {
    var hozPanel = new BABYLON.GUI.StackPanel();
    hozPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    hozPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    hozPanel.isVertical = false;
    hozPanel.height = '24px';

    var fromText = new BABYLON.GUI.TextBlock();
    fromText.text = fromName;
    fromText.width = '100px'
    fromText.color = "white";
    fromText.fontFamily = 'Isocpeur';
    hozPanel.addControl(fromText);

    var image;
    if (kill) {
        image = new BABYLON.GUI.Image("killIcon" + Math.floor(getRandomInRange(0, 1000)), "../assets/img/skull.png");
    } else {
        image = new BABYLON.GUI.Image("killIcon" + Math.floor(getRandomInRange(0, 1000)), "../assets/img/bullet.png");
    }
    image.width = '24px';
    image.height = '24px';
    hozPanel.addControl(image);

    var toText = new BABYLON.GUI.TextBlock();
    toText.text = toName;
    toText.width = '100px'
    toText.color = "white";
    toText.fontFamily = 'Isocpeur';
    hozPanel.addControl(toText);

    return hozPanel;
}

function showKill(text) {
    killText.text = text;
    if (showKillTimeout != null) {
        clearTimeout(showKillTimeout);
    }
    showKillTimeout = setTimeout(() => {
        killText.text = '';
    }, 5000);
}

function showMatchEnd(win) {
    player.physicsImpostor.sleep();
    player.physicsImpostor.mass = 0;
    if (!win) {
        showFire(player);
        if (player.idleSound.isPlaying) player.idleSound.pause();
        if (player.runSound.isPlaying) player.runSound.pause();
    }
    arcRotateCam = new BABYLON.ArcRotateCamera("arcRotate", 0, 0, 10, new BABYLON.Vector3(player.position.x, player.position.y, player.position.z), scene);
    arcRotateCam.setPosition(new BABYLON.Vector3(tppCamera.position.x, tppCamera.position.y, tppCamera.position.z));
    rotateCamera = true;
    scene.activeCamera = arcRotateCam;
    sightImage.isVisible = false;

    loaded = false;
    enemyPeers = [];
    enemyPeerIds = [];
    noOfConnections = 0;
    var uids = [];
    for (var user of Object.values(peerIdToUser)) {
        uids.push(user.uid);
    }
    uids.push(firebase.auth().currentUser.uid);
    peerIdToUser = {};

    document.getElementById('transparentCover').style.opacity = '.35';
    document.getElementById('transparentCover').style.pointerEvents = 'all';
    document.getElementById('matchEndContainer').style.opacity = '1';
    document.getElementById('matchEndContainer').style.pointerEvents = 'all';
    document.getElementById('winloseTitle').innerHTML = (win) ? 'Win' : 'Lost';
    document.getElementById('pointsValue').innerHTML = matchStats.points;
    document.getElementById('killsValue').innerHTML = matchStats.kills;
    lobbyDeadline = new Date((new Date()).getTime() + 30000);
    if (win) {
        socket.emit('matchEnd', {
            winner: firebase.auth().currentUser.uid,
            roomId: peerId.split('_')[1],
            uids: uids
        });
    }
    lobbyTimerID = setInterval(() => {
        var diff = lobbyDeadline - (new Date()).getTime();
        if (diff < 0) {
            clearInterval(lobbyTimerID);
            if (player.idleSound.isPlaying) player.idleSound.pause();
            if (player.runSound.isPlaying) player.runSound.pause();
            peer.destroy();
            scene.dispose();
            showScreen('lobby');
            return;
        }
        document.getElementById('timerContainer').innerHTML = (Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))) + ':' + (Math.floor((diff % (1000 * 60)) / 1000));
    }, 1000);
}