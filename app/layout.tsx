import "./globals.css";
import type { Metadata } from "next";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "NeoMaker ERP",
  description: "Gestão de pedidos, produção e financeiro para impressão 3D.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="pt-BR"><body><PwaRegister />{children}</body></html>;
}
