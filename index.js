const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3037;

// Enable CORS for allowed origins
const allowedOrigins = ['https://tradingview.cybermafia.shop', 'https://payments.cybermafia.shop'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin, like mobile apps or curl requests
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: Access denied for origin ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'], // Specify allowed methods
  credentials: true,  // Allow credentials (cookies, authorization headers)
}));

// Handle CORS preflight requests
app.options('*', cors());

app.use(bodyParser.json());

// Configure multer storage for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('Uploading file to uploads directory');
    cb(null, 'uploads/'); // Directory to save the uploaded files
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    console.log('Saving file as:', file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});


const upload = multer({ storage: storage });

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

    try {
        // Ensure event_time is a valid Unix timestamp
        const eventTimestamp = event_time && event_time > Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
            ? event_time
            : Math.floor(Date.now() / 1000);

        // Hash user data
        const hashedEmail = user_data.email ? crypto.createHash('sha256').update(user_data.email).digest('hex') : undefined;
        const hashedPhone = user_data.phone_number ? crypto.createHash('sha256').update(user_data.phone_number).digest('hex') : undefined;
        const hashedZip = user_data.zip ? crypto.createHash('sha256').update(user_data.zip).digest('hex') : undefined;

        // Get client IP address
        let clientIpAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '8.8.8.8';
        if (!isValidIpAddress(clientIpAddress)) {
            clientIpAddress = '8.8.8.8'; // Default valid IP
        }

        // Get client user agent
        const clientUserAgent = req.headers['user-agent'];

        // Construct the payload for Facebook CAPI
        const payload = {
            data: [{
                event_name,
                event_time: eventTimestamp,
                event_id,
                event_source_url,
                action_source,
                user_data: {
                    em: hashedEmail,
                    ph: hashedPhone,
                    zp: hashedZip,
                    client_ip_address: clientIpAddress,
                    client_user_agent: clientUserAgent
                },
                custom_data: custom_data || {} ,
                
            }],
        };

        // Send the request to Facebook's API
        const response = await axios.post(FB_API_URL, payload, { timeout: 8000 });
        res.status(200).json({ success: true, message: 'Event tracked successfully', data: response.data });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Error tracking event', error: error.message });
    }
});

// Form Submission Endpoint with file upload
app.post('/submit', upload.single('paymentScreenshot'), async (req, res) => {
    const { amountDropdown, utr, email, username } = req.body;
    const paymentScreenshot = req.file;

    try {
        // Telegram text message with payment details
        const telegramMessage = `
         💸 New Payment:
          Name: ${username || 'N/A'}
          Amount: ${amountDropdown || 'N/A'}
          UTR/UPI Reference ID: ${utr || 'N/A'}
          Email: ${email || 'N/A'}
        `;

        // Send the text message to Telegram
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: telegramMessage
        });

        // Send the screenshot file to Telegram if uploaded
        if (paymentScreenshot) {
            const screenshotFilePath = path.resolve(paymentScreenshot.path);

            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('photo', fs.createReadStream(screenshotFilePath));

            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, formData, {
                headers: formData.getHeaders(),
            });
        }

        res.status(200).json({ success: true, message: 'Form submission and Telegram notification sent successfully, including screenshot.' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Error sending Telegram notification', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
