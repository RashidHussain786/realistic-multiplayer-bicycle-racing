const { v4: uuidv4 } = require('uuid');

// In-memory waiting room (for proof of concept)
let waitingPlayers = [];

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

    try {
        const body = JSON.parse(event.body);
        const playerId = body.playerId || uuidv4();
        const playerInfo = {
            id: playerId,
            timestamp: Date.now(),
            connectionInfo: body.connectionInfo || {}
        };

        // Add player to waiting room
        waitingPlayers.push(playerInfo);

        // Check if we can make a match
        if (waitingPlayers.length >= 2) {
            const player1 = waitingPlayers.shift();
            const player2 = waitingPlayers.shift();

            // Return match info to both players
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    matched: true,
                    matchId: uuidv4(),
                    players: {
                        you: player1.id === playerId ? player1 : player2,
                        opponent: player1.id === playerId ? player2 : player1
                    }
                })
            };
        } else {
            // Player is waiting
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    matched: false,
                    playerId: playerId,
                    waiting: true,
                    message: 'Searching for opponent...'
                })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
