// frontend/src/types/GameState.ts
export interface GameState {
  position: { x: number; y: number }; // For the bicycle's frame
  angle: number; // For the bicycle frame's orientation
  wheelSpeed: number; // For the rear wheel's angular velocity (to represent pedaling)
  currency: number; // Player's current in-game currency
  timestamp: number; // For when the state was generated
}
