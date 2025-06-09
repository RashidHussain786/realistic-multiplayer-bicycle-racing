import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import { AppScreen } from './types/AppScreen';

// Mock child components
jest.mock('./components/MainMenu', () => ({
  __esModule: true,
  default: jest.fn(({ navigateToMatchmaking }) => (
    <div data-testid="main-menu">
      <button onClick={navigateToMatchmaking}>Go to Matchmaking</button>
    </div>
  )),
}));

jest.mock('./components/MatchmakingScreen', () => ({
  __esModule: true,
  default: jest.fn(({ navigateToGame }) => (
    <div data-testid="matchmaking-screen">
      <button onClick={navigateToGame}>Go to Game</button>
    </div>
  )),
}));

jest.mock('./components/GameScreen', () => ({
  __esModule: true,
  default: jest.fn(({ onRaceEnd }) => (
    <div data-testid="game-screen">
      <button onClick={() => onRaceEnd('Test Player', 150)}>End Race</button>
    </div>
  )),
}));

jest.mock('./components/PostRaceSummaryScreen', () => ({
  __esModule: true,
  default: jest.fn(({ winnerName, finalPlayerCurrency, onReturnToMainMenu }) => (
    <div data-testid="post-race-summary-screen">
      <h1>Winner: {winnerName}</h1>
      <p>Currency: {finalPlayerCurrency}</p>
      <button onClick={onReturnToMainMenu}>Return to Main Menu</button>
    </div>
  )),
}));


describe('App Component State Transitions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('renders MainMenu by default', () => {
    render(<App />);
    expect(screen.getByTestId('main-menu')).toBeInTheDocument();
  });

  test('navigates to MatchmakingScreen when navigateToMatchmaking is called', () => {
    render(<App />);
    act(() => {
      screen.getByText('Go to Matchmaking').click();
    });
    expect(screen.getByTestId('matchmaking-screen')).toBeInTheDocument();
  });

  test('navigates to GameScreen when navigateToGame is called', () => {
    render(<App />);
    // First, navigate to Matchmaking
    act(() => {
      screen.getByText('Go to Matchmaking').click();
    });
    // Then, navigate to Game
    act(() => {
      screen.getByText('Go to Game').click();
    });
    expect(screen.getByTestId('game-screen')).toBeInTheDocument();
  });

  test('navigates to PostRaceSummaryScreen with correct data when handleRaceEnd is called', () => {
    render(<App />);
    // Navigate to GameScreen first
    act(() => {
      screen.getByText('Go to Matchmaking').click();
    });
    act(() => {
      screen.getByText('Go to Game').click();
    });

    // Simulate GameScreen calling onRaceEnd
    act(() => {
      screen.getByText('End Race').click(); // This button in the mock calls onRaceEnd('Test Player', 150)
    });

    expect(screen.getByTestId('post-race-summary-screen')).toBeInTheDocument();
    expect(screen.getByText('Winner: Test Player')).toBeInTheDocument();
    expect(screen.getByText('Currency: 150')).toBeInTheDocument();
  });

  test('navigates back to MainMenu from PostRaceSummaryScreen', () => {
    render(<App />);
    // Navigate all the way to PostRaceSummaryScreen
    act(() => {
      screen.getByText('Go to Matchmaking').click();
    });
    act(() => {
      screen.getByText('Go to Game').click();
    });
    act(() => {
      screen.getByText('End Race').click();
    });

    // Now, click the button to return to MainMenu
    act(() => {
      screen.getByText('Return to Main Menu').click();
    });
    expect(screen.getByTestId('main-menu')).toBeInTheDocument();
  });
});
