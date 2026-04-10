export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
