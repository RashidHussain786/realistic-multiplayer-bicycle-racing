// frontend/src/components/MatchmakingScreen.tsx
import React from 'react';
import loadingSpinner from '../assets/loading_spinner.gif';
import mainMenuBackground from '../assets/main_menu_background.png'; // Re-using for consistency

interface MatchmakingScreenProps {
  statusText: string;
  playerId?: string;
  navigateToGame: () => void; // Added prop
}

const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({ statusText, playerId, navigateToGame }) => {
  // navigateToGame is now available if needed, e.g. for a cancel button or other logic
  // For now, it's just added to satisfy the type system based on App.tsx usage.
  // If it's meant to be called under certain conditions within this screen, that logic would go here.
  // Example: if (someCondition) navigateToGame();
  console.log('navigateToGame prop available in MatchmakingScreen:', navigateToGame); // Simulate usage

  return (
    <div
      style={{
        backgroundImage: `url(${mainMenuBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: "'Press Start 2P', cursive",
        color: 'white',
        textAlign: 'center',
      }}
    >
      <img src={loadingSpinner} alt="Loading..." style={{ width: '100px', height: '100px', marginBottom: '30px' }} />
      <p style={{ fontSize: '1.5em', textShadow: '2px 2px #000000', marginBottom: '20px' }}>
        {statusText}
      </p>
      {playerId && (
        <p style={{ fontSize: '1em', color: '#CCCCCC', textShadow: '1px 1px #000000' }}>
          (Your ID: {playerId})
        </p>
      )}
      {/* Optional: Add a cancel button here later if needed */}
    </div>
  );
};

export default MatchmakingScreen;
