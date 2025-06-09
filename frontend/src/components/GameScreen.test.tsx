import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import GameScreen from './GameScreen';
import type { GameState } from '../types/GameState';

// Add RACE_DURATION_MS constant
const RACE_DURATION_MS = 30000; // 30 seconds race duration

// Mock image assets
jest.mock('../assets/sky_background.png', () => 'sky_background.png');
jest.mock('../assets/mountain_layer_1.png', () => 'mountain_layer_1.png');
jest.mock('../assets/mountain_layer_2.png', () => 'mountain_layer_2.png');
jest.mock('../assets/mountain_layer_3.png', () => 'mountain_layer_3.png');

// Mock webRTCService
const mockSendGameState = jest.fn();
const mockSetOnGameStateReceived = jest.fn();
jest.mock('../services/WebRTCService', () => ({
  __esModule: true,
  default: {
    sendGameState: mockSendGameState,
    setOnGameStateReceived: mockSetOnGameStateReceived,
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    setOnConnect: jest.fn(),
    setOnDisconnect: jest.fn(),
    setOnError: jest.fn(),
  },
}));

// Mock Matter.js
const mockEngine = {
  Engine: {
    create: jest.fn().mockReturnValue({
      world: { bodies: [] as any[], gravity: { x: 0, y: 1 } },
      on: jest.fn(),
      off: jest.fn(),
      clear: jest.fn(),
    }),
  },
  Render: {
    create: jest.fn().mockReturnValue({
      canvas: document.createElement('canvas'),
      stop: jest.fn(),
    }),
    run: jest.fn(),
    stop: jest.fn(),
  },
  Runner: {
    create: jest.fn().mockReturnValue({
      id: 'runner-id'
    }),
    run: jest.fn(),
    stop: jest.fn(),
  },
  World: {
    add: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
  Bodies: {
    rectangle: jest.fn().mockImplementation((x, y, _width, _height, options) => ({
      id: Math.random(),
      label: options?.label || 'rectangle',
      position: { x, y },
      ...options,
    })),
    circle: jest.fn().mockImplementation((x, y, _radius, options) => ({
      id: Math.random(),
      label: options?.label || 'circle',
      position: { x, y },
      velocity: { x: 0, y: 0 },
      angularVelocity: 0,
      ...options,
    })),
  },
  Body: {
    nextGroup: jest.fn().mockReturnValue(0),
    set: jest.fn(),
    applyForce: jest.fn(),
    setVelocity: jest.fn(),
    setAngularVelocity: jest.fn(),
    setPosition: jest.fn(),
    setAngle: jest.fn(),
  },
  Composite: {
    create: jest.fn().mockImplementation(() => ({
      bodies: [],
      constraints: [],
      composites: [],
      label: 'composite'
    })),
    addBody: jest.fn(),
    addConstraint: jest.fn(),
    get: jest.fn(),
    allBodies: jest.fn(),
    clear: jest.fn(),
  },
  Constraint: {
    create: jest.fn().mockImplementation(options => ({
      id: Math.random(),
      ...options,
    })),
  },
  Events: {
    on: jest.fn(),
    off: jest.fn(),
  },
};

jest.mock('matter-js', () => mockEngine);

// To store the collision callback
let collisionStartCallback: ((event: any) => void) | null = null;

describe('GameScreen Coin Collection', () => {
  const mockPlayerId = 'player1';
  const mockOpponentId = 'player2';
  const mockOnDisconnect = jest.fn();
  const mockOnSendMessage = jest.fn();
  const mockOnRaceEnd = jest.fn();

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    collisionStartCallback = null;

    // Reset specific mock implementations
    mockEngine.Engine.create.mockReturnValue({
      world: { bodies: [], gravity: { x: 0, y: 1 } },
      on: jest.fn(),
      off: jest.fn(),
      clear: jest.fn()
    });

    mockEngine.World.add.mockImplementation((world, bodyOrComposite) => {
      if (Array.isArray(bodyOrComposite)) {
        world.bodies.push(...bodyOrComposite);
      } else {
        world.bodies.push(bodyOrComposite);
      }
    });

    mockEngine.World.remove.mockImplementation((world, bodyToRemove) => {
      world.bodies = world.bodies.filter((b: any) => b.id !== bodyToRemove.id);
    });

    mockEngine.Events.on.mockImplementation((engineInstance, eventName, callback) => {
      if (eventName === 'collisionStart') {
        collisionStartCallback = callback;
      }
      (engineInstance as any)[eventName + 'Callback'] = callback;
    });

    // Mock bicycle parts
    const mockWheelA = { id: 'wheelA_id', label: 'wheelA' };
    const mockWheelB = { id: 'wheelB_id', label: 'wheelB' };
    const mockFrame = { id: 'frame_id', label: 'frame' };

    mockEngine.Composite.get.mockImplementation((_composite, label, type) => {
      if (type === 'body') {
        if (label === 'wheelA') return mockWheelA;
        if (label === 'wheelB') return mockWheelB;
        if (label === 'frame') return mockFrame;
      }
      return null;
    });

    mockEngine.Composite.allBodies.mockImplementation((composite) => {
      if (composite && composite.label === 'Bicycle') {
        return [mockWheelA, mockWheelB, mockFrame];
      }
      return [];
    });
  });

  test('increments currency on coin collection', async () => {
    render(
      <GameScreen
        opponentId={mockOpponentId}
        playerId={mockPlayerId}
        onDisconnect={mockOnDisconnect}
        onSendMessage={mockOnSendMessage}
        lastMessageReceived={null}
        onRaceEnd={mockOnRaceEnd}
      />
    );

    // Check initial points display
    expect(screen.getByText((content) => content.startsWith('Points:'))).toHaveTextContent('Points: 0');

    // Ensure collision callback was registered
    expect(collisionStartCallback).not.toBeNull();

    const playerBodyPart = { id: 'frame_id', label: 'frame' };
    const coinBody = {
      id: 'coin1_id',
      label: 'coin',
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      angularVelocity: 0
    };

    // Add coin to world
    const worldInstance = mockEngine.Engine.create().world;
    mockEngine.World.add(worldInstance, coinBody);

    // Simulate collision
    await act(async () => {
      if (collisionStartCallback) {
        collisionStartCallback({
          pairs: [
            { bodyA: playerBodyPart, bodyB: coinBody },
          ],
        });
      }
    });

    // Check that points increased (assuming COIN_VALUE is 10)
    expect(screen.getByText((content) => content.startsWith('Points:'))).toHaveTextContent('Points: 10');
  });

  test('removes coin from world and state on collection', async () => {
    const worldRemoveSpy = jest.spyOn(mockEngine.World, 'remove');

    render(
      <GameScreen
        opponentId={mockOpponentId}
        playerId={mockPlayerId}
        onDisconnect={mockOnDisconnect}
        onSendMessage={mockOnSendMessage}
        lastMessageReceived={null}
        onRaceEnd={mockOnRaceEnd}
      />
    );

    expect(collisionStartCallback).not.toBeNull();

    const playerBodyPart = { id: 'frame_id', label: 'frame' };
    const coinId = 'coin_to_collect_id';
    const coinBodyToCollect = {
      id: coinId,
      label: 'coin',
      position: { x: 10, y: 10 },
      velocity: { x: 0, y: 0 },
      angularVelocity: 0
    };

    const worldInstance = mockEngine.Engine.create().world;
    mockEngine.World.add(worldInstance, coinBodyToCollect);

    await act(async () => {
      if (collisionStartCallback) {
        collisionStartCallback({
          pairs: [
            { bodyA: playerBodyPart, bodyB: coinBodyToCollect },
          ],
        });
      }
    });

    // Check that World.remove was called
    expect(worldRemoveSpy).toHaveBeenCalledTimes(1);
    expect(worldRemoveSpy.mock.calls[0][1]).toBe(coinBodyToCollect);

    // Verify coin is removed from world
    expect(worldInstance.bodies.find((b: any) => b.id === coinId)).toBeUndefined();

    worldRemoveSpy.mockRestore();
  });
});

