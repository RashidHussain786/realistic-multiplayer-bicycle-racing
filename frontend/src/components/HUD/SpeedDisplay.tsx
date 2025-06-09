import React from 'react';

interface SpeedDisplayProps {
  speed: number;
}

const SpeedDisplay: React.FC<SpeedDisplayProps> = ({ speed }) => {
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px', // This will be adjusted later if it overlaps with PositionDisplay
      fontFamily: "'Press Start 2P', cursive",
      color: 'white',
      backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent black background
      padding: '10px',
      borderRadius: '0px', // Sharp corners for retro look
      border: '2px solid white', // Simple white border
      textShadow: '2px 2px #FF00FF', // Magenta shadow
      fontSize: '1em',
      zIndex: 100, // Ensure it's above other elements
    }}>
      Speed: {speed.toFixed(2)} KPH
    </div>
  );
};

export default SpeedDisplay;
