"use client"

import { useState } from "react";
import { createPortal } from "react-dom";
import { Connector } from "@/lib/connectors";
import {
  ConnectorProductType,
  DEFAULT_PRODUCT_TYPE,
  PRODUCT_CATALOG,
  normalizeConnectorProductType,
} from "@/lib/product-catalog";
import {
  getProductBadgeLabel,
  getProductFieldPresentation,
  getProductProfile,
  isConnectorNtlmActive,
  requiresConnectorNtlmDomain,
} from "@/lib/product-profiles";
import { updateConnectorAction, toggleConnectorAction, deleteConnectorAction } from "@/app/actions";
import { Server, Settings2, Pause, Play, Activity, X, Save, ExternalLink, ShieldOff, Trash2 } from "lucide-react";
import { useStats } from "@/contexts/StatsContext";

const CONNECTOR_TYPES = PRODUCT_CATALOG;

function ConnectorTypeSection({ connectorType, onChange }: { connectorType?: string; onChange?: (type: string) => void }) {
  const current = connectorType || DEFAULT_PRODUCT_TYPE;
  return (
    <div>
      <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tipo de producto</label>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {CONNECTOR_TYPES.map(t => (
          <label key={t.value} className="relative cursor-pointer" title={t.tooltip}>
            <input type="radio" name="connectorType" value={t.value} checked={current === t.value} onChange={() => onChange?.(t.value)} className="sr-only peer" />
            <div className="p-3 rounded-lg border border-outline-variant/20 bg-surface-container-lowest peer-checked:border-primary/60 peer-checked:bg-primary/5 transition-all">
              <div className="flex items-center gap-2">
                <span className="text-base">{t.icon}</span>
                <span className="font-label text-xs font-bold text-on-surface">{t.label}</span>
              </div>
              <p className="font-body text-[10px] text-on-surface-variant mt-1 leading-tight">{t.desc}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function NtlmSection({
  ntlmEnabled,
  onNtlmChange,
  ntlmDomain,
  showToggle,
}: {
  ntlmEnabled: boolean;
  onNtlmChange: (v: boolean) => void;
  ntlmDomain?: string;
  showToggle: boolean;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
      <div className="flex items-start gap-4 p-4">
        <svg className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div className="flex-1">
          <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Autenticación NTLM</p>
          <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
            El proxy completa el handshake NTLM con Active Directory.
          </p>
        </div>
        {showToggle ? (
          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
            <input type="checkbox" name="isNtlm" checked={ntlmEnabled} onChange={e => onNtlmChange(e.target.checked)} className="sr-only peer" />
            <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
          </label>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Obligatorio</span>
        )}
      </div>
      {ntlmEnabled && (
        <div className="px-4 pb-4">
          <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Dominio AD</label>
          <input name="ntlmDomain" defaultValue={ntlmDomain || ""} placeholder="DOMINIO" className="w-full bg-surface-container border border-transparent text-on-surface text-sm py-2 px-3 rounded-lg focus:border-primary/50 outline-none mt-1" />
        </div>
      )}
    </div>
  );
}

export function ConnectorRow({
  connector,
  isSelected,
  dashboardHost,
  dashboardProtocol,
}: {
  connector: Connector;
  isSelected?: boolean;
  dashboardHost: string;
  dashboardProtocol: "http" | "https";
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedType, setSelectedType] = useState<ConnectorProductType>(normalizeConnectorProductType(connector.connectorType));
  const [ntlmEnabled, setNtlmEnabled] = useState(isConnectorNtlmActive(connector));
  const [coreNtlmDomain, setCoreNtlmDomain] = useState(connector.coreNtlmDomain || "");
  const [harLog, setHarLog] = useState(connector.harLog === true);
  const [trafficLog, setTrafficLog] = useState(connector.trafficLog === true);
  const [ssoLog, setSsoLog] = useState(connector.ssoLog === true);
  const [hbLog, setHbLog] = useState(connector.hbLog === true);
  const [hbFirstPulse, setHbFirstPulse] = useState(connector.hbFirstPulse !== undefined ? String(connector.hbFirstPulse) : "");
  const [trafficRetentionValue, setTrafficRetentionValue] = useState(connector.trafficRetentionValue !== undefined ? String(connector.trafficRetentionValue) : "");
  const [trafficRetentionUnit, setTrafficRetentionUnit] = useState(connector.trafficRetentionUnit || "hours");
  const selectedProfile = getProductProfile(selectedType);
  const productBadge = getProductBadgeLabel(selectedType);
  const fieldPresentation = getProductFieldPresentation(selectedType);

  const handleTypeChange = (type: string) => {
    const normalizedType = normalizeConnectorProductType(type);
    setSelectedType(normalizedType);
    const nextProfile = getProductProfile(normalizedType);
    if (!nextProfile.supports.ntlmToggle) {
      setNtlmEnabled(isConnectorNtlmActive({ connectorType: normalizedType, isNtlm: false }));
    }
  };
  const { connectors } = useStats();
  const stats = connectors[connector.id] || connector.stats || { requests: 0, bytes: 0, latency: 0, activePing: undefined, isOnline: undefined };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0.0";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  };

  const getByteUnit = (bytes: number) => {
    if (bytes === 0) return "B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return sizes[i];
  };

  const isPaused = !connector.isActive;

  let isDown = false;
  let isChecking = false;
  let pingMs = null;

  if (!isPaused) {
    if (stats.activePing === -1 || stats.isOnline === false) {
      isDown = true;
    } else if (stats.activePing === undefined) {
      isChecking = true;
    } else {
      pingMs = stats.activePing;
    }
  }

  const borderColor = isPaused ? "border-outline-variant" : (isDown ? "border-error" : (isChecking ? "border-tertiary" : "border-secondary"));
  const iconColor = isPaused ? "text-on-surface-variant" : (isDown ? "text-error" : (isChecking ? "text-tertiary" : "text-secondary"));
  const statusColor = isPaused ? "bg-outline-variant text-on-surface-variant" : (isDown ? "bg-error text-error" : (isChecking ? "bg-tertiary text-on-tertiary" : "bg-secondary text-secondary"));
  const statusText = isPaused ? "Standby" : (isDown ? "Offline" : (isChecking ? "Checking" : "Healthy"));

  const [activeTab, setActiveTab] = useState<'general' | 'producto' | 'seguridad' | 'diagnostico'>('general');
  const [bypassAuth, setBypassAuth] = useState(connector.bypassAuth === true);
  const currentHostname = dashboardHost.split(":")[0] || dashboardHost;
  const isLocalDashboard = currentHostname === "localhost" || currentHostname === "127.0.0.1";
  const gatewayUrl = isLocalDashboard
    ? `http://${currentHostname}:${connector.port}/`
    : `${dashboardProtocol}://${connector.publicHost}:${connector.port}/`;

  const tabs = [
    { id: 'general' as const,     label: 'General',   badge: null },
    { id: 'producto' as const,    label: 'Producto',  badge: productBadge },
    { id: 'seguridad' as const,   label: 'Seguridad', badge: (bypassAuth || ntlmEnabled) ? '!' : null },
    { id: 'diagnostico' as const, label: 'Diagnóstico', badge: (trafficLog || harLog || ssoLog || hbLog) ? 'LOGS' : null },
  ];

  const editModal = isEditing ? createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/20 shadow-[0_20px_40px_rgba(0,0,0,0.7)] w-full max-w-2xl relative flex flex-col" style={{maxHeight: '90vh'}}>
        <form action={async (formData) => {
          await updateConnectorAction(connector.id, formData);
          setIsEditing(false);
        }} className="flex flex-col flex-1 min-h-0">

          {/* Header */}
          <div className="px-6 pt-6 pb-0 shrink-0">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-headline font-bold text-primary text-lg">Editando Conector</h3>
                <p className="font-body text-[10px] text-on-surface-variant mt-0.5">{connector.id}</p>
              </div>
              <button onClick={() => setIsEditing(false)} type="button" className="text-on-surface-variant hover:text-on-surface bg-surface-container-highest p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-outline-variant/15">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'text-primary border-b-2 border-primary -mb-px'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                  {tab.badge && (
                    <span className="bg-primary/20 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content â€” todos los paneles siempre en el DOM para que los inputs se incluyan en el submit */}
          <div className="overflow-y-auto flex-1">

            <div className={`px-6 py-5 space-y-5 ${activeTab === 'general' ? '' : 'hidden'}`}>

              {/* Sección: Identidad */}
              <div>
                <p className="font-label text-[9px] font-bold uppercase tracking-[0.15em] text-primary/60 mb-3 flex items-center gap-2">
                  <span className="flex-1 h-px bg-primary/10"></span>
                  Identidad
                  <span className="flex-1 h-px bg-primary/10"></span>
                </p>
                <div>
                  <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                  <input name="name" defaultValue={connector.name} className="w-full bg-surface-container-lowest border border-transparent text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 outline-none mt-1" />
                </div>
              </div>

              {/* Sección: Red */}
              <div>
                <p className="font-label text-[9px] font-bold uppercase tracking-[0.15em] text-primary/60 mb-3 flex items-center gap-2">
                  <span className="flex-1 h-px bg-primary/10"></span>
                  Red
                  <span className="flex-1 h-px bg-primary/10"></span>
                </p>
                <div className="space-y-3">
                  <div className="grid grid-cols-[1fr_148px] gap-5">
                    <div>
                  <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Host Público</label>
                      <input
                        name="publicHost"
                        defaultValue={connector.publicHost}
                        className="w-full bg-surface-container-lowest border border-outline-variant/15 text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 outline-none mt-1 transition-colors"
                        placeholder="app.dominio.com"
                      />
                    </div>
                    <div>
                      <label className="font-label text-[10px] font-bold uppercase tracking-widest text-primary/80">Puerto Proxy</label>
                      <input
                        name="port"
                        type="number"
                        defaultValue={connector.port}
                        className="w-full bg-surface-container-lowest border border-primary/20 text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 outline-none mt-1 tabular-nums text-center font-mono transition-colors"
                        placeholder="8080"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">URL Interna</label>
                    <input name="targetUrl" defaultValue={connector.targetUrl} className="w-full bg-surface-container-lowest border border-transparent text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 outline-none mt-1" placeholder="http://10.0.0.1:80" />
                  </div>
                </div>
              </div>

            </div>

            <div className={`px-6 py-5 space-y-4 ${activeTab === 'producto' ? '' : 'hidden'}`}>
              <ConnectorTypeSection connectorType={selectedType} onChange={handleTypeChange} />
              <div className={selectedProfile.supports.coreNtlmDomain ? '' : 'hidden'}>
                <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Dominio NTLM Core</label>
                <input
                  name="coreNtlmDomain"
                  value={coreNtlmDomain}
                  onChange={e => setCoreNtlmDomain(e.target.value)}
                  placeholder="DOMINIO"
                  className="w-full bg-surface-container-lowest border border-transparent text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 outline-none mt-1"
                />
                <p className="font-body text-[10px] text-on-surface-variant mt-1.5">
                  {fieldPresentation.coreNtlmDomainHelp}
                </p>
              </div>
              <div className={selectedProfile.supports.entryPath ? '' : 'hidden'}>
                <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{fieldPresentation.entryPathLabel}</label>
                <input name="entryPath" defaultValue={connector.entryPath || ""} placeholder={fieldPresentation.entryPathPlaceholder} className="w-full bg-surface-container-lowest border border-transparent text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 outline-none mt-1" />
                <p className="font-body text-[10px] text-on-surface-variant mt-1.5">
                  {fieldPresentation.entryPathHelp}
                </p>
              </div>
            </div>

            <div className={`px-6 py-5 space-y-4 ${activeTab === 'seguridad' ? '' : 'hidden'}`}>
              {/* Bypass SSO */}
              <div className="flex items-start gap-4 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
                <ShieldOff className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Bypass SSO</p>
                  <p className="font-body text-[10px] text-on-surface-variant mt-0.5">Desactiva la autenticación Microsoft Entra ID para este conector. Cualquier usuario podrá acceder sin login.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input type="hidden" name="bypassAuth" value={bypassAuth ? "true" : "false"} />
                  <input type="checkbox" checked={bypassAuth} onChange={e => setBypassAuth(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-error peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>
              {selectedProfile.supports.ntlmDomain && requiresConnectorNtlmDomain({ connectorType: selectedType, isNtlm: ntlmEnabled }) && (
                <NtlmSection
                  ntlmEnabled={ntlmEnabled}
                  onNtlmChange={setNtlmEnabled}
                  ntlmDomain={connector.ntlmDomain}
                  showToggle={selectedProfile.supports.ntlmToggle}
                />
              )}
            </div>

            <div className={`px-6 py-5 space-y-5 ${activeTab === 'diagnostico' ? '' : 'hidden'}`}>
              <div>
                <p className="font-label text-[9px] font-bold uppercase tracking-[0.15em] text-primary/60 mb-3 flex items-center gap-2">
                  <span className="flex-1 h-px bg-primary/10"></span>
                  Diagnóstico y Logs
                  <span className="flex-1 h-px bg-primary/10"></span>
                </p>
                <div className="space-y-3">
                  {/* Debug HAR */}
                  <div className="flex items-start gap-4 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
                    <svg className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Debug HAR</p>
                      <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                        Escribe un log HAR completo en <code className="bg-surface-container px-1 rounded font-mono">logs/har-{connector.id}.jsonl</code> para capturar errores de tráfico HTTP.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input type="hidden" name="harLog" value={harLog ? "true" : "false"} />
                      <input type="checkbox" checked={harLog} onChange={e => setHarLog(e.target.checked)} className="sr-only peer" />
                      <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-secondary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                    </label>
                  </div>

                  {/* Log de Tráfico */}
                  <div className="flex items-start gap-4 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
                    <svg className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Log de Tráfico</p>
                      <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                        Log de tráfico agrupado por conector en <code className="bg-surface-container px-1 rounded font-mono">logs/traffic/{connector.id}/</code>. Rotación de 100 MB. Incluye cookies, headers y eventos de debug.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input type="hidden" name="trafficLog" value={trafficLog ? "true" : "false"} />
                      <input type="checkbox" checked={trafficLog} onChange={e => setTrafficLog(e.target.checked)} className="sr-only peer" />
                      <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                    </label>
                  </div>

                  {/* Log de SSO */}
                  <div className="flex items-start gap-4 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
                    <svg className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Log de SSO</p>
                      <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                        Escribe un log de autenticación y redirecciones SSO en <code className="bg-surface-container px-1 rounded font-mono">logs/sso/{connector.id}/</code>.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input type="hidden" name="ssoLog" value={ssoLog ? "true" : "false"} />
                      <input type="checkbox" checked={ssoLog} onChange={e => setSsoLog(e.target.checked)} className="sr-only peer" />
                      <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                    </label>
                  </div>

                  {/* Log de Heartbeat */}
                  <div className="flex items-start gap-4 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
                    <Activity className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Log de Heartbeat</p>
                      <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                        Escribe un log de mantenimiento de conexión y Shield en <code className="bg-surface-container px-1 rounded font-mono">logs/hb/{connector.id}/</code>.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input type="hidden" name="hbLog" value={hbLog ? "true" : "false"} />
                      <input type="checkbox" checked={hbLog} onChange={e => setHbLog(e.target.checked)} className="sr-only peer" />
                      <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                    </label>
                  </div>

                  {/* Tiempo de Retención */}
                  <div className="flex items-start gap-4 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
                    <div className="flex-1">
                      <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Tiempo de Retención de Logs</p>
                      <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                        Especifica durante cuánto tiempo se almacenarán todos los logs del conector (Tráfico, HAR, SSO, Heartbeat) antes de eliminarse automáticamente. Deja vacío para usar el valor por defecto (5 horas).
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0 mt-0.5 w-[200px]">
                      <input 
                        type="number"
                        name="trafficRetentionValue"
                        min="1"
                        value={trafficRetentionValue}
                        onChange={e => setTrafficRetentionValue(e.target.value)}
                        className="w-1/2 bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm py-2 px-3 rounded-lg focus:border-primary/50 outline-none font-mono text-center"
                        placeholder="5"
                      />
                      <select
                        name="trafficRetentionUnit"
                        value={trafficRetentionUnit}
                        onChange={e => setTrafficRetentionUnit(e.target.value as any)}
                        className="w-1/2 bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm py-2 px-3 rounded-lg focus:border-primary/50 outline-none text-center"
                      >
                        <option value="seconds">Segundos</option>
                        <option value="minutes">Minutos</option>
                        <option value="hours">Horas</option>
                        <option value="days">Días</option>
                      </select>
                    </div>
                  </div>

                  {/* Heartbeat Threshold Override */}
                  <div className="flex items-start gap-4 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
                    <div className="flex-1">
                      <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Umbral de Heartbeat (Segundos)</p>
                      <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                        Tiempo de espera antes de activar el Heartbeat Shield para mantener la conexión viva. Deja vacío para usar el valor global por defecto (20s).
                      </p>
                    </div>
                    <div className="w-24 shrink-0 mt-0.5">
                      <input 
                        type="number"
                        name="hbFirstPulse"
                        min="1"
                        value={hbFirstPulse}
                        onChange={e => setHbFirstPulse(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm py-2 px-3 rounded-lg focus:border-primary/50 outline-none font-mono text-center"
                        placeholder="20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer fijo */}
          <div className="px-6 py-4 border-t border-outline-variant/10 shrink-0 flex gap-3">
            <button type="submit" className="flex-1 bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest transition-transform active:scale-95 shadow-lg shadow-on-primary/20">
              <Save size={18} /> Guardar Cambios
            </button>
            <button
              type="button"
              onClick={async () => {
                if (confirm(`¿Eliminar el conector "${connector.name}"? Esta acción no se puede deshacer.`)) {
                  await deleteConnectorAction(connector.id);
                  setIsEditing(false);
                }
              }}
              className="px-4 py-3 bg-error-container/30 hover:bg-error-container/60 text-error border border-error/20 font-bold rounded-lg flex items-center gap-2 text-xs uppercase tracking-widest transition-all active:scale-95"
            >
              <Trash2 size={16} /> Eliminar
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  ) : null;

  const rowContent = (
    <div className={`group bg-surface-container-low hover:bg-surface-container transition-colors py-1.5 px-3 rounded-lg flex items-center gap-2 md:gap-3 border-l-2 ${borderColor} ${isPaused ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2 w-1/4">
        <div className={`w-6 h-6 min-w-[24px] rounded bg-surface-container-highest flex items-center justify-center ${iconColor}`}>
          <Server className="w-3.5 h-3.5" />
        </div>
        <div className="truncate whitespace-nowrap overflow-hidden">
          <h3 className="font-headline text-[11px] font-bold text-on-surface truncate">{connector.name}</h3>
          <p className="font-body text-[8.5px] text-on-surface-variant font-mono truncate" title={connector.publicHost}>{connector.publicHost}:{connector.port}</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-3 overflow-hidden">
        <div className="space-y-0">
          <p className="font-label text-[8.5px] font-medium uppercase tracking-tighter text-on-surface-variant truncate">Origin Ping</p>
          <div className="flex items-baseline gap-0.5">
            <span className={`font-headline text-sm font-bold ${isPaused ? 'text-on-surface' : (isDown ? 'text-error' : (pingMs !== null ? 'text-secondary' : 'text-on-surface'))}`}>
              {pingMs !== null ? pingMs : "--"}
            </span>
            <span className={`text-[8.5px] ${isPaused ? 'text-on-surface-variant' : (pingMs !== null ? 'text-secondary/70' : 'text-on-surface-variant')}`}>ms</span>
          </div>
        </div>
        <div className="space-y-0">
          <p className="font-label text-[8.5px] font-medium uppercase tracking-tighter text-on-surface-variant truncate">Requests</p>
          <div className="flex items-baseline gap-0.5">
            <span className="font-headline text-sm font-bold text-on-surface">{stats.requests}</span>
            <span className="text-[8.5px] text-on-surface-variant">/m</span>
          </div>
        </div>
        <div className="space-y-0">
          <p className="font-label text-[8.5px] font-medium uppercase tracking-tighter text-on-surface-variant truncate">Traffic</p>
          <div className="flex items-baseline gap-0.5">
            <span className="font-headline text-sm font-bold text-on-surface">{formatBytes(stats.bytes)}</span>
            <span className="text-[8.5px] text-on-surface-variant">{getByteUnit(stats.bytes)}</span>
          </div>
        </div>
        <div className="space-y-0">
          <p className="font-label text-[8.5px] font-medium uppercase tracking-tighter text-on-surface-variant truncate">BizGuard Status</p>
          <div className="flex items-center gap-1 pt-0.5 h-[16px]">
            <span className={`w-1 h-1 rounded-full ${statusColor.split(' ')[0]}`}></span>
            <span className={`text-[8.5px] font-bold ${statusColor.split(' ')[1]} uppercase tracking-tighter`}>{statusText}</span>
            {connector.bypassAuth && (
              <span className="text-[8px] font-bold text-error uppercase tracking-tighter ml-1" title="SSO Bypass activo">NO-SSO</span>
            )}
            {connector.harLog && (
              <span className="text-[8px] font-bold text-secondary uppercase tracking-tighter ml-1 bg-secondary/15 px-1 rounded" title="HAR Debug Activo">HAR</span>
            )}
            {connector.ssoLog && (
              <span className="text-[8px] font-bold text-primary uppercase tracking-tighter ml-1 bg-primary/15 px-1 rounded" title="Log SSO Activo">SSO</span>
            )}
            {connector.hbLog && (
              <span className="text-[8px] font-bold text-tertiary uppercase tracking-tighter ml-1 bg-tertiary/15 px-1 rounded" title="Log HB Activo">HB</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <a href={connector.targetUrl} target="_blank" className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-lg transition-all active:scale-90" title="Open Origin (Internal Web)">
          <ExternalLink className="w-4 h-4" />
        </a>
        <a href={gatewayUrl} target="_blank" className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-lg transition-all active:scale-90" title="BizGuard Monitoring / View Public Gateway">
          <Activity className="w-4 h-4" />
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleConnectorAction(connector.id);
          }}
          className={`p-1.5 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-all active:scale-90 ${isPaused ? 'hover:text-secondary' : 'hover:text-error'}`}
          title={isPaused ? "Resume BizGuard" : "Pause BizGuard"}
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(!isEditing);
          }}
          className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-lg transition-all active:scale-90"
          title="Settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {rowContent}
      {editModal}
    </>
  );
}

