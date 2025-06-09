// File: backend/matchmaking-service/localServer.js

const http = require('http');
const { handler } = require('./index'); // Import your Lambda handler from index.js

const PORT = 3001; // You can change this port if needed

const server = http.createServer(async (req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
    });

    req.on('end', async () => {
        // Construct an event object similar to what API Gateway would send to Lambda
        const event = {
            httpMethod: req.method,
            path: req.url, // The path of the request
            headers: { ...req.headers }, // Copy request headers
            body: body, // The handler expects a stringified JSON body if it's POST/PUT
            // queryStringParameters: {}, // Populate if your handler uses query strings
            // pathParameters: {},      // Populate if your handler uses path parameters
            // For basic testing, body and httpMethod are often the most important.
        };

        try {
            // Call your imported Lambda handler
            const lambdaResponse = await handler(event);

            // Prepare headers for the client response
            const responseHeaders = { ...lambdaResponse.headers }; // Start with headers from Lambda

            // Ensure CORS headers are present for local development
            if (!responseHeaders['Access-Control-Allow-Origin']) {
                responseHeaders['Access-Control-Allow-Origin'] = '*'; // Allow all origins for local dev
            }
            if (!responseHeaders['Access-Control-Allow-Methods']) {
                // Adjust allowed methods based on what your handler supports and what frontend needs
                responseHeaders['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS, PUT, DELETE';
            }
            if (!responseHeaders['Access-Control-Allow-Headers']) {
                // Adjust allowed headers based on what frontend sends
                responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token';
            }
            if (!responseHeaders['Content-Type'] && lambdaResponse.body) {
                // If lambdaResponse.body exists and Content-Type is not set, assume application/json
                // The actual handler already sets Content-Type, so this is a fallback.
                responseHeaders['Content-Type'] = 'application/json';
            }


            // Handle OPTIONS pre-flight requests for CORS
            if (req.method === 'OPTIONS') {
                res.writeHead(204, responseHeaders); // 204 No Content for OPTIONS
                res.end();
                return;
            }

            // Send the actual response from the Lambda handler
            res.writeHead(lambdaResponse.statusCode, responseHeaders);
            res.end(lambdaResponse.body);

        } catch (error) {
            console.error('[LocalServer] Error executing Lambda handler:', error);
            // Basic error response with CORS
            res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify({
                error: 'Internal Server Error in local wrapper',
                details: error.message
            }));
        }
    });
});

server.listen(PORT, () => {
    console.log(`[LocalServer] Matchmaking service (emulating Lambda) now running on http://localhost:${PORT}`);
    console.log('Ensure your frontend API calls are directed to this address.');
    console.log('All requests to this server will be passed to your handler in index.js.');
});
