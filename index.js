require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');
const client = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Crear servidor HTTP y WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    server,
    path: '/stream',
    clientTracking: true,
    perMessageDeflate: false
});

// Manejar conexiones WebSocket
wss.on('connection', (ws, req) => {
    console.log('🎤 Nueva conexión WebSocket establecida');
    console.log('🔌 Headers:', req.headers);
    console.log('👥 Clientes conectados:', wss.clients.size);
    
    let lastMessageTime = Date.now();
    let audioBuffer = Buffer.alloc(0);

    // Enviar mensaje de bienvenida
    ws.send(JSON.stringify({ type: 'welcome', message: 'Conexión establecida' }));

    ws.on('message', (data) => {
        try {
            lastMessageTime = Date.now();
            audioBuffer = Buffer.concat([audioBuffer, data]);
            console.log(`🎵 Audio recibido - Tamaño: ${data.length} bytes`);
            
            // Enviar confirmación
            ws.send(JSON.stringify({ type: 'ack', size: data.length }));
        } catch (error) {
            console.error('❌ Error procesando audio:', error);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });

    ws.on('close', (code, reason) => {
        console.log('🔌 Conexión WebSocket cerrada');
        console.log('📊 Código:', code);
        console.log('📝 Razón:', reason);
        console.log('👥 Clientes restantes:', wss.clients.size);
    });

    ws.on('error', (error) => {
        console.error('❌ Error en WebSocket:', error);
    });

    // Ping para mantener la conexión viva
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on('pong', () => {
        console.log('📡 Pong recibido');
    });

    ws.on('close', () => {
        clearInterval(pingInterval);
    });
});

// Verificar estado del WebSocket Server
wss.on('error', (error) => {
    console.error('❌ Error en WebSocket Server:', error);
});

wss.on('close', () => {
    console.log('🔌 WebSocket Server cerrado');
});

// Ruta para verificar estado del WebSocket
app.get('/ws-status', (req, res) => {
    res.json({
        status: 'ok',
        clients: wss.clients.size,
        ready: wss.readyState === WebSocket.OPEN
    });
});

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

// Iniciar servidor HTTP con WebSocket
const PORT = process.env.PORT || 8080;
const serverHost = process.env.SERVER_URL.replace('https://', '');
server.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
    console.log(`📞 TwiML URL: ${process.env.SERVER_URL}/twiml`);
    console.log(`🎤 WebSocket URL: wss://${serverHost}/stream`);
    console.log(`📊 Estado WebSocket: ${wss.readyState}`);
}); 