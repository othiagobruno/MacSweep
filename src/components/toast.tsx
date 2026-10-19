import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  tone: ToastTone;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  /** Milliseconds; 0 keeps the toast until dismissed. */
  duration?: number;
}

interface ToastEntry extends ToastOptions {
  id: number;
}

interface ToastContextType {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { ...options, id }]);
      const duration = options.duration ?? (options.tone === "error" ? 8000 : 5000);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="region" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
              <Icon size={18} className="toast-icon" />
              <div className="toast-body">
                <strong>{toast.title}</strong>
                {toast.message && <p>{toast.message}</p>}
                {toast.action && (
                  <button
                    className="toast-action"
                    onClick={() => {
                      toast.action?.onClick();
                      dismiss(toast.id);
                    }}
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                className="toast-close"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
