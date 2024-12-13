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
    
    let callInProgress = false;
    let currentCall = null;
    let audioBuffer = Buffer.alloc(0);

    // Enviar mensaje de bienvenida
    ws.send(JSON.stringify({ type: 'welcome', message: 'Conexión establecida' }));

    ws.on('message', async (data) => {
        try {
            // Si es un mensaje de texto (control)
            if (typeof data === 'string') {
                const control = JSON.parse(data);
                if (control.type === 'start_call') {
                    console.log('🎯 Iniciando llamada de emergencia');
                    const call = await client.calls.create({
                        url: `${process.env.SERVER_URL}/twiml`,
                        to: '+34671220070',
                        from: process.env.TWILIO_PHONE_NUMBER
                    });
                    callInProgress = true;
                    currentCall = call;
                    console.log('📞 Llamada iniciada:', call.sid);
                    ws.send(JSON.stringify({ type: 'call_started', callId: call.sid }));
                }
            } 
            // Si es un buffer de audio
            else {
                if (callInProgress) {
                    audioBuffer = Buffer.concat([audioBuffer, data]);
                    console.log(`🎵 Audio recibido - Tamaño: ${data.length} bytes`);
                    ws.send(JSON.stringify({ type: 'audio_received', size: data.length }));
                }
            }
        } catch (error) {
            console.error('❌ Error procesando mensaje:', error);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });

    ws.on('close', () => {
        console.log('🔌 Conexión WebSocket cerrada');
        if (callInProgress && currentCall) {
            console.log('📞 Finalizando llamada:', currentCall.sid);
            client.calls(currentCall.sid)
                .update({status: 'completed'})
                .then(() => console.log('✅ Llamada finalizada correctamente'))
                .catch(err => console.error('❌ Error al finalizar llamada:', err));
        }
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

    ws.on('error', (error) => {
        console.error('❌ Error en WebSocket:', error);
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
        console.log('📞 Solicitud de llamada recibida:', req.body);
        const { to } = req.body;
        if (!to) {
            console.log('❌ Error: Número de teléfono no proporcionado');
            return res.status(400).json({ error: 'Se requiere el número de teléfono' });
        }

        console.log('🔑 Verificando credenciales de Twilio...');
        console.log('Account SID:', process.env.TWILIO_ACCOUNT_SID);
        console.log('Auth Token:', process.env.TWILIO_AUTH_TOKEN ? 'Presente' : 'Falta');
        console.log('Phone Number:', process.env.TWILIO_PHONE_NUMBER);

        // Primero hacemos la llamada
        console.log('📞 Iniciando llamada a:', to);
        const call = await client.calls.create({
            twiml: '<Response><Say language="es-ES">Alerta de emergencia activada. Por favor, mantenga la línea.</Say><Pause length="3600"/></Response>',
            to: to,
            from: process.env.TWILIO_PHONE_NUMBER,
            statusCallback: `${process.env.SERVER_URL}/call-status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallbackMethod: 'POST'
        });
        console.log('✅ Llamada iniciada con éxito:', call.sid);

        // Luego enviamos el SMS
        console.log('📱 Enviando SMS a:', to);
        const message = await client.messages.create({
            body: '🚨 ALERTA DE EMERGENCIA: Se ha activado el botón de emergencia.',
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to,
            statusCallback: `${process.env.SERVER_URL}/sms-status`
        });
        console.log('✅ SMS enviado:', message.sid);

        res.json({ 
            success: true, 
            callId: call.sid,
            messageId: message.sid
        });
    } catch (error) {
        console.error('❌ Error al hacer la llamada:', error);
        console.error('Detalles del error:', {
            message: error.message,
            code: error.code,
            status: error.status,
            moreInfo: error.moreInfo
        });
        res.status(500).json({ 
            error: error.message,
            details: {
                code: error.code,
                status: error.status,
                moreInfo: error.moreInfo
            }
        });
    }
});

// Ruta para recibir actualizaciones del estado de la llamada
app.post('/call-status', (req, res) => {
    console.log('📞 Estado de la llamada actualizado:', req.body);
    res.sendStatus(200);
});

// Ruta para recibir actualizaciones del estado del SMS
app.post('/sms-status', (req, res) => {
    console.log('📱 Estado del SMS actualizado:', req.body);
    res.sendStatus(200);
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