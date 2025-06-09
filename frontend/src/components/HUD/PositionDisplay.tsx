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
      padding: '10px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      borderRadius: '5px',
      zIndex: 100, // Ensure it's above other elements
    }}>
      Position: {currentPosition}/{totalRacers}
    </div>
  );
};

export default PositionDisplay;
