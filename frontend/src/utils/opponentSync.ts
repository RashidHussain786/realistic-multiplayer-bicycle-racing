import type { GameState } from '../types/GameState';

/**
 * @file opponentSync.ts
 * @description This module provides a manager for buffering and interpolating opponent game states
 * to achieve smoother remote entity synchronization.
 */

/**
 * Represents a game state entry stored in the buffer, augmented with the time it was received.
 */
export interface BufferedGameState {
  /** The game state received from the opponent. */
  state: GameState;
  /** The local timestamp (performance.now()) when the state was received. */
  receivedTime: number;
}

/**
 * Represents the visual state of the opponent, typically after interpolation, ready for rendering.
 */
export interface OpponentVisualState {
  /** Interpolated position (x, y coordinates). */
  position: { x: number; y: number };
  /** Interpolated angle. */
  angle: number;
  /** Interpolated wheel speed (typically taken from the more recent state in interpolation). */
  wheelSpeed: number;
}

/** Default number of states to keep in the buffer. */
const DEFAULT_BUFFER_SIZE_LIMIT = 60; // Store states for about 1 second at 60hz if states arrive at 60hz
/** Default delay (in milliseconds) to render opponent states, helps absorb jitter. */
const DEFAULT_RENDER_DELAY = 100; // ms

/**
 * Manages buffering of opponent game states and provides interpolation
 * to smooth out perceived movement and handle network jitter.
 */
export class OpponentSyncManager {
  private buffer: BufferedGameState[] = [];
  private bufferSizeLimit: number;
  private renderDelay: number; // The delay used for interpolation target time.

  /**
   * Constructs an OpponentSyncManager.
   * @param bufferSizeLimit The maximum number of game states to store in the buffer.
   * @param renderDelay The delay (in ms) behind the current time for which to interpolate states.
   */
  constructor(bufferSizeLimit: number = DEFAULT_BUFFER_SIZE_LIMIT, renderDelay: number = DEFAULT_RENDER_DELAY) {
    this.bufferSizeLimit = bufferSizeLimit;
    this.renderDelay = renderDelay;
  }

  /**
   * Adds a new game state received from the opponent to the buffer.
   * Manages the buffer size by removing the oldest state if the limit is exceeded.
   * @param gameState The game state received from the opponent.
   */
  public addState(gameState: GameState): void {
    const receivedTime = performance.now(); // Timestamp locally when state is added
    this.buffer.push({ state: gameState, receivedTime });

    // Trim the buffer if it exceeds the size limit
    if (this.buffer.length > this.bufferSizeLimit) {
      this.buffer.shift(); // Remove the oldest state
    }
  }

  /**
   * Calculates an interpolated visual state for the opponent based on the buffered states
   * and a given render timestamp.
   * @param renderTimestamp The current timestamp (e.g., performance.now()) for which to calculate the state.
   * @returns An OpponentVisualState if interpolation is possible, otherwise null.
   */
  public getInterpolatedState(renderTimestamp: number): OpponentVisualState | null {
    if (this.buffer.length === 0) {
      return null; // Not enough data
    }

    // Target time for interpolation is renderTimestamp minus the renderDelay
    const targetTime = renderTimestamp - this.renderDelay;

    let s1: BufferedGameState | null = null; // State snapshot before or at targetTime
    let s2: BufferedGameState | null = null;

    // Find the two states in the buffer that surround the targetTime
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].state.timestamp <= targetTime) {
        s1 = this.buffer[i];
        if (i + 1 < this.buffer.length) {
          s2 = this.buffer[i + 1];
        }
        break;
      }
    }

    if (s1 && s2) {
      // Interpolate between s1 and s2
      const t1 = s1.state.timestamp;
      const t2 = s2.state.timestamp;
      let factor = 0;

      if (t2 - t1 > 0) {
        factor = (targetTime - t1) / (t2 - t1);
      }
      factor = Math.max(0, Math.min(1, factor)); // Clamp factor to [0, 1]

      const interpolatedX = s1.state.position.x + (s2.state.position.x - s1.state.position.x) * factor;
      const interpolatedY = s1.state.position.y + (s2.state.position.y - s1.state.position.y) * factor;

      // Handle angle interpolation carefully for wrap-around (e.g. -PI to PI)
      // For simplicity, using linear interpolation. More robust solution might be needed if bikes spin fast.
      const interpolatedAngle = s1.state.angle + (s2.state.angle - s1.state.angle) * factor;

      return {
        position: { x: interpolatedX, y: interpolatedY },
        angle: interpolatedAngle,
        wheelSpeed: s2.state.wheelSpeed, // Typically use the more recent wheel speed
      };
    } else if (s1) {
      // Not enough data to interpolate, use the latest state before or at targetTime (s1)
      // Or, could use the most recent state in buffer if s1 is too old.
      // For now, using s1, which is common practice if s2 is not available.
      return {
        position: { ...s1.state.position },
        angle: s1.state.angle,
        wheelSpeed: s1.state.wheelSpeed,
      };
    } else if (this.buffer.length > 0) {
      // If no state is older than targetTime (all states are newer), use the oldest state we have (first in buffer)
      // This might happen if RENDER_DELAY is very small or network latency is high
      const oldestState = this.buffer[0];
       return {
        position: { ...oldestState.state.position },
        angle: oldestState.state.angle,
        wheelSpeed: oldestState.state.wheelSpeed,
      };
    }

    return null; // No suitable state found
  }

  public getLatestCurrency(): number | null {
    if (this.buffer.length > 0) {
      return this.buffer[this.buffer.length - 1].state.currency;
    }
    return null;
  }
}
