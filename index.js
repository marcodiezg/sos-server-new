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
    path: '/stream',
    clientTracking: true
});

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok',
        server: process.env.SERVER_URL,
        phone: process.env.TWILIO_PHONE_NUMBER
    });
});

// Ruta para verificar Twilio
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
        console.log('📊 Usando número:', process.env.TWILIO_PHONE_NUMBER);
        
        const call = await client.calls.create({
            twiml: '<Response><Say language="es-ES">Esta es una llamada de prueba.</Say></Response>',
            to: '+34671220070',
            from: process.env.TWILIO_PHONE_NUMBER
        }).catch(error => {
            console.error('❌ Error de Twilio:', error);
            throw error;
        });

        console.log('✅ Llamada de prueba iniciada:', call.sid);
        res.json({ success: true, callId: call.sid });
    } catch (error) {
        console.error('❌ Error en llamada de prueba:', error);
        console.error('Detalles:', {
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

// Iniciar servidor HTTP con WebSocket
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
    console.log('📊 Variables de entorno:', {
        SERVER_URL: process.env.SERVER_URL,
        TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? 'Presente' : 'Falta',
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'Presente' : 'Falta'
    });
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promesa rechazada no manejada:', error);
}); 