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
import { useAppState } from "../contexts/app-state-context";
import type { MaintenanceResult } from "../types";

interface MaintenanceTask {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  action: () => Promise<MaintenanceResult>;
}

export function Maintenance() {
  const {
    maintenance: { taskStates, setTaskStates },
  } = useAppState();

  const tasks: MaintenanceTask[] = [
    {
      id: "free-ram",
      title: "Free Up RAM",
      description:
        "Purge inactive memory to free up RAM for active applications.",
      icon: <MemoryStick size={24} />,
      colorClass: "purple",
      action: async () => {
        if (window.electronAPI) {
          return window.electronAPI.maintenance.freeRam();
        }
        await new Promise((r) => setTimeout(r, 2000));
        return {
          success: true,
          message: "RAM memory freed successfully",
        };
      },
    },
    {
      id: "flush-dns",
      title: "Flush DNS Cache",
      description:
        "Clear DNS cache to fix connection issues and improve browsing.",
      icon: <Globe size={24} />,
      colorClass: "green",
      action: async () => {
        if (window.electronAPI) {
          return window.electronAPI.maintenance.flushDns();
        }
        await new Promise((r) => setTimeout(r, 1500));
        return {
          success: true,
          message: "DNS cache flushed successfully",
        };
      },
    },
    {
      id: "rebuild-spotlight",
      title: "Rebuild Spotlight Index",
      description: "Rebuild the Spotlight index to fix search issues.",
      icon: <Search size={24} />,
      colorClass: "blue",
      action: async () => {
        if (window.electronAPI) {
          return window.electronAPI.maintenance.rebuildSpotlight();
        }
        await new Promise((r) => setTimeout(r, 3000));
        return {
          success: true,
          message: "Spotlight index rebuild initiated",
        };
      },
    },
    {
      id: "repair-permissions",
      title: "Repair Disk Permissions",
      description: "Fix incorrect file permissions that may cause issues.",
      icon: <ShieldCheck size={24} />,
      colorClass: "orange",
      action: async () => {
        if (window.electronAPI) {
          return window.electronAPI.maintenance.repairPermissions();
        }
        await new Promise((r) => setTimeout(r, 2500));
        return {
          success: true,
          message: "Disk permissions repaired successfully",
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
          message: err.message || "Task failed",
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
              <h1 className="page-title">Maintenance</h1>
              <p className="page-subtitle">
                Run maintenance tasks to keep your Mac running smoothly
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={runAll}
              disabled={Object.values(taskStates).some(
                (s) => s.status === "running",
              )}
            >
              <Play size={16} />
              Run All
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
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                <div className="maintenance-card-footer">
                  {state.status === "idle" && (
                    <span className="status-badge idle">Ready</span>
                  )}
                  {state.status === "running" && (
                    <span className="status-badge running">
                      <Loader2
                        size={12}
                        style={{
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      Running...
                    </span>
                  )}
                  {state.status === "done" && (
                    <span className="status-badge done">
                      <CheckCircle2 size={12} />
                      {state.message || "Done"}
                    </span>
                  )}
                  {state.status === "error" && (
                    <span className="status-badge error">
                      <XCircle size={12} />
                      {state.message || "Failed"}
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
