// frontend/src/components/GameScreen.tsx
import React, { useState, useEffect, useRef } from 'react'; // Added useEffect and useRef
import { Engine, Render, Runner, World, Bodies, Composite, Constraint, Body, Events } from 'matter-js';

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
  const bicycleRef = useRef<Composite | null>(null); // Ref to store the bicycle composite
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

    // Create and add the bicycle
    const bicycleInstance = createBicycle(400, 100); // Positioned above ground
    bicycleRef.current = bicycleInstance; // Store instance in ref
    World.add(world, bicycleInstance);


    // Run the engine
    Runner.run(runner, engine);
    Render.run(render);

    // --- beforeUpdate event listener ---
    const handleBeforeUpdate = () => {
      const targetForce = targetForceRef.current;
      const currentAppliedForce = currentAppliedForceRef.current;

      // Smoothly interpolate currentAppliedForce towards targetForce
      const newAppliedForce = currentAppliedForce + (targetForce - currentAppliedForce) * FORCE_SMOOTHING_FACTOR;
      currentAppliedForceRef.current = newAppliedForce;

      if (bicycleRef.current && Math.abs(newAppliedForce) > MIN_APPLIED_FORCE_THRESHOLD) {
        const rearWheel = Composite.get(bicycleRef.current, 'wheelB', 'body') as Body | null;
        if (rearWheel) {
          Body.applyForce(rearWheel, rearWheel.position, { x: newAppliedForce, y: 0 });
        }
      }

      // Decay the target force if no new input
      targetForceRef.current *= TARGET_FORCE_DECAY_FACTOR;
      if (Math.abs(targetForceRef.current) < MIN_APPLIED_FORCE_THRESHOLD) {
        targetForceRef.current = 0; // Snap to zero if very small
      }
    };

    Events.on(engine, 'beforeUpdate', handleBeforeUpdate);
    // --- End of beforeUpdate event listener ---

    // Cleanup on unmount
    return () => {
      Events.off(engine, 'beforeUpdate', handleBeforeUpdate); // Remove event listener

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
