import React from 'react';

interface SpeedDisplayProps {
  speed: number;
}

const SpeedDisplay: React.FC<SpeedDisplayProps> = ({ speed }) => {
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      padding: '10px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      borderRadius: '5px',
      zIndex: 100, // Ensure it's above other elements
    }}>
      Speed: {speed.toFixed(2)} km/h
    </div>
  );
};

export default SpeedDisplay;
