import { useState } from "react";
import {
  CheckCircle2,
  Globe,
  History,
  Layers,
  Loader2,
  Lock,
  MemoryStick,
  Play,
  Search,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "../components/checkbox";
import { PageHeader } from "../components/page";
import { useToast } from "../components/toast";
import { api } from "../lib/api";
import type { MaintenanceResult, MaintenanceTaskId } from "../types";

interface TaskDef {
  id: MaintenanceTaskId;
  icon: LucideIcon;
  color: string;
  admin: boolean;
}

const TASKS: TaskDef[] = [
  { id: "freeRam", icon: MemoryStick, color: "purple", admin: true },
  { id: "flushDns", icon: Globe, color: "green", admin: true },
  { id: "rebuildSpotlight", icon: Search, color: "blue", admin: true },
  { id: "repairPermissions", icon: ShieldCheck, color: "orange", admin: true },
  { id: "rebuildLaunchServices", icon: Layers, color: "pink", admin: false },
  { id: "thinSnapshots", icon: History, color: "teal", admin: true },
];

type TaskState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: MaintenanceResult }
  | { status: "error"; result: MaintenanceResult };

export function Maintenance() {
  const { t } = useTranslation();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<MaintenanceTaskId>>(
    new Set(["freeRam", "flushDns"]),
  );
  const [states, setStates] = useState<
    Partial<Record<MaintenanceTaskId, TaskState>>
  >({});
  const isRunning = Object.values(states).some((s) => s?.status === "running");

  async function run(ids: MaintenanceTaskId[]) {
    if (ids.length === 0 || isRunning) return;
    setStates((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { status: "running" };
      return next;
    });

    let results: MaintenanceResult[];
    try {
      results = await api.maintenance.run(ids);
    } catch (err) {
      results = ids.map((taskId) => ({
        taskId,
        success: false,
        cancelled: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }

    setStates((prev) => {
      const next = { ...prev };
      for (const result of results) {
        next[result.taskId] = result.cancelled
          ? { status: "idle" }
          : { status: result.success ? "done" : "error", result };
      }
      return next;
    });

    if (results.some((r) => r.cancelled)) {
      toast.show({ tone: "info", title: t("errors.adminCancelled") });
    } else if (ids.length > 1) {
      const failed = results.filter((r) => !r.success).length;
      toast.show(
        failed
          ? {
              tone: "warning",
              title: t("maintenance.someFailed", { count: failed }),
            }
          : { tone: "success", title: t("maintenance.allDone") },
      );
    }
  }

  function toggle(id: MaintenanceTaskId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <PageHeader
          title={t("maintenance.title")}
          subtitle={t("maintenance.subtitle")}
          actions={
            <button
              className="btn btn-primary"
              onClick={() =>
                run(
                  TASKS.filter((task) => selected.has(task.id)).map(
                    (task) => task.id,
                  ),
                )
              }
              disabled={isRunning || selected.size === 0}
            >
              <Play size={16} />
              {t("maintenance.runSelected", { count: selected.size })}
            </button>
          }
        />

        <p className="list-caption">
          <Lock size={12} /> {t("maintenance.adminHint")}
        </p>

        <div className="maintenance-grid">
          {TASKS.map((task) => {
            const state = states[task.id] ?? { status: "idle" };
            const Icon = task.icon;
            const running = state.status === "running";
            const isSelected = selected.has(task.id);
            return (
              <div
                key={task.id}
                className={`maintenance-card ${isSelected ? "selected" : ""}`}
                onClick={() => toggle(task.id)}
              >
                <div className="maintenance-card-top">
                  <div className={`maintenance-card-icon ${task.color}`}>
                    <Icon size={24} />
                  </div>
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggle(task.id)}
                    label={t(`maintenance.${task.id}`)}
                  />
                </div>
                <h3>
                  {t(`maintenance.${task.id}`)}
                  {task.admin && (
                    <Lock
                      size={12}
                      className="maintenance-lock"
                      aria-label={t("common.requiresAdmin")}
                    />
                  )}
                </h3>
                <p>{t(`maintenance.${task.id}Desc`)}</p>
                <div className="maintenance-card-footer">
                  {state.status === "idle" && (
                    <span className="status-badge idle">
                      {t("common.ready")}
                    </span>
                  )}
                  {state.status === "running" && (
                    <span className="status-badge running">
                      <Loader2 size={12} className="spin" />
                      {t("common.running")}
                    </span>
                  )}
                  {state.status === "done" && (
                    <span className="status-badge done">
                      <CheckCircle2 size={12} />
                      {state.result.detail
                        ? t("maintenance.reclaimed", {
                            size: state.result.detail,
                          })
                        : t("common.done")}
                    </span>
                  )}
                  {state.status === "error" && (
                    <span
                      className="status-badge error"
                      title={state.result.error}
                    >
                      <XCircle size={12} />
                      {t("common.failed")}
                    </span>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={isRunning}
                    onClick={(e) => {
                      e.stopPropagation();
                      void run([task.id]);
                    }}
                  >
                    {running ? (
                      <Loader2 size={12} className="spin" />
                    ) : (
                      <Play size={12} />
                    )}
                    {t("maintenance.run")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
