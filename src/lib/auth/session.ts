import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "hd_session";
export const SESSION_DAYS = 7;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET debe estar configurado (mínimo 32 caracteres).");
    }
    return new TextEncoder().encode("dev-only-secret-conecta-acf-no-usar-en-produccion");
  }
  return new TextEncoder().encode(secret);
}

/** sv = versión de sesión del usuario: al cambiar la contraseña sube y las sesiones anteriores dejan de valer. */
export async function signSession(userId: number, sessionVersion: number) {
  return new SignJWT({ uid: userId, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function readSession(token: string | undefined): Promise<{ uid: number; sv: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "number") return null;
    return { uid: payload.uid, sv: typeof payload.sv === "number" ? payload.sv : 0 };
  } catch {
    return null;
  }
}

export async function verifySession(token: string | undefined): Promise<number | null> {
  return (await readSession(token))?.uid ?? null;
}
