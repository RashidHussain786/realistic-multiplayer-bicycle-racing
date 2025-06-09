// frontend/src/components/MatchmakingScreen.test.tsx
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MatchmakingScreen from './MatchmakingScreen';

describe('MatchmakingScreen Component', () => {
  const statusText = "Searching for players...";
  const playerId = "testPlayer123";

  test('renders with status text and player ID', () => {
    render(<MatchmakingScreen statusText={statusText} playerId={playerId} navigateToGame={() => {}} />);

    // Check for status text
    expect(screen.getByText(statusText)).toBeInTheDocument();

    // Check for player ID (text is constructed like "(Your ID: testPlayer123)")
    expect(screen.getByText(`(Your ID: ${playerId})`)).toBeInTheDocument();

    // Check for loading spinner image by its alt text
    const spinnerImage = screen.getByAltText('Loading...');
    expect(spinnerImage).toBeInTheDocument();
    expect(spinnerImage).toHaveAttribute('src', 'loading_spinner.gif'); // Assuming the name after import
  });

  test('renders with status text and without player ID', () => {
    render(<MatchmakingScreen statusText={statusText} navigateToGame={() => {}} />);

    // Check for status text
    expect(screen.getByText(statusText)).toBeInTheDocument();

    // Player ID should not be present
    expect(screen.queryByText(`(Your ID: ${playerId})`)).not.toBeInTheDocument();

    // Check for loading spinner image
    expect(screen.getByAltText('Loading...')).toBeInTheDocument();
  });

  test('applies basic styling (presence of font family in style attribute - indicative)', () => {
    // Note: Testing exact CSS is brittle. This is a very basic check.
    // More robust visual testing would require tools like Storybook or Percy.
    const { container } = render(<MatchmakingScreen statusText={statusText} navigateToGame={() => {}} />);
    const mainDiv = container.firstChild as HTMLElement;

    // Check if the main div has a style attribute that suggests retro font might be applied
    // This indirectly checks our inline style for fontFamily.
    expect(mainDiv).toHaveStyle("fontFamily: 'Press Start 2P', cursive");
    // Check for background image (also part of inline style)
    expect(mainDiv).toHaveStyle("backgroundImage: url(main_menu_background.png)");
  });
});
