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

// Inicializar Twilio con logs detallados
console.log('🔄 Inicializando cliente Twilio...');
let client;
try {
    client = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
    console.log('✅ Cliente Twilio inicializado correctamente');
} catch (error) {
    console.error('❌ Error inicializando Twilio:', error);
    process.exit(1);
}

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

// Endpoint de prueba para Twilio
app.get('/test-twilio', async (req, res) => {
    console.log('\n🔵 PRUEBA DE TWILIO 🔵');
    try {
        // 1. Verificar cuenta
        console.log('1️⃣ Verificando cuenta...');
        const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        console.log('Cuenta:', {
            sid: account.sid,
            status: account.status,
            type: account.type
        });

        // 2. Listar números disponibles
        console.log('2️⃣ Listando números...');
        const numbers = await client.incomingPhoneNumbers.list();
        console.log('Números disponibles:', numbers.map(n => ({
            phoneNumber: n.phoneNumber,
            friendlyName: n.friendlyName,
            capabilities: n.capabilities
        })));

        res.json({
            account: {
                sid: account.sid,
                status: account.status,
                type: account.type
            },
            numbers: numbers.map(n => ({
                phoneNumber: n.phoneNumber,
                friendlyName: n.friendlyName,
                capabilities: n.capabilities
            }))
        });
    } catch (error) {
        console.error('❌ Error en prueba:', error);
        res.status(500).json({ error: error.message });
    }
});

// Función para verificar estado de llamada
async function checkCallStatus(callSid, attempt = 1) {
    try {
        console.log(`📞 Verificando estado de llamada (intento ${attempt})...`);
        const callStatus = await client.calls(callSid).fetch();
        console.log('📞 Estado actual:', {
            sid: callStatus.sid,
            status: callStatus.status,
            duration: callStatus.duration,
            direction: callStatus.direction,
            from: callStatus.from,
            to: callStatus.to,
            price: callStatus.price,
            errorCode: callStatus.errorCode,
            errorMessage: callStatus.errorMessage,
            timestamp: new Date().toISOString()
        });
        return callStatus;
    } catch (error) {
        console.error(`❌ Error verificando estado (intento ${attempt}):`, error);
        return null;
    }
}

// Iniciar llamada
app.post('/start-call', async (req, res) => {
    console.log('\n🔵 NUEVA SOLICITUD DE LLAMADA 🔵');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    try {
        // 1. Validar request
        console.log('1️⃣ Validando request...');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        
        if (!req.body.to) {
            throw new Error('No se proporcionó número de destino');
        }

        // 2. Preparar número
        console.log('2️⃣ Preparando número...');
        let toNumber = req.body.to;
        if (!toNumber.startsWith('+')) {
            toNumber = '+' + toNumber;
        }
        console.log('Número origen:', process.env.TWILIO_PHONE_NUMBER);
        console.log('Número destino:', toNumber);

        // 3. Verificar cuenta Twilio
        console.log('3️⃣ Verificando cuenta Twilio...');
        const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        console.log('Cuenta Twilio:', {
            status: account.status,
            type: account.type,
            friendlyName: account.friendlyName
        });

        // 4. Intentar llamada con configuración básica
        console.log('4️⃣ Iniciando llamada con configuración básica...');
        const call = await client.calls.create({
            to: toNumber,
            from: process.env.TWILIO_PHONE_NUMBER,
            twiml: '<Response><Say language="es-ES">Esto es una prueba de llamada de emergencia.</Say><Pause length="2"/></Response>'
        });

        console.log('✅ Llamada creada:', {
            sid: call.sid,
            status: call.status,
            direction: call.direction,
            from: call.from,
            to: call.to
        });

        // 5. Verificar estado inmediatamente
        console.log('5️⃣ Verificando estado inicial...');
        const initialStatus = await client.calls(call.sid).fetch();
        console.log('Estado inicial:', {
            status: initialStatus.status,
            duration: initialStatus.duration,
            errorCode: initialStatus.errorCode,
            errorMessage: initialStatus.errorMessage
        });

        // 6. Enviar respuesta
        res.json({ 
            success: true,
            callId: call.sid,
            status: initialStatus.status,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ ERROR EN LLAMADA:', error);
        console.error('Stack:', error.stack);
        console.error('Detalles:', {
            code: error.code,
            status: error.status,
            moreInfo: error.moreInfo
        });
        
        res.status(500).json({ 
            success: false,
            error: error.message,
            details: {
                code: error.code,
                status: error.status,
                moreInfo: error.moreInfo
            },
            timestamp: new Date().toISOString()
        });
    }
});

// Estado de la llamada
app.post('/call-status', (req, res) => {
    console.log('\n🔵 ACTUALIZACIÓN DE ESTADO DE LLAMADA 🔵');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('Headers:', req.headers);
    console.log('Body completo:', req.body);
    
    const statusInfo = {
        callSid: req.body.CallSid,
        callStatus: req.body.CallStatus,
        direction: req.body.Direction,
        from: req.body.From,
        to: req.body.To,
        errorCode: req.body.ErrorCode,
        errorMessage: req.body.ErrorMessage,
        duration: req.body.CallDuration,
        timestamp: new Date().toISOString()
    };
    
    console.log('📞 Información de estado:', statusInfo);
    res.sendStatus(200);
});

// Iniciar servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor iniciado en puerto ${PORT}`);
    console.log(`🌐 URL del servidor: ${process.env.SERVER_URL}`);
    console.log(`📞 Número de teléfono: ${process.env.TWILIO_PHONE_NUMBER}`);
}); 