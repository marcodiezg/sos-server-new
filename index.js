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
    
    let callInProgress = false;
    let currentCall = null;
    let mediaStream = null;

    // Enviar mensaje de bienvenida
    ws.send(JSON.stringify({ type: 'welcome', message: 'Conexión establecida' }));

    ws.on('message', async (data) => {
        try {
            // Si es un mensaje de texto (control)
            if (typeof data === 'string') {
                const control = JSON.parse(data);
                if (control.type === 'start_call') {
                    console.log('🎯 Iniciando llamada de emergencia');
                    
                    // Primero enviamos el SMS
                    console.log('📱 Enviando SMS...');
                    const message = await client.messages.create({
                        body: '🚨 ALERTA DE EMERGENCIA: Se ha activado el botón de emergencia.',
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: '+34671220070'
                    });
                    console.log('✅ SMS enviado:', message.sid);

                    // Luego iniciamos la llamada
                    const call = await client.calls.create({
                        twiml: '<Response><Say language="es-ES">Alerta de emergencia activada. Mantenga la línea para escuchar el audio en directo.</Say><Connect><Stream url="wss://sos-server-new-production.up.railway.app/stream"/></Connect></Response>',
                        to: '+34671220070',
                        from: process.env.TWILIO_PHONE_NUMBER,
                        statusCallback: `${process.env.SERVER_URL}/call-status`,
                        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                        statusCallbackMethod: 'POST'
                    });
                    callInProgress = true;
                    currentCall = call;
                    console.log('📞 Llamada iniciada:', call.sid);
                    ws.send(JSON.stringify({ type: 'call_started', callId: call.sid }));
                }
            } 
            // Si es un buffer de audio
            else if (callInProgress) {
                // Transmitir el audio directamente a los clientes conectados
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(data);
                    }
                });
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

// Configuración de Twilio
console.log('🔑 Inicializando Twilio con:', {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
});

// Ruta de prueba para verificar credenciales
app.get('/verify', async (req, res) => {
    try {
        console.log('🔍 Verificando credenciales de Twilio...');
        const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        console.log('✅ Cuenta verificada:', account.friendlyName);
        res.json({ 
            status: 'ok',
            account: account.friendlyName,
            phoneNumber: process.env.TWILIO_PHONE_NUMBER
        });
    } catch (error) {
        console.error('❌ Error verificando cuenta:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta para hacer llamada de prueba
app.get('/test-call', async (req, res) => {
    try {
        console.log('📞 Iniciando llamada de prueba...');
        const call = await client.calls.create({
            twiml: '<Response><Say language="es-ES">Esta es una llamada de prueba.</Say></Response>',
            to: '+34671220070',
            from: process.env.TWILIO_PHONE_NUMBER
        });
        console.log('✅ Llamada de prueba iniciada:', call.sid);
        res.json({ success: true, callId: call.sid });
    } catch (error) {
        console.error('❌ Error en llamada de prueba:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta para enviar SMS de prueba
app.get('/test-sms', async (req, res) => {
    try {
        console.log('📱 Enviando SMS de prueba...');
        const message = await client.messages.create({
            body: 'Este es un mensaje de prueba.',
            from: process.env.TWILIO_PHONE_NUMBER,
            to: '+34671220070'
        });
        console.log('✅ SMS de prueba enviado:', message.sid);
        res.json({ success: true, messageId: message.sid });
    } catch (error) {
        console.error('❌ Error enviando SMS de prueba:', error);
        res.status(500).json({ error: error.message });
    }
}); 