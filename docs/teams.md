# Avisos privados en Teams

Conecta envía las notificaciones existentes al correo corporativo de cada destinatario activo usando un flujo de Power Automate. No busca por nombre ni necesita un PC encendido. Las notificaciones de solicitudes, tareas y seguimientos que usan `sendPush` también llegan a Teams cuando se habilita el canal. Los avisos push existentes siguen funcionando por separado.

## Configurar Power Automate

1. Crear el flujo **Conecta ACF - avisos privados en Teams** en el entorno de ACF SAS.
2. Agregar el desencadenador estándar **Webhook de Microsoft Teams → Cuando se recibe una solicitud de webhook de Teams**. No usar el desencadenador HTTP premium.
3. Para llamadas desde Vercel sin sesión interactiva de Microsoft, seleccionar **Cualquiera**. La URL firmada es una credencial; quien la conozca podrá invocar el flujo. No publicarla ni ponerla en el navegador de Conecta. Confirmar esta configuración con el administrador antes de guardar.
4. En Configuración del desencadenador, agregar esta condición (adaptar el dominio si corresponde):

   ```text
   @and(equals(triggerBody()?['source'],'conecta-acf'),endsWith(toLower(coalesce(triggerBody()?['recipient'],'')),'@acfcia.com'),not(empty(triggerBody()?['message'])))
   ```

5. Agregar **Microsoft Teams → Publicar mensaje en un chat o canal**:
   - Publicar como: **Bot de Flow**.
   - Publicar en: **Chatear con un bot de Flow**.
   - Recipient → Configuración → Usar contenido dinámico: `@{triggerBody()?['recipient']}`.
   - Mensaje: `@{triggerBody()?['message']}`.
6. Guardar, comprobar que no solicita una licencia premium y copiar la URL firmada directamente a `TEAMS_WORKFLOW_URL`, de tipo **Secret** en Vercel. Dar un copropietario al flujo para evitar depender de una sola cuenta.
7. Configurar `TEAMS_ALLOWED_DOMAINS=acfcia.com` y, después de la prueba a la cuenta administradora, `TEAMS_ENABLED=true`. Desplegar de nuevo para aplicar las variables.

## Verificación y límites

- Antes de habilitar todos los avisos, probar un mensaje al administrador y revisar que la ejecución de Power Automate y el chat de Teams confirmen la entrega. Una respuesta HTTP 202 solo confirma que el flujo aceptó el trabajo.
- El correo de cada usuario debe resolver a una cuenta real de Teams en el inquilino; un alias de correo no siempre es el nombre de inicio de sesión de Microsoft 365. Corregirlo en Administración → Usuarios si es necesario.
- Los errores de Teams no bloquean los avisos push. Se registran sin la URL secreta ni el texto de los mensajes. No se reintenta automáticamente un envío fallido para evitar duplicados ante timeouts ambiguos.
- Las asignaciones y comentarios se envían después de la petición que los genera. Los recordatorios vencidos conservan el horario de procesamiento existente (cron diario, apertura de Conecta o consulta del puente de WhatsApp); este cambio no crea un programador cada minuto.
- El uso sin costo adicional depende de la licencia Microsoft 365, la disponibilidad de Workflows y los límites del inquilino. No activar pruebas premium ni comprar licencias para este flujo.

Pruebas de transporte (Node.js 22.6 o posterior):

```sh
node --experimental-strip-types --test tests/teams-transport.test.mjs
```

Referencias: [envío privado con el bot](https://learn.microsoft.com/en-us/power-automate/teams/send-a-message-in-teams#post-a-message-as-the-flow-bot-directly-to-a-user), [conector Teams y webhook](https://learn.microsoft.com/en-us/connectors/teams/), [licencias](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
