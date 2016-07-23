/**
 *  Logic for a game inspired by 'Duck Hunt'
 *  that hinges on an in-office joke.
 *
 *  @author  mod_ave
 *  @version 0.6
 */

/* Game objects. */

// Delegate features.
var isMobile;

// The HTML canvas element.
var canvas;
// The Easel element constructed of the canvas.
var stage;

// Splash screen graphic.
var splash;
// Loading screen progress text.
var progress;

// Background graphical asset.
var background;
// Foreground graphical asset.
var foreground;
// Gun graphical asset.
var gun;
// Progress graphical asset.
var progress;

// Progress text asset.
var progressText;
// Start game button.
var startGame;

// Bullet animation for prefab.
var bulletAnim;

// Lojko animation for prefab.
var lojkoAnim;

/* Useful constants and globals. */

// Used to preload assets.
var LOAD_MANIFEST = [
    {src: "img/play-button.png", id: "play-button"},
    {src: "img/background-1.png", id: "background-1"},
    {src: "img/background-2.png", id: "background-2"},
    {src: "img/foreground-1.png", id: "foreground-1"},
    {src: "img/foreground-2.png", id: "foreground-2"},
    {src: "img/spritesheet-lojko.png", id: "spritesheet-lojko"},
    {src: "img/spritesheet-gun.png", id: "spritesheet-gun"},
    {src: "img/spritesheet-bullet.png", id: "spritesheet-bullet"},
    {src: "img/spritesheet-progress.png", id: "spritesheet-progress"},
    {src: "img/retry-button.png", id: "retry-button"},
    {src: "img/fail-screen.png", id: "fail-screen"},
    {src: "snd/danger.wav", id: "danger"},
    {src: "snd/fail.wav", id: "fail"},
    {src: "snd/hit.wav", id: "hit"},
    {src: "snd/reload.wav", id: "reload"},
    {src: "snd/score.wav", id: "score"},
    {src: "snd/start.wav", id: "start"},
    {src: "snd/lojkohit.wav", id: "lojkohit"},
    {src: "snd/runaway.wav", id: "runaway"},
    {src: "snd/visager.mp3", id: "mainloop"}
];
var loader;

// Control whether the user can shoot.
var canShoot;

// Track user progress.
var playerProgress = 10;
var numHit = 0;
var numLojkos;
// Deduplicate requests to change progress.
var progressLock = false;

// Keep a track of player score.
var playerScore;
var SCORE_INCREMENT = 100;

// Keep track of failure state.
var hasFailed = false;

// Set the wait time before respawning Lojko.
var MIN_WAIT = 750;
var MAX_WAIT = 3500;

// Control how fast he is allowed to go.
var MIN_SPEED = 6000;
var MAX_SPEED = 1500;

/**
 *  Initialise loading game objects
 *  and introductory splash screen.
 */
function init() {
    
    // Check to see if the user is on mobile.
    if (createjs.BrowserDetect.isIOS || createjs.BrowserDetect.isAndroid || createjs.BrowserDetect.isBlackberry) {
        isMobile = true;
	}
    
    // Get the canvas.
    canvas = document.getElementById("game");
    // Instantiate the stage.
    stage = new createjs.Stage(canvas);
    
    // Display loading screen splash image.
    splash = new Image();
    splash.src = "img/splash-screen.png";
    // splash.x = splash.y = 0;
    splash.onload = function(event) {
        splash = new createjs.Bitmap(splash);
        stage.addChild(splash);
        stage.update(); 
    };
    
    // Display loading screen text.
    progressText = new createjs.Text("Loading: 0%", "bold 60px Arial", "#FFFFFF");
    progressText.textAlign = "center";
    progressText.textBaseline = "middle";
    progressText.x = 1380;
    progressText.y = 780;
    stage.addChild(progressText);
    stage.update();
    
    loader = new createjs.LoadQueue(false);
    if(!isMobile) {
        loader.installPlugin(createjs.Sound);
        createjs.Sound.alternateExtensions = ["wav"];
    }
    
    loader.addEventListener("progress", onLoadProgess);
    loader.addEventListener("complete", onLoadFinish);
    
    loader.loadManifest(LOAD_MANIFEST);
    
}

/**
 *  Update load progress visual.
 */
function onLoadProgess() {
    
    // Log loading to console.
    progressText.text = "Loading: " + (loader.progress * 100 | 0) + "%";
    
    // Refresh the canvas.
    stage.update();
    
}

/**
 *  Allow the user to start
 *  the game.
 */
