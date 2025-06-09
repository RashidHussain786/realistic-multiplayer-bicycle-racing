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
        background: '#f0f0f0',
      },
    });

    // Create runner
    const runner = Runner.create();
    runnerRef.current = runner;

    // Add bodies
    const ground = Bodies.rectangle(400, 590, 810, 60, { isStatic: true, label: 'ground' }); // Ground
    World.add(world, [ground]);

    // Create and add the player's bicycle
    const playerBicycleInstance = createBicycle(400, 100); // Player's starting position
    bicycleRef.current = playerBicycleInstance;
    World.add(world, playerBicycleInstance);

    // Create and add the opponent's bicycle
    const opponentBicycleInstance = createBicycle(100, 100); // Opponent's starting position
    opponentBicycleRef.current = opponentBicycleInstance;
    // Optionally, change color or properties for visual distinction
    opponentBicycleInstance.bodies.forEach(b => {
      if (b.label === 'frame' || b.label === 'wheelA' || b.label === 'wheelB') {
        b.render.fillStyle = 'rgba(0, 0, 255, 0.7)'; // Example: Make opponent's bike semi-transparent blue
        b.render.strokeStyle = 'darkblue';
      }
    });
    World.add(world, opponentBicycleInstance);

    // Set opponent's bicycle parts to be sensors
    const opponentFrameBody = Composite.get(opponentBicycleInstance, 'frame', 'body') as Body | null;
    const opponentWheelABody = Composite.get(opponentBicycleInstance, 'wheelA', 'body') as Body | null;
    const opponentWheelBBody = Composite.get(opponentBicycleInstance, 'wheelB', 'body') as Body | null;

    if (opponentFrameBody) Body.set(opponentFrameBody, { isSensor: true });
    if (opponentWheelABody) Body.set(opponentWheelABody, { isSensor: true });
    if (opponentWheelBBody) Body.set(opponentWheelBBody, { isSensor: true });


    // Run the engine
    Runner.run(runner, engine);
    Render.run(render);

    const RENDER_DELAY = 100; // ms, for interpolation

    // --- Main game loop listener (beforeUpdate) ---
    const gameLoop = () => {
      // Player's bicycle force application (existing logic)
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

      // Opponent's bicycle interpolation logic
      if (opponentBicycleRef.current && engineRef.current) {
        const buffer = opponentStateBufferRef.current;
        const renderTimestamp = performance.now(); // Using performance.now() for consistency with receivedTime

        if (buffer.length === 0 && opponentVisualStateRef.current) {
          // If buffer is empty but we had a visual state, keep rendering that (no new updates)
          // This case might be redundant if visual state is only set when buffer has items.
        } else if (buffer.length > 0) {
          let s1 = null, s2 = null;

          // Find two states to interpolate between based on RENDER_DELAY
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
          // If no state is old enough, s1 will be null. We might need to extrapolate backwards or use the oldest state.
          // If all states are older than targetTime (s1 is the latest, s2 is null), we extrapolate forwards.

          if (s1 && s2) { // Interpolate
            const t1 = s1.state.timestamp;
            const t2 = s2.state.timestamp;
            let factor = 0;
            if (t2 - t1 > 0) { // Avoid division by zero
                factor = (targetTime - t1) / (t2 - t1);
            }
            factor = Math.max(0, Math.min(1, factor)); // Clamp factor

            const prevPos = s1.state.position;
            const nextPos = s2.state.position;
            const interpolatedX = prevPos.x + (nextPos.x - prevPos.x) * factor;
            const interpolatedY = prevPos.y + (nextPos.y - prevPos.y) * factor;

            const prevAngle = s1.state.angle;
            const nextAngle = s2.state.angle;
            // Simple linear interpolation for angle. Consider shortest path for angles if differences can be large.
            const interpolatedAngle = prevAngle + (nextAngle - prevAngle) * factor;

            opponentVisualStateRef.current = {
              position: { x: interpolatedX, y: interpolatedY },
              angle: interpolatedAngle,
              wheelSpeed: s2.state.wheelSpeed, // Use latest wheel speed
            };
          } else if (s1) { // Extrapolate from s1 (if s2 is null, means s1 is the newest state older than targetTime)
                           // Or, if all states are newer than targetTime, s1 is null.
                           // For now, if only one state or cannot find pair, just use the latest.
            const latestStateEntry = buffer[buffer.length - 1];
            opponentVisualStateRef.current = {
              position: { ...latestStateEntry.state.position },
              angle: latestStateEntry.state.angle,
              wheelSpeed: latestStateEntry.state.wheelSpeed,
            };
          } else if (buffer.length > 0) { // Fallback: use the most recent state if no suitable pair found
            const latestStateEntry = buffer[buffer.length - 1];
            opponentVisualStateRef.current = {
              position: { ...latestStateEntry.state.position },
              angle: latestStateEntry.state.angle,
              wheelSpeed: latestStateEntry.state.wheelSpeed,
            };
          }
        }

        // Apply visual state to Matter.js bodies
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
    Events.on(engine, 'beforeUpdate', gameLoop); // Use beforeUpdate for physics related changes

    // --- afterUpdate event listener for sending game state (player's state) ---
    const handlePlayerStateSend = () => {
      if (bicycleRef.current && engineRef.current) {
        const frame = Composite.get(bicycleRef.current, 'frame', 'body') as Body | null;
        const rearWheel = Composite.get(bicycleRef.current, 'wheelB', 'body') as Body | null;

        if (frame && rearWheel) {
          const gameState: GameState = {
            position: { x: frame.position.x, y: frame.position.y },
            angle: frame.angle,
            wheelSpeed: rearWheel.angularVelocity,
            timestamp: performance.now(), // Use performance.now() for player state as well
          };
          webRTCService.sendGameState(gameState);
        }
      }
    };
    Events.on(engine, 'afterUpdate', handlePlayerStateSend); // Send state after physics update

    // Cleanup on unmount
    return () => {
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
  }, []); // Empty dependency array ensures this runs only once on mount and cleanup on unmount
  // Note: bicycleRef, opponentBicycleRef and engineRef are refs, their .current property changes do not trigger re-runs of useEffect.
  // If these refs themselves were to change (which they don't in this setup), they'd be needed in dependencies.

  // Effect for setting up game state receiver
  useEffect(() => {
    const BUFFER_SIZE_LIMIT = 20; // Keep last 20 states

    webRTCService.setOnGameStateReceived((gameState: GameState) => {
      const receivedTime = performance.now(); // Use performance.now() for consistency
      opponentStateBufferRef.current.push({ state: gameState, receivedTime });

      // Manage buffer size
      if (opponentStateBufferRef.current.length > BUFFER_SIZE_LIMIT) {
        opponentStateBufferRef.current.shift(); // Remove the oldest state
      }

      // If this is the first state, or opponentVisualState is not yet set,
      // initialize visual state and apply directly to Matter bodies.
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
      webRTCService.setOnGameStateReceived(null); // Clear callback on unmount
    };
  }, []); // Empty dependency array, runs once on mount

  // Effect for keyboard input
  useEffect(() => {
    const MAX_EFFECTIVE_TIME_DIFF = 500; // ms
    const FORCE_SCALE_FACTOR = 0.03; // Adjust for desired force strength
    const LOW_SPEED_THRESHOLD = 0.5; // m/s, approximate
    const MIN_FORCE_RAMP_FACTOR = 0.1; // Minimum force factor when starting from stop

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
            lastDPressTimeRef.current = 0; // Reset for next alternation
          }
        }
        lastAPressTimeRef.current = currentTime;
      } else if (key === 'd') {
        const lastATime = lastAPressTimeRef.current;
        if (lastATime > 0) {
          timeDiff = currentTime - lastATime;
          if (timeDiff > 0 && timeDiff < MAX_EFFECTIVE_TIME_DIFF) {
            calculatedForceMagnitude = FORCE_SCALE_FACTOR * (1 - timeDiff / MAX_EFFECTIVE_TIME_DIFF);
            lastAPressTimeRef.current = 0; // Reset for next alternation
          }
        }
        lastDPressTimeRef.current = currentTime;
      }

      if (calculatedForceMagnitude > 0) {
        const currentSpeed = Math.abs(rearWheel.velocity.x);
        let rampUpFactor = 1.0;

        if (currentSpeed < LOW_SPEED_THRESHOLD) {
          rampUpFactor = Math.min(1, (currentSpeed / LOW_SPEED_THRESHOLD) + MIN_FORCE_RAMP_FACTOR);
          // Ensure rampUpFactor is not less than MIN_FORCE_RAMP_FACTOR, especially at speed 0
          rampUpFactor = Math.max(MIN_FORCE_RAMP_FACTOR, rampUpFactor);
        }

        const finalForceMagnitude = calculatedForceMagnitude * rampUpFactor;

        targetForceRef.current = finalForceMagnitude; // Set the target force

        console.log(
          `Target force set: ${finalForceMagnitude.toFixed(4)} (Base: ${calculatedForceMagnitude.toFixed(4)}, Ramp: ${rampUpFactor.toFixed(2)}) due to ${key.toUpperCase()} press (timeDiff: ${timeDiff}ms, speed: ${currentSpeed.toFixed(2)})`
        );
        // Body.applyForce(rearWheel, rearWheel.position, { x: finalForceMagnitude, y: 0 }); // REMOVED
      } else if (calculatedForceMagnitude <= 0 && (key === 'a' || key === 'd')) {
        // If pedal stroke was not effective (e.g., too slow alternation) but key was pressed,
        // we still want to ensure previous target force starts decaying if it wasn't already.
        // The main decay logic in beforeUpdate handles continuous decay.
        // This ensures that if a player *tries* to pedal but fails, targetForce doesn't stick.
        // However, the primary decay is handled in beforeUpdate. This might be redundant.
        // For now, the main decay in beforeUpdate should be sufficient.
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

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty dependency array to run once on mount and clean up on unmount


  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid green' }}>
      <h2>Game Screen</h2>
      <p>My Player ID: {playerId || 'N/A'}</p>
      <p>Connected to Opponent: {opponentId || 'Waiting for opponent...'}</p>

      {/* Div for Matter.js canvas */}
      <div ref={sceneRef} style={{ width: '800px', height: '600px', border: '1px solid black', marginBottom: '20px' }} />

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
