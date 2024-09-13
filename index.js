const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors');  // Import cors

const app = express();
const PORT = process.env.PORT || 3037;

// Enable CORS for both 'tradingview.cybermafia.shop' and 'payments.cybermafia.shop'
const allowedOrigins = ['https://tradingview.cybermafia.shop', 'https://payments.cybermafia.shop'];

app.use(cors({
  origin: function (origin, callback) {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],  // Specify allowed methods
  credentials: true          // If you need to include cookies or authentication headers
}));

app.use(bodyParser.json());

const ACCESS_TOKEN = 'EAAFLvGWR7QQBO1MfUFa7PGYFRi2CVkeSkroV4eUMJT1kyeTCNRUPVUzHztXu3fFhtTn9VMv3uXpTq10zhNR397ihHVo2ekXL1B9qIvyP9nTdc4lkK7PVSx1lSZC3IjFZBVHwtOwJ9wEIN4PkYMNHH3EdyEPmP6pNIwEE1XlZCBMWeDlfo1WWTCNqbp3Ovwj1wZDZD';

const FB_API_URL = `https://graph.facebook.com/v14.0/1055377212772927/events?access_token=${ACCESS_TOKEN}`;
const TELEGRAM_BOT_TOKEN = '6962504638:AAFkba3-vDDSYu6j69FJMG2ZH2G2MWpi3J0';
const TELEGRAM_CHAT_ID = '7434740689';

// Helper function to validate IP address format
function isValidIpAddress(ip) {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}

// Facebook Pixel Event (CAPI) Tracking Endpoint
app.post('/track-event', async (req, res) => {
    const { event_name, event_time, event_id, custom_data, user_data, event_source_url, action_source } = req.body;
    console.log('Received data:', req.body);

    try {
        // Ensure event_time is a valid Unix timestamp and within 7 days
        const eventTimestamp = event_time && event_time > Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
            ? event_time
            : Math.floor(Date.now() / 1000);

        // Hash email, phone number, and postal code using SHA-256
        const hashedEmail = user_data.email ? crypto.createHash('sha256').update(user_data.email).digest('hex') : undefined;
        const hashedPhone = user_data.phone_number ? crypto.createHash('sha256').update(user_data.phone_number).digest('hex') : undefined;
        const hashedZip = user_data.zip ? crypto.createHash('sha256').update(user_data.zip).digest('hex') : undefined;

        // Get client IP address and validate, fallback to a default valid IP if invalid
        let clientIpAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '8.8.8.8';
        if (!isValidIpAddress(clientIpAddress)) {
            clientIpAddress = '8.8.8.8';  // Fallback to a valid IP address if the one provided is invalid
        }

        // Get client user agent
        const clientUserAgent = req.headers['user-agent'];

        // Construct the payload for the API request
        const payload = {
            data: [{
                event_name,
                event_time: eventTimestamp,
                event_id,
                event_source_url: event_source_url,
                action_source: action_source,
                user_data: {
                    em: hashedEmail,
                    ph: hashedPhone,
                    zp: hashedZip,
                    client_ip_address: clientIpAddress,  // Valid IP
                    client_user_agent: clientUserAgent
                },
                custom_data: custom_data || {}
            }],
        };

        // Send the request to Facebook's API
        const response = await axios.post(FB_API_URL, payload, { timeout: 8000 });
        console.log('Facebook API response:', response.data);

        // Respond with success if the event was tracked successfully
        res.status(200).json({ success: true, message: 'Event tracked successfully' });

    } catch (error) {
        if (error.response) {
            console.error('Error response data:', error.response.data);
            console.error('Error response status:', error.response.status);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error', error.message);
        }
        res.status(500).json({
            success: false,
            message: 'Error tracking event',
            error: error.response ? error.response.data : error.message
        });
    }
});

// Form Submission Endpoint (to send Telegram message)
app.post('/submit', async (req, res) => {
    const { amountDropdown, utr, email, username } = req.body;

    try {
        const telegramMessage = `
         💸 New Form Submission:
          - Amount: ${amountDropdown}
          - UTR/UPI Reference ID: ${utr}
          - Email: ${email}
          - TradingView Username: ${username}
        `;
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: telegramMessage
        });

        res.status(200).json({ success: true, message: 'Form submission tracked and Telegram notification sent.' });

    } catch (error) {
        console.error('Error sending Telegram message:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error sending Telegram notification',
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