function onLoadFinish() {
    
    // Log finished loading to console.
    console.log("Finished loading.");
    
    // Add button to start game.
    startGame = new createjs.Bitmap(loader.getResult("play-button"));
    startGame.x = 1053;
    startGame.y = 649;
    stage.addChild(startGame);
    stage.update(); 
    
    startGame.on("click", function(event) {
        if(!isMobile) {
            createjs.Sound.play("start");
        }
        // Start game timer.
        createjs.Ticker.on("tick", tick);
        watchRestart();
    });
    
}

/**
 *  Fires when player starts
 *  game; initialises main
 *  game loop.
 */
function watchRestart() {
    
    // Remove loading objects.
    stage.removeAllChildren();
    
    /* Load stage objects. */
    
    // Background.
    var backgroundAnim = new createjs.SpriteSheet({
       "images": [loader.getResult("background-1"), loader.getResult("background-2")],
        "frames": [
            [0, 0, 1920, 1080, 0, 0, 0],
            [0, 0, 1920, 1080, 1, 0, 0]
        ],
        "animations": {
            "idle" : [0, 1]
        },
        framerate: .50
    });
    background = new createjs.Sprite(backgroundAnim, "idle");
    stage.addChild(background);
    
    // Lojko.
    lojkoAnim = new createjs.SpriteSheet({
       "images": [loader.getResult("spritesheet-lojko")],
        "frames": {width: 384, height: 708},
        "animations": {
            "run" : [0, 3],
            "hit" : [4, 4, "run", 0.5]
        },
        framerate: 2.5
    });
    createjs.SpriteSheetUtils.addFlippedFrames(lojkoAnim, true, false, false);
    
    // Foreground.
    var foregroundAnim = new createjs.SpriteSheet({
       "images": [loader.getResult("foreground-1"), loader.getResult("foreground-2")],
        "frames": [
            [0, 0, 1920, 1080, 0, 0, 0],
            [0, 0, 1920, 1080, 1, 0, 0]
        ],
        "animations": {
            "idle" : [0, 1]
        },
        framerate: .20
    });
    foreground = new createjs.Sprite(foregroundAnim, "idle");
    stage.addChild(foreground);
    
    // Progress.
    var progressAnim = new createjs.SpriteSheet({
       "images": [loader.getResult("spritesheet-progress")],
        "frames": {width: 504, height: 204, count: 10},
        "animations": {
            "10" : 0,
            "9" : 1,
            "8" : 2,
            "7" : 3,
            "6" : 4,
            "5" : 5,
            "4" : 6,
            "3" : 7,
            "2" : 8,
            "1" : 9,
            "0" : 10
        },
        framerate: 0.40
    });
    progress = new createjs.Sprite(progressAnim, "10");
    progress.x = (stage.canvas.width / 2) - (progress.getBounds().width / 2);
    progress.y = stage.canvas.height - (progress.getBounds().height * 1.18);
    stage.addChild(progress);
    
    // Gun.
    var gunAnim = new createjs.SpriteSheet({
       "images": [loader.getResult("spritesheet-gun")],
        "frames": {width: 192, height: 564},
        "animations": {
            "aim": 0,
            "reload" : [1, 3, "aim"]
        },
        framerate: 1.65
    });
    gun = new createjs.Sprite(gunAnim, "aim");
    stage.addChild(gun);
    
    // Bullet.
    bulletAnim = new createjs.SpriteSheet({
       "images": [loader.getResult("spritesheet-bullet")],
        "frames": {width: 48, height: 108},
        "animations": {
            "collide" : [1, 3]
        },
        framerate: 2
    });
    
    // Restart (begin) the game.
    restart();
    
}

/**
 *  Reset game loop to
 *  try playing again.
 */
function restart() {
    
    // Reset scores.
    playerScore = 0;
    playerProgress = 10;
    numHit = 0;
    numLojkos = 0;
    hasFailed = false;
    
    // Position the cursor correctly.
    aim({
        "stageX" : stage.mouseX,
        "stageY" : stage.mouseY
    });
    
    // Hide the cursor.
    stage.canvas.style.cursor = "none";
    
    // Play music.
    if(!isMobile) {
        createjs.Sound.play("mainloop", {interrupt: createjs.Sound.INTERRUPT_NONE, loop: -1, volume: 0.3});
    }
        
    // Add listener to track gun sprite.
    stage.on("stagemousemove", aim);
    // Add listener to track shot.
    stage.on("stagemousedown", shoot);
    // Add listener to track reload.
    gun.on("animationend", gunTrigger);
    // Add listener for user progress.
    progress.on("change", updateProgress);
    progress.on("animationend", fail);
    
    // Allow user to shoot.
    canShoot = true;
    
    // Add a Lojko.
    spawnLojko();
    
}

