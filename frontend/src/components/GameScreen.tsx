import skyBackground from '../assets/sky_background.png';
import mountainLayer1 from '../assets/mountain_layer_1.png';
import mountainLayer2 from '../assets/mountain_layer_2.png';
import mountainLayer3 from '../assets/mountain_layer_3.png';
import retroMusic from '../assets/retro_music.mp3'; // Import the music file
import coinCollectSound from '../assets/coin_collect.wav'; // Import coin sound effect
// frontend/src/components/GameScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import SpeedDisplay from './HUD/SpeedDisplay';
import PositionDisplay from './HUD/PositionDisplay';
import PointsDisplay from './HUD/PointsDisplay';
import { Engine, Runner, World, Bodies, Composite, Constraint, Body, Events } from 'matter-js'; // Removed Render
import type { GameState } from '../types/GameState'; // Import GameState
import webRTCService from '../services/WebRTCService'; // Import webRTCService
import useMatterJS from '../hooks/useMatterJS'; // Import the custom hook
import { createBicycle, createCoin, createTrackWalls, createHazards } from '../utils/matterSetup'; // Import setup functions
import RaceEndOverlay from './RaceEndOverlay'; // Import the new overlay component
import { OpponentSyncManager } from '../utils/opponentSync'; // Import the new OpponentSyncManager

// After imports, before GameScreen component
// import { World, Bodies, Body, Engine, Composite } from 'matter-js'; // Ensure these are imported

const createDustPuffSystem = (world: World, basePosition: { x: number, y: number }, count: number, engine: Engine, raceOverFlag: boolean) => {
  if (!world || !engine || raceOverFlag) return;

  for (let i = 0; i < count; i++) {
    const radius = Math.random() * 2 + 1;
    const puff = Bodies.circle(
      basePosition.x - 5 - (Math.random() * 10), // Positioned behind and slightly offset from the wheel
      basePosition.y + Math.random() * 5,     // Slightly above or below the wheel's y-axis center
      radius,
      {
        isSensor: true, // Puffs don't physically interact
        label: 'dustPuff',
        render: {
          fillStyle: '#BABABA', // Greyish color for dust
          opacity: 0.5 + Math.random() * 0.2 // Semi-transparent and variable
        },
        frictionAir: 0.06 // Puffs should slow down and dissipate
      }
    );
    // Apply a small initial velocity away from the wheel
    Body.setVelocity(puff, {
      x: -(Math.random() * 0.8 + 0.3), // Backwards
      y: -(Math.random() * 0.4 + 0.1)  // Slightly upwards
    });
    World.add(world, puff);
    // Remove puff after a short duration
    setTimeout(() => {
      // Check if engine and world still exist and race is not over, to prevent errors on component unmount or race end
      if (engine && engine.world && !raceOverFlag) {
        World.remove(engine.world, puff);
      }
    }, 250 + Math.random() * 150); // Lifespan of 250-400ms
  }
};

interface GameScreenProps {
  opponentId: string | null;
  playerId: string | null;
  onDisconnect: () => void;
  onSendMessage: (message: string) => void;
  lastMessageReceived: string | null;
  onRaceEnd: (winnerName: string, finalPlayerCurrency: number) => void; // New prop
}

const RACE_DURATION_MS = 60000; // 1 minute for the race

// createBicycle and createCoin functions are now imported from ../utils/matterSetup

