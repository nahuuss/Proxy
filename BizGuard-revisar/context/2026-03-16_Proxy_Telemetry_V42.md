# Registro de Implementación: Proxy Telemetry V42 (Absolute Edition)
Fecha: 2026-03-16
Autor: Antigravity AI

## Resumen del Proyecto
Se ha implementado un Proxy Reverso avanzado en Node.js diseñado para actuar como puente entre Cloudflare y un backend IIS (`core.serenaart.com.ar`). El objetivo principal fue eliminar la percepción de inactividad en peticiones largas mediante un Dashboard de telemetría en tiempo real y un sistema de latidos (Heartbeat).

## Hitos Técnicos (Evolución V1 -> V42)
1.  **V1-V10**: Proxy básico, manejo de reescritura de dominios y descompresión Zlib.
2.  **V11-V32**: Implementación de `cluster` (multiproceso) y primer borrador de Dashboard TUI.
3.  **V33-V36**: Introducción de cronómetros de proceso y contador de latidos (Heartbeat 55s/15s).
4.  **V37-V40**: Visor elástico adaptativo y "Smart Truncate" para proteger los bordes de la tabla contra URLs largas de .NET.
5.  **V41-V42**: **Absolute Edition**. Implementación de redibujado atómico y barrido de búfer para eliminar el "ghosting" al redimensionar la consola en Windows.

## Especificaciones de la Interfaz
- **Ancho Fijo**: 114 caracteres.
- **Truncado Endurecido**: 106 caracteres (Hardened Truncate).
- **Modos de Ejecución**:
    - `Dashboard`: TUI interactiva con colores y tablas.
    - `Headless`: Modo texto plano para servicios (NSSM/PM2), activado automáticamente vía `isTTY` o parámetros `--no-gui`/`--quiet`.

## Infraestructura y Dependencias
- **Motor**: Node.js (Core modules: http, https, cluster, zlib, readline).
- **SSL**: `rejectUnauthorized: false` para túnel seguro a backend interno.
- **Puerto**: 8080 (Configurable).

---
*Este documento forma parte del historial de contexto del proyecto.*