/**
 *  Update the game's display
 *  based on events.
 */
function tick(event) {
    
    // Update the stage.
    stage.update(event);
    
}

/**
 *  Update the player's aim.
 */
function aim(event) {
    
    // Move the player's gun to match the cursor.
    gun.x = event.stageX - gun.getBounds().width / 2;
    gun.y = event.stageY - gun.getBounds().height / 15;
    
}

/**
 *  Play gun shooting and reloading animations.
 */
function shoot(event) {
    
    // Prevent redundant clicks...
    if(canShoot) {
        
        // Lock this action.
        canShoot = false;
        
        // Get the X and Y of the mouse (in case it moves).
        var localMouseX = stage.mouseX;
        var localMouseY = stage.mouseY;
        
        // Check for actual hit.
        for(let e of stage.getObjectsUnderPoint(localMouseX, localMouseY)) {
            
            if(e.name == "lojko" && !wasBulletBlocked(localMouseX, localMouseY)) {

                if(!isMobile) {
                    createjs.Sound.play("lojkohit");
                }
                
                // Increment Lojko's hit.
                numHit++;
                
                // Stop movement.
                createjs.Tween.removeTweens(e);
                // Play hit animation.
                if(Math.random() > 0.5) {
                    e.gotoAndPlay("hit");
                }
                else {
                    e.gotoAndPlay("hit_h");
                }
            }
        }
        
        // Create a bullet drop.
        spawnBullet(localMouseX, localMouseY);
        
        // Play the reload animation.
        gun.gotoAndPlay("reload");
        
        // Play the shoot/reload sound effect.
        if(!isMobile) {
            createjs.Sound.play("reload");
        }
            
    }
    
}

/**
 *  Control whether the player is allowed to
 *  shoot at the given time.
 */
function gunTrigger(event) {
    
    if(event.name == "reload") {
        
        // Unlock shoot action.
        canShoot = true;
        
    }
    
}

/**
 *  Spawn a bullet prefab at the
 *  specified point.
 */
function spawnBullet(x, y) {
    
    if(!isMobile) {
        createjs.Sound.play("hit");
    }
    
    // Create a new sprite from the animation sheet.
    var bullet = new createjs.Sprite(bulletAnim, "collide");
    bullet.x = x - 10;
    bullet. y = y - 30;
    stage.addChildAt(bullet, 2);
    bullet.on("animationend", function(event) {
        stage.removeChild(bullet);
    })
    
}

/**
 *  Prefabricator for game objects using
 *  the 'Lojko' spritesheet.
 */
function spawnLojko() {
    
    // Wait a certain amount of time.
    setTimeout(function(){

        // Only if we haven't failed.
        if(!hasFailed) {
        
            console.log("spawning a loj");
            numLojkos++;
            
            // Create a new sprite from the animation sheet.
            var lojko = new createjs.Sprite(lojkoAnim, "run");
            // Object's movement.
            var tween;

            /* Directions. */

            // Set the LHS bound.
            var leftOOB = 0 - (lojko.getBounds().width);
            // Set the RHS bound.
            var rightOOB = stage.canvas.width + lojko.getBounds().width;

            // Give the sprite a name.
            lojko.name = "lojko";

            // Set speed.
            var speed = getRandomInt(MIN_SPEED, MAX_SPEED);

            // Set a random starting position and fire.
            lojko.y = 170;
            if(Math.random() > 0.5) { 
                // Store that we were moving right.
                var movingRight = true;
                // LHS.
                lojko.x  = 0 - (lojko.getBounds().width);
                // Begin movement.
                tween = createjs.Tween.get(lojko, {override:true})
                    .to({x: rightOOB}, speed, createjs.Ease.linear)
                    .call(despawnLojko);
            }
            else {
                // Store that we weren't moving right.
                var movingRight = false;
                // RHS.
                lojko.x = stage.canvas.width + lojko.getBounds().width;
                // Flip the animation.
                lojko.gotoAndPlay("run_h");
                // Begin movement.
                tween = createjs.Tween.get(lojko, {override:true})
                    .to({x: leftOOB}, speed, createjs.Ease.linear)
                    .call(despawnLojko);
            }

            // Add listener for being hit.
            lojko.on("animationend", function(event) {

                // If lojko has just been hit...
                if(event.name == "hit" || event.name == "hit_h") {
                    
                    // Decide which side to run to.
                    var runX;

                    // If he is closer to left hand side...
                    if(lojko.x < stage.canvas.width / 2) {
                        lojko.gotoAndPlay("run_h");
                        runX = leftOOB;
                    }
                    else {
                        lojko.gotoAndPlay("run");
                        runX = rightOOB;
                    }
                    
                    if(!isMobile) {
                        createjs.Sound.play("runaway");
                    }
                    
                    // Begin movement.
                    createjs.Tween.get(lojko, {override:true})
                        .to({x: runX}, 650, createjs.Ease.linear)
                        .call(despawnLojko);

                    // Update player score.
                    incrementProgress();

                }

            });

            stage.addChildAt(lojko, 1);
            
        }

    }, getRandomInt(MIN_WAIT, MAX_WAIT));   
    
}

