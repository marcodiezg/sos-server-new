require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const client = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configurar CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Limpiar configuración del número
app.get('/clean-number', async (req, res) => {
    try {
        // Actualizar el número para eliminar cualquier configuración
        const number = await client.incomingPhoneNumbers(process.env.TWILIO_PHONE_SID)
            .update({
                voiceUrl: '',
                voiceMethod: 'POST',
                voiceFallbackUrl: '',
                voiceFallbackMethod: 'POST',
                statusCallback: '',
                statusCallbackMethod: 'POST',
                voiceCallerIdLookup: false,
                voiceApplicationSid: ''
            });

        console.log('Número limpiado:', number.sid);
        res.json({ success: true, message: 'Configuración limpiada' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Iniciar llamada
app.post('/start-call', async (req, res) => {
    try {
        let toNumber = req.body.to;
        if (!toNumber.startsWith('+')) {
            toNumber = '+' + toNumber;
        }

        // Llamada directa sin TwiML
        const call = await client.calls.create({
            to: toNumber,
            from: process.env.TWILIO_PHONE_NUMBER,
            record: false,
            timeout: 20,
            machineDetection: 'Enable'
        });

        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
}); 