const GameScreen: React.FC<GameScreenProps> = ({
  opponentId,
  playerId,
  onDisconnect,
  onSendMessage,
  lastMessageReceived,
}) => {
  // --- Core Game State ---
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);
  const [raceOver, setRaceOver] = useState(false);
  const [coins, setCoins] = useState<Body[]>([]); // Array to store coin bodies

  // --- Player State ---
  const [playerCurrency, setPlayerCurrency] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [playerPosition, setPlayerPosition] = useState<1 | 2>(1);

  // --- Opponent State ---
  const [opponentCurrency, setOpponentCurrency] = useState(0);

  // --- UI Interaction State ---
  const [message, setMessage] = useState(''); // For chat input

  // --- Parallax State ---
  const [skyOffset, setSkyOffset] = useState(0);
  const [mountain1Offset, setMountain1Offset] = useState(0);
  const [mountain2Offset, setMountain2Offset] = useState(0);
  const [mountain3Offset, setMountain3Offset] = useState(0);

  // --- Audio State ---
  const [volume, setVolume] = useState(0.5);

  // --- Refs ---
  // Matter.js Core Refs
  const sceneRef = useRef<HTMLDivElement>(null); // For Matter.js canvas
  const bicycleRef = useRef<Composite | null>(null);
  const opponentBicycleRef = useRef<Composite | null>(null);
  // Player Input Refs
  const lastAPressTimeRef = useRef<number>(0);
  const lastDPressTimeRef = useRef<number>(0);
  const targetForceRef = useRef<number>(0);
  const currentAppliedForceRef = useRef<number>(0);
  // Collision/Effect Cooldown Refs
  const lastPotholeCollisionTimeRef = useRef<number>(0);
  const lastOilSlickCollisionTimeRef = useRef<number>(0);
  const collectedCoinIdsRef = useRef<Set<number>>(new Set());
  // Opponent Sync Refs
  const opponentSyncManagerRef = useRef(new OpponentSyncManager()); // Instantiate the manager
  const opponentVisualStateRef = useRef<{ position: { x: number, y: number }, angle: number, wheelSpeed: number } | null>(null);
  // Audio Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // UI/Animation Refs
  const parallaxIntervalRef = useRef<number | null>(null);


  // --- Constants ---
  const COIN_VALUE = 10;
  const FORCE_SCALE_FACTOR = 0.005; // Added constant
  const FORCE_SMOOTHING_FACTOR = 0.1;
  const TARGET_FORCE_DECAY_FACTOR = 0.95;
  const MIN_APPLIED_FORCE_THRESHOLD = 0.001;

  // --- Initialization & Hooks ---

  // Initialize Matter.js using the custom hook
  const { engineRef } = useMatterJS({ sceneRef, isRunning: !raceOver });

  // --- Game Lifecycle Effects ---
  useEffect(() => {
    setRaceStartTime(Date.now());
  }, []);

  // Race End Logic
  useEffect(() => {
    // Assuming onRaceEnd is passed directly in GameScreenProps and destructured
    if (raceOver || !raceStartTime || !onRaceEnd) return;

    const timerInterval = setInterval(() => {
      if (Date.now() - raceStartTime >= RACE_DURATION_MS) {
        if (!raceOver) {
          setRaceOver(true);
          console.log("Race over! Determining winner...");

          if (engineRef.current) {
            Events.off(engineRef.current, 'collisionStart');
            Events.off(engineRef.current, 'beforeUpdate');
            Events.off(engineRef.current, 'afterUpdate');
            console.log("Race End: Matter.js event listeners cleared for physics updates.");
          }

          let winnerName = "Player";
          const playerFrameBody = bicycleRef.current ? Composite.get(bicycleRef.current, 'frame', 'body') as Body | null : null;
          const playerX = playerFrameBody ? playerFrameBody.position.x : 0;
          const opponentX = opponentVisualStateRef.current?.position?.x || 0;

          if (playerCurrency > opponentCurrency) {
            winnerName = "Player";
          } else if (opponentCurrency > playerCurrency) {
            winnerName = "Opponent";
          } else {
            if (playerX > opponentX) {
              winnerName = "Player";
            } else if (opponentX > playerX) {
              winnerName = "Opponent";
            } else {
              winnerName = "Player";
            }
          }
          console.log(`Winner determined: ${winnerName}, Player Final Currency: ${playerCurrency}`);
          onRaceEnd(winnerName, playerCurrency); // Use destructured onRaceEnd
        }
        clearInterval(timerInterval);
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [raceStartTime, raceOver, playerCurrency, opponentCurrency, onRaceEnd]); // Use onRaceEnd in deps


  // --- Audio Effects ---
  useEffect(() => {
    audioRef.current = new Audio(retroMusic);
    audioRef.current.loop = true;
    audioRef.current.volume = volume;

    const handleAudioError = (e: Event) => {
      console.error("Error loading audio:", e);
    };
    audioRef.current.addEventListener('error', handleAudioError);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('error', handleAudioError);
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (raceStartTime && !raceOver) {
        audioRef.current.volume = volume;
        audioRef.current.play().catch(error => {
          console.error("Error playing audio:", error);
        });
      } else if (raceOver) {
        audioRef.current.pause();
      }
    }
  }, [raceStartTime, raceOver, volume]);

  // --- Matter.js Game Logic & World Setup Effects ---
  useEffect(() => {
    if (raceOver || !sceneRef.current || !engineRef.current) {
      if (raceOver && engineRef.current) {
        Events.off(engineRef.current, 'collisionStart');
        Events.off(engineRef.current, 'beforeUpdate');
        Events.off(engineRef.current, 'afterUpdate');
        console.log("Game-specific Matter.js event listeners cleared due to raceOver condition in setup effect.");
      }
      console.log(
        "Matter.js game logic setup skipped: raceOver is", raceOver,
        "or sceneRef not current, or engineRef from hook not current."
      );
      return;
    }

    const engine = engineRef.current;
    const world = engine.world;

    const canvasWidth = 800;
    const canvasHeight = 600;
    const trackCenterX = canvasWidth / 2;
    const trackCenterY = canvasHeight / 2;
    const trackOuterHeight = 450;
    const wallThickness = 20;
    const trackInnerHeight = 250;
    const trackOuterWidth = 700;

    createTrackWalls(world, canvasWidth, canvasHeight);
    createHazards(world, canvasWidth, canvasHeight);

    const coinPositions = [
      { x: trackCenterX + 100, y: trackCenterY - (trackInnerHeight / 2) - ((trackOuterHeight - trackInnerHeight) / 4) + 10 },
      { x: trackCenterX - 150, y: trackCenterY + (trackInnerHeight / 2) + ((trackOuterHeight - trackInnerHeight) / 4) - 10 },
      { x: trackCenterX, y: trackCenterY + (trackOuterHeight / 2) - wallThickness - 30 },
      { x: trackCenterX + (trackOuterWidth / 2) - wallThickness - 80, y: trackCenterY + 50 },
      { x: trackCenterX - (trackOuterWidth / 2) - wallThickness + 80, y: trackCenterY - 50 },
    ];

    const createdCoinsList: Body[] = [];
    coinPositions.forEach(pos => {
      const newCoin = createCoin(pos.x, pos.y);
      World.add(world, newCoin);
      createdCoinsList.push(newCoin);
    });
    setCoins(createdCoinsList);

    const playerStartX = trackCenterX;
    const playerStartY = trackCenterY - trackOuterHeight / 2 + wallThickness + 50;
    const playerBicycleInstance = createBicycle(playerStartX, playerStartY, 'player1');
    bicycleRef.current = playerBicycleInstance;
    World.add(world, playerBicycleInstance);

    const opponentStartX = trackCenterX;
    const opponentStartY = trackCenterY + trackOuterHeight / 2 - wallThickness - 50;
    const opponentBicycleInstance = createBicycle(opponentStartX, opponentStartY, 'player2');
    opponentBicycleRef.current = opponentBicycleInstance;
    World.add(world, opponentBicycleInstance);

    const opponentFrameBody = Composite.get(opponentBicycleInstance, 'frame', 'body') as Body | null;
    const opponentWheelABody = Composite.get(opponentBicycleInstance, 'wheelA', 'body') as Body | null;
    const opponentWheelBBody = Composite.get(opponentBicycleInstance, 'wheelB', 'body') as Body | null;

    if (opponentFrameBody) Body.set(opponentFrameBody, { isSensor: true });
    if (opponentWheelABody) Body.set(opponentWheelABody, { isSensor: true });
    if (opponentWheelBBody) Body.set(opponentWheelBBody, { isSensor: true });

    const removeCoin = (coinBody: Body) => {
      if (engineRef.current && engineRef.current.world) {
        World.remove(engineRef.current.world, coinBody);
      }
      setCoins(prevCoins => prevCoins.filter(c => c.id !== coinBody.id));
      collectedCoinIdsRef.current.add(coinBody.id);
    };

    // --- Collision Handler Helper Functions ---
    // (Defined within useEffect to close over necessary state/refs like volume, setPlayerCurrency, COIN_VALUE, bicycleRef, etc.)
    // The first, older handleCollision function block has been removed.

    const processPlayerCoinCollision = (coinBody: Body) => {
      if (!collectedCoinIdsRef.current.has(coinBody.id)) {
        console.log('Coin collected:', coinBody.id);
        setPlayerCurrency(prevCurrency => prevCurrency + COIN_VALUE);

        const sound = new Audio(coinCollectSound);
        sound.volume = volume;
        sound.play().catch(e => console.error("Error playing coin sound:", e));

        // Call removeCoin which is defined in the outer scope of this useEffect
        // Ensure removeCoin is available and correctly defined in the outer scope.
        // Assuming removeCoin is defined similar to:
        // const removeCoin = (cb: Body) => { /* logic to remove coin from world and state */ };
        // For this refactor, we are focusing on handleCollision structure.
        // We need to ensure `removeCoin` is accessible. It is defined before `handleCollision`.
        removeCoin(coinBody);
      }
    };

    const processPlayerPotholeCollision = () => {
      const now = Date.now();
      const POTHOLE_COOLDOWN = 1000;
      if (now - lastPotholeCollisionTimeRef.current > POTHOLE_COOLDOWN) {
        console.log('Applying pothole effect...');
        lastPotholeCollisionTimeRef.current = now;
        if (bicycleRef.current) {
          const playerBicycleParts = Composite.allBodies(bicycleRef.current);
          playerBicycleParts.forEach(part => {
            Body.setVelocity(part, {
              x: part.velocity.x * 0.5,
              y: part.velocity.y * 0.5
            });
          });
          const rearWheel = Composite.get(bicycleRef.current, 'wheelB', 'body') as Body | null;
          const frontWheel = Composite.get(bicycleRef.current, 'wheelA', 'body') as Body | null;
          if (rearWheel) Body.setAngularVelocity(rearWheel, rearWheel.angularVelocity * 0.5);
          if (frontWheel) Body.setAngularVelocity(frontWheel, frontWheel.angularVelocity * 0.5);
        }
      }
    };

    const processPlayerOilSlickCollision = () => {
      const now = Date.now();
      const OIL_SLICK_COOLDOWN = 1500;
      if (now - lastOilSlickCollisionTimeRef.current > OIL_SLICK_COOLDOWN) {
        console.log('Applying oil slick effect...');
        lastOilSlickCollisionTimeRef.current = now;
        if (bicycleRef.current) {
          const playerFrame = Composite.get(bicycleRef.current, 'frame', 'body') as Body | null;
          const forceMagnitude = 0.0025;
          const direction = Math.random() < 0.5 ? -1 : 1;
          if (playerFrame) {
            Body.applyForce(playerFrame, playerFrame.position, { x: forceMagnitude * direction, y: 0 });
          }
        }
      }
    };

    // --- Main Collision Handler ---
    // Dispatches to specific handlers based on collision pair labels
    const handleCollision = (event: Matter.IEventCollision<Engine>) => {
      if (raceOver || !bicycleRef.current || !engineRef.current) return;
      const playerParts = Composite.allBodies(bicycleRef.current);
      const pairs = event.pairs;
      collectedCoinIdsRef.current.clear();

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];

        const isBodyAPlayerPart = playerParts.some(part => part.id === pair.bodyA.id);
        const isBodyBPlayerPart = playerParts.some(part => part.id === pair.bodyB.id);

        let playerCollidedBody: Body | null = null;
        let otherBody: Body | null = null;

        if (isBodyAPlayerPart) {
          playerCollidedBody = pair.bodyA;
          otherBody = pair.bodyB;
        } else if (isBodyBPlayerPart) {
          playerCollidedBody = pair.bodyB;
          otherBody = pair.bodyA;
        }

        if (playerCollidedBody && otherBody) {
          if (otherBody.label === 'coin') {
            processPlayerCoinCollision(otherBody);
          } else if (otherBody.label === 'pothole') {
            processPlayerPotholeCollision(); // playerCollidedBody and otherBody can be passed if needed by helper
          } else if (otherBody.label === 'oilSlick') {
            processPlayerOilSlickCollision(); // playerCollidedBody and otherBody can be passed if needed by helper
          }
        }
      }
    };
    Events.on(engine, 'collisionStart', handleCollision);

    const gameLoop = () => {
      if (raceOver || !engineRef.current) return;
      const targetForce = targetForceRef.current;
      const currentAppliedForce = currentAppliedForceRef.current;
      const newAppliedForce = currentAppliedForce + (targetForce - currentAppliedForce) * FORCE_SMOOTHING_FACTOR;
      currentAppliedForceRef.current = newAppliedForce;
      if (bicycleRef.current && Math.abs(newAppliedForce) > MIN_APPLIED_FORCE_THRESHOLD) {
        const rearWheel = Composite.get(bicycleRef.current, 'wheelB', 'body') as Body | null;
        if (rearWheel) {
          Body.applyForce(rearWheel, rearWheel.position, { x: newAppliedForce, y: 0 });
        }
      }
      targetForceRef.current *= TARGET_FORCE_DECAY_FACTOR;
      if (Math.abs(targetForceRef.current) < MIN_APPLIED_FORCE_THRESHOLD) {
        targetForceRef.current = 0;
      }

      // Opponent state interpolation using OpponentSyncManager
      if (opponentBicycleRef.current && engineRef.current) {
        const visualState = opponentSyncManagerRef.current.getInterpolatedState(performance.now());
        if (visualState) {
          opponentVisualStateRef.current = visualState;
        }

        // Apply the visual state to the opponent's bicycle
        if (opponentVisualStateRef.current) { // Check if we have a state to apply
          const opponentFrame = Composite.get(opponentBicycleRef.current, 'frame', 'body') as Body | null;
          const opponentRearWheel = Composite.get(opponentBicycleRef.current, 'wheelB', 'body') as Body | null;
          if (opponentFrame && opponentRearWheel) {
            Body.setPosition(opponentFrame, opponentVisualStateRef.current.position);
            Body.setAngle(opponentFrame, opponentVisualStateRef.current.angle);
            Body.setAngularVelocity(opponentRearWheel, opponentVisualStateRef.current.wheelSpeed);
          }
        }
      }
    };
    Events.on(engine, 'beforeUpdate', gameLoop);

    const handlePlayerStateSend = () => {
      if (raceOver || !bicycleRef.current || !engineRef.current) return;
      if (bicycleRef.current && engineRef.current) {
        const frame = Composite.get(bicycleRef.current, 'frame', 'body') as Body | null;
        const rearWheel = Composite.get(bicycleRef.current, 'wheelB', 'body') as Body | null;
        if (frame && rearWheel) {
          const gameState: GameState = {
            position: { x: frame.position.x, y: frame.position.y },
            angle: frame.angle,
            wheelSpeed: rearWheel.angularVelocity,
            currency: playerCurrency,
            timestamp: performance.now(),
          };
          webRTCService.sendGameState(gameState);
        }
      }
    };
    Events.on(engine, 'afterUpdate', handlePlayerStateSend);

    return () => {
      if (engineRef.current) {
        Events.off(engineRef.current, 'collisionStart', handleCollision);
        Events.off(engineRef.current, 'beforeUpdate', gameLoop);
        Events.off(engineRef.current, 'afterUpdate', handlePlayerStateSend);
        console.log("Game-specific Matter.js event listeners cleaned up from setup effect.");
      }
    };
  }, [raceOver, engineRef, volume, playerCurrency]); // Added volume and playerCurrency as dependencies due to their use in event handlers

  // --- WebRTC Effects ---
  useEffect(() => {
    if (raceOver) {
      webRTCService.setOnGameStateReceived(null);
      return;
    }
    const BUFFER_SIZE_LIMIT = 20;
    webRTCService.setOnGameStateReceived((receivedGameState: GameState) => {
      if (raceOver) return;

      opponentSyncManagerRef.current.addState(receivedGameState);
      const latestOpponentCurrency = opponentSyncManagerRef.current.getLatestCurrency();
      if (latestOpponentCurrency !== null) {
        setOpponentCurrency(latestOpponentCurrency);
      }

      // Initial direct set for opponent if no visual state yet (can be removed if interpolation handles init well)
      if (!opponentVisualStateRef.current && opponentBicycleRef.current && engineRef.current) {
        opponentVisualStateRef.current = {
          position: { ...receivedGameState.position },
          angle: receivedGameState.angle,
          wheelSpeed: receivedGameState.wheelSpeed,
        };
        const opponentFrame = Composite.get(opponentBicycleRef.current, 'frame', 'body') as Body | null;
        const opponentRearWheel = Composite.get(opponentBicycleRef.current, 'wheelB', 'body') as Body | null;
        if (opponentFrame && opponentRearWheel) {
          Body.setPosition(opponentFrame, receivedGameState.position);
          Body.setAngle(opponentFrame, receivedGameState.angle);
          Body.setAngularVelocity(opponentRearWheel, receivedGameState.wheelSpeed);
        }
      }
    });
    return () => {
      webRTCService.setOnGameStateReceived(null);
    };
  }, [raceOver]);

  // --- Player Input Effects ---
  useEffect(() => {
    if (raceOver) return;

    const MAX_EFFECTIVE_TIME_DIFF = 500; // Should be a const at top level
    const applyPedalForce = (key: 'a' | 'd') => { // This function could be memoized or defined outside if it doesn't depend on too many props/state
      if (!bicycleRef.current) return;
      const currentTime = Date.now();
      const rearWheel = Composite.get(bicycleRef.current, 'wheelB', 'body') as Body | null;
      if (!rearWheel) {
        console.error('Rear wheel (wheelB) not found in composite');
        return;
      }
      let timeDiff = 0;
      let calculatedForceMagnitude = 0;
      if (key === 'a') {
        const lastDTime = lastDPressTimeRef.current;
        if (lastDTime > 0) {
          timeDiff = currentTime - lastDTime;
          if (timeDiff > 0 && timeDiff < MAX_EFFECTIVE_TIME_DIFF) {
            calculatedForceMagnitude = FORCE_SCALE_FACTOR * (1 - timeDiff / MAX_EFFECTIVE_TIME_DIFF);
            lastDPressTimeRef.current = 0;
          }
        }
        lastAPressTimeRef.current = currentTime;
      } else if (key === 'd') {
        const lastATime = lastAPressTimeRef.current;
        if (lastATime > 0) {
          timeDiff = currentTime - lastATime;
          if (timeDiff > 0 && timeDiff < MAX_EFFECTIVE_TIME_DIFF) {
            calculatedForceMagnitude = FORCE_SCALE_FACTOR * (1 - timeDiff / MAX_EFFECTIVE_TIME_DIFF);
            lastAPressTimeRef.current = 0;
          }
        }
        lastDPressTimeRef.current = currentTime;
      }
      if (calculatedForceMagnitude > 0) {
        const currentSpeed = Math.abs(rearWheel.velocity.x);
        let rampUpFactor = 1.0;
        const LOW_SPEED_THRESHOLD = 0.5; // Should be a const at top level
        const MIN_FORCE_RAMP_FACTOR = 0.1; // Should be a const at top level
        if (currentSpeed < LOW_SPEED_THRESHOLD) {
          rampUpFactor = Math.min(1, (currentSpeed / LOW_SPEED_THRESHOLD) + MIN_FORCE_RAMP_FACTOR);
          rampUpFactor = Math.max(MIN_FORCE_RAMP_FACTOR, rampUpFactor);
        }
        const finalForceMagnitude = calculatedForceMagnitude * rampUpFactor;
        targetForceRef.current = finalForceMagnitude;
        console.log(
          `Target force set: ${finalForceMagnitude.toFixed(4)} (Base: ${calculatedForceMagnitude.toFixed(4)}, Ramp: ${rampUpFactor.toFixed(2)}) due to ${key.toUpperCase()} press (timeDiff: ${timeDiff}ms, speed: ${currentSpeed.toFixed(2)})`
        );

        // Trigger dust puffs
        const MIN_FORCE_FOR_DUST = 0.002; // Threshold to trigger dust
        if (finalForceMagnitude > MIN_FORCE_FOR_DUST) {
          if (bicycleRef.current && engineRef.current && engineRef.current.world) {
            const rearWheelBody = Composite.get(bicycleRef.current, 'wheelB', 'body') as Body | null;
            if (rearWheelBody) {
              createDustPuffSystem(engineRef.current.world, rearWheelBody.position, 3, engineRef.current, raceOver);
            }
          }
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (raceOver) return;
      const key = event.key.toLowerCase();
      if (key === 'a') {
        applyPedalForce('a');
      } else if (key === 'd') {
        applyPedalForce('d');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [raceOver, engineRef, bicycleRef]); // FORCE_SCALE_FACTOR could be a dependency if it changed, but it's a const

  // --- HUD Update Effects ---
  useEffect(() => {
    let intervalId: number | undefined = undefined;
    if (!raceOver && bicycleRef.current) {
      const updateHudData = () => {
        if (raceOver) {
            if(intervalId) clearInterval(intervalId);
            return;
        }
        if (bicycleRef.current) {
        const rearWheel = Composite.get(bicycleRef.current, 'wheelB', 'body') as Body | null;
        if (rearWheel) {
          const speed = Math.abs(rearWheel.velocity.x);
          const displayableSpeed = speed * 5;
          setDisplaySpeed(displayableSpeed);
        }
      }

      if (bicycleRef.current && opponentVisualStateRef.current?.position) {
        const playerFrame = Composite.get(bicycleRef.current, 'frame', 'body') as Body | null;
        if (playerFrame) {
          const playerX = playerFrame.position.x;
          const opponentX = opponentVisualStateRef.current.position.x;
          setPlayerPosition(playerX >= opponentX ? 1 : 2);
        }
      }
    };
      intervalId = window.setInterval(updateHudData, 100);
    } else if (raceOver && intervalId) {
        clearInterval(intervalId);
    }

    return () => {
        if (intervalId) clearInterval(intervalId);
    };
  }, [bicycleRef.current, raceOver]); // opponentVisualStateRef.current could be a dependency if its change should trigger this


  // --- Visual/Animation Effects ---
  useEffect(() => {
    if (raceOver) {
      if (parallaxIntervalRef.current !== null) {
        clearInterval(parallaxIntervalRef.current);
        parallaxIntervalRef.current = null;
      }
      return;
    }

    const scrollSpeedFactor = 0.1;
    if (parallaxIntervalRef.current === null) {
      parallaxIntervalRef.current = window.setInterval(() => {
        setSkyOffset(prev => (prev - 0.2 * scrollSpeedFactor)); // Slowest
        setMountain3Offset(prev => (prev - 0.5 * scrollSpeedFactor)); // Slow
        setMountain2Offset(prev => (prev - 1.0 * scrollSpeedFactor)); // Medium
        setMountain1Offset(prev => (prev - 1.5 * scrollSpeedFactor)); // Fast
      }, 16);
    }

    return () => {
      if (parallaxIntervalRef.current !== null) {
        clearInterval(parallaxIntervalRef.current);
        parallaxIntervalRef.current = null;
      }
    };
  }, [raceOver]);

  // --- Handle Send Message ---
  const handleSend = () => {
    if (raceOver) return;
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  // --- Render ---
  return (
    <div style={{ padding: '20px', border: '1px solid green', position: 'relative' }}>
      <RaceEndOverlay isVisible={raceOver} />
      {/* Score Display - THIS WILL BE REPLACED/AUGMENTED BY PointsDisplay */}
      {/* <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        padding: '10px 20px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
        fontFamily: "'Press Start 2P', cursive",
        fontSize: '1.5em',
        borderRadius: '5px',
        textShadow: '2px 2px #FF00FF', // Magenta shadow for pop
        zIndex: 100
      }}>
        Score: {score}
      </div> */}

      <SpeedDisplay speed={displaySpeed} />
      <PositionDisplay currentPosition={playerPosition} totalRacers={2} />
      <PointsDisplay points={playerCurrency} />

      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100, background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '5px' }}>
        <label htmlFor="volumeSlider" style={{ color: 'white', marginRight: '5px', fontFamily: "'Press Start 2P', cursive", fontSize: '0.8em', textShadow: '1px 1px #000000' }}>Volume:</label>
        <input
          id="volumeSlider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => {
            const newVolume = parseFloat(e.target.value);
            setVolume(newVolume);
            if (audioRef.current) {
              audioRef.current.volume = newVolume;
            }
          }}
          style={{ verticalAlign: 'middle' }}
        />
      </div>

      <h2>Game Screen</h2>
      <p>My Player ID: {playerId || 'N/A'}</p>
      <p>Connected to Opponent: {opponentId || 'Waiting for opponent...'}</p>

      {/* Div for Matter.js canvas */}
      {/* Container for parallax and game canvas */}
      <div style={{ position: 'relative', width: '800px', height: '600px', overflow: 'hidden', border: '1px solid black', marginBottom: '20px', background: 'lightblue' }}>
        {/* Parallax Background Layers - Assuming image width is 800px */}
        <img src={skyBackground} style={{ position: 'absolute', left: skyOffset % 1600 < -800 ? (skyOffset % 1600) + 1600 : skyOffset % 1600, top: 0, width: '800px', height: '100%', objectFit: 'cover', zIndex: 0 }} alt="sky" />
        <img src={skyBackground} style={{ position: 'absolute', left: (skyOffset % 1600 < -800 ? (skyOffset % 1600) + 1600 : skyOffset % 1600) + 800, top: 0, width: '800px', height: '100%', objectFit: 'cover', zIndex: 0 }} alt="sky" />
        <img src={mountainLayer3} style={{ position: 'absolute', left: mountain3Offset % 1600 < -800 ? (mountain3Offset % 1600) + 1600 : mountain3Offset % 1600, top: 0, width: '800px', height: '100%', objectFit: 'cover', zIndex: 1 }} alt="far mountains" />
        <img src={mountainLayer3} style={{ position: 'absolute', left: (mountain3Offset % 1600 < -800 ? (mountain3Offset % 1600) + 1600 : mountain3Offset % 1600) + 800, top: 0, width: '800px', height: '100%', objectFit: 'cover', zIndex: 1 }} alt="far mountains" />
        <img src={mountainLayer2} style={{ position: 'absolute', left: mountain2Offset % 1600 < -800 ? (mountain2Offset % 1600) + 1600 : mountain2Offset % 1600, top: 0, width: '800px', height: '100%', objectFit: 'cover', zIndex: 2 }} alt="mid mountains" />
        <img src={mountainLayer2} style={{ position: 'absolute', left: (mountain2Offset % 1600 < -800 ? (mountain2Offset % 1600) + 1600 : mountain2Offset % 1600) + 800, top: 0, width: '800px', height: '100%', objectFit: 'cover', zIndex: 2 }} alt="mid mountains" />
        <img src={mountainLayer1} style={{ position: 'absolute', left: mountain1Offset % 1600 < -800 ? (mountain1Offset % 1600) + 1600 : mountain1Offset % 1600, top: 0, width: '800px', height: '100%', objectFit: 'cover', zIndex: 3 }} alt="near mountains" />
        <img src={mountainLayer1} style={{ position: 'absolute', left: (mountain1Offset % 1600 < -800 ? (mountain1Offset % 1600) + 1600 : mountain1Offset % 1600) + 800, top: 0, width: '800px', height: '100%', objectFit: 'cover', zIndex: 3 }} alt="near mountains" />

        {/* Matter.js canvas, ensure it's on top of parallax layers */}
        <div ref={sceneRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 4 }} />
      </div>

      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter message"
          style={{ fontFamily: "'Press Start 2P', cursive", border: '2px solid white', borderRadius: '0px', backgroundColor: 'black', color: 'white', padding: '5px', marginRight: '10px' }}
        />
        <button onClick={handleSend} style={{ fontFamily: "'Press Start 2P', cursive", border: '2px solid white', borderRadius: '0px', backgroundColor: '#DD00DD', color: 'white', textShadow: '1px 1px #000000', padding: '5px 10px' }}>Send Message</button>
      </div>

      {lastMessageReceived && (
        <div style={{ marginTop: '10px', border: '1px solid #ccc', padding: '10px', background: '#f9f9f9' }}>
          <strong>Last message received:</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{lastMessageReceived}</p>
        </div>
      )}

      <button onClick={onDisconnect} style={{ fontFamily: "'Press Start 2P', cursive", border: '2px solid white', borderRadius: '0px', backgroundColor: 'red', color: 'white', textShadow: '1px 1px #000000', padding: '10px 15px', marginTop: '20px' }}>
        Disconnect Call
      </button>
    </div>
  );
};

export default GameScreen;
