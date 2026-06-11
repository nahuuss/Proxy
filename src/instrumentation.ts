export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Migrar logs antiguos de la raíz a /logs antes de arrancar
    try {
      const fs = await import("fs");
      const path = await import("path");
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const migrateLogFile = (fileName: string) => {
        const oldPath = path.join(/*turbopackIgnore: true*/ process.cwd(), fileName);
        const newPath = path.join(logsDir, fileName);
        if (fs.existsSync(oldPath)) {
          try {
            if (fs.existsSync(newPath)) {
              // Si ya existe el nuevo, concatenamos el viejo
              const oldContent = fs.readFileSync(oldPath, 'utf8');
              fs.appendFileSync(newPath, oldContent, 'utf8');
              fs.unlinkSync(oldPath);
            } else {
              // Si no existe, lo renombramos/movemos
              fs.renameSync(oldPath, newPath);
            }
            console.log(`[Logs Migration] Migrado ${fileName} exitosamente a logs/${fileName}`);
          } catch (e: any) {
            console.error(`[Logs Migration Error] Error migrando ${fileName}:`, e.message);
          }
        }
      };

      migrateLogFile('hb.log');
      migrateLogFile('sso.log');
    } catch (err: any) {
      console.error("[Logs Migration Error] Fallo al iniciar migración:", err.message);
    }

    if (
      process.env.NEXT_PHASE === 'phase-production-build' ||
      (typeof process !== 'undefined' && process.argv && process.argv.some(arg => arg.includes('build') || arg.includes('next-build')))
    ) {
      console.log("[Instrumentation] Skipping ProxyManager initialization during production build phase.");
      return;
    }

    const { proxyManager } = await import("@/lib/proxy-manager");
    await proxyManager.init();
    console.log("[Instrumentation] ProxyManager initialized and ports opened.");

    const shutdown = () => {
      console.log("\n[BizGuard] Shutting down...");
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}
