import {
  MemoryStick,
  Globe,
  Search,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppState } from "../contexts/app-state-context";
import type { MaintenanceResult } from "../types";

interface MaintenanceTask {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  colorClass: string;
  successKey: string;
  action: () => Promise<MaintenanceResult>;
}

export function Maintenance() {
  const { t } = useTranslation();
  const {
    maintenance: { taskStates, setTaskStates },
  } = useAppState();

  const tasks: MaintenanceTask[] = [
    {
      id: "free-ram",
      titleKey: "maintenance.freeRam",
      descriptionKey: "maintenance.freeRamDesc",
      icon: <MemoryStick size={24} />,
      colorClass: "purple",
      successKey: "maintenance.freeRamSuccess",
      action: async () => {
        if (window.electronAPI) {
          return window.electronAPI.maintenance.freeRam();
        }
        await new Promise((r) => setTimeout(r, 2000));
        return {
          success: true,
          message: t("maintenance.freeRamSuccess"),
        };
      },
    },
    {
      id: "flush-dns",
      titleKey: "maintenance.flushDns",
      descriptionKey: "maintenance.flushDnsDesc",
      icon: <Globe size={24} />,
      colorClass: "green",
      successKey: "maintenance.flushDnsSuccess",
      action: async () => {
        if (window.electronAPI) {
          return window.electronAPI.maintenance.flushDns();
        }
        await new Promise((r) => setTimeout(r, 1500));
        return {
          success: true,
          message: t("maintenance.flushDnsSuccess"),
        };
      },
    },
    {
      id: "rebuild-spotlight",
      titleKey: "maintenance.rebuildSpotlight",
      descriptionKey: "maintenance.rebuildSpotlightDesc",
      icon: <Search size={24} />,
      colorClass: "blue",
      successKey: "maintenance.rebuildSpotlightSuccess",
      action: async () => {
        if (window.electronAPI) {
          return window.electronAPI.maintenance.rebuildSpotlight();
        }
        await new Promise((r) => setTimeout(r, 3000));
        return {
          success: true,
          message: t("maintenance.rebuildSpotlightSuccess"),
        };
      },
    },
    {
      id: "repair-permissions",
      titleKey: "maintenance.repairPermissions",
      descriptionKey: "maintenance.repairPermissionsDesc",
      icon: <ShieldCheck size={24} />,
      colorClass: "orange",
      successKey: "maintenance.repairPermissionsSuccess",
      action: async () => {
        if (window.electronAPI) {
          return window.electronAPI.maintenance.repairPermissions();
        }
        await new Promise((r) => setTimeout(r, 2500));
        return {
          success: true,
          message: t("maintenance.repairPermissionsSuccess"),
        };
      },
    },
  ];

  async function runTask(task: MaintenanceTask) {
    setTaskStates((prev) => ({
      ...prev,
      [task.id]: { status: "running" },
    }));

    try {
      const result = await task.action();
      setTaskStates((prev) => ({
        ...prev,
        [task.id]: {
          status: result.success ? "done" : "error",
          message: result.message,
        },
      }));
    } catch (err: any) {
      setTaskStates((prev) => ({
        ...prev,
        [task.id]: {
          status: "error",
          message: err.message || t("maintenance.taskFailed"),
        },
      }));
    }
  }

  async function runAll() {
    for (const task of tasks) {
      await runTask(task);
    }
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <div className="page-header">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h1 className="page-title">{t("maintenance.title")}</h1>
              <p className="page-subtitle">{t("maintenance.subtitle")}</p>
            </div>
            <button
              className="btn btn-primary"
              onClick={runAll}
              disabled={Object.values(taskStates).some(
                (s) => s.status === "running",
              )}
            >
              <Play size={16} />
              {t("maintenance.runAll")}
            </button>
          </div>
        </div>

        <div className="maintenance-grid">
          {tasks.map((task) => {
            const state = taskStates[task.id] || {
              status: "idle",
            };
            const isRunning = state.status === "running";

            return (
              <div
                key={task.id}
                className="maintenance-card"
                onClick={() => !isRunning && runTask(task)}
                style={{
                  cursor: isRunning ? "wait" : "pointer",
                }}
              >
                <div className={`maintenance-card-icon ${task.colorClass}`}>
                  {task.icon}
                </div>
                <h3>{t(task.titleKey)}</h3>
                <p>{t(task.descriptionKey)}</p>
                <div className="maintenance-card-footer">
                  {state.status === "idle" && (
                    <span className="status-badge idle">
                      {t("common.ready")}
                    </span>
                  )}
                  {state.status === "running" && (
                    <span className="status-badge running">
                      <Loader2
                        size={12}
                        style={{
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      {t("common.running")}
                    </span>
                  )}
                  {state.status === "done" && (
                    <span className="status-badge done">
                      <CheckCircle2 size={12} />
                      {state.message || t("common.done")}
                    </span>
                  )}
                  {state.status === "error" && (
                    <span className="status-badge error">
                      <XCircle size={12} />
                      {state.message || t("common.failed")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