describe('GameScreen Race Winner Logic', () => {
  const mockPlayerId = 'player1_race_test';
  const mockOpponentId = 'player2_race_test';
  const mockOnDisconnect = jest.fn();
  const mockOnSendMessage = jest.fn();
  const mockOnRaceEnd = jest.fn();

  let lastSetOnGameStateReceivedCallback: ((state: GameState) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    lastSetOnGameStateReceivedCallback = null;

    // Store the callback passed to setOnGameStateReceived
    mockSetOnGameStateReceived.mockImplementation((callback) => {
      lastSetOnGameStateReceivedCallback = callback;
    });

    // Mock requestAnimationFrame for testing
    global.requestAnimationFrame = jest.fn((cb) => {
      cb(performance.now());
      return 1;
    });
    global.cancelAnimationFrame = jest.fn();

    // Set up default mocks for bicycle components
    mockEngine.Composite.get.mockImplementation((_composite, label, type) => {
      if (type === 'body' && label === 'frame') {
        return { position: { x: 100, y: 100 }, label: 'frame' };
      }
      if (type === 'body' && label === 'wheelB') {
        return { id: 'wheelB_id', label: 'wheelB', angularVelocity: 0, velocity: { x: 0, y: 0 } };
      }
      return null;
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    (global.requestAnimationFrame as jest.Mock).mockRestore();
    (global.cancelAnimationFrame as jest.Mock).mockRestore();
  });

  test("calls onRaceEnd with 'Player' as winner if player has more currency", () => {
    render(
      <GameScreen
        opponentId={mockOpponentId}
        playerId={mockPlayerId}
        onDisconnect={mockOnDisconnect}
        onSendMessage={mockOnSendMessage}
        lastMessageReceived={null}
        onRaceEnd={mockOnRaceEnd}
      />
    );

    // Set opponent currency to 50
    if (lastSetOnGameStateReceivedCallback) {
      act(() => {
        lastSetOnGameStateReceivedCallback!({
          position: { x: 50, y: 100 },
          angle: 0,
          wheelSpeed: 0,
          currency: 50,
          timestamp: Date.now() - 1000
        });
      });
    }

    // Advance time to trigger race end
    act(() => {
      jest.advanceTimersByTime(RACE_DURATION_MS);
    });

    expect(mockOnRaceEnd).toHaveBeenCalledWith("Player", expect.any(Number));
  });

  test("calls onRaceEnd with 'Opponent' as winner if opponent has more currency", () => {
    render(
      <GameScreen
        opponentId={mockOpponentId}
        playerId={mockPlayerId}
        onDisconnect={mockOnDisconnect}
        onSendMessage={mockOnSendMessage}
        lastMessageReceived={null}
        onRaceEnd={mockOnRaceEnd}
      />
    );

    // Set opponent currency to 150
    if (lastSetOnGameStateReceivedCallback) {
      act(() => {
        lastSetOnGameStateReceivedCallback!({
          position: { x: 50, y: 100 },
          angle: 0,
          wheelSpeed: 0,
          currency: 150,
          timestamp: Date.now() - 1000
        });
      });
    }

    act(() => {
      jest.advanceTimersByTime(RACE_DURATION_MS);
    });

    expect(mockOnRaceEnd).toHaveBeenCalledWith("Opponent", expect.any(Number));
  });

  test("calls onRaceEnd with 'Player' as winner if currencies are equal and player is further", () => {
    render(
      <GameScreen
        opponentId={mockOpponentId}
        playerId={mockPlayerId}
        onDisconnect={mockOnDisconnect}
        onSendMessage={mockOnSendMessage}
        lastMessageReceived={null}
        onRaceEnd={mockOnRaceEnd}
      />
    );

    // Set opponent currency equal but position behind
    if (lastSetOnGameStateReceivedCallback) {
      act(() => {
        lastSetOnGameStateReceivedCallback!({
          position: { x: 50, y: 100 }, // Behind player (x: 100)
          angle: 0,
          wheelSpeed: 0,
          currency: 0, // Same as initial player currency
          timestamp: Date.now() - 1000
        });
      });
    }

    act(() => {
      jest.advanceTimersByTime(RACE_DURATION_MS);
    });

    expect(mockOnRaceEnd).toHaveBeenCalledWith("Player", 0);
  });

  test("calls onRaceEnd with 'Opponent' as winner if currencies are equal and opponent is further", () => {
    render(
      <GameScreen
        opponentId={mockOpponentId}
        playerId={mockPlayerId}
        onDisconnect={mockOnDisconnect}
        onSendMessage={mockOnSendMessage}
        lastMessageReceived={null}
        onRaceEnd={mockOnRaceEnd}
      />
    );

    if (lastSetOnGameStateReceivedCallback) {
      act(() => {
        lastSetOnGameStateReceivedCallback!({
          position: { x: 200, y: 100 }, // Ahead of player (x: 100)
          angle: 0,
          wheelSpeed: 0,
          currency: 0,
          timestamp: Date.now() - 1000
        });
      });
    }

    act(() => {
      jest.advanceTimersByTime(RACE_DURATION_MS);
    });

    expect(mockOnRaceEnd).toHaveBeenCalledWith("Opponent", 0);
  });

  test("calls onRaceEnd with 'Player' as winner if currencies and positions are equal", () => {
    render(
      <GameScreen
        opponentId={mockOpponentId}
        playerId={mockPlayerId}
        onDisconnect={mockOnDisconnect}
        onSendMessage={mockOnSendMessage}
        lastMessageReceived={null}
        onRaceEnd={mockOnRaceEnd}
      />
    );

    if (lastSetOnGameStateReceivedCallback) {
      act(() => {
        lastSetOnGameStateReceivedCallback!({
          position: { x: 100, y: 100 }, // Same as player position
          angle: 0,
          wheelSpeed: 0,
          currency: 0, // Same as player currency
          timestamp: Date.now() - 1000
        });
      });
    }

    act(() => {
      jest.advanceTimersByTime(RACE_DURATION_MS);
    });

    expect(mockOnRaceEnd).toHaveBeenCalledWith("Player", 0);
  });
});