import React from 'react';

interface PostRaceSummaryScreenProps {
  winnerName: string;
  finalPlayerCurrency: number;
  onReturnToMainMenu: () => void;
}

const PostRaceSummaryScreen: React.FC<PostRaceSummaryScreenProps> = ({
  winnerName,
  finalPlayerCurrency,
  onReturnToMainMenu,
}) => {
  const screenStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh', // Consider if this is ideal for a summary screen, or if it should be smaller.
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: 'white',
    fontFamily: "'Press Start 2P', cursive",
    padding: '20px',
    textAlign: 'center',
    border: '3px solid #FFFF00', // Yellow border
    borderRadius: '0px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '3em',
    marginBottom: '30px',
    textShadow: '2px 2px #00FF00', // Green shadow
  };

  const infoStyle: React.CSSProperties = {
    fontSize: '1.5em',
    marginBottom: '15px',
    textShadow: '2px 2px #00FF00', // Green shadow
  };

  const buttonStyle: React.CSSProperties = {
    fontFamily: "'Press Start 2P', cursive",
    border: '2px solid white',
    borderRadius: '0px',
    backgroundColor: '#00DDDD', // Teal/Cyan
    color: 'white',
    textShadow: '1px 1px #000000',
    padding: '15px 30px',
    fontSize: '1.2em',
    marginTop: '30px',
    cursor: 'pointer',
  };

  return (
    <div style={screenStyle}>
      <h1 style={titleStyle}>Race Over!</h1>
      <p style={infoStyle}>Winner: {winnerName}</p>
      <p style={infoStyle}>Your Final Currency: {finalPlayerCurrency}</p>
      <button style={buttonStyle} onClick={onReturnToMainMenu}>
        Return to Main Menu
      </button>
    </div>
  );
};

export default PostRaceSummaryScreen;
