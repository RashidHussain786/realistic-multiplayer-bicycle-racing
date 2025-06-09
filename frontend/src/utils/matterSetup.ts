import { World, Bodies, Composite, Constraint, Body } from 'matter-js';
import bicyclePlayer1Sprite from '../assets/bicycle_player1.png';
import bicyclePlayer2Sprite from '../assets/bicycle_player2.png';
import oilSlickSprite from '../assets/oil_slick.png';
import potholeSprite from '../assets/pothole.png';

/**
 * @file matterSetup.ts
 * @description This module contains utility functions for creating various Matter.js game entities
 * such as bicycles, coins, track walls, and hazards. These functions encapsulate the
 * detailed Matter.js body creation logic, making the main game screen component cleaner.
 */

/**
 * Creates a bicycle composite, including wheels, frame, and axles.
 * @param x The initial x-coordinate for the center of the bicycle frame.
 * @param y The initial y-coordinate for the center of the bicycle frame.
 * @param playerType Distinguishes between 'player1' and 'player2' for sprite selection.
 * @returns A Matter.js Composite representing the bicycle.
 */
export const createBicycle = (x: number, y: number, playerType: 'player1' | 'player2'): Composite => {
  const group = Body.nextGroup(true); // Ensures parts of the same bicycle don't self-collide
  const wheelRadius = 20;
  const wheelGap = 50; // Distance from center of frame to center of wheels horizontally
  const frameHeight = 30;
  const frameWidth = 100;

  // Wheels
  const selectedSprite = playerType === 'player1' ? bicyclePlayer1Sprite : bicyclePlayer2Sprite;

  // Wheels
  const wheelA = Bodies.circle(x - wheelGap, y + frameHeight / 2, wheelRadius, {
    label: 'wheelA', // Front wheel
    collisionFilter: { group: group },
    friction: 0.8,
    render: {
      visible: false,
    },
  });
  const wheelB = Bodies.circle(x + wheelGap, y + frameHeight / 2, wheelRadius, {
    label: 'wheelB', // Rear wheel
    collisionFilter: { group: group },
    friction: 0.8,
    render: {
      visible: false,
    },
  });

  // Frame
  const frame = Bodies.rectangle(x, y, frameWidth, frameHeight, {
    label: 'frame',
    collisionFilter: { group: group },
    density: 0.005, // Density affects mass and thus inertia
    render: {
      sprite: {
        texture: selectedSprite,
        xScale: 0.5, // Adjust as needed based on sprite dimensions vs body
        yScale: 0.5, // Adjust as needed
      },
    },
  });

  // Axles: Constraints that connect the wheels to the frame
  const axleA = Constraint.create({
    bodyA: frame,
    pointA: { x: -wheelGap, y: 0 }, // Connection point on the frame (relative to frame's center)
    bodyB: wheelA,
    pointB: { x: 0, y: 0 }, // Connection point on the wheel (relative to wheel's center)
    stiffness: 1.0, // High stiffness to make it a rigid connection
    length: 0, // Zero length makes it act like a pin joint
  });

  const axleB = Constraint.create({
    bodyA: frame,
    pointA: { x: wheelGap, y: 0 },
    bodyB: wheelB,
    pointB: { x: 0, y: 0 },
    stiffness: 1.0,
    length: 0,
  });

  const bicycleComposite = Composite.create({ label: 'Bicycle' }); // Create a composite to group all bicycle parts
  Composite.add(bicycleComposite, wheelA);
  Composite.add(bicycleComposite, wheelB);
  Composite.add(bicycleComposite, frame);
  Composite.add(bicycleComposite, axleA);
  Composite.add(bicycleComposite, axleB);

  return bicycleComposite;
};

/**
 * Creates a static, sensor coin body.
 * @param x The x-coordinate for the center of the coin.
 * @param y The y-coordinate for the center of the coin.
 * @returns A Matter.js Body representing the coin.
 */
export const createCoin = (x: number, y: number): Body => {
  const coinRadius = 10;
  const coin = Bodies.circle(x, y, coinRadius, {
    isStatic: true, // Coins don't move
    isSensor: true, // Coins trigger collision events but don't cause physical reactions
    label: 'coin',
    render: {
      fillStyle: '#FFD700', // Gold color for placeholder rendering
    },
  });
  return coin;
};

/**
 * Creates the walls for the racetrack and adds them to the given world.
 * This includes outer and inner straight walls, and approximated curved corners.
 * @param world The Matter.js World to add the walls to.
 * @param canvasWidth The width of the game canvas, used for centering the track.
 * @param canvasHeight The height of the game canvas, used for centering the track.
 */
