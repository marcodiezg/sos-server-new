require('dotenv').config();

// Configuración inicial
console.log('🚀 Iniciando servidor...');
console.log('📊 Variables de entorno:', {
    SERVER_URL: process.env.SERVER_URL,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? 'Presente' : 'Falta',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'Presente' : 'Falta'
});

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

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok',
        server: process.env.SERVER_URL,
        phone: process.env.TWILIO_PHONE_NUMBER,
        timestamp: new Date().toISOString()
    });
});

// Enviar SMS
app.post('/send-sms', async (req, res) => {
    try {
        console.log('📱 Enviando SMS...');
        console.log('📞 Request completo:', req.body);
        console.log('📞 Número destino:', req.body.to);
        console.log('📝 Mensaje:', req.body.body);
        
        if (!req.body.to || !req.body.body) {
            console.error('❌ Faltan datos requeridos');
            return res.status(400).json({
                success: false,
                error: 'Se requieren los campos "to" y "body"',
                receivedData: req.body,
                timestamp: new Date().toISOString()
            });
        }

        // Asegurarse de que el número tenga el formato correcto
        let toNumber = req.body.to;
        if (!toNumber.startsWith('+')) {
            toNumber = '+' + toNumber;
        }
        
        const sms = await client.messages.create({
            body: req.body.body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: toNumber
        });
        
        console.log('✅ SMS enviado:', sms.sid);
        res.json({ 
            success: true,
            messageId: sms.sid,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error enviando SMS:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Iniciar llamada
app.post('/start-call', async (req, res) => {
    try {
        console.log('📞 Iniciando llamada...');
        console.log('📞 Número destino:', req.body.to);
        
        // Asegurarse de que el número tenga el formato correcto
        let toNumber = req.body.to;
        if (!toNumber.startsWith('+')) {
            toNumber = '+' + toNumber;
        }
        
        const call = await client.calls.create({
            twiml: `<Response>
                <Dial callerId="${process.env.TWILIO_PHONE_NUMBER}">
                    ${toNumber}
                </Dial>
            </Response>`,
            to: process.env.TWILIO_PHONE_NUMBER,
            from: process.env.TWILIO_PHONE_NUMBER,
            statusCallback: `${process.env.SERVER_URL}/call-status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallbackMethod: 'POST'
        });
        
        console.log('✅ Llamada iniciada:', call.sid);
        res.json({ 
            success: true,
            callId: call.sid,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error iniciando llamada:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Estado de la llamada
app.post('/call-status', (req, res) => {
    console.log('📞 Estado de llamada:', req.body);
    res.sendStatus(200);
});

// Iniciar servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
    console.log(`🌐 URL del servidor: ${process.env.SERVER_URL}`);
    console.log(`📞 Número de teléfono: ${process.env.TWILIO_PHONE_NUMBER}`);
}); 