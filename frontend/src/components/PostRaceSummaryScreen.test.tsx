import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest/globals'; // Using Vitest's mocking
import PostRaceSummaryScreen from './PostRaceSummaryScreen';

describe('PostRaceSummaryScreen', () => {
  const mockWinnerName = 'Player One';
  const mockFinalCurrency = 1250;
  const mockOnReturnToMainMenu = vi.fn();

  beforeEach(() => {
    // Reset mock before each test
    mockOnReturnToMainMenu.mockClear();
  });

  test('renders winner name and final currency correctly', () => {
    render(
      <PostRaceSummaryScreen
        winnerName={mockWinnerName}
        finalPlayerCurrency={mockFinalCurrency}
        onReturnToMainMenu={mockOnReturnToMainMenu}
      />
    );

    // Check for "Race Over!" title
    expect(screen.getByText('Race Over!')).toBeInTheDocument();

    // Check for winner name
    expect(screen.getByText(`Winner: ${mockWinnerName}`)).toBeInTheDocument();

    // Check for final currency
    expect(screen.getByText(`Your Final Currency: ${mockFinalCurrency}`)).toBeInTheDocument();
  });

  test('calls onReturnToMainMenu when the button is clicked', () => {
    render(
      <PostRaceSummaryScreen
        winnerName="Test Winner"
        finalPlayerCurrency={100}
        onReturnToMainMenu={mockOnReturnToMainMenu}
      />
    );

    const returnButton = screen.getByRole('button', { name: /return to main menu/i });
    expect(returnButton).toBeInTheDocument();

    fireEvent.click(returnButton);

    expect(mockOnReturnToMainMenu).toHaveBeenCalledTimes(1);
  });

  test('displays different winner and currency', () => {
    const differentWinner = 'CPU Opponent';
    const differentCurrency = 50;
    render(
      <PostRaceSummaryScreen
        winnerName={differentWinner}
        finalPlayerCurrency={differentCurrency}
        onReturnToMainMenu={mockOnReturnToMainMenu}
      />
    );

    expect(screen.getByText(`Winner: ${differentWinner}`)).toBeInTheDocument();
    expect(screen.getByText(`Your Final Currency: ${differentCurrency}`)).toBeInTheDocument();
  });
});
