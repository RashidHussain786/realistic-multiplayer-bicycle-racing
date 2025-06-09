import React from 'react';

interface RaceEndOverlayProps {
  isVisible: boolean;
}

const RaceEndOverlay: React.FC<RaceEndOverlayProps> = ({ isVisible }) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      padding: '30px',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: 'white',
      fontSize: '2.5em',
      fontFamily: "'Press Start 2P', cursive", // Retro font
      border: '3px solid #FF00FF', // Magenta border
      borderRadius: '10px',
      textShadow: '3px 3px #00FFFF', // Cyan shadow
      zIndex: 1000,
      textAlign: 'center'
    }}>
      Race Finished!
    </div>
  );
};

export default RaceEndOverlay;
