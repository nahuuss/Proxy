"use client";

import { createConnectorAction, checkPortAction } from "@/app/actions";
import { useActionState, useState, useEffect } from "react";
import {
  Rocket,
  Loader2, 
  Zap, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Settings, 
  Network, 
  Info, 
  Shield,
  Activity
} from "lucide-react";
import {
  ConnectorProductType,
  DEFAULT_PRODUCT_TYPE,
  PRODUCT_CATALOG,
} from "@/lib/product-catalog";
import {
  getProductFieldPresentation,
  getProductProfile,
  isConnectorNtlmActive,
  requiresConnectorNtlmDomain,
  validateConnectorWithProfile,
} from "@/lib/product-profiles";

const CONNECTOR_TYPES = PRODUCT_CATALOG;

export function AddConnectorForm() {
  const [state, formAction, isPending] = useActionState(createConnectorAction, {
    message: "",
    success: false
  });

  const [step, setStep] = useState(1);
  
  // Valores del formulario para validaciones en tiempo real
  const [name, setName] = useState("");
  const [port, setPort] = useState("");
  const [description, setDescription] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [publicHost, setPublicHost] = useState("");
  const [connectorType, setConnectorType] = useState<ConnectorProductType>(DEFAULT_PRODUCT_TYPE);
  const [entryPath, setEntryPath] = useState("");
  const [coreNtlmDomain, setCoreNtlmDomain] = useState("");
  
  const [bypassAuth, setBypassAuth] = useState(false);
  const [isNtlm, setIsNtlm] = useState(false);
  const [ntlmDomain, setNtlmDomain] = useState("");
  
  const [harLog, setHarLog] = useState(false);
  const [trafficLog, setTrafficLog] = useState(false);
  const [ssoLog, setSsoLog] = useState(false);
  const [hbLog, setHbLog] = useState(false);
  const [hbFirstPulse, setHbFirstPulse] = useState("");
  const [trafficRetentionValue, setTrafficRetentionValue] = useState("");
  const [trafficRetentionUnit, setTrafficRetentionUnit] = useState("hours");
  const selectedProfile = getProductProfile(connectorType);
  const fieldPresentation = getProductFieldPresentation(connectorType);
  const profileValidationErrors = validateConnectorWithProfile({ connectorType, entryPath, coreNtlmDomain, isNtlm, ntlmDomain });

  // Estados de validación de puerto
  const [portOccupied, setPortOccupied] = useState<boolean | null>(null);
  const [checkingPort, setCheckingPort] = useState(false);
  const [portReason, setPortReason] = useState<'configured' | 'system' | null>(null);

  // Verificar disponibilidad del puerto al cambiar (debounce 400ms)
  useEffect(() => {
    const pNum = parseInt(port);
    if (isNaN(pNum) || pNum <= 0 || pNum > 65535) {
      setPortOccupied(null);
      setPortReason(null);
      return;
    }

    setCheckingPort(true);
    const timer = setTimeout(async () => {
      try {
        const res = await checkPortAction(pNum);
        setPortOccupied(res.occupied);
        setPortReason(res.reason || null);
      } catch {
        setPortOccupied(null);
        setPortReason(null);
      } finally {
        setCheckingPort(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [port]);

  const getPortBorderClass = () => {
    if (checkingPort) return "border-amber-500/40 focus:border-amber-500/70";
    if (portOccupied === true) return "border-error/40 focus:border-error/70 text-error";
    if (portOccupied === false) return "border-secondary/40 focus:border-secondary/70";
    return "border-transparent focus:border-primary/50 focus:shadow-[0_0_12px_rgba(179,197,255,0.15)]";
  };

  // Manejar el cambio de tipo de conector
  const handleTypeChange = (val: ConnectorProductType) => {
    setConnectorType(val);
    const nextProfile = getProductProfile(val);
    if (!nextProfile.supports.ntlmToggle) {
      setIsNtlm(isConnectorNtlmActive({ connectorType: val, isNtlm: false }));
    }
  };

  // Validaciones obligatorias de cada paso
  const isStepValid = () => {
    if (step === 1) {
      return name.trim() !== "" && 
             port.trim() !== "" && 
             !isNaN(parseInt(port)) && 
             portOccupied !== true && 
             !checkingPort;
    }
    if (step === 2) {
      return targetUrl.trim() !== "" && publicHost.trim() !== "";
    }
    if (step === 3 || step === 4) {
      return profileValidationErrors.length === 0;
    }
    return true;
  };

  const steps = [
    { number: 1, label: "General", icon: Settings },
    { number: 2, label: "Red", icon: Network },
    { number: 3, label: "Tipo", icon: Info },
    { number: 4, label: "Seguridad", icon: Shield },
    { number: 5, label: "Logs", icon: Activity },
  ];

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isStepValid() && step < 5) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  return (
    <section className="bg-surface-container-low rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative border border-outline-variant/10">
      
      {/* Cabecera */}
      <div className="px-8 py-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
        <div>
          <h2 className="font-headline text-lg font-bold text-on-surface tracking-tight">Dar de Alta Nuevo BizGuard</h2>
          <p className="font-body text-xs text-on-surface-variant mt-1">Configura la redirección y políticas de seguridad paso a paso</p>
        </div>
        <Rocket className="text-primary/50 w-8 h-8 shrink-0" />
      </div>

      {/* Indicador de progreso (Wizard Steps) */}
      <div className="px-8 pt-6 pb-2 bg-surface-container-low border-b border-outline-variant/5">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          {steps.map((s, idx) => (
            <div key={s.number} className="flex-1 flex items-center">
              {/* Círculo del Paso */}
              <div className="flex flex-col items-center relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  step > s.number 
                    ? 'bg-primary border-primary text-on-primary' 
                    : step === s.number 
                      ? 'border-primary text-primary bg-primary/10 shadow-[0_0_12px_rgba(179,197,255,0.25)]' 
                      : 'border-outline-variant/30 text-on-surface-variant bg-surface-container-lowest'
                }`}>
                  {step > s.number ? (
                    <Check className="w-4.5 h-4.5" />
                  ) : (
                    <s.icon className="w-4 h-4" />
                  )}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider mt-2 transition-colors duration-300 ${
                  step === s.number ? 'text-primary font-extrabold' : 'text-on-surface-variant/60'
                }`}>
                  {s.label}
                </span>
              </div>

              {/* Conector Line */}
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-[2px] mx-2 -mt-6 transition-colors duration-300 ${
                  step > s.number + 1 
                    ? 'bg-primary' 
                    : step === s.number + 1 
                      ? 'bg-gradient-to-r from-primary to-outline-variant/20' 
                      : 'bg-outline-variant/15'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Formulario */}
      <form action={formAction} className="p-8 relative">
        
        {/* PASO 1: INFORMACIÓN GENERAL */}
        <div className={`space-y-5 ${step === 1 ? "block" : "hidden"}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2 md:col-span-2">
              <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre del Conector</label>
              <input 
                name="name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-surface-container-lowest border border-transparent text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 focus:ring-0 focus:shadow-[0_0_12px_rgba(179,197,255,0.15)] placeholder-outline-variant transition-all outline-none" 
                placeholder="e.g. Edge BizGuard Primary" 
                type="text"
              />
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Puerto Proxy</label>
              <input 
                name="port"
                required
                type="number"
                value={port}
                onChange={e => setPort(e.target.value)}
                className={`w-full bg-surface-container-lowest border text-on-surface font-mono text-sm py-3 px-4 rounded-lg focus:ring-0 outline-none transition-all ${getPortBorderClass()}`} 
                placeholder="e.g. 8080"
              />
              {checkingPort && (
                <p className="text-[9px] text-amber-500/80 animate-pulse font-semibold mt-1">Verificando puerto...</p>
              )}
              {portOccupied === true && (
                <p className="text-[9px] text-error font-semibold mt-1">
                  {portReason === "configured" 
                    ? "Ocupado: Asignado en BizGuard" 
                    : "Ocupado: En uso por el sistema"}
                </p>
              )}
              {portOccupied === false && (
                <p className="text-[9px] text-secondary font-semibold mt-1">Puerto disponible</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Descripción</label>
            <input 
              name="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-surface-container-lowest border border-transparent text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 focus:ring-0 focus:shadow-[0_0_12px_rgba(179,197,255,0.15)] placeholder-outline-variant transition-all outline-none" 
              placeholder="Descripción corta sobre el propósito de este proxy..." 
              type="text"
            />
          </div>
        </div>

        {/* PASO 2: RED Y ENRUTAMIENTO (SEPARADOS) */}
        <div className={`space-y-5 ${step === 2 ? "block" : "hidden"}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">URL Interna / Target URL</label>
              <input 
                name="targetUrl"
                required={step === 2}
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                className="w-full bg-surface-container-lowest border border-transparent text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 focus:ring-0 focus:shadow-[0_0_12px_rgba(179,197,255,0.15)] placeholder-outline-variant transition-all outline-none" 
                placeholder="http://10.0.0.1:80" 
                type="text"
              />
              <p className="text-[10px] text-on-surface-variant/70">Servidor backend interno de destino al cual se redirigirán las peticiones.</p>
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Host Público / Public Host</label>
              <input 
                name="publicHost"
                required={step === 2}
                value={publicHost}
                onChange={e => setPublicHost(e.target.value)}
                className="w-full bg-surface-container-lowest border border-transparent text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 focus:ring-0 focus:shadow-[0_0_12px_rgba(179,197,255,0.15)] placeholder-outline-variant transition-all outline-none" 
                placeholder="app.dominio.com" 
                type="text"
              />
              <p className="text-[10px] text-on-surface-variant/70">Nombre de dominio externo por el que los usuarios accederán a este proxy.</p>
            </div>
          </div>
        </div>

        {/* PASO 3: PRODUCTO & TIPO */}
        <div className={`space-y-5 ${step === 3 ? "block" : "hidden"}`}>
          <div className="space-y-4">
            <div>
              <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tipo de Conector</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {CONNECTOR_TYPES.map(t => (
                  <label key={t.value} className="relative cursor-pointer" title={t.tooltip}>
                    <input 
                      type="radio" 
                      name="connectorType" 
                      value={t.value} 
                      checked={connectorType === t.value} 
                      onChange={() => handleTypeChange(t.value)} 
                      className="sr-only peer" 
                    />
                    <div className="p-4 rounded-lg border border-outline-variant/20 bg-surface-container-lowest peer-checked:border-primary/60 peer-checked:bg-primary/5 transition-all hover:bg-surface-container-low/50">
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
            {selectedProfile.supports.entryPath && (
              <div className="space-y-2">
                <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{fieldPresentation.entryPathLabel}</label>
                <input 
                  name="entryPath"
                  value={entryPath}
                  onChange={e => setEntryPath(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-transparent text-on-surface font-mono text-sm py-3 px-4 rounded-lg focus:border-primary/50 focus:ring-0 placeholder-outline-variant transition-all outline-none" 
                  placeholder={`e.g. ${fieldPresentation.entryPathPlaceholder}`}
                  type="text"
                />
                <p className="text-[10px] text-on-surface-variant/70">{fieldPresentation.entryPathHelp}</p>
              </div>
            )}
            {selectedProfile.supports.coreNtlmDomain && (
              <div className="space-y-2">
                <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Dominio NTLM Core</label>
                <input
                  name="coreNtlmDomain"
                  value={coreNtlmDomain}
                  onChange={e => setCoreNtlmDomain(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-transparent text-on-surface font-mono text-sm py-3 px-4 rounded-lg focus:border-primary/50 focus:ring-0 placeholder-outline-variant transition-all outline-none"
                  placeholder="e.g. SERENASEGUROS"
                  type="text"
                />
                <p className="text-[10px] text-on-surface-variant/70">{fieldPresentation.coreNtlmDomainHelp}</p>
              </div>
            )}
            {step === 3 && profileValidationErrors.length > 0 && (
              <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-error">Faltan datos del perfil</p>
                <p className="text-[11px] text-error/90 mt-1">{profileValidationErrors.join(" ")}</p>
              </div>
            )}
          </div>
        </div>

        {/* PASO 4: SEGURIDAD & AUTENTICACIÓN */}
        <div className={`space-y-5 ${step === 4 ? "block" : "hidden"}`}>
          <div className="space-y-4">
            
            {/* Bypass Auth */}
            <div className="flex items-start justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
              <div className="flex-1 mr-4">
                <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Bypass Authentication</p>
                <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                  Si se activa, el proxy omitirá la validación de credenciales SSO y dará acceso directo a cualquier usuario.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input type="hidden" name="bypassAuth" value={bypassAuth ? "true" : "false"} />
                <input 
                  type="checkbox" 
                  checked={bypassAuth} 
                  onChange={e => setBypassAuth(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            {selectedProfile.supports.ntlmToggle && (
              <>
            {/* NTLM Integration */}
            <div className="flex items-start justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
              <div className="flex-1 mr-4">
                <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Autenticación NTLM Integrada</p>
                <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                  Activa la negociación NTLM para iniciar sesión automáticamente en servidores Active Directory del backend.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input type="hidden" name="isNtlm" value={isNtlm ? "true" : "false"} />
                <input 
                  type="checkbox" 
                  checked={isNtlm} 
                  onChange={e => setIsNtlm(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 disabled:opacity-50"></div>
              </label>
            </div>
              </>
            )}

            {selectedProfile.supports.ntlmDomain && requiresConnectorNtlmDomain({ connectorType, isNtlm }) && (
              <div className="space-y-2 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10 animate-in slide-in-from-top-2 duration-200">
                <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Dominio NTLM / Active Directory Domain</label>
                <input 
                  name="ntlmDomain"
                  value={ntlmDomain}
                  onChange={e => setNtlmDomain(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-transparent text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 focus:ring-0 placeholder-outline-variant outline-none" 
                  placeholder="e.g. MIEMPRESA" 
                  type="text"
                />
                {!selectedProfile.supports.ntlmToggle && (
                  <p className="text-[10px] text-on-surface-variant/70">Este perfil usa NTLM de forma obligatoria y requiere el dominio configurado.</p>
                )}
              </div>
            )}
            {step === 4 && profileValidationErrors.length > 0 && (
              <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-error">Faltan datos del perfil</p>
                <p className="text-[11px] text-error/90 mt-1">{profileValidationErrors.join(" ")}</p>
              </div>
            )}

          </div>
        </div>

        {/* PASO 5: DIAGNÓSTICO & LOGS */}
        <div className={`space-y-5 ${step === 5 ? "block" : "hidden"}`}>
          <div className="space-y-4">
            
            {/* HAR Log */}
            <div className="flex items-start justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
              <div className="flex-1 mr-4">
                <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Debug HAR</p>
                <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                  Escribe un log completo en formato HAR (.jsonl) en la carpeta de depuración para inspección profunda de red.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input type="hidden" name="harLog" value={harLog ? "true" : "false"} />
                <input 
                  type="checkbox" 
                  checked={harLog} 
                  onChange={e => setHarLog(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-secondary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            {/* Traffic & Diagnostic Log */}
            <div className="flex items-start justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
              <div className="flex-1 mr-4">
                <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Log de Tráfico</p>
                <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                  Log de tráfico agrupado por conector en <code className="bg-surface-container px-1 rounded font-mono">logs/traffic/</code>. Rotación automática (100MB).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input type="hidden" name="trafficLog" value={trafficLog ? "true" : "false"} />
                <input 
                  type="checkbox" 
                  checked={trafficLog} 
                  onChange={e => setTrafficLog(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-secondary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            {/* Log de SSO */}
            <div className="flex items-start justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
              <div className="flex-1 mr-4">
                <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Log de SSO</p>
                <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                  Log de autenticación y redirecciones SSO en la carpeta del conector (<code className="bg-surface-container px-1 rounded font-mono">logs/sso/</code>).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input type="hidden" name="ssoLog" value={ssoLog ? "true" : "false"} />
                <input 
                  type="checkbox" 
                  checked={ssoLog} 
                  onChange={e => setSsoLog(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-secondary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            {/* Log de Heartbeat */}
            <div className="flex items-start justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
              <div className="flex-1 mr-4">
                <p className="font-label text-xs font-bold text-on-surface uppercase tracking-wide">Log de Heartbeat</p>
                <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                  Log de mantenimiento de conexión y Shield en la carpeta del conector (<code className="bg-surface-container px-1 rounded font-mono">logs/hb/</code>).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input type="hidden" name="hbLog" value={hbLog ? "true" : "false"} />
                <input 
                  type="checkbox" 
                  checked={hbLog} 
                  onChange={e => setHbLog(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:bg-secondary peer-focus:outline-none transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            {/* Tiempo de Retención */}
            <div className="flex items-start justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
              <div className="flex-1 mr-4">
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
                  onChange={e => setTrafficRetentionUnit(e.target.value)}
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
            <div className="flex items-start justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
              <div className="flex-1 mr-4">
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

        {/* BOTONES DE NAVEGACIÓN (PIE) */}
        <div className="mt-8 pt-6 border-t border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
          {/* Botón Atrás */}
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="border border-outline-variant/50 hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-bold py-3 px-5 rounded-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>
            )}
          </div>

          {/* Botón Siguiente / Deploy */}
          <div>
            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!isStepValid()}
                className="bg-primary text-on-primary font-bold py-3 px-5 rounded-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest transition-all active:scale-95 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 cursor-pointer shadow-md shadow-primary/10"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                type="submit"
                disabled={isPending}
                className="bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest transition-transform active:scale-95 hover:brightness-110 shadow-lg shadow-primary-container/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer h-[44px]"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Deploy
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
      
      {/* Mensaje de respuesta */}
      {state?.message && (
        <div className={`px-8 py-3 text-sm font-medium border-t transition-all ${
          state.success 
            ? 'bg-secondary-container/20 text-secondary border-secondary/20' 
            : 'bg-error-container/20 text-error border-error/20'
        }`}>
          {state.message}
        </div>
      )}
    </section>
  );
}

