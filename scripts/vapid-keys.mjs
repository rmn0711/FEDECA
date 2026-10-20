// Genera las claves VAPID para las notificaciones push: node scripts/vapid-keys.mjs
import webpush from "web-push";
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"\nVAPID_PRIVATE_KEY="${privateKey}"\nVAPID_SUBJECT="mailto:mesadeayuda@acfcia.com"`);
