import Image from "next/image";
import { APP_NAME, ORG_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in oklch, #d9342c 8%, transparent), transparent)",
      }}
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex size-18 items-center justify-center rounded-2xl bg-card shadow-xs ring-1 ring-foreground/10">
          <Image src="/logo-acf.svg" alt="ACF" width={44} height={44} className="h-11 w-11" priority />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {APP_NAME} <span className="text-[#d9342c]">ACF</span>
        </h1>
        <p className="text-sm text-muted-foreground">{ORG_NAME} S.A.S.</p>
      </div>
      {children}
    </div>
  );
}
