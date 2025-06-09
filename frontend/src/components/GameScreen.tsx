import skyBackground from '../assets/sky_background.png';
import mountainLayer1 from '../assets/mountain_layer_1.png';
import mountainLayer2 from '../assets/mountain_layer_2.png';
import mountainLayer3 from '../assets/mountain_layer_3.png';
import { useState, useEffect, useRef } from 'react'; // Ensure useState, useEffect, useRef are imported
// frontend/src/components/GameScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Engine, Render, Runner, World, Bodies, Composite, Constraint, Body, Events } from 'matter-js';
import { GameState } from '../types/GameState'; // Import GameState
import webRTCService from '../services/WebRTCService'; // Import webRTCService

interface GameScreenProps {
  opponentId: string | null;
  playerId: string | null;
  onDisconnect: () => void;
  onSendMessage: (message: string) => void;
  lastMessageReceived: string | null;
}

// Function to create a bicycle composite
const createBicycle = (x: number, y: number): Composite => {
  const group = Body.nextGroup(true);
  const wheelRadius = 20;
  const wheelGap = 50; // Distance from center of frame to center of wheels horizontally
  const frameHeight = 30;
  const frameWidth = 100;

  // Wheels
  const wheelA = Bodies.circle(x - wheelGap, y + frameHeight / 2, wheelRadius, {
    label: 'wheelA', // Front wheel
    collisionFilter: { group: group },
    friction: 0.8,
  });
  const wheelB = Bodies.circle(x + wheelGap, y + frameHeight / 2, wheelRadius, {
    label: 'wheelB', // Rear wheel
    collisionFilter: { group: group },
    friction: 0.8,
  });

  // Frame
  const frame = Bodies.rectangle(x, y, frameWidth, frameHeight, {
    label: 'frame',
    collisionFilter: { group: group },
    density: 0.005, // Adjust density as needed
  });

  // Axles (constraints)
  const axleA = Constraint.create({
    bodyA: frame,
    pointA: { x: -wheelGap, y: 0 }, // Relative to frame's center
    bodyB: wheelA,
    pointB: { x: 0, y: 0 }, // Relative to wheelA's center
    stiffness: 1.0, // Increased stiffness
    length: 0, // Length of 0 makes it act like a pin
  });

  const axleB = Constraint.create({
    bodyA: frame,
    pointA: { x: wheelGap, y: 0 }, // Relative to frame's center
    bodyB: wheelB,
    pointB: { x: 0, y: 0 }, // Relative to wheelB's center
    stiffness: 1.0, // Increased stiffness
    length: 0,
  });

  const bicycleComposite = Composite.create({ label: 'Bicycle' });
  Composite.addBody(bicycleComposite, wheelA);
  Composite.addBody(bicycleComposite, wheelB);
  Composite.addBody(bicycleComposite, frame);
  Composite.addConstraint(bicycleComposite, axleA);
  Composite.addConstraint(bicycleComposite, axleB);

  return bicycleComposite;
};


