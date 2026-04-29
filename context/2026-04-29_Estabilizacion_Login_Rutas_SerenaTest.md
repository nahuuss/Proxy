# Estabilización de Producto: Serena-Test (Login y Rutas)

**Fecha:** 2026-04-29  
**Estado:** Completado  
**Versión Proxy:** 1.3.2-Hotfix  

## 1. Problemas Identificados
Tras la implementación inicial del producto `Serena-Test`, se detectaron dos problemas críticos en el entorno de pruebas (`hometest.serenaart.com.ar`):

1. **Bloqueo de Login (AJAX Delta):** Al intentar ingresar, el sistema no realizaba ninguna acción. Esto se debía a que el **Heartbeat Shield** (HB) inyectaba espacios en blanco al inicio de la respuesta AJAX, corrompiendo el formato esperado por el parser de Microsoft/Telerik (`Sys.WebForms.PageRequestManagerParserErrorException`).
2. **Duplicación de Rutas (404s):** Varios activos (imágenes y scripts) fallaban con error 404 debido a una duplicación en la ruta: `/Portals/_default/Skins/SkinOmint//Portals/...`. Esto ocurría por la reescritura de URLs absolutas que luego eran concatenadas dinámicamente por el motor de DNN.

## 2. Soluciones Implementadas

### Backend (Rules Engine)
Se modificó quirúrgicamente el archivo `src/lib/rules/serena-test.ts`:

- **Aislamiento de HB en AJAX:** Se añadió una lógica de detección para **AJAX Delta** y **XHR estándar**. El HB Shield ahora se desactiva automáticamente para estos requests en el producto `Serena-Test`, permitiendo un login fluido.
- **Exclusión de Login:** Se añadieron filtros explícitos para no aplicar HB en rutas que contengan `login` o `ingreso`.
- **Limpieza de Body (rewriteBody):**
    - Se implementó un reescritor que detecta y elimina la duplicación de prefijos `/Portals/.../Portals/`.
    - Se añadió un normalizador de dobles barras (`//`) para asegurar que las rutas root-relative sean válidas.

### Empaquetado
- Se ejecutó `preparar-despliegue.ps1` para generar el paquete standalone actualizado en la carpeta `BizGuard/`.

## 3. Verificación
1. **Login:** Se verificó que el flujo de autenticación en `https://hometest.serenaart.com.ar/` ya no se bloquea y redirige correctamente al Panel.
2. **Recursos:** Se confirmó la carga correcta de imágenes y scripts que anteriormente daban 404 por rutas duplicadas.
3. **Aislamiento:** Se validó que el comportamiento de los productos `Core` y `Bank` no fue alterado, manteniendo su lógica de HB original.

## 4. Notas de Despliegue
El paquete generado en `E:\Proxy\BizGuard` contiene los binarios actualizados. Solo es necesario reiniciar el servicio de node apuntando al nuevo `server.js`.
