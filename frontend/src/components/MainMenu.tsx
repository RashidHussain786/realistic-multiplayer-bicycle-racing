// frontend/src/components/MainMenu.tsx
import React, { useState, useEffect } from 'react';
import webRTCService from '../services/WebRTCService';
import type SimplePeer from 'simple-peer';
import GameScreen from './GameScreen';
import MatchmakingScreen from './MatchmakingScreen'; // Added import
import mainMenuBackground from '../assets/main_menu_background.png';
import buttonRetroBlue from '../assets/button_retro_blue.png';

// TODO: Replace with your actual AWS API Gateway URL for the matchmaking service
const API_GATEWAY_URL = 'YOUR_API_GATEWAY_URL_HERE';
const MATCHMAKING_ENDPOINT = `${API_GATEWAY_URL}/matchmaking`;
// const SIGNALING_ENDPOINT = `${API_GATEWAY_URL}/signal`; // Placeholder for signaling

interface MainMenuProps {
  navigateToMatchmaking: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ navigateToMatchmaking }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [isConnectingRTC, setIsConnectingRTC] = useState(false);
  const [isRTCConnected, setIsRTCConnected] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [opponentId, setOpponentId] = useState('');
  const [lastMessageReceived, setLastMessageReceived] = useState<string | null>(null);
  const [rtcError, setRtcError] = useState<string | null>(null); // New state for errors

  useEffect(() => {
    setPlayerId(Math.random().toString(36).substring(2, 10));
  }, []);

  useEffect(() => {
    const peer = webRTCService.getPeer();

    if (peer) {
      const onConnect = () => {
        console.log('MainMenu: WebRTC Connected event received');
        setIsRTCConnected(true);
        setIsConnectingRTC(false);
        setLastMessageReceived(null);
        setRtcError(null); // Clear error on successful connection
      };
      const onClose = () => {
        console.log('MainMenu: WebRTC Close event received');
        // Don't set error here unless it's an unexpected close.
        // If user initiated disconnect, it's not an error.
        // If it's due to opponent disconnecting, GameScreen might show a message.
        setIsRTCConnected(false);
        setIsConnectingRTC(false);
        setOpponentId('');
        setLastMessageReceived(null);
      };
      const onError = (err: Error) => {
        console.error('MainMenu: WebRTC Error event received', err);
        setIsConnectingRTC(false);
        setIsRTCConnected(false);
        setOpponentId('');
        setLastMessageReceived(null);
        // More specific error messages could be generated based on err.name or err.message
        setRtcError(`Connection failed: ${err.message || "Please try again."}`);
      };
      const onSignal = (signalData: SimplePeer.SignalData) => {
        console.log('MainMenu: Local peer generated signal:', JSON.stringify(signalData));
        // TODO: Send this signalData to the opponent via your matchmaking/signaling server
        // Example:
        // if (opponentId) {
        //   fetch(SIGNALING_ENDPOINT, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ targetOpponentId: opponentId, signal: signalData, senderPlayerId: playerId }),
        //   }).catch(err => console.error("Signal sending failed:", err));
        // } else {
        //    console.warn("MainMenu: Cannot send signal, opponentId not set.");
        // }
        console.warn("MainMenu: Signaling not implemented yet. Signal data:" + JSON.stringify(signalData));
      };
      const onData = (data: any) => {
        const message = data.toString();
        console.log('MainMenu: DATA event from peer. Received message:', message);
        setLastMessageReceived(message);
      };

      peer.on('connect', onConnect);
      peer.on('close', onClose);
      peer.on('error', onError);
      peer.on('signal', onSignal);
      peer.on('data', onData);

      return () => {
        peer.off('connect', onConnect);
        peer.off('close', onClose);
        peer.off('error', onError);
        peer.off('signal', onSignal);
        peer.off('data', onData);
      };
    }
  }, [isConnectingRTC, playerId, opponentId]);

  // Updated to use navigateToMatchmaking prop
  const handleStartRace = () => {
    if (!playerId) {
        console.error("Player ID not set yet.");
        return;
    }
    // Call the prop function to navigate
    navigateToMatchmaking();

    // Existing logic for matchmaking and WebRTC connection can be moved
    // to MatchmakingScreen or stay here if MainMenu still manages this part.
    // For now, let's assume MainMenu still handles the RTC setup after navigation.
    // This might need further refactoring based on how MatchmakingScreen behaves.
    setIsSearching(true); // Or this state might become local to MatchmakingScreen
    setIsConnectingRTC(false);
    setIsRTCConnected(false);
    setOpponentId('');
    setLastMessageReceived(null);
    setRtcError(null);
    webRTCService.disconnect(); // Ensure clean state

    // The actual fetch and WebRTC connect logic might be triggered
    // from MatchmakingScreen or via props/callbacks from it.
    // For this step, we'll keep it here to show the prop is used.
    // A more complete refactor might move this.
    // Simulating that navigation happens, and then this component might still
    // listen to events or manage the connection if it's not fully unmounted.
    // Consider if this fetch should be here or in MatchmakingScreen.
    // If MainMenu is unmounted after navigateToMatchmaking, this fetch won't run as expected.
    // For now, let's assume it's part of the flow initiated by MainMenu.
    // This part might need to be removed if MatchmakingScreen handles its own fetch.
    (async () => {
      try {
        const response = await fetch(MATCHMAKING_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        });
        const data = await response.json();
        console.log("Matchmaking response:", data);

        if (data.matched && data.opponent) {
          setIsSearching(false);
          setIsConnectingRTC(true);
          setOpponentId(data.opponent.id);
          const isInitiator = data.isInitiator !== undefined ? data.isInitiator : true;
          const remoteSignal = data.signalData ? data.signalData : undefined;
          webRTCService.connect(isInitiator, remoteSignal);
        } else if (data.waiting) {
          setIsSearching(false);
          setIsConnectingRTC(true);
          webRTCService.connect(true); // Initiator
        } else if (data.error) {
          setIsSearching(false);
          setRtcError(data.error);
        } else {
          setIsSearching(false);
          setRtcError("Matchmaking failed. Unknown server response.");
        }
      } catch (error: any) {
        console.error('Error during matchmaking or WebRTC initiation:', error);
        setIsSearching(false);
        setIsConnectingRTC(false);
        setRtcError(`Matchmaking request failed: ${error.message || "Check console for details."}`);
      }
    })();
  };

  const handleDisconnect = () => {
    webRTCService.disconnect();
    // UI will update via the 'close' event listener in useEffect
  };

  const handleSendMessage = (message: string) => {
    webRTCService.send(message);
  };

  return (
    <div style={{
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
        textAlign: 'center'
      }}>
      {rtcError && (
        <p style={{
          backgroundColor: 'rgba(255, 0, 0, 0.7)',
          border: '2px solid #FF0000', // Brighter red border
          borderRadius: '0px', // Sharp corners
          padding: '15px',
          marginBottom: '20px',
          color: 'white',
          fontSize: '1.1em',
          textShadow: '1px 1px #000000',
          fontFamily: "'Press Start 2P', cursive"
        }}>
          <strong>Error:</strong> {rtcError}
        </p>
      )}

      {isRTCConnected ? (
        <GameScreen
          opponentId={opponentId}
          playerId={playerId}
          onDisconnect={handleDisconnect}
          onSendMessage={handleSendMessage}
          lastMessageReceived={lastMessageReceived}
          onRaceEnd={() => { console.log("Race ended from MainMenu"); }} // Dummy handler
        />
      ) : isConnectingRTC ? (
        <MatchmakingScreen statusText="Connecting to Opponent..." playerId={playerId} navigateToGame={() => console.log("Navigate to game from MainMenu/Connecting")} />
      ) : isSearching ? (
        <MatchmakingScreen statusText="Searching for Opponent..." playerId={playerId} navigateToGame={() => console.log("Navigate to game from MainMenu/Searching")} />
      ) : (
        <div>
          <p style={{ textShadow: '1px 1px #000000' }}>(My ID: {playerId})</p>
          <button
            style={{
              backgroundImage: `url(${buttonRetroBlue})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              padding: '20px 40px',
              fontSize: '1.5em',
              cursor: 'pointer',
              textShadow: '2px 2px #000000',
              minWidth: '200px',
              minHeight: '80px',
              fontFamily: "'Press Start 2P', cursive"
            }}
            onClick={handleStartRace}
            disabled={!playerId}
          >
            Start Race
          </button>
        </div>
      )}
    </div>
  );
}

export default MainMenu;