const GameScreen: React.FC<GameScreenProps> = ({
  opponentId,
  playerId,
  onDisconnect,
  onSendMessage,
  lastMessageReceived,
}) => {
  const [message, setMessage] = useState('');
  const [score, setScore] = useState(0); // Basic score state
  // TODO: Add logic to update score based on game events
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const runnerRef = useRef<Runner | null>(null);
  const bicycleRef = useRef<Composite | null>(null); // Ref to store the player's bicycle composite
  const opponentBicycleRef = useRef<Composite | null>(null); // Ref to store the opponent's bicycle composite
  const opponentStateBufferRef = useRef<Array<{ state: GameState, receivedTime: number }>>([]);
  const opponentVisualStateRef = useRef<{ position: { x: number, y: number }, angle: number, wheelSpeed: number } | null>(null);
  const lastAPressTimeRef = useRef<number>(0);
  const lastDPressTimeRef = useRef<number>(0);
  const targetForceRef = useRef<number>(0);
  const currentAppliedForceRef = useRef<number>(0);
  const lastPotholeCollisionTimeRef = useRef<number>(0); // For pothole effect cooldown
  const lastOilSlickCollisionTimeRef = useRef<number>(0); // For oil slick effect cooldown

  // Constants for physics behavior
  const FORCE_SMOOTHING_FACTOR = 0.1;
  const TARGET_FORCE_DECAY_FACTOR = 0.95; // Decay per frame
  const MIN_APPLIED_FORCE_THRESHOLD = 0.001;


  // Effect for Matter.js setup and cleanup
  useEffect(() => {
    if (!sceneRef.current) {
      console.error("Scene ref is not available");
      return;
    }

    // Create engine
    const engine = Engine.create();
    engineRef.current = engine;
    const world = engine.world;

    // Create renderer
    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: 800,
        height: 600,
        wireframes: false, // Set to true for debugging
        background: 'transparent', // Parallax background
      },
    });

    // Create runner
    const runner = Runner.create();
    runnerRef.current = runner;

    // Add bodies
    // const ground = Bodies.rectangle(400, 590, 810, 60, { isStatic: true, label: 'ground' }); // Ground
    // World.add(world, [ground]); // Ground removed for track

    // Track dimensions and properties
    const canvasWidth = 800;
    const canvasHeight = 600;
    const trackOuterWidth = 700;
    const trackOuterHeight = 450;
    const trackInnerWidth = 500;
    const trackInnerHeight = 250;
    const wallThickness = 20;
    // const cornerRadius = 100; // Conceptual

    const trackCenterX = canvasWidth / 2;
    const trackCenterY = canvasHeight / 2;

    const trackWallStyle = { isStatic: true, label: 'trackWall', render: { fillStyle: '#3333FF' } }; // Vibrant Blue

    const wallBodies = [];

    // Outer walls
    // Top outer wall
    wallBodies.push(Bodies.rectangle(trackCenterX, trackCenterY - trackOuterHeight / 2 + wallThickness / 2, trackOuterWidth - 2 * 100, wallThickness, trackWallStyle)); // Shortened for corners
    // Bottom outer wall
    wallBodies.push(Bodies.rectangle(trackCenterX, trackCenterY + trackOuterHeight / 2 - wallThickness / 2, trackOuterWidth - 2 * 100, wallThickness, trackWallStyle)); // Shortened for corners
    // Left outer wall
    wallBodies.push(Bodies.rectangle(trackCenterX - trackOuterWidth / 2 + wallThickness / 2, trackCenterY, wallThickness, trackOuterHeight - 2 * 100, trackWallStyle)); // Shortened for corners
    // Right outer wall
    wallBodies.push(Bodies.rectangle(trackCenterX + trackOuterWidth / 2 - wallThickness / 2, trackCenterY, wallThickness, trackOuterHeight - 2 * 100, trackWallStyle)); // Shortened for corners

    // Inner walls
    // Top inner wall
    wallBodies.push(Bodies.rectangle(trackCenterX, trackCenterY - trackInnerHeight / 2 + wallThickness / 2, trackInnerWidth - 2 * 50, wallThickness, trackWallStyle)); // Shortened for corners
    // Bottom inner wall
    wallBodies.push(Bodies.rectangle(trackCenterX, trackCenterY + trackInnerHeight / 2 - wallThickness / 2, trackInnerWidth - 2 * 50, wallThickness, trackWallStyle)); // Shortened for corners
    // Left inner wall
    wallBodies.push(Bodies.rectangle(trackCenterX - trackInnerWidth / 2 + wallThickness / 2, trackCenterY, wallThickness, trackInnerHeight - 2 * 50, trackWallStyle)); // Shortened for corners
    // Right inner wall
    wallBodies.push(Bodies.rectangle(trackCenterX + trackInnerWidth / 2 - wallThickness / 2, trackCenterY, wallThickness, trackInnerHeight - 2 * 50, trackWallStyle)); // Shortened for corners

    // Approximate corners with small rectangles
    const cornerSegments = 6;
    const segmentAngle = Math.PI / 2 / cornerSegments;
    const outerCornerRadius = (trackOuterHeight - trackInnerHeight) / 4; // Approximate
    const innerCornerRadius = outerCornerRadius;


    // Outer corners
    // Top-left outer corner
    for (let i = 0; i < cornerSegments; i++) {
      const angle = Math.PI + i * segmentAngle + segmentAngle / 2;
      const x = trackCenterX - (trackOuterWidth / 2 - 100) + Math.cos(angle) * (100 - wallThickness/2) ;
      const y = trackCenterY - (trackOuterHeight / 2 - 100) + Math.sin(angle) * (100 - wallThickness/2) ;
      wallBodies.push(Bodies.rectangle(x, y, 50, wallThickness, { ...trackWallStyle, angle: angle + Math.PI/2 }));
    }
     // Top-right outer corner
    for (let i = 0; i < cornerSegments; i++) {
      const angle = Math.PI * 1.5 + i * segmentAngle + segmentAngle / 2;
      const x = trackCenterX + (trackOuterWidth / 2 - 100) + Math.cos(angle) * (100 - wallThickness/2);
      const y = trackCenterY - (trackOuterHeight / 2 - 100) + Math.sin(angle) * (100 - wallThickness/2);
      wallBodies.push(Bodies.rectangle(x, y, 50, wallThickness, { ...trackWallStyle, angle: angle + Math.PI/2 }));
    }
    // Bottom-left outer corner
    for (let i = 0; i < cornerSegments; i++) {
      const angle = Math.PI * 0.5 + i * segmentAngle + segmentAngle / 2;
      const x = trackCenterX - (trackOuterWidth / 2 - 100) + Math.cos(angle) * (100 - wallThickness/2);
      const y = trackCenterY + (trackOuterHeight / 2 - 100) + Math.sin(angle) * (100 - wallThickness/2);
      wallBodies.push(Bodies.rectangle(x, y, 50, wallThickness, { ...trackWallStyle, angle: angle + Math.PI/2 }));
    }
    // Bottom-right outer corner
    for (let i = 0; i < cornerSegments; i++) {
      const angle = 0 + i * segmentAngle + segmentAngle / 2;
      const x = trackCenterX + (trackOuterWidth / 2 - 100) + Math.cos(angle) * (100 - wallThickness/2);
      const y = trackCenterY + (trackOuterHeight / 2 - 100) + Math.sin(angle) * (100 - wallThickness/2);
      wallBodies.push(Bodies.rectangle(x, y, 50, wallThickness, { ...trackWallStyle, angle: angle + Math.PI/2 }));
    }

    // Inner corners (similar logic, adjusted radii and positions)
    // Top-left inner corner
    for (let i = 0; i < cornerSegments; i++) {
        const angle = Math.PI + i * segmentAngle + segmentAngle / 2;
        const x = trackCenterX - (trackInnerWidth / 2 - 50) + Math.cos(angle) * (50 - wallThickness/2);
        const y = trackCenterY - (trackInnerHeight / 2 - 50) + Math.sin(angle) * (50 - wallThickness/2);
        wallBodies.push(Bodies.rectangle(x, y, 40, wallThickness, { ...trackWallStyle, angle: angle + Math.PI/2 }));
    }
    // Top-right inner corner
    for (let i = 0; i < cornerSegments; i++) {
        const angle = Math.PI * 1.5 + i * segmentAngle + segmentAngle / 2;
        const x = trackCenterX + (trackInnerWidth / 2 - 50) + Math.cos(angle) * (50 - wallThickness/2);
        const y = trackCenterY - (trackInnerHeight / 2 - 50) + Math.sin(angle) * (50 - wallThickness/2);
        wallBodies.push(Bodies.rectangle(x, y, 40, wallThickness, { ...trackWallStyle, angle: angle + Math.PI/2 }));
    }
    // Bottom-left inner corner
    for (let i = 0; i < cornerSegments; i++) {
        const angle = Math.PI * 0.5 + i * segmentAngle + segmentAngle / 2;
        const x = trackCenterX - (trackInnerWidth / 2 - 50) + Math.cos(angle) * (50 - wallThickness/2);
        const y = trackCenterY + (trackInnerHeight / 2 - 50) + Math.sin(angle) * (50 - wallThickness/2);
        wallBodies.push(Bodies.rectangle(x, y, 40, wallThickness, { ...trackWallStyle, angle: angle + Math.PI/2 }));
    }
    // Bottom-right inner corner
    for (let i = 0; i < cornerSegments; i++) {
        const angle = 0 + i * segmentAngle + segmentAngle / 2;
        const x = trackCenterX + (trackInnerWidth / 2 - 50) + Math.cos(angle) * (50 - wallThickness/2);
        const y = trackCenterY + (trackInnerHeight / 2 - 50) + Math.sin(angle) * (50 - wallThickness/2);
        wallBodies.push(Bodies.rectangle(x, y, 40, wallThickness, { ...trackWallStyle, angle: angle + Math.PI/2 }));
    }


    World.add(world, wallBodies);

    // Hazard Properties
    const potholeRadius = 18;
    const potholeStyle = { isStatic: true, isSensor: true, label: 'pothole', render: { fillStyle: '#FF6600' } }; // Bright Orange
    const oilSlickWidth = 30;
    const oilSlickHeight = 80;
    const oilSlickStyle = { isStatic: true, isSensor: true, label: 'oilSlick', render: { fillStyle: '#6600CC' } }; // Purple


    // Hazard Placement Calculations
    const p1x = trackCenterX + 50;
    const p1y = trackCenterY - (trackInnerHeight / 2) - ((trackOuterHeight - trackInnerHeight) / 4);
    const p2x = trackCenterX - 50;
    const p2y = trackCenterY + (trackInnerHeight / 2) + ((trackOuterHeight - trackInnerHeight) / 4);
    const o1x = trackCenterX - (trackInnerWidth / 2) - ((trackOuterWidth - trackInnerWidth) / 4);
    const o1y = trackCenterY - 50;
    const o2x = trackCenterX + (trackInnerWidth / 2) + ((trackOuterWidth - trackInnerWidth) / 4);
    const o2y = trackCenterY + 50;

    // Create Hazard Bodies
    const pothole1 = Bodies.circle(p1x, p1y, potholeRadius, potholeStyle);
    const pothole2 = Bodies.circle(p2x, p2y, potholeRadius, potholeStyle);
    const oilSlick1 = Bodies.rectangle(o1x, o1y, 80, 30, { ...oilSlickStyle, angle: Math.PI / 2 });
    const oilSlick2 = Bodies.rectangle(o2x, o2y, 80, 30, { ...oilSlickStyle, angle: Math.PI / 2 });

    World.add(world, [pothole1, pothole2, oilSlick1, oilSlick2]);

    const playerStartX = trackCenterX;
    const playerStartY = trackCenterY - trackOuterHeight / 2 + wallThickness + 50;
    const playerBicycleInstance = createBicycle(playerStartX, playerStartY);
    bicycleRef.current = playerBicycleInstance;
    World.add(world, playerBicycleInstance);

    const opponentStartX = trackCenterX;
    const opponentStartY = trackCenterY + trackOuterHeight / 2 - wallThickness - 50;
    const opponentBicycleInstance = createBicycle(opponentStartX, opponentStartY);
    opponentBicycleRef.current = opponentBicycleInstance;
    opponentBicycleInstance.bodies.forEach(b => {
      if (b.label === 'frame' || b.label === 'wheelA' || b.label === 'wheelB') {
        b.render.fillStyle = '#00FFFF'; // Cyan for opponent bike
        b.render.strokeStyle = '#00AAAA'; // Darker cyan for opponent outline
      }
    });
    World.add(world, opponentBicycleInstance);

    const opponentFrameBody = Composite.get(opponentBicycleInstance, 'frame', 'body') as Body | null;
    const opponentWheelABody = Composite.get(opponentBicycleInstance, 'wheelA', 'body') as Body | null;
    const opponentWheelBBody = Composite.get(opponentBicycleInstance, 'wheelB', 'body') as Body | null;

    if (opponentFrameBody) Body.set(opponentFrameBody, { isSensor: true });
    if (opponentWheelABody) Body.set(opponentWheelABody, { isSensor: true });
    if (opponentWheelBBody) Body.set(opponentWheelBBody, { isSensor: true });


    Runner.run(runner, engine);
    Render.run(render);

    const handleCollision = (event: Matter.IEventCollision<Engine>) => {
      if (!bicycleRef.current) return;
      const playerParts = Composite.allBodies(bicycleRef.current);
      const pairs = event.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        let playerBody = null;
        let hazardBody = null;
        const isBodyAPlayerPart = playerParts.some(part => part.id === pair.bodyA.id);
        const isBodyBPlayerPart = playerParts.some(part => part.id === pair.bodyB.id);
        if (isBodyAPlayerPart && (pair.bodyB.label === 'pothole' || pair.bodyB.label === 'oilSlick')) {
          playerBody = pair.bodyA;
          hazardBody = pair.bodyB;
        } else if (isBodyBPlayerPart && (pair.bodyA.label === 'pothole' || pair.bodyA.label === 'oilSlick')) {
          playerBody = pair.bodyB;
          hazardBody = pair.bodyA;
        }
        if (playerBody && hazardBody) {
          if (hazardBody.label === 'pothole') {
            const now = Date.now();
            const POTHOLE_COOLDOWN = 1000;
            if (now - lastPotholeCollisionTimeRef.current > POTHOLE_COOLDOWN) {
              console.log('Applying pothole effect...');
              lastPotholeCollisionTimeRef.current = now;
              const playerBicycleParts = Composite.allBodies(bicycleRef.current!);
              playerBicycleParts.forEach(part => {
                Body.setVelocity(part, {
                  x: part.velocity.x * 0.5,
                  y: part.velocity.y * 0.5
                });
              });
              const rearWheel = Composite.get(bicycleRef.current!, 'wheelB', 'body') as Body | null;
              const frontWheel = Composite.get(bicycleRef.current!, 'wheelA', 'body') as Body | null;
              if (rearWheel) Body.setAngularVelocity(rearWheel, rearWheel.angularVelocity * 0.5);
              if (frontWheel) Body.setAngularVelocity(frontWheel, frontWheel.angularVelocity * 0.5);
            }
          } else if (hazardBody.label === 'oilSlick') {
            const now = Date.now();
            const OIL_SLICK_COOLDOWN = 1500;
            if (now - lastOilSlickCollisionTimeRef.current > OIL_SLICK_COOLDOWN) {
              console.log('Applying oil slick effect...');
              lastOilSlickCollisionTimeRef.current = now;
              const playerFrame = Composite.get(bicycleRef.current!, 'frame', 'body') as Body | null;
              const forceMagnitude = 0.0025;
              const direction = Math.random() < 0.5 ? -1 : 1;
              if (playerFrame) {
                Body.applyForce(playerFrame, playerFrame.position, { x: forceMagnitude * direction, y: 0 });
              }
            }
          }
        }
      }
    };
    Events.on(engine, 'collisionStart', handleCollision);

    const RENDER_DELAY = 100;
    const gameLoop = () => {
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
      if (opponentBicycleRef.current && engineRef.current) {
        const buffer = opponentStateBufferRef.current;
        const renderTimestamp = performance.now();
        if (buffer.length > 0) {
          let s1 = null, s2 = null;
          const targetTime = renderTimestamp - RENDER_DELAY;
          for (let i = buffer.length - 1; i >= 0; i--) {
            if (buffer[i].state.timestamp <= targetTime) {
              s1 = buffer[i];
              if (i + 1 < buffer.length) {
                s2 = buffer[i + 1];
              }
              break;
            }
          }
          if (s1 && s2) {
            const t1 = s1.state.timestamp;
            const t2 = s2.state.timestamp;
            let factor = 0;
            if (t2 - t1 > 0) {
                factor = (targetTime - t1) / (t2 - t1);
            }
            factor = Math.max(0, Math.min(1, factor));
            const prevPos = s1.state.position;
            const nextPos = s2.state.position;
            const interpolatedX = prevPos.x + (nextPos.x - prevPos.x) * factor;
            const interpolatedY = prevPos.y + (nextPos.y - prevPos.y) * factor;
            const prevAngle = s1.state.angle;
            const nextAngle = s2.state.angle;
            const interpolatedAngle = prevAngle + (nextAngle - prevAngle) * factor;
            opponentVisualStateRef.current = {
              position: { x: interpolatedX, y: interpolatedY },
              angle: interpolatedAngle,
              wheelSpeed: s2.state.wheelSpeed,
            };
          } else if (s1) {
            const latestStateEntry = buffer[buffer.length - 1];
            opponentVisualStateRef.current = {
              position: { ...latestStateEntry.state.position },
              angle: latestStateEntry.state.angle,
              wheelSpeed: latestStateEntry.state.wheelSpeed,
            };
          } else if (buffer.length > 0) {
            const latestStateEntry = buffer[buffer.length - 1];
            opponentVisualStateRef.current = {
              position: { ...latestStateEntry.state.position },
              angle: latestStateEntry.state.angle,
              wheelSpeed: latestStateEntry.state.wheelSpeed,
            };
          }
        }
        if (opponentVisualStateRef.current && opponentBicycleRef.current) {
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
      if (bicycleRef.current && engineRef.current) {
        const frame = Composite.get(bicycleRef.current, 'frame', 'body') as Body | null;
        const rearWheel = Composite.get(bicycleRef.current, 'wheelB', 'body') as Body | null;
        if (frame && rearWheel) {
          const gameState: GameState = {
            position: { x: frame.position.x, y: frame.position.y },
            angle: frame.angle,
            wheelSpeed: rearWheel.angularVelocity,
            timestamp: performance.now(),
          };
          webRTCService.sendGameState(gameState);
        }
      }
    };
    Events.on(engine, 'afterUpdate', handlePlayerStateSend);
    return () => {
      Events.off(engine, 'collisionStart', handleCollision);
      Events.off(engine, 'beforeUpdate', gameLoop);
      Events.off(engine, 'afterUpdate', handlePlayerStateSend);
      if (runnerRef.current) {
        Runner.stop(runnerRef.current);
      }
      if (engineRef.current) {
        Composite.clear(engineRef.current.world, false, true);
        Engine.clear(engineRef.current);
      }
      Render.stop(render);
      if (render.canvas) {
        render.canvas.remove();
      }
    };
  }, []);
  useEffect(() => {
    const BUFFER_SIZE_LIMIT = 20;
    webRTCService.setOnGameStateReceived((gameState: GameState) => {
      const receivedTime = performance.now();
      opponentStateBufferRef.current.push({ state: gameState, receivedTime });
      if (opponentStateBufferRef.current.length > BUFFER_SIZE_LIMIT) {
        opponentStateBufferRef.current.shift();
      }
      if (!opponentVisualStateRef.current && opponentBicycleRef.current) {
        opponentVisualStateRef.current = {
          position: { ...gameState.position },
          angle: gameState.angle,
          wheelSpeed: gameState.wheelSpeed,
        };
        const opponentFrame = Composite.get(opponentBicycleRef.current, 'frame', 'body') as Body | null;
        const opponentRearWheel = Composite.get(opponentBicycleRef.current, 'wheelB', 'body') as Body | null;
        if (opponentFrame && opponentRearWheel) {
          Body.setPosition(opponentFrame, gameState.position);
          Body.setAngle(opponentFrame, gameState.angle);
          Body.setAngularVelocity(opponentRearWheel, gameState.wheelSpeed);
        }
      }
    });
    return () => {
      webRTCService.setOnGameStateReceived(null);
    };
  }, []);
  useEffect(() => {
    const MAX_EFFECTIVE_TIME_DIFF = 500;
    const FORCE_SCALE_FACTOR = 0.03;
    const LOW_SPEED_THRESHOLD = 0.5;
    const MIN_FORCE_RAMP_FACTOR = 0.1;
    const applyPedalForce = (key: 'a' | 'd') => {
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
        if (currentSpeed < LOW_SPEED_THRESHOLD) {
          rampUpFactor = Math.min(1, (currentSpeed / LOW_SPEED_THRESHOLD) + MIN_FORCE_RAMP_FACTOR);
          rampUpFactor = Math.max(MIN_FORCE_RAMP_FACTOR, rampUpFactor);
        }
        const finalForceMagnitude = calculatedForceMagnitude * rampUpFactor;
        targetForceRef.current = finalForceMagnitude;
        console.log(
          `Target force set: ${finalForceMagnitude.toFixed(4)} (Base: ${calculatedForceMagnitude.toFixed(4)}, Ramp: ${rampUpFactor.toFixed(2)}) due to ${key.toUpperCase()} press (timeDiff: ${timeDiff}ms, speed: ${currentSpeed.toFixed(2)})`
        );
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, []); // Empty dependency array to run once on mount and clean up on unmount

  // Effect for time-based score increment
  useEffect(() => {
    const scoreInterval = setInterval(() => {
      setScore(prevScore => prevScore + 10); // Increment score by 10 every 5 seconds
    }, 5000); // 5000 milliseconds = 5 seconds

    return () => clearInterval(scoreInterval); // Cleanup interval on component unmount
  }, []); // Empty dependency array ensures this runs once on mount

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const [skyOffset, setSkyOffset] = useState(0);
  const [mountain1Offset, setMountain1Offset] = useState(0);
  const [mountain2Offset, setMountain2Offset] = useState(0);
  const [mountain3Offset, setMountain3Offset] = useState(0);

  useEffect(() => {
    const scrollSpeedFactor = 0.1;
    const interval = setInterval(() => {
      setSkyOffset(prev => (prev - 0.5 * scrollSpeedFactor));
      setMountain1Offset(prev => (prev - 1 * scrollSpeedFactor));
      setMountain2Offset(prev => (prev - 2 * scrollSpeedFactor));
      setMountain3Offset(prev => (prev - 3 * scrollSpeedFactor));
    }, 16);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '20px', border: '1px solid green', position: 'relative' }}> {/* Added position: 'relative' */}
      {/* Score Display */}
      <div style={{
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
          style={{ marginRight: '10px' }}
        />
        <button onClick={handleSend}>Send Message</button>
      </div>

      {lastMessageReceived && (
        <div style={{ marginTop: '10px', border: '1px solid #ccc', padding: '10px', background: '#f9f9f9' }}>
          <strong>Last message received:</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{lastMessageReceived}</p>
        </div>
      )}

      <button onClick={onDisconnect} style={{ marginTop: '20px', backgroundColor: 'red', color: 'white' }}>
        Disconnect Call
      </button>
    </div>
  );
};

export default GameScreen;