/**
 *  Remove 'Lojko' game object
 *  from the stage and clean-up.
 */
function despawnLojko(tween) {
    
    // Remove the object.
    stage.removeChild(tween._target);
    
    // Spawn a new one.
    spawnLojko();
    
    // Low odds of ramping difficulty.
    if(Math.random() > 0.90) {
        if(numLojkos < 5) {
            spawnLojko();   
        }
        // Also make the game a bit harder.
        if(!(progress.spriteSheet.framerate > 75)) {
            progress.spriteSheet.framerate = progress.spriteSheet.framerate + 0.10;   
        }
        else {
            // If the game is at its hardest, make reloading a bit quicker.
            gun.spriteSheet.framerate = gun.spriteSheet.framerate + 0.5;
        }
    }
    else if(numHit > 6 && numLojkos < 5) {
        spawnLojko();
        // Also make the game a bit harder.
        if(!(progress.spriteSheet.framerate > 75)) {
            progress.spriteSheet.framerate = progress.spriteSheet.framerate + 0.10;   
        }
    }
    
}

/**
 *  Check whether the bullet was blocked.
 */
function wasBulletBlocked(x, y) {
    return foreground.hitTest(x, y);
}

/**
 *  Update the current player 'health'
 *  equivalent to track their progress
 *  and determine if they have lost.
 */
function updateProgress(event) {
    
    if(progressLock) {
        progressLock = false;
    }
    else {
        // Update the player progress.
        switch(event.target.currentFrame) {
            case 0:
                playerProgress = 10;
                break;
            case 1:
                playerProgress = 9;
                break;
            case 2:
                playerProgress = 8;
                break;
            case 3:
                playerProgress = 7;
                break;
            case 4:
                playerProgress = 6;
                break;
            case 5:
                playerProgress = 5;
                break;
            case 6:
                playerProgress = 4;
                break;
            case 7:
                playerProgress = 3;
                break;
            case 8:
                playerProgress = 2;
                break;
            case 9:
                playerProgress = 1;
                break;
        }
    }
    
    if(playerProgress == 3 && !isMobile) {
        createjs.Sound.play("danger");
    }
    
}

/**
 *  Replenish some of the progress bar.
 */
function incrementProgress() {
    
    // Round up to nearest thousand.
    var nextThousand = Math.ceil(playerScore/1000)*1000;
    
    // Replenish the progress bar.
    if(playerProgress > 8) {
        playerProgress = 10; 
    }
    else {
        playerProgress++;
    }
    
    progressLock = true;
    progress.gotoAndPlay(10 - playerProgress);
    
    // Add to user score.
    playerScore = playerScore + SCORE_INCREMENT;
    
    if(playerScore >= nextThousand && !isMobile) {
        createjs.Sound.play("score");
    }
    
}

/**
 *  Handle the player failing
 *  the game by removing listeners
 *  and moving to a fail screen.
 */
function fail() {
    
    // Lock asynchronous background operations.
    hasFailed = true;
    
    if(!isMobile) {
        createjs.Sound.stop();
        createjs.Sound.play("fail");
    }
    
    stage.canvas.style.cursor = "default";
    
    // Remove from stage.
    stage.removeAllChildren();
    
    // Add the new background.
    var failScreen = new createjs.Bitmap(loader.getResult("fail-screen"));
    stage.addChild(failScreen);
    stage.update(); 
    
    // Add the new score.
    var finalScoreField = new createjs.Text("Final Score: " + playerScore, "bold 60px Arial", "#3a8944");
    finalScoreField.maxWidth = 1000;
	finalScoreField.textAlign = "center";
	finalScoreField.textBaseline = "middle";
	finalScoreField.x = 585;
	finalScoreField.y = 705;
	stage.addChild(finalScoreField);
    
    // Add the retry button.
    var retryButton = new createjs.Bitmap(loader.getResult("retry-button"));
    retryButton.x = 1180;
    retryButton.y = 850;
    stage.addChild(retryButton);
    retryButton.on("click", watchRestart);
    
    stage.update();
    
}

/**
 *  Returns a random integer between min (inclusive) and max (inclusive).
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}