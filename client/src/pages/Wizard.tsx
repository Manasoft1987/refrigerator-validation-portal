import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { EQUIPMENT_TYPES, TEMP_MODES, VALIDATION_BASIS } from "@shared/validation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Lock,
  Plus,
  Thermometer,
  Trash2,
  Upload,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import GeneralInfoStep from "./wizard/GeneralInfoStep";
import ChecklistStep from "./wizard/ChecklistStep";
import PVStep from "./wizard/PVStep";
import FinalReportStep from "./wizard/FinalReportStep";
import ExcursionStudyStep from "./wizard/ExcursionStudyStep";
import WarehouseProtocolStep from "./wizard/WarehouseProtocolStep";
import WarehouseEquipmentStep from "./wizard/WarehouseEquipmentStep";

// Standard protocol: 6 steps (no sections step)
const STANDARD_STEPS = [
  { id: 1, key: "general", label: "Общие сведения", icon: FileText },
  { id: 2, key: "iq", label: "IQ · Квалификация монтажа", icon: ClipboardCheck },
  { id: 3, key: "oq", label: "OQ · Квалификация функционирования", icon: ClipboardCheck },
  { id: 4, key: "pv", label: "PV · Эксплуатационная квалификация", icon: Thermometer },
  { id: 5, key: "excursion", label: "Испытания на отклонение", icon: Thermometer },
  { id: 6, key: "final", label: "Итоговый отчёт", icon: Download },
] as const;

type WStep = { id: number; key: string; label: string; icon: any; equipmentId?: number | null };

