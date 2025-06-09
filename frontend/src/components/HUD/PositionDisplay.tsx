import React from 'react';

interface PositionDisplayProps {
  currentPosition: 1 | 2;
  totalRacers: number;
}

const PositionDisplay: React.FC<PositionDisplayProps> = ({ currentPosition, totalRacers }) => {
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)', // Center align
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
      Position: {currentPosition}/{totalRacers}
    </div>
  );
};

export default PositionDisplay;
