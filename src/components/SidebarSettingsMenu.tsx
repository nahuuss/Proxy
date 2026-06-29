"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleHelp, Settings2, X } from "lucide-react";
import { updateGlobalSettingsAction } from "@/app/actions";
import { GlobalSettings } from "@/lib/settings";
import { useRouter } from "next/navigation";

type SettingsActionState = {
  success: boolean;
  message: string;
};

const initialActionState: SettingsActionState = {
  success: false,
  message: "",
};

export function SidebarSettingsMenu({ settings }: { settings: GlobalSettings }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateGlobalSettingsAction, initialActionState);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (state.success) {
      setIsOpen(false);
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-4 px-4 py-3 text-on-surface-variant hover:text-on-surface transition-all duration-300"
      >
        <Settings2 className="w-5 h-5" />
        <span className="font-label text-xs font-medium uppercase tracking-widest">Configuracion</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-3 w-[320px] rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)] z-50">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface">Configuracion global</h3>
              <p className="mt-1 text-[10px] text-on-surface-variant/70">
                Ajustes generales de plataforma y reinicio automatico.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
              aria-label="Cerrar configuracion"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form action={formAction} className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Public Host</label>
              <input
                name="publicHost"
                defaultValue={settings.publicHost}
                className="w-full rounded-lg border border-outline-variant/20 bg-background px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
                placeholder="bizguard.midominio.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Auth URL</label>
              <input
                name="authUrl"
                defaultValue={settings.authUrl}
                className="w-full rounded-lg border border-outline-variant/20 bg-background px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
                placeholder="http://localhost:3000"
              />
            </div>

            <input name="internalTarget" type="hidden" value={settings.internalTarget} readOnly />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">HB Shield</label>
                <input
                  name="hbFirstPulse"
                  type="number"
                  min="1"
                  defaultValue={settings.hbFirstPulse ?? 20}
                  className="w-full rounded-lg border border-outline-variant/20 bg-background px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
                />
                <p className="mt-1 text-[9px] text-on-surface-variant/60">Segundos</p>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Reset auto</label>
                  <div className="relative group">
                    <CircleHelp className="w-3.5 h-3.5 text-on-surface-variant/70 cursor-help" />
                    <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden w-64 rounded-xl border border-outline-variant/20 bg-surface-container-high px-3 py-2.5 text-[10px] leading-relaxed text-on-surface shadow-[0_18px_50px_rgba(0,0,0,0.45)] group-hover:block">
                      <p className="font-semibold text-on-surface">Reset auto de memoria</p>
                      <p className="mt-1 text-on-surface-variant/85">
                        Define cada cuantos minutos BizGuard ejecuta una limpieza de memoria usada por la plataforma.
                      </p>
                      <p className="mt-1 text-on-surface-variant/85">
                        Para el usuario esto no reinicia Windows ni apaga conectores. Lo que hace es compactar las bases internas en memoria, liberar buffers y pedir a Node.js que recupere memoria que ya no se esta usando.
                      </p>
                      <p className="mt-1 text-on-surface-variant/85">
                        Sirve para mantener estable el consumo de RAM cuando hubo muchas solicitudes, archivos grandes, logs o sesiones prolongadas. Si el valor es menor, la limpieza ocurre mas seguido. Si es mayor, se limpia con menos frecuencia.
                      </p>
                    </div>
                  </div>
                </div>
                <input
                  name="memoryResetIntervalMinutes"
                  type="number"
                  min="1"
                  defaultValue={settings.memoryResetIntervalMinutes ?? 30}
                  className="w-full rounded-lg border border-outline-variant/20 bg-background px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
                />
                <p className="mt-1 text-[9px] text-on-surface-variant/60">Minutos</p>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-outline-variant/15 bg-background/70 px-3 py-2.5">
              <div>
                <p className="text-[11px] font-semibold text-on-surface">Bypass Auth Global</p>
                <p className="text-[9px] text-on-surface-variant/60">Desactiva autenticacion para toda la consola.</p>
              </div>
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  name="bypassAuth"
                  defaultChecked={settings.bypassAuth}
                  className="peer sr-only"
                />
                <span className="h-5 w-10 rounded-full bg-surface-container-highest transition-colors peer-checked:bg-primary/70"></span>
                <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></span>
              </span>
            </label>

            {state.message && (
              <p className={`text-[10px] ${state.success ? "text-secondary" : "text-red-400"}`}>
                {state.message}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-on-primary shadow-lg shadow-on-primary/20 transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Guardando..." : "Guardar configuracion"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
