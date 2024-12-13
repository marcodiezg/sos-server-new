const express = require('express');
const router = express.Router();
const twilio = require('twilio');

// Inicializar cliente de Twilio con logging detallado
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
  { 
    logLevel: 'debug'
  }
);

// Ruta para iniciar la llamada - versión ultra simple
router.post('/start-call', async (req, res) => {
  try {
    console.log('🚀 Iniciando llamada simple...');
    const { to } = req.body;
    
    if (!to) {
      console.error('❌ Error: Número de destino no proporcionado');
      return res.status(400).json({
        success: false,
        error: 'Número de destino requerido'
      });
    }

    // Verificar credenciales antes de la llamada
    console.log('🔑 Verificando credenciales...');
    console.log('SID:', process.env.TWILIO_ACCOUNT_SID?.substring(0, 5) + '...');
    console.log('Token:', process.env.TWILIO_AUTH_TOKEN ? 'Presente' : 'Falta');
    console.log('Número:', process.env.TWILIO_PHONE_NUMBER);

    // Llamada en su forma más simple
    const call = await client.calls.create({
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: '<Response><Say language="es-ES">Esta es una llamada de emergencia.</Say></Response>'
    });

    console.log('✅ Llamada iniciada:', {
      sid: call.sid,
      status: call.status,
      direction: call.direction,
      from: call.from,
      to: call.to
    });
    
    res.json({
      success: true,
      callSid: call.sid,
      status: call.status
    });

  } catch (error) {
    console.error('❌ Error detallado:', {
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: {
        code: error.code,
        status: error.status
      }
    });
  }
});

module.exports = router; 