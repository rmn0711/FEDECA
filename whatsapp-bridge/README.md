# Puente de WhatsApp

Envía las alertas de la plataforma **desde tu propio WhatsApp**, sin API de Meta y sin costo, y trae a la
plataforma las respuestas que las personas dan a esas alertas.

## Instalar (una sola vez, en un PC que permanezca encendido)

1. Instala [Node.js 20 o superior](https://nodejs.org).
2. Copia esta carpeta al PC y crea el archivo `.env` a partir de `.env.example`:
   - `PLATFORM_URL`: la dirección de la plataforma en Vercel.
   - `WHATSAPP_BRIDGE_TOKEN`: el mismo valor configurado en Vercel.
3. En una terminal dentro de la carpeta: `npm install` y luego `npm start`.
4. En la plataforma, **Configuración → WhatsApp**, aparece el código QR. En tu teléfono: WhatsApp →
   **Dispositivos vinculados → Vincular un dispositivo** y escanéalo.

Para que arranque solo al encender el PC (Windows): `npm install -g pm2 pm2-windows-startup`,
`pm2 start index.mjs --name whatsapp`, `pm2 save` y `pm2-startup install`.

## Seguridad

- La carpeta `auth/` es **tu sesión de WhatsApp**: quien la tenga puede escribir como tú. No la copies,
  no la subas a git ni la compartas. Si el PC se pierde, cierra la sesión desde el teléfono (Dispositivos vinculados).
- Solo se envían a la plataforma las respuestas que citan una alerta o traen un código HD-xxxxx, y la palabra BAJA.
  Tus demás chats nunca salen de este equipo.
- La comunicación con la plataforma es por HTTPS con un token secreto.

## Cuidar el número

Es una conexión no oficial (como WhatsApp Web). Para reducir el riesgo de suspensión, el servicio envía solo a
quienes aceptaron alertas, con pausas aleatorias, máximo 40 por hora y 200 por día, y solo entre 6:00 a. m. y
9:00 p. m. Si el servicio se cae, las alertas quedan en la bandeja de la plataforma para enviarlas a mano.
