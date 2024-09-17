const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors');  // Import cors
const multer = require('multer'); // Import multer for file uploads
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // Used to send the image to Telegram

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

// Configure multer storage for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Directory to save the uploaded files
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const TELEGRAM_BOT_TOKEN = '6962504638:AAFkba3-vDDSYu6j69FJMG2ZH2G2MWpi3J0';
const TELEGRAM_CHAT_ID = '7434740689';

// Form Submission Endpoint with file upload
app.post('/submit', upload.single('paymentScreenshot'), async (req, res) => {
    const { amountDropdown, utr, email, username } = req.body; // Access form fields
    const paymentScreenshot = req.file;  // Access the uploaded file

    try {
        // Build the Telegram message
        const telegramMessage = `
         💸 New Payment:
          Name: ${username || 'N/A'}
          Amount: ${amountDropdown || 'N/A'}
          UTR/UPI Reference ID: ${utr || 'N/A'}
          Email: ${email || 'N/A'}
        `;

        // Send the text message with payment details to Telegram
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: telegramMessage
        });

        // Send the screenshot file to Telegram (if uploaded)
        if (paymentScreenshot) {
            const screenshotFilePath = path.resolve(paymentScreenshot.path);

            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('photo', fs.createReadStream(screenshotFilePath));  // Send the screenshot

            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, formData, {
                headers: formData.getHeaders(),
            });
        }

        res.status(200).json({ success: true, message: 'Form submission tracked and Telegram notification sent, including the screenshot.' });

    } catch (error) {
        console.error('Error sending Telegram message or screenshot:', error.message);
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