export const createTrackWalls = (world: World, canvasWidth: number, canvasHeight: number) => {
  // TODO: Consider making track dimensions and corner properties configurable if track variations are needed.
  const trackOuterWidth = 700;
  const trackOuterHeight = 450;
  const trackInnerWidth = 500;
  const trackInnerHeight = 250;
  const wallThickness = 20;
  const trackCenterX = canvasWidth / 2;
  const trackCenterY = canvasHeight / 2;
  const trackWallStyle = { isStatic: true, label: 'trackWall', render: { fillStyle: '#3333FF' } };

  const wallBodies = [];

  // Outer walls
  wallBodies.push(Bodies.rectangle(trackCenterX, trackCenterY - trackOuterHeight / 2 + wallThickness / 2, trackOuterWidth - 2 * 100, wallThickness, trackWallStyle));
  wallBodies.push(Bodies.rectangle(trackCenterX, trackCenterY + trackOuterHeight / 2 - wallThickness / 2, trackOuterWidth - 2 * 100, wallThickness, trackWallStyle));
  wallBodies.push(Bodies.rectangle(trackCenterX - trackOuterWidth / 2 + wallThickness / 2, trackCenterY, wallThickness, trackOuterHeight - 2 * 100, trackWallStyle));
  wallBodies.push(Bodies.rectangle(trackCenterX + trackOuterWidth / 2 - wallThickness / 2, trackCenterY, wallThickness, trackOuterHeight - 2 * 100, trackWallStyle));

  // Inner walls
  wallBodies.push(Bodies.rectangle(trackCenterX, trackCenterY - trackInnerHeight / 2 + wallThickness / 2, trackInnerWidth - 2 * 50, wallThickness, trackWallStyle));
  wallBodies.push(Bodies.rectangle(trackCenterX, trackCenterY + trackInnerHeight / 2 - wallThickness / 2, trackInnerWidth - 2 * 50, wallThickness, trackWallStyle));
  wallBodies.push(Bodies.rectangle(trackCenterX - trackInnerWidth / 2 + wallThickness / 2, trackCenterY, wallThickness, trackInnerHeight - 2 * 50, trackWallStyle));
  wallBodies.push(Bodies.rectangle(trackCenterX + trackInnerWidth / 2 - wallThickness / 2, trackCenterY, wallThickness, trackInnerHeight - 2 * 50, trackWallStyle));

  // Corner approximations
  const cornerSegments = 6;
  const segmentAngle = Math.PI / 2 / cornerSegments;

  // Outer corners
  for (let i = 0; i < cornerSegments; i++) {
    const angle = Math.PI + i * segmentAngle + segmentAngle / 2;
    const x = trackCenterX - (trackOuterWidth / 2 - 100) + Math.cos(angle) * (100 - wallThickness / 2);
    const y = trackCenterY - (trackOuterHeight / 2 - 100) + Math.sin(angle) * (100 - wallThickness / 2);
    wallBodies.push(Bodies.rectangle(x, y, 50, wallThickness, { ...trackWallStyle, angle: angle + Math.PI / 2 }));
  }
  for (let i = 0; i < cornerSegments; i++) {
    const angle = Math.PI * 1.5 + i * segmentAngle + segmentAngle / 2;
    const x = trackCenterX + (trackOuterWidth / 2 - 100) + Math.cos(angle) * (100 - wallThickness / 2);
    const y = trackCenterY - (trackOuterHeight / 2 - 100) + Math.sin(angle) * (100 - wallThickness / 2);
    wallBodies.push(Bodies.rectangle(x, y, 50, wallThickness, { ...trackWallStyle, angle: angle + Math.PI / 2 }));
  }
  for (let i = 0; i < cornerSegments; i++) {
    const angle = Math.PI * 0.5 + i * segmentAngle + segmentAngle / 2;
    const x = trackCenterX - (trackOuterWidth / 2 - 100) + Math.cos(angle) * (100 - wallThickness / 2);
    const y = trackCenterY + (trackOuterHeight / 2 - 100) + Math.sin(angle) * (100 - wallThickness / 2);
    wallBodies.push(Bodies.rectangle(x, y, 50, wallThickness, { ...trackWallStyle, angle: angle + Math.PI / 2 }));
  }
  for (let i = 0; i < cornerSegments; i++) {
    const angle = 0 + i * segmentAngle + segmentAngle / 2;
    const x = trackCenterX + (trackOuterWidth / 2 - 100) + Math.cos(angle) * (100 - wallThickness / 2);
    const y = trackCenterY + (trackOuterHeight / 2 - 100) + Math.sin(angle) * (100 - wallThickness / 2);
    wallBodies.push(Bodies.rectangle(x, y, 50, wallThickness, { ...trackWallStyle, angle: angle + Math.PI / 2 }));
  }

  // Inner corners
  for (let i = 0; i < cornerSegments; i++) {
    const angle = Math.PI + i * segmentAngle + segmentAngle / 2;
    const x = trackCenterX - (trackInnerWidth / 2 - 50) + Math.cos(angle) * (50 - wallThickness / 2);
    const y = trackCenterY - (trackInnerHeight / 2 - 50) + Math.sin(angle) * (50 - wallThickness / 2);
    wallBodies.push(Bodies.rectangle(x, y, 40, wallThickness, { ...trackWallStyle, angle: angle + Math.PI / 2 }));
  }
  for (let i = 0; i < cornerSegments; i++) {
    const angle = Math.PI * 1.5 + i * segmentAngle + segmentAngle / 2;
    const x = trackCenterX + (trackInnerWidth / 2 - 50) + Math.cos(angle) * (50 - wallThickness / 2);
    const y = trackCenterY - (trackInnerHeight / 2 - 50) + Math.sin(angle) * (50 - wallThickness / 2);
    wallBodies.push(Bodies.rectangle(x, y, 40, wallThickness, { ...trackWallStyle, angle: angle + Math.PI / 2 }));
  }
  for (let i = 0; i < cornerSegments; i++) {
    const angle = Math.PI * 0.5 + i * segmentAngle + segmentAngle / 2;
    const x = trackCenterX - (trackInnerWidth / 2 - 50) + Math.cos(angle) * (50 - wallThickness / 2);
    const y = trackCenterY + (trackInnerHeight / 2 - 50) + Math.sin(angle) * (50 - wallThickness / 2);
    wallBodies.push(Bodies.rectangle(x, y, 40, wallThickness, { ...trackWallStyle, angle: angle + Math.PI / 2 }));
  }
  for (let i = 0; i < cornerSegments; i++) {
    const angle = 0 + i * segmentAngle + segmentAngle / 2;
    const x = trackCenterX + (trackInnerWidth / 2 - 50) + Math.cos(angle) * (50 - wallThickness / 2);
    const y = trackCenterY + (trackInnerHeight / 2 - 50) + Math.sin(angle) * (50 - wallThickness / 2);
    wallBodies.push(Bodies.rectangle(x, y, 40, wallThickness, { ...trackWallStyle, angle: angle + Math.PI / 2 }));
  }

  World.add(world, wallBodies);
  // console.log(`Created ${wallBodies.length} track wall segments.`); // Optional: for debugging
};

