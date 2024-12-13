require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const client = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
const { VoiceResponse } = require('twilio').twiml;

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Log de todas las peticiones
app.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.path}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
});

// Endpoint de prueba
app.get('/', (req, res) => {
    console.log('🏠 Endpoint raíz llamado');
    res.json({ status: 'ok', message: 'Servidor funcionando' });
});

// Endpoint para generar TwiML básico
app.all('/basic-twiml', (req, res) => {
    console.log('📞 Generando TwiML básico');
    const twiml = new VoiceResponse();
    twiml.say({ language: 'es-ES' }, 'Conectando llamada');
    console.log('TwiML:', twiml.toString());
    res.type('text/xml');
    res.send(twiml.toString());
});

// Iniciar llamada
app.post('/start-call', async (req, res) => {
    console.log('⭐️ Iniciando nueva llamada');
    console.log('Variables de entorno:');
    console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);
    console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER);
    console.log('SERVER_URL:', process.env.SERVER_URL);
    
    try {
        let toNumber = req.body.to;
        if (!toNumber.startsWith('+')) {
            toNumber = '+' + toNumber;
        }

        console.log('📞 Número destino:', toNumber);
        
        // URL para TwiML básico
        const twimlUrl = `${process.env.SERVER_URL}/basic-twiml`;
        console.log('🔗 URL TwiML:', twimlUrl);

        // Intentar crear la llamada con configuración mínima
        const call = await client.calls.create({
            to: toNumber,
            from: process.env.TWILIO_PHONE_NUMBER,
            url: twimlUrl
        });

        console.log('✅ Llamada creada:', call.sid);
        res.json({ success: true, callId: call.sid });
        
    } catch (error) {
        console.error('❌ Error completo:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error
        });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log('🚀 Servidor iniciado');
    console.log('📍 Puerto:', PORT);
    console.log('🌐 URL del servidor:', process.env.SERVER_URL);
    console.log('📞 URL TwiML:', `${process.env.SERVER_URL}/basic-twiml`);
}); 