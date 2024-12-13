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
const WebSocket = require('ws');
const http = require('http');

// Inicializar Twilio
console.log('🔄 Inicializando cliente Twilio...');
const client = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Crear servidor HTTP y WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    server,
    path: '/stream'
});

// Manejar conexiones WebSocket
wss.on('connection', (ws, req) => {
    console.log('🎤 Nueva conexión WebSocket establecida');
    let callInProgress = false;
    let currentCall = null;

    ws.on('message', async (data) => {
        try {
            // Si es un mensaje de texto (control)
            if (typeof data === 'string') {
                const message = JSON.parse(data);
                console.log('📨 Mensaje recibido:', message);

                if (message.type === 'send_sms') {
                    console.log('📱 Enviando SMS...');
                    const sms = await client.messages.create({
                        body: message.body || '🚨 ALERTA DE EMERGENCIA: Se ha activado el botón de emergencia.',
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: message.to
                    });
                    console.log('✅ SMS enviado:', sms.sid);
                    ws.send(JSON.stringify({ type: 'sms_sent', messageId: sms.sid }));
                }
                else if (message.type === 'start_call') {
                    console.log('📞 Iniciando llamada...');
                    const call = await client.calls.create({
                        twiml: '<Response><Say language="es-ES">Alerta de emergencia activada. Mantenga la línea para escuchar el audio en directo.</Say><Connect><Stream url="wss://sos-server-new-production.up.railway.app/stream"/></Connect></Response>',
                        to: message.to,
                        from: process.env.TWILIO_PHONE_NUMBER
                    });
                    callInProgress = true;
                    currentCall = call;
                    console.log('✅ Llamada iniciada:', call.sid);
                    ws.send(JSON.stringify({ type: 'call_started', callId: call.sid }));
                }
            } 
            // Si es un buffer de audio
            else if (callInProgress) {
                // Transmitir el audio directamente
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

    ws.on('error', (error) => {
        console.error('❌ Error en WebSocket:', error);
    });
});

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok',
        server: process.env.SERVER_URL,
        phone: process.env.TWILIO_PHONE_NUMBER
    });
});

// Iniciar servidor HTTP con WebSocket
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
}); 