export default function Wizard() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [location, setLocation] = useLocation();
  const [step, setStep] = useState(1);

  const protocolQ = trpc.protocols.get.useQuery({ id }, { enabled: !isNaN(id) });
  const giQ = trpc.generalInfo.get.useQuery({ protocolId: id }, { enabled: !isNaN(id) });
  const pvQ = trpc.pv.get.useQuery({ protocolId: id }, { enabled: !isNaN(id) });
  // Load warehouse equipment list (only used for warehouse protocols)
  const equipmentQ = trpc.warehouseEquipment.list.useQuery(
    { protocolId: id },
    { enabled: !isNaN(id) },
  );

  const p = protocolQ.data;
  const isWarehouse = p?.equipmentType === "warehouse";
  const equipment = equipmentQ.data ?? [];

  // Build step list for warehouse
  // Step 1: General info about the object
  // Step 2: Protocol sections 1-7
  // Step 3: Equipment in the object (WarehouseEquipmentStep)
  // Step 4: Single IQ for the entire object (all equipment listed inside)
  // Step 5: Single OQ for the entire object (all equipment listed inside)
  // Step 6: PQ/PV, Step 7: Excursion, Step 8: Final report
  const warehouseSteps = useMemo<WStep[]>(() => {
    return [
      { id: 1, key: "general",   label: "Общие сведения об объекте",                     icon: FileText },
      { id: 2, key: "sections",  label: "Разделы протокола",                            icon: FileText },
      { id: 3, key: "equipment", label: "Оборудование в объекте",                     icon: Thermometer },
      { id: 4, key: "iq",        label: "IQ · Квалификация монтажа",              icon: ClipboardCheck },
      { id: 5, key: "oq",        label: "OQ · Квалификация функционирования", icon: ClipboardCheck },
      { id: 6, key: "pv",        label: "PQ/PV · Эксплуатационная квалификация",   icon: Thermometer },
      { id: 7, key: "excursion", label: "Испытания на отклонение",                   icon: Thermometer },
      { id: 8, key: "final",     label: "Итоговый отчёт",                                icon: Download },
    ];
  }, []);

  const activeSteps: WStep[] = isWarehouse ? warehouseSteps : (STANDARD_STEPS as unknown as WStep[]);
  const totalSteps = activeSteps.length;
  const requestedStep = useMemo(() => {
    if (typeof window === "undefined" || !Number.isFinite(id)) return null;
    const fromQuery = new URLSearchParams(window.location.search).get("step");
    let fromStorage: string | null = null;
    try {
      fromStorage = window.sessionStorage.getItem(`protocolWizardStep:${id}`);
    } catch {
      fromStorage = null;
    }
    return fromQuery || fromStorage;
  }, [id, location]);

  // auto-jump to the first incomplete step when wizard first loads
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!p || initialized) return;
    const requested = requestedStep
      ? activeSteps.find(s => s.key === requestedStep || String(s.id) === requestedStep)
      : null;
    if (requested) {
      setStep(requested.id);
      try {
        window.sessionStorage.removeItem(`protocolWizardStep:${id}`);
      } catch {
        // Session storage is optional.
      }
      setInitialized(true);
      return;
    }
    if (isWarehouse) {
      if (p.iqVerdict === "pass" && p.oqVerdict !== "pass") setStep(5);
      else if (p.iqVerdict !== "pass" && giQ.data) setStep(4);
      else setStep(1);
    } else {
      if (p.iqVerdict === "pass" && p.oqVerdict !== "pass") setStep(3);
      else if (p.iqVerdict !== "pass" && (giQ.data?.model || giQ.data?.serial)) setStep(2);
      else setStep(1);
    }
    setInitialized(true);
  }, [p, initialized, giQ.data, isWarehouse, requestedStep, activeSteps, id]);

  const unlockStep = (s: WStep): boolean => {
    if (!p) return false;
    if (s.id === 1) return true;
    const giReady = !!(giQ.data?.tempMode);
    if (isWarehouse) {
      // Warehouse: fixed 8 steps
      if (s.key === "sections")  return giReady;
      if (s.key === "equipment") return giReady;
      if (s.key === "iq")        return giReady;
      if (s.key === "oq")        return p.iqVerdict === "pass";
      if (s.key === "pv")        return p.oqVerdict === "pass";
      if (s.key === "excursion") return p.pvVerdict === "pass" || p.pvVerdict === "fail";
      if (s.key === "final")     return p.pvVerdict === "pass" || p.pvVerdict === "fail";
    } else {
      if (s.id === 2) return giReady;
      if (s.id === 3) return p.iqVerdict === "pass";
      if (s.id === 4) return p.oqVerdict === "pass";
      if (s.id === 5) return p.pvVerdict === "pass" || p.pvVerdict === "fail";
      if (s.id === 6) return p.pvVerdict === "pass" || p.pvVerdict === "fail";
    }
    return false;
  };

  const stepStatus = (s: WStep): "done" | "issue" | "current" | "locked" | "ready" => {
    if (!p) return "locked";
    if (s.id === step) return "current";
    if (s.id === 1) return !!(giQ.data?.tempMode) ? "done" : "ready";
    const verdict = (v: string | null | undefined) =>
      v === "pass" ? "done" : v === "fail" ? "issue" : unlockStep(s) ? "ready" : "locked";
    if (isWarehouse) {
      if (s.key === "sections" || s.key === "equipment") return unlockStep(s) ? "ready" : "locked";
      if (s.key === "iq")        return verdict(p.iqVerdict);
      if (s.key === "oq")        return verdict(p.oqVerdict);
      if (s.key === "pv")        return verdict(p.pvVerdict);
      if (s.key === "excursion" || s.key === "final") return unlockStep(s) ? "ready" : "locked";
    } else {
      if (s.id === 2) return verdict(p.iqVerdict);
      if (s.id === 3) return verdict(p.oqVerdict);
      if (s.id === 4) return verdict(p.pvVerdict);
      if (s.id === 5 || s.id === 6) return unlockStep(s) ? "ready" : "locked";
    }
    return "locked";
  };

  const progressPct = useMemo(() => {
    let pct = 0;
    if (giQ.data?.tempMode) pct += 20;
    if (p?.iqVerdict === "pass") pct += 20;
    if (p?.oqVerdict === "pass") pct += 20;
    if (p?.pvVerdict === "pass" || p?.pvVerdict === "fail") pct += 30;
    if (p?.status === "completed") pct += 10;
    return Math.min(pct, 100);
  }, [p, giQ.data]);

  if (protocolQ.isLoading || !p) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="h-10 w-64 bg-muted animate-pulse rounded mb-4" />
        <div className="h-96 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  const currentStepDef = activeSteps.find(s => s.id === step);

  return (
    <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => setLocation("/protocols")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> К протоколам
        </button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Протокол валидации
            </div>
            <h1 className="text-3xl font-semibold tracking-tight num">{p.number}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Заполните {totalSteps} этапов — портал автоматически рассчитает статистику PV и подготовит PDF.
            </p>
          </div>
          <div className="space-y-1 w-full max-w-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Прогресс</span>
              <span className="font-medium num">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        </div>
      </div>

      {/* Step tabs */}
      <Card className="border">
        <CardContent className="p-2">
          <ol
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${Math.min(totalSteps, 8)}, minmax(0, 1fr))` }}
          >
            {activeSteps.map(s => {
              const status = stepStatus(s);
              const active = s.id === step;
              const locked = status === "locked";
              return (
                <li key={s.id}>
                  <button
                    disabled={locked}
                    onClick={() => setStep(s.id)}
                    className={`w-full text-left rounded-lg px-3 py-3 transition-colors flex items-start gap-3 ${
                      active
                        ? "bg-primary/10 ring-1 ring-primary/20"
                        : locked
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:bg-accent/50 cursor-pointer"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 text-sm font-semibold ${
                        status === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : status === "issue"
                            ? "bg-rose-100 text-rose-700"
                            : active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {status === "done" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : status === "issue" ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : locked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        s.id
                      )}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <div
                        className={`text-[11px] uppercase tracking-wide ${
                          active ? "text-primary font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        Шаг {s.id}
                      </div>
                      <div
                        className={`text-xs font-medium leading-snug truncate ${
                          active ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {s.label}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Step content */}
      <div>
        {/* Step 1 — General info (all types) */}
        {step === 1 && (
          <GeneralInfoStep
            protocolId={id}
            onDone={() => setStep(2)}
            equipmentType={p?.equipmentType ?? undefined}
          />
        )}

        {/* ── WAREHOUSE FLOW ─────────────────────────────────────────── */}
        {isWarehouse && currentStepDef?.key === "sections" && (
          <WarehouseProtocolStep
            protocolId={id}
            onDone={() => setStep(step + 1)}
            onBack={() => setStep(step - 1)}
          />
        )}

        {/* Step 3 — Equipment in the warehouse object */}
        {isWarehouse && currentStepDef?.key === "equipment" && (
          <WarehouseEquipmentStep
            protocolId={id}
            onDone={() => { equipmentQ.refetch(); setStep(step + 1); }}
          />
        )}

        {/* Step 4 — Single IQ for the entire object (all equipment listed inside) */}
        {isWarehouse && currentStepDef?.key === "iq" && (
          <ChecklistStep
            protocolId={id}
            stage="iq"
            onPass={() => setStep(step + 1)}
            onBack={() => setStep(step - 1)}
            equipmentType={p?.equipmentType ?? undefined}
            warehouseEquipmentList={equipment}
          />
        )}

        {/* Step 5 — Single OQ for the entire object (all equipment listed inside) */}
        {isWarehouse && currentStepDef?.key === "oq" && (
          <ChecklistStep
            protocolId={id}
            stage="oq"
            onPass={() => setStep(step + 1)}
            onBack={() => setStep(step - 1)}
            equipmentType={p?.equipmentType ?? undefined}
            warehouseEquipmentList={equipment}
          />
        )}

        {isWarehouse && currentStepDef?.key === "pv" && (
          <PVStep protocolId={id} onDone={() => setStep(step + 1)} onBack={() => setStep(step - 1)} />
        )}
        {isWarehouse && currentStepDef?.key === "excursion" && (
          <ExcursionStudyStep protocolId={id} onDone={() => setStep(step + 1)} onBack={() => setStep(step - 1)} />
        )}
        {isWarehouse && currentStepDef?.key === "final" && (
          <FinalReportStep protocolId={id} onBack={() => setStep(step - 1)} />
        )}

        {/* ── STANDARD FLOW ──────────────────────────────────────────── */}
        {!isWarehouse && step === 2 && (
          <ChecklistStep
            protocolId={id}
            stage="iq"
            onPass={() => setStep(3)}
            onBack={() => setStep(1)}
            equipmentType={p?.equipmentType ?? undefined}
          />
        )}
        {!isWarehouse && step === 3 && (
          <ChecklistStep
            protocolId={id}
            stage="oq"
            onPass={() => setStep(4)}
            onBack={() => setStep(2)}
            equipmentType={p?.equipmentType ?? undefined}
          />
        )}
        {!isWarehouse && step === 4 && (
          <PVStep protocolId={id} onDone={() => setStep(5)} onBack={() => setStep(3)} />
        )}
        {!isWarehouse && step === 5 && (
          <ExcursionStudyStep protocolId={id} onDone={() => setStep(6)} onBack={() => setStep(4)} />
        )}
        {!isWarehouse && step === 6 && (
          <FinalReportStep protocolId={id} onBack={() => setStep(5)} />
        )}
      </div>
    </div>
  );
}

// Re-export sub-step helpers for convenience (small inline icon use)
export { GeneralInfoStep, ChecklistStep, PVStep, ExcursionStudyStep, FinalReportStep };
// Keep these symbols alive to avoid unused warnings when tree-shaking:
export const _unused = {
  Upload,
  Plus,
  Trash2,
  Loader2,
  ArrowRight,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  EQUIPMENT_TYPES,
  TEMP_MODES,
  VALIDATION_BASIS,
  trpc,
  toast,
};
