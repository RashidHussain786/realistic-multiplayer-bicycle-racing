// frontend/src/services/WebRTCService.ts
import SimplePeer from 'simple-peer';

class WebRTCService {
  private peer: SimplePeer.Instance | null = null;

  constructor() {
    // TODO: Initialize signaling logic here
  }

  public async createOffer(): Promise<SimplePeer.SignalData | undefined> {
    // TODO: Implement offer creation
    console.log('Creating offer...');
    return undefined;
  }

  public async handleSignal(signal: SimplePeer.SignalData): Promise<void> {
    // TODO: Implement signal handling (for answers and ICE candidates)
    console.log('Handling signal:', signal);
  }

  public connect(initiator: boolean, opponentSignal?: SimplePeer.SignalData): void {
    if (this.peer) {
        console.warn("WebRTCService: Peer already exists. Disconnecting old peer before creating a new one.");
        this.peer.destroy();
    }
    console.log(`WebRTCService: connect called. Initiator: ${initiator}`);

    // Add STUN server configuration here
    const peerConfig: SimplePeer.Options = {
        initiator: initiator,
        trickle: false, // For simplicity, disable trickle ICE
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
            // You can add more STUN/TURN servers here if needed
            // Example TURN server:
            // {
            //   urls: 'turn:your.turn.server.com:3478',
            //   username: 'user',
            //   credential: 'password'
            // }
          ]
        }
    };

    this.peer = new SimplePeer(peerConfig);

    this.peer.on('error', (err) => {
        console.error('WebRTC peer error:', err);
    });

    this.peer.on('signal', (data) => {
        console.log('WebRTCService: SIGNAL event from peer:', JSON.stringify(data));
    });

    if (opponentSignal && !initiator) {
        console.log('WebRTCService: Connecting to opponent with signal:', opponentSignal);
        this.peer.signal(opponentSignal);
    }

    this.peer.on('connect', () => {
        console.log('WebRTCService: CONNECT event. WebRTC connection established.');
        this.peer?.send('hello from ' + (initiator ? 'initiator' : 'receiver'));
    });

    this.peer.on('data', (data) => {
        console.log('WebRTCService: DATA event. Received message:', data.toString());
    });

    this.peer.on('close', () => {
        console.log('WebRTCService: CLOSE event. WebRTC connection closed.');
        this.peer = null;
    });
  }

  public send(data: string): void {
    if (this.peer && this.peer.connected) {
      this.peer.send(data);
    } else {
      console.warn('WebRTCService: Cannot send data: Peer is not connected.');
    }
  }

  public disconnect(): void {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
      console.log('WebRTCService: Peer disconnected.');
    }
  }

  public getPeer(): SimplePeer.Instance | null {
    return this.peer;
  }
}

const webRTCService = new WebRTCService();
export default webRTCService;
