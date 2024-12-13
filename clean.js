require('dotenv').config();
const client = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function cleanTwilioConfig() {
    try {
        // 1. Limpiar configuración del número
        console.log('Limpiando configuración del número...');
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
        
        console.log('Número actualizado:', number.sid);

        // 2. Listar y eliminar TwiML Apps
        console.log('Buscando TwiML Apps...');
        const apps = await client.applications.list();
        console.log(`Encontradas ${apps.length} aplicaciones`);
        
        for (const app of apps) {
            console.log(`Eliminando aplicación: ${app.sid}`);
            await client.applications(app.sid).remove();
        }

        console.log('✅ Limpieza completada');
        
        // Verificar configuración final
        const updatedNumber = await client.incomingPhoneNumbers(process.env.TWILIO_PHONE_SID).fetch();
        console.log('Configuración final del número:', {
            sid: updatedNumber.sid,
            voiceUrl: updatedNumber.voiceUrl,
            voiceMethod: updatedNumber.voiceMethod,
            voiceFallbackUrl: updatedNumber.voiceFallbackUrl
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

cleanTwilioConfig(); 