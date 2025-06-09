import React from 'react';

interface PointsDisplayProps {
  points: number;
}

const PointsDisplay: React.FC<PointsDisplayProps> = ({ points }) => {
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      padding: '10px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      borderRadius: '5px',
      zIndex: 100, // Ensure it's above other elements
    }}>
      Points: {points}
    </div>
  );
};

export default PointsDisplay;
