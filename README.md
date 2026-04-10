# BizGuard | Enterprise Proxy

BizGuard es un motor de proxy reverso industrial y autenticado, diseñado para asegurar y enrutar el tráfico hacia aplicaciones internas mediante Microsoft Entra ID SSO.

## Características

- 🛡️ **Autenticación Zero-Trust**: Protege endpoints de aplicaciones legadas integrándolas con Microsoft Entra ID.
- ⚡ **Enrutamiento Dinámico**: Múltiples conectores proxy TCP administrados en un único panel de control.
- 📊 **Métricas en Tiempo Real**: Consumo de ancho de banda, requests y latencia en vivo.
- ⚙️ **Modo Multi-Worker**: Soporte total para el cluster Node.js mediante sincronización IPC rápida.

## Despliegue

Utiliza el script `preparar-despliegue.ps1` en PowerShell para generar el paquete industrial (`dist-bizguard`). Luego puedes subirlo al servidor y ejecutar:

```bash
node server.js
```