/**
 * Creates hazard bodies (potholes and oil slicks) and adds them to the given world.
 * Hazard positions are currently hardcoded relative to track dimensions.
 * @param world The Matter.js World to add the hazards to.
 * @param canvasWidth The width of the game canvas, used for positioning.
 * @param canvasHeight The height of the game canvas, used for positioning.
 */
export const createHazards = (world: World, canvasWidth: number, canvasHeight: number) => {
  // TODO: Consider making hazard types, properties, and positions configurable.
  const trackOuterHeight = 450; // Assuming these dimensions are consistent with createTrackWalls
  const trackInnerHeight = 250;
  const trackInnerWidth = 500;
  const trackOuterWidth = 700;
  const trackCenterX = canvasWidth / 2;
  const trackCenterY = canvasHeight / 2;

  const potholeRadius = 18;
  const potholeStyle = {
    isStatic: true,
    isSensor: true,
    label: 'pothole',
    render: {
      sprite: {
        texture: potholeSprite,
        xScale: 0.5, // Adjust as needed
        yScale: 0.5, // Adjust as needed
      },
    },
  };
  const oilSlickStyle = {
    isStatic: true,
    isSensor: true,
    label: 'oilSlick',
    render: {
      sprite: {
        texture: oilSlickSprite,
        xScale: 0.5, // Adjust as needed
        yScale: 0.5, // Adjust as needed
      },
    },
  };

  const p1x = trackCenterX + 50;
  const p1y = trackCenterY - (trackInnerHeight / 2) - ((trackOuterHeight - trackInnerHeight) / 4);
  const p2x = trackCenterX - 50;
  const p2y = trackCenterY + (trackInnerHeight / 2) + ((trackOuterHeight - trackInnerHeight) / 4);
  const o1x = trackCenterX - (trackInnerWidth / 2) - ((trackOuterWidth - trackInnerWidth) / 4);
  const o1y = trackCenterY - 50;
  const o2x = trackCenterX + (trackInnerWidth / 2) + ((trackOuterWidth - trackInnerWidth) / 4);
  const o2y = trackCenterY + 50;

  const hazardBodies = [
    Bodies.circle(p1x, p1y, potholeRadius, potholeStyle),
    Bodies.circle(p2x, p2y, potholeRadius, potholeStyle),
    Bodies.rectangle(o1x, o1y, 80, 30, { ...oilSlickStyle, angle: Math.PI / 2 }),
    Bodies.rectangle(o2x, o2y, 80, 30, { ...oilSlickStyle, angle: Math.PI / 2 }),
  ];

  World.add(world, hazardBodies);
  // console.log(`Created ${hazardBodies.length} hazard bodies.`); // Optional: for debugging
};
