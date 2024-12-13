require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const client = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor funcionando' });
});

// Ruta para enviar SMS
app.post('/send-sms', async (req, res) => {
    try {
        const { to, message } = req.body;
        if (!to || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Se requieren los campos "to" y "message"' 
            });
        }

        const twilioMessage = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });

        res.json({ 
            success: true, 
            messageId: twilioMessage.sid 
        });
    } catch (error) {
        console.error('Error al enviar SMS:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Ruta para TwiML
app.all('/twiml', (req, res) => {
    console.log('TwiML endpoint llamado:', req.method);
    const response = new VoiceResponse();
    response.pause({ length: 3600 });
    res.type('text/xml');
    res.send(response.toString());
});

// Ruta para configurar número
app.get('/setup-number', async (req, res) => {
    try {
        await client.incomingPhoneNumbers(process.env.TWILIO_PHONE_SID)
            .update({
                voiceUrl: `${process.env.SERVER_URL}/twiml`,
                voiceMethod: 'POST'
            });
        res.json({ success: true, message: 'Número configurado correctamente' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta para hacer llamada
app.post('/make-call', async (req, res) => {
    try {
        const { to } = req.body;
        if (!to) {
            return res.status(400).json({ error: 'Se requiere el número de teléfono' });
        }

        const call = await client.calls.create({
            url: `${process.env.SERVER_URL}/twiml`,
            to: to,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        res.json({ success: true, callId: call.sid });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
}); 