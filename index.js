const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3037;

const ACCESS_TOKEN = 'EAAFLvGWR7QQBO1MfUFa7PGYFRi2CVkeSkroV4eUMJT1kyeTCNRUPVUzHztXu3fFhtTn9VMv3uXpTq10zhNR397ihHVo2ekXL1B9qIvyP9nTdc4lkK7PVSx1lSZC3IjFZBVHwtOwJ9wEIN4PkYMNHH3EdyEPmP6pNIwEE1XlZCBMWeDlfo1WWTCNqbp3Ovwj1wZDZD'; // Replace with actual token
const FB_API_URL = `https://graph.facebook.com/v14.0/1055377212772927/events?access_token=${ACCESS_TOKEN}`;

// Telegram Bot Config
const TELEGRAM_BOT_TOKEN = '6962504638:AAFkba3-vDDSYu6j69FJMG2ZH2G2MWpi3J0';
const TELEGRAM_CHAT_ID = '7434740689';

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
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(bodyParser.json());

// Facebook Pixel Event (CAPI) Tracking Endpoint
app.post('/track-event', async (req, res) => {
    const { event_name, event_time, event_id, user_data, event_source_url, action_source } = req.body;

    try {
        const eventTimestamp = event_time || Math.floor(Date.now() / 1000);

        const payload = {
            data: [{
                event_name: event_name || "PageView",  // Default to PageView if not provided
                event_time: eventTimestamp,
                event_id: event_id || `event_${eventTimestamp}`,  // Generate an event_id if not provided
                action_source: action_source || "website",  // Default to website
                event_source_url: event_source_url || "https://yourdomain.com",  // Ensure URL is present
                user_data: {
                    client_user_agent: req.headers['user-agent'],
                    client_ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress
                }
            }]
        };

        // Log the payload for debugging
        console.log('Payload being sent to Facebook:', JSON.stringify(payload, null, 2));

        // Send the request to Facebook's Conversion API
        const response = await axios.post(FB_API_URL, payload, { timeout: 8000 });
        console.log('Facebook API response:', response.data);

        res.status(200).json({ success: true, message: 'Tracking event sent to Facebook.' });

    } catch (error) {
        // Log detailed Facebook API error
        if (error.response) {
            console.error('Error response from Facebook:', error.response.data);
            console.error('Error response status:', error.response.status);
        } else {
            console.error('Error tracking event:', error.message);
        }

        // Send proper response to the client
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
        // Send form data to Telegram
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
