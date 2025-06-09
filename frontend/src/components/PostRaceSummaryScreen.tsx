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
    height: '100vh',
    backgroundColor: '#282c34',
    color: 'white',
    fontFamily: 'Arial, sans-serif',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '3em',
    marginBottom: '30px',
  };

  const infoStyle: React.CSSProperties = {
    fontSize: '1.5em',
    marginBottom: '15px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '15px 30px',
    fontSize: '1.2em',
    cursor: 'pointer',
    backgroundColor: '#61dafb',
    border: 'none',
    borderRadius: '5px',
    color: '#282c34',
    marginTop: '30px',
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
