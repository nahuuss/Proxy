const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, AlignmentType, HeadingLevel, WidthType } = require('docx');
const fs = require('fs');
const path = require('path');

// Colores corporativos (Hex sin #)
const COLOR_PRIMARY = "1B365D"; // Azul Oscuro
const COLOR_SECONDARY = "4A90E2"; // Azul Claro
const COLOR_TEXT = "333333"; // Gris Oscuro
const COLOR_BG_HEADER = "F2F4F8"; // Fondo cabecera tabla
const COLOR_BORDER = "D1D5DB"; // Borde sutil

const doc = new Document({
    sections: [{
        properties: {},
        children: [
            // Título Principal
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [
                    new TextRun({
                        text: "🛡️ BizGuard Reverse Proxy",
                        bold: true,
                        size: 56, // 28pt
                        color: COLOR_PRIMARY,
                        font: "Calibri",
                    }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 500 },
                children: [
                    new TextRun({
                        text: "Puntos Claves, Problemas Solucionados y Beneficios por Producto",
                        italic: true,
                        size: 26, // 13pt
                        color: COLOR_SECONDARY,
                        font: "Calibri",
                    }),
                ],
            }),

            // Separador
            new Paragraph({
                spacing: { after: 300 },
                children: [
                    new TextRun({
                        text: "_________________________________________________________________________________",
                        color: COLOR_BORDER,
                    })
                ]
            }),

            // Introducción
            new Paragraph({
                spacing: { after: 400 },
                children: [
                    new TextRun({
                        text: "El proxy inverso BizGuard actúa como un componente crítico de infraestructura en el ecosistema corporativo. Unifica la multiplexación de puertos, normaliza la seguridad perimetral, resuelve incompatibilidades de protocolos heredados y proporciona resiliencia mediante mecanismos de Heartbeat activos y pasivos.",
                        size: 22, // 11pt
                        color: COLOR_TEXT,
                        font: "Calibri",
                    }),
                ],
            }),

            // 1. Core
            new Paragraph({
                spacing: { before: 300, after: 150 },
                children: [
                    new TextRun({
                        text: "1. ⚙️ Core (core.serenaart.com.ar)",
                        bold: true,
                        size: 36, // 18pt
                        color: COLOR_PRIMARY,
                        font: "Calibri",
                    }),
                ],
            }),
            new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({ text: "• El Problema Original: ", bold: true, size: 22, color: COLOR_TEXT }),
                    new TextRun({ 
                        text: "Los procesos largos (como la subida masiva de archivos +10 PDFs) producían errores de inactividad (Error 524 de Cloudflare). Además, el modal visual del Heartbeat colapsaba el navegador ('Explorador sobrecargado') en peticiones POST. Finalmente, los módulos de seguridad internos restringían permisos al detectar tráfico externo.",
                        size: 22,
                        color: COLOR_TEXT
                    }),
                ],
            }),
            new Paragraph({
                spacing: { after: 300 },
                children: [
                    new TextRun({ text: "• Soluciones del Proxy: ", bold: true, size: 22, color: COLOR_PRIMARY }),
                    new TextRun({ 
                        text: "Implementación de Heartbeat Shield Pasivo (inyecta espacios en blanco invisibles cada 15s tras el evento req.on('end') de subida) para mantener activa la conexión sin interferir con los datos; normalización de cabeceras (Origin, Referer) al formato interno para evadir la restricción de permisos (EDSA); reescritura Root-Relative (URLs absolutas internas a rutas relativas para evitar llamadas cruzadas no autorizadas); y File Guard para proteger archivos binarios (.pdf, .xlsx, .zip) de corrupciones por reescritura de texto.",
                        size: 22,
                        color: COLOR_TEXT
                    }),
                ],
            }),

            // 2. CRM
            new Paragraph({
                spacing: { before: 300, after: 150 },
                children: [
                    new TextRun({
                        text: "2. 👥 CRM (Microsoft Dynamics CRM 2013 on-premise)",
                        bold: true,
                        size: 36, // 18pt
                        color: COLOR_PRIMARY,
                        font: "Calibri",
                    }),
                ],
            }),
            new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({ text: "• El Problema Original: ", bold: true, size: 22, color: COLOR_TEXT }),
                    new TextRun({ 
                        text: "CRM 2013 requiere autenticación heredada Windows/NTLM bajo Active Directory, incompatible directamente con accesos externos estándar. Generaba URLs internas rotas (ej: http://arbuewvcrmapp01:5555) que rompían popups e imágenes, y redirigía a páginas en blanco en el login inicial de la raíz.",
                        size: 22,
                        color: COLOR_TEXT
                    }),
                ],
            }),
            new Paragraph({
                spacing: { after: 300 },
                children: [
                    new TextRun({ text: "• Soluciones del Proxy: ", bold: true, size: 22, color: COLOR_PRIMARY }),
                    new TextRun({ 
                        text: "Autenticación transparente NTLM (handshake de 3 pasos) traduciendo credenciales a un JWT seguro cifrado en la sesión; simplificación de UI de login (oculta el campo Dominio e inyecta 'SERENASEGUROS' automáticamente, renombra 'Usuario' a 'Legajo'); reescritura dinámica de URLs internas a formato público para reparar imágenes e iconos rotos; y redirección inteligente al callback base funcional del CRM (/SERENAART/) en accesos raíz.",
                        size: 22,
                        color: COLOR_TEXT
                    }),
                ],
            }),

            // 3. Hometest
            new Paragraph({
                spacing: { before: 300, after: 150 },
                children: [
                    new TextRun({
                        text: "3. 🧪 Hometest / Serena-Test (Entorno Sandbox / Staging)",
                        bold: true,
                        size: 36, // 18pt
                        color: COLOR_PRIMARY,
                        font: "Calibri",
                    }),
                ],
            }),
            new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({ text: "• El Problema Original: ", bold: true, size: 22, color: COLOR_TEXT }),
                    new TextRun({ 
                        text: "Probar nuevas políticas, reescrituras de cabeceras o emulaciones de Heartbeat de forma directa en producción implicaba un riesgo crítico de indisponibilidad para el negocio.",
                        size: 22,
                        color: COLOR_TEXT
                    }),
                ],
            }),
            new Paragraph({
                spacing: { after: 300 },
                children: [
                    new TextRun({ text: "• Soluciones del Proxy: ", bold: true, size: 22, color: COLOR_PRIMARY }),
                    new TextRun({ 
                        text: "Aislamiento absoluto en una clase de reglas específica (SerenaTestRules) bajo el patrón Strategy. Permite al equipo de desarrollo inyectar reglas experimentales, simular latencias o testear estabilidad del Heartbeat sin afectar los canales productivos oficiales.",
                        size: 22,
                        color: COLOR_TEXT
                    }),
                ],
            }),

            // 4. Bank
            new Paragraph({
                spacing: { before: 300, after: 150 },
                children: [
                    new TextRun({
                        text: "4. 🏦 Bank (Canal Transaccional Seguro)",
                        bold: true,
                        size: 36, // 18pt
                        color: COLOR_PRIMARY,
                        font: "Calibri",
                    }),
                ],
            }),
            new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({ text: "• El Problema Original: ", bold: true, size: 22, color: COLOR_TEXT }),
                    new TextRun({ 
                        text: "El canal exige autenticación estricta con Microsoft Entra ID SSO. Las discrepancias de puertos y protocolos (externo HTTPS en bank.bzld.click e interno HTTP en localhost:3000) provocaban bucles infinitos de login y errores de cookies (state cookie missing y MissingCSRF). Adicionalmente, el inyector HTML del Heartbeat interfería en la estructura de las respuestas JSON transaccionales.",
                        size: 22,
                        color: COLOR_TEXT
                    }),
                ],
            }),
            new Paragraph({
                spacing: { after: 400 },
                children: [
                    new TextRun({ text: "• Soluciones del Proxy: ", bold: true, size: 22, color: COLOR_PRIMARY }),
                    new TextRun({ 
                        text: "Mapeo explícito de cookies (desactivando el flag __Secure- en ambiente interno) y bypass controlado del CSRF nativo (skipCSRFCheck) delegando seguridad en BizGuard; login basado en Server Component mediante POST nativo (elimina loops y crashes de URL); y políticas especializadas de bypass de Heartbeat para servicios que devuelven JSON transaccional para proteger su velocidad e integridad.",
                        size: 22,
                        color: COLOR_TEXT
                    }),
                ],
            }),

            // Título de la tabla
            new Paragraph({
                spacing: { before: 400, after: 200 },
                children: [
                    new TextRun({
                        text: "📊 Resumen de Soluciones Tecnológicas",
                        bold: true,
                        size: 28, // 14pt
                        color: COLOR_PRIMARY,
                        font: "Calibri",
                    }),
                ],
            }),

            // Tabla
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    // Fila Cabecera
                    new TableRow({
                        children: [
                            new TableCell({
                                width: { size: 20, type: WidthType.PERCENTAGE },
                                shading: { fill: COLOR_BG_HEADER },
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "Producto", bold: true, size: 20, color: COLOR_PRIMARY })] })],
                            }),
                            new TableCell({
                                width: { size: 30, type: WidthType.PERCENTAGE },
                                shading: { fill: COLOR_BG_HEADER },
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "Host Interno vs Público", bold: true, size: 20, color: COLOR_PRIMARY })] })],
                            }),
                            new TableCell({
                                width: { size: 50, type: WidthType.PERCENTAGE },
                                shading: { fill: COLOR_BG_HEADER },
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "Principal Aporte Técnico", bold: true, size: 20, color: COLOR_PRIMARY })] })],
                            }),
                        ],
                    }),
                    // Fila Core
                    new TableRow({
                        children: [
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "Core", bold: true, size: 18 })] })],
                            }),
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "core.serenaart.com.ar\n→ core2-serenaseguros.msappproxy.net", size: 18 })] })],
                            }),
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "Heartbeat Shield pasivo (evita caídas por inactividad en uploads de 11 PDFs de manera invisible) y normalización de headers EDSA.", size: 18 })] })],
                            }),
                        ],
                    }),
                    // Fila CRM
                    new TableRow({
                        children: [
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "CRM", bold: true, size: 18 })] })],
                            }),
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "arbuewvcrmapp01:5555\n→ crm.serenaart.com.ar", size: 18 })] })],
                            }),
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "Handshake NTLM (3 pasos) transparente integrado a JWT, login personalizado de legajos y reescritura de popups e imágenes rotas.", size: 18 })] })],
                            }),
                        ],
                    }),
                    // Fila SerenaTest
                    new TableRow({
                        children: [
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "Hometest", bold: true, size: 18 })] })],
                            }),
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "serenatest.serenaart.com.ar", size: 18 })] })],
                            }),
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "Entorno Sandbox aislado (Strategy Pattern) para testear y depurar reglas de reescritura sin riesgos colaterales para la producción.", size: 18 })] })],
                            }),
                        ],
                    }),
                    // Fila Bank
                    new TableRow({
                        children: [
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "Bank", bold: true, size: 18 })] })],
                            }),
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "bank.bzld.click", size: 18 })] })],
                            }),
                            new TableCell({
                                margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                children: [new Paragraph({ children: [new TextRun({ text: "Estabilización SSO Entra ID con mapeo de cookies personalizado y bypass de seguridad CSRF, con protección selectiva de flujos JSON.", size: 18 })] })],
                            }),
                        ],
                    }),
                ]
            }),

            // Footer
            new Paragraph({
                spacing: { before: 500 },
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: "BizGuard Enterprise Security Gateway • Reporte Técnico Confidencial",
                        size: 16,
                        color: COLOR_BORDER,
                        font: "Calibri",
                    })
                ]
            })
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const outputPath = path.join(__dirname, '../../BizGuard_Proxy_Puntos_Clave.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Documento DOCX generado con éxito en: ${outputPath}`);
}).catch(err => {
    console.error("Error al generar el documento:", err);
    process.exit(1);
});
