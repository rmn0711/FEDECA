import Image from "next/image";

// Mismo indicador del cotizador: el logo de ACF se "llena" mientras carga la página.
export default function AppLoading() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="relative size-40">
        <Image src="/logo-acf.svg" alt="" aria-hidden className="absolute inset-0 opacity-15" width={160} height={160} priority />
        <Image src="/logo-acf.svg" alt="Cargando" className="absolute inset-0 animate-logo-fill" width={160} height={160} priority />
      </div>
    </div>
  );
}
