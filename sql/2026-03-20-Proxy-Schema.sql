-- Script de creación de base de datos para Plataforma Proxy
-- Fecha: 2026-03-20

CREATE TABLE [dbo].[Proxies] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Name] NVARCHAR(100) NOT NULL,
    [InternalTarget] NVARCHAR(255) NOT NULL, -- Ej: core2-serenaseguros.internal
    [PublicHostname] NVARCHAR(255) NOT NULL, -- Ej: core.serenaart.com.ar
    [IsActive] BIT DEFAULT 1,
    [CreatedAt] DATETIME2 DEFAULT GETDATE(),
    [CreatedBy] NVARCHAR(255)
);

CREATE TABLE [dbo].[ProxyLogs] (
    [Id] BIGINT IDENTITY(1,1) PRIMARY KEY,
    [ProxyId] INT FOREIGN KEY REFERENCES [Proxies](Id),
    [Timestamp] DATETIME2 DEFAULT GETDATE(),
    [Method] NVARCHAR(10),
    [Url] NVARCHAR(MAX),
    [StatusCode] INT,
    [UserEmail] NVARCHAR(255)
);
