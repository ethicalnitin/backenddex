app.post('/track-event', async (req, res) => {
    const { event_name, event_time, event_id, custom_data, user_data, event_source_url, action_source } = req.body;

    // Log received data for debugging
    console.log('Received data from frontend:', req.body);

    try {
        const eventTimestamp = event_time && event_time > Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
            ? event_time
            : Math.floor(Date.now() / 1000);

        // Hash user data (email, phone, zip)
        const hashedEmail = user_data.email ? crypto.createHash('sha256').update(user_data.email).digest('hex') : undefined;
        const hashedPhone = user_data.phone_number ? crypto.createHash('sha256').update(user_data.phone_number).digest('hex') : undefined;
        const hashedZip = user_data.zip ? crypto.createHash('sha256').update(user_data.zip).digest('hex') : undefined;

        // Get client IP address and validate
        let clientIpAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '8.8.8.8';
        if (!isValidIpAddress(clientIpAddress)) {
            clientIpAddress = '8.8.8.8';
        }

        const clientUserAgent = req.headers['user-agent'];

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
                    client_ip_address: clientIpAddress,
                    client_user_agent: clientUserAgent
                },
                custom_data: custom_data || {}
            }]
        };

        // Send the request to Facebook's API
        const response = await axios.post(FB_API_URL, payload);
        console.log('Facebook response:', response.data);  // Log Facebook's response

        // Respond with success
        res.status(200).send('Event tracked successfully');
    } catch (error) {
        console.error('Error tracking event:', error);
        res.status(500).send('Error tracking event');
    }
});
