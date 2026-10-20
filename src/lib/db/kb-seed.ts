import { eq } from "drizzle-orm";
import type { DB } from "./index";
import { kbArticles, settings, users } from "./schema";

const FLAG = "kb_v1";

// Artículos de arranque: guías generales que el equipo debe ajustar a sus procedimientos reales.
const ARTICLES: Array<{ category: string | null; title: string; summary: string; keywords: string; body: string }> = [
  {
    category: "sistemas",
    title: "Olvidé mi contraseña del correo (Microsoft 365)",
    summary: "Cómo recuperar el acceso a tu correo corporativo sin esperar a Sistemas.",
    keywords: "contraseña clave correo outlook microsoft 365 bloqueado olvidé acceso",
    body: `Si olvidaste la contraseña de tu correo **@acfcia.com**:

1. Entra a **https://passwordreset.microsoftonline.com** desde el celular o desde otro equipo.
2. Escribe tu correo y el código de la imagen.
3. Verifica con el método que registraste (celular o correo alterno).
4. Crea una contraseña nueva: mínimo 12 caracteres, con mayúsculas, números y un símbolo.

> Si no tienes un método de verificación registrado o la cuenta dice **bloqueada**, crea una solicitud de **Sistemas** con prioridad **Alta**.

### Recomendaciones
- [ ] No reutilices la contraseña de otros sistemas (SINCO, CRM).
- [ ] Actualiza la contraseña también en el celular (Outlook / Teams).
`,
  },
  {
    category: "sistemas",
    title: "La VPN no conecta: revisa esto antes de reportar",
    summary: "Pasos rápidos que resuelven la mayoría de fallas de VPN desde obra o casa.",
    keywords: "vpn conexion remota obra internet error 809 no conecta forticlient",
    body: `Antes de crear la solicitud, prueba en este orden:

1. **Internet:** abre cualquier página web. Si no carga, el problema es la red y no la VPN.
2. **Reinicia el cliente de VPN** (ciérralo por completo desde la barra de tareas y ábrelo de nuevo).
3. **Contraseña:** si la cambiaste hace poco, la VPN usa la nueva.
4. **Red de la obra o del hotel:** algunas redes bloquean la VPN. Prueba compartiendo datos desde tu celular.
5. Reinicia el computador.

Si sigue fallando, crea una solicitud de **Sistemas** y adjunta una **captura del mensaje de error** e indica desde dónde te conectas.
`,
  },
  {
    category: "sinco",
    title: "Usuario de SINCO bloqueado u olvidé la contraseña",
    summary: "Qué hacer si SINCO no te deja entrar y qué datos enviar.",
    keywords: "sinco contraseña clave usuario bloqueado acceso ingresar erp",
    body: `SINCO bloquea el usuario después de varios intentos fallidos.

### Qué hacer
1. Espera **15 minutos** y vuelve a intentar con cuidado (mayúsculas, teclado numérico).
2. Si no funciona, crea una solicitud de **Sinco Soft** con tipo **Creación de usuario o permisos** e indica:
   - Tu **usuario de SINCO**
   - La **empresa / proyecto** en la que trabajas
   - Si necesitas **cambiar permisos** además del desbloqueo

> El desbloqueo se atiende con prioridad **Alta** si te impide facturar, pagar o aprobar ese mismo día.
`,
  },
  {
    category: "diseno",
    title: "Cómo pedir una pieza gráfica (y que salga a la primera)",
    summary: "La información que necesita Diseño para entregar sin reprocesos.",
    keywords: "diseño pieza grafica post flyer pendon banner logo presentacion brief",
    body: `Una buena solicitud de diseño tiene **brief completo**. Incluye siempre:

| Dato | Ejemplo |
| --- | --- |
| Objetivo | Anunciar la apertura de la sala de ventas |
| Público | Familias que buscan vivienda VIS |
| Formato y medidas | Post 1080 × 1350 px, pendón 1 × 2 m |
| Textos exactos | Título, subtítulo, llamado a la acción, legales |
| Fecha de entrega | Con al menos **3 días hábiles** |
| Referencias | Links o piezas anteriores que te gusten |

### Tiempos sugeridos
- Post o historia: **2 días hábiles**
- Pieza impresa o campaña: **5 días hábiles**

Las piezas se aprueban en la plataforma: recibirás la propuesta y podrás **aprobarla o pedir cambios** sobre la imagen.
`,
  },
  {
    category: "redes",
    title: "Cómo solicitar una publicación en redes sociales",
    summary: "Qué enviar para programar un post, historia o reel.",
    keywords: "redes sociales publicacion post historia reel instagram facebook linkedin tiktok",
    body: `Para programar una publicación necesitamos:

- **Red social** y **formato** (post, carrusel, historia, reel).
- **Fecha y hora** deseada (mínimo **2 días hábiles** de anticipación).
- **Copy** sugerido y enlace de destino.
- **Material**: adjúntalo o indica si requiere diseño (se coordina con Diseño gráfico).

> Las publicaciones urgentes o de crisis se marcan con prioridad **Alta**.
`,
  },
  {
    category: "cotizador",
    title: "Antes de pedir un ajuste en el cotizador",
    summary: "Datos mínimos para ajustar una cotización o reportar una falla.",
    keywords: "cotizador cotizacion ajuste precio descuento error version cliente",
    body: `Para ajustar una cotización o reportar una falla del cotizador, incluye:

1. **Número de cotización** (ej. COT-2026-0451).
2. **Cliente** y **proyecto / unidad**.
3. Qué debe cambiar: precio, descuento, forma de pago, plazo…
4. Si es una falla: **captura de pantalla** y los pasos que hiciste.

> Los ajustes de precio requieren la aprobación comercial correspondiente; menciónala en la solicitud.
`,
  },
  {
    category: "ia",
    title: "Qué herramientas de IA podemos usar y cómo pedir acceso",
    summary: "Buenas prácticas y cómo solicitar licencias o automatizaciones con IA.",
    keywords: "ia inteligencia artificial claude chatgpt copilot licencia acceso automatizacion",
    body: `### Buenas prácticas
- [ ] No pegues **datos personales de clientes** ni información financiera en herramientas no autorizadas.
- [ ] Revisa siempre el resultado antes de enviarlo a un cliente.
- [ ] Indica cuando un contenido fue apoyado con IA si así lo pide el área.

### Cómo pedir acceso o una automatización
Crea una solicitud de **Inteligencia Artificial** indicando el proceso actual, cuánto tiempo toma y el resultado esperado. El equipo de IA evaluará la mejor herramienta.
`,
  },
  {
    category: "crm",
    title: "Cómo importar contactos al CRM",
    summary: "Formato del archivo para cargar leads de ferias, eventos o campañas.",
    keywords: "crm importar contactos leads base de datos excel csv feria evento",
    body: `Para importar contactos envía un Excel o CSV con estas columnas:

| Columna | Obligatoria |
| --- | --- |
| Nombre | Sí |
| Apellido | Sí |
| Celular (con indicativo, ej. 3001234567) | Sí |
| Correo | No |
| Proyecto de interés | Sí |
| Fuente (feria, pauta, referido…) | Sí |
| Autorización de tratamiento de datos | **Sí** |

> Sin **autorización de tratamiento de datos** no se pueden cargar los contactos.

Crea la solicitud en **CRM** con tipo **Importar o depurar contactos** y adjunta el archivo.
`,
  },
];

export async function seedKnowledgeBase(db: DB) {
  const [done] = await db.select().from(settings).where(eq(settings.key, FLAG));
  if (done) return;
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  for (const a of ARTICLES) {
    await db.insert(kbArticles).values({
      categorySlug: a.category,
      title: a.title,
      summary: a.summary,
      keywords: a.keywords,
      body: a.body,
      createdBy: owner?.id ?? null,
      updatedBy: owner?.id ?? null,
    });
  }
  await db.insert(settings).values({ key: FLAG, value: new Date().toISOString() }).onConflictDoNothing();
}
