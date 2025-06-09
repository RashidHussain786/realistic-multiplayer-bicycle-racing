import { useState } from 'react';
import MainMenu from './components/MainMenu';
import MatchmakingScreen from './components/MatchmakingScreen'; // Assuming this exists
import GameScreen from './components/GameScreen';
import { AppScreen } from './types/AppScreen';
import PostRaceSummaryScreen from './components/PostRaceSummaryScreen'; // Import actual component

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.MainMenu);
  const [winnerName, setWinnerName] = useState<string>(''); // State for winner's name
  const [finalPlayerCurrency, setFinalPlayerCurrency] = useState<number>(0); // State for final currency

  const navigateToMainMenu = () => setCurrentScreen(AppScreen.MainMenu);
  const navigateToMatchmaking = () => setCurrentScreen(AppScreen.Matchmaking);
  const navigateToGame = () => setCurrentScreen(AppScreen.InGame);

  const handleRaceEnd = (winner: string, currency: number) => {
    setWinnerName(winner);
    setFinalPlayerCurrency(currency);
    setCurrentScreen(AppScreen.PostRaceSummary);
  };

  let content;
  switch (currentScreen) {
    case AppScreen.MainMenu:
      content = <MainMenu navigateToMatchmaking={navigateToMatchmaking} />;
      break;
    case AppScreen.Matchmaking:
      content = <MatchmakingScreen statusText="Searching for opponent..." navigateToGame={navigateToGame} />;
      break;
    case AppScreen.InGame:
      // opponentId, playerId, onDisconnect, onSendMessage, lastMessageReceived are illustrative;
      // ensure GameScreen receives all necessary props from its actual usage context if this were real.
      // For this task, focusing on onRaceEnd.
      content = (
        <GameScreen
          opponentId={null} // Placeholder
          playerId={null} // Placeholder
          onDisconnect={() => console.log('Disconnected')} // Placeholder
          onSendMessage={(msg) => console.log('Send message:', msg)} // Placeholder
          lastMessageReceived={null} // Placeholder
          onRaceEnd={handleRaceEnd} // Pass the new handler
        />
      );
      break;
    case AppScreen.PostRaceSummary:
      content = (
        <PostRaceSummaryScreen
          winnerName={winnerName}
          finalPlayerCurrency={finalPlayerCurrency}
          onReturnToMainMenu={navigateToMainMenu}
        />
      );
      break;
    default:
      content = <MainMenu navigateToMatchmaking={navigateToMatchmaking} />;
  }

  return (
    <>
      {content}
    </>
  );
}

export default App;
