const { v4: uuidv4 } = require('uuid');

// In-memory waiting room (for proof of concept)
let waitingPlayers = [];
let activeSessions = {};

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const WAITING_PLAYER_TIMEOUT_MS = 60 * 1000; // 60 seconds

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Session cleanup logic
    const now = Date.now();
    for (const playerId in activeSessions) {
        if (activeSessions.hasOwnProperty(playerId)) {
            const sessionTimestamp = activeSessions[playerId].timestamp;
            if ((now - sessionTimestamp) > SESSION_TIMEOUT_MS) {
                delete activeSessions[playerId];
                console.log(`Cleaned up stale session for player ${playerId}`);
            }
        }
    }

    try {
        const body = JSON.parse(event.body);
        const action = body.action || 'matchmake'; // Default to 'matchmake'

        if (action === 'sendSignal') {
            const { sourcePlayerId, targetPlayerId, signalPayload } = body;

            const { sourcePlayerId, targetPlayerId, signalPayload } = body;
            let missingFields = [];
            if (!sourcePlayerId) missingFields.push('sourcePlayerId');
            if (!targetPlayerId) missingFields.push('targetPlayerId');
            if (!signalPayload) missingFields.push('signalPayload');

            if (missingFields.length > 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `Missing required fields for sendSignal: ${missingFields.join(', ')}` })
                };
            }

            const targetPlayerInfo = activeSessions[targetPlayerId];
            if (!targetPlayerInfo) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: `Target player ${targetPlayerId} not found in active session or session may have expired.` })
                };
            }

            // Store the signal, could be an array if multiple signals are expected
            targetPlayerInfo.webRTCSignalingData = {
                from: sourcePlayerId,
                payload: signalPayload,
                receivedAt: Date.now()
            };
            // No need to update activeSessions[targetPlayerId] = targetPlayerInfo; as it's a reference

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Signal sent successfully to ' + targetPlayerId })
            };

        } else if (action === 'getSignal') {
            const { playerId: getSignalPlayerId } = body; // Renamed to avoid conflict with matchmake's playerId

            if (!getSignalPlayerId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'playerId is required for getSignal action.' })
                };
            }

            const playerInfoForGetSignal = activeSessions[getSignalPlayerId]; // Renamed for clarity
            if (!playerInfoForGetSignal) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: `Player ${getSignalPlayerId} not in active session or session may have expired.` })
                };
            }

            const signalData = playerInfoForGetSignal.webRTCSignalingData;
            playerInfoForGetSignal.webRTCSignalingData = null; // Clear after retrieval (correct lines)

            // Removed the duplicated and incorrect lines that previously referred to 'playerInfo'

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ signalData: signalData })
            };

        } else if (action === 'matchmake') {
            const playerId = body.playerId || uuidv4(); // playerId for the new player entering matchmaking
            // --- Start of 'matchmake' action ---
            const currentTimestamp = Date.now(); // Used for new player and for filtering

            // Filter waitingPlayers for stale entries before adding the new player
            const originalWaitingCount = waitingPlayers.length;
            waitingPlayers = waitingPlayers.filter(player => (currentTimestamp - player.timestamp) <= WAITING_PLAYER_TIMEOUT_MS);
            const removedCount = originalWaitingCount - waitingPlayers.length;
            if (removedCount > 0) {
                console.log(`Removed ${removedCount} stale players from waiting queue.`);
            }

            const newPlayerId = body.playerId || uuidv4(); // Renamed from playerId to newPlayerId for clarity
            const newPlayerInfo = { // Renamed from playerInfo to newPlayerInfo
                id: newPlayerId,
                timestamp: currentTimestamp, // Use the timestamp captured at the start of this action
                connectionInfo: body.connectionInfo || {},
                webRTCSignalingData: {},
                opponentId: null
            };

            waitingPlayers.push(newPlayerInfo);

            if (waitingPlayers.length >= 2) {
                // Note: newPlayerId is the ID of the player who made *this* request.
                // player1 and player2 are taken from the queue.
                const player1 = waitingPlayers.shift(); // This is one of the matched players
                const player2 = waitingPlayers.shift(); // This is the other matched player

                player1.opponentId = player2.id;
                player2.opponentId = player1.id;

                activeSessions[player1.id] = player1;
                activeSessions[player2.id] = player2;

                // Check if the current requester (newPlayerId) is part of this match
                if (player1.id === newPlayerId || player2.id === newPlayerId) {
                    // Requester is part of the match
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            matched: true,
                            matchId: uuidv4(),
                            players: {
                                you: player1.id === newPlayerId ? player1 : player2,
                                opponent: player1.id === newPlayerId ? player2 : player1
                            }
                        })
                    };
                } else {
                    // Requester is not part of this match (other players were matched).
                    // So, the current requester (newPlayerId) is still waiting.
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            matched: false,
                            playerId: newPlayerId,
                            waiting: true,
                            message: 'Searching for opponent... (other players were matched ahead of you)'
                        })
                    };
                }
            } else {
                // Not enough players in the queue *after current player was added*, so current player is waiting.
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        matched: false,
                        playerId: newPlayerId,
                        waiting: true,
                        message: 'Searching for opponent...'
                    })
                };
            }
        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `Unknown action: ${action}. Must be one of 'sendSignal', 'getSignal', or 'matchmake'.` })
            };
        }
    } catch (error) {
        console.error("Unhandled error in handler:", error); // Log the error
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};
