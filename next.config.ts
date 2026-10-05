import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Permite abrir el dev server desde otros dispositivos de la misma red
  // (ej. el celular, para probar el diseño responsivo) — sin esto, Next.js
  // bloquea las requests de HMR que no vienen de localhost.
  allowedDevOrigins: ["192.168.0.15"],
};

export default nextConfig;
