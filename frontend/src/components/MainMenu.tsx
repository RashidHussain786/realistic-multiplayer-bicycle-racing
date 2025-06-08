import { useState } from 'react';

// TODO: Replace with your actual AWS API Gateway URL for the matchmaking service
const API_GATEWAY_URL = 'YOUR_API_GATEWAY_URL_HERE/matchmaking';

function MainMenu() {
  const [isSearching, setIsSearching] = useState(false);

  const handleStartRace = async () => {
    setIsSearching(true);
    const playerId = Math.random().toString(36).substring(7);
    try {
      const response = await fetch(API_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerId }),
      });
      const data = await response.json();
      if (data.matched) {
        setIsSearching(false);
        console.log('Opponent found:', data.opponent);
      } else {
        console.log('Waiting for opponent...');
      }
    } catch (error) {
      console.error('Error during matchmaking:', error);
      setIsSearching(false);
    }
  };

  return (
    <>
      {isSearching ? (
        <p>Searching for Opponent...</p>
      ) : (
        <button onClick={handleStartRace}>Start Race</button>
      )}
    </>
  );
}

export default MainMenu;
