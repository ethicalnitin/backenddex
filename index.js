const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const crypto = require('crypto');  // Import the crypto module

const app = express();
const PORT = process.env.PORT || 3037;

// Middleware to parse incoming request bodies
app.use(bodyParser.json());

// Your access token
const ACCESS_TOKEN = 'EAAFLvGWR7QQBO1MfUFa7PGYFRi2CVkeSkroV4eUMJT1kyeTCNRUPVUzHztXu3fFhtTn9VMv3uXpTq10zhNR397ihHVo2ekXL1B9qIvyP9nTdc4lkK7PVSx1lSZC3IjFZBVHwtOwJ9wEIN4PkYMNHH3EdyEPmP6pNIwEE1XlZCBMWeDlfo1WWTCNqbp3Ovwj1wZDZD';

// Conversion API event endpoint
const FB_API_URL = `https://graph.facebook.com/v14.0/1055377212772927/events?access_token=${ACCESS_TOKEN}`;

app.post('/track-event', async (req, res) => {
    const { event_name, event_time, event_id, custom_data, user_data, event_source_url, action_source } = req.body;

    try {
        // Ensure event_time is a valid Unix timestamp and within 7 days
        const eventTimestamp = event_time && event_time > Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
            ? event_time
            : Math.floor(Date.now() / 1000);  // Use current time if event_time is too old or not provided

        // Hash email, phone number, and postal code using SHA-256
        const hashedEmail = user_data.email ? crypto.createHash('sha256').update(user_data.email).digest('hex') : undefined;
        const hashedPhone = user_data.phone_number ? crypto.createHash('sha256').update(user_data.phone_number).digest('hex') : undefined;
        const hashedZip = user_data.zip ? crypto.createHash('sha256').update(user_data.zip).digest('hex') : undefined;

        // Get client IP address and user agent (passed via headers)
        const clientIpAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const clientUserAgent = req.headers['user-agent'];

        // Construct the payload for the API request
        const payload = {
            data: [{
                event_name,
                event_time: eventTimestamp,    // Updated event_time
                event_id,
                event_source_url: event_source_url,  // Event source URL
                action_source: action_source,  // Action source
                user_data: {
                    em: hashedEmail,               // Use 'em' for email
                    ph: hashedPhone,               // Use 'ph' for phone number
                    zp: hashedZip,                 // Use 'zp' for postal code (hashed)
                    client_ip_address: clientIpAddress,  // Do not hash
                    client_user_agent: clientUserAgent   // Do not hash
                },
                custom_data: custom_data || {}
            }]
        };

        // Send the request to Facebook's API
        const response = await axios.post(FB_API_URL, payload);

        // Respond with success if the event was tracked successfully
        res.status(200).send('Event tracked successfully');
    } catch (error) {
        if (error.response) {
            console.error('Error response data:', error.response.data);
            console.error('Error response status:', error.response.status);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error', error.message);
        }
        res.status(500).send('Error tracking event');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
