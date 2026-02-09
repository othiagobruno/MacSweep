import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  SystemJunkResult,
  LargeFile,
  AppInfo,
  StartupItem,
} from "../types";

/* ── SmartScan ─────────────────────────────────────── */

type ScanState = "idle" | "scanning" | "done";

interface ScanResults {
  junk: SystemJunkResult[];
  totalJunk: number;
}

interface SmartScanState {
  scanState: ScanState;
  setScanState: Dispatch<SetStateAction<ScanState>>;
  progress: number;
  setProgress: Dispatch<SetStateAction<number>>;
  scanStatus: string;
  setScanStatus: Dispatch<SetStateAction<string>>;
  results: ScanResults | null;
  setResults: Dispatch<SetStateAction<ScanResults | null>>;
  isCleaning: boolean;
  setIsCleaning: Dispatch<SetStateAction<boolean>>;
  cleaned: boolean;
  setCleaned: Dispatch<SetStateAction<boolean>>;
}

/* ── System Junk ───────────────────────────────────── */

interface SystemJunkState {
  isScanning: boolean;
  setIsScanning: Dispatch<SetStateAction<boolean>>;
  results: SystemJunkResult[];
  setResults: Dispatch<SetStateAction<SystemJunkResult[]>>;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  isCleaning: boolean;
  setIsCleaning: Dispatch<SetStateAction<boolean>>;
  cleaned: boolean;
  setCleaned: Dispatch<SetStateAction<boolean>>;
}

/* ── Large Files ───────────────────────────────────── */

type SortBy = "size" | "name" | "date";

interface LargeFilesState {
  isScanning: boolean;
  setIsScanning: Dispatch<SetStateAction<boolean>>;
  files: LargeFile[];
  setFiles: Dispatch<SetStateAction<LargeFile[]>>;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  sortBy: SortBy;
  setSortBy: Dispatch<SetStateAction<SortBy>>;
  scanned: boolean;
  setScanned: Dispatch<SetStateAction<boolean>>;
}

/* ── Uninstaller ───────────────────────────────────── */

interface AppWithIcon extends AppInfo {
  iconDataUrl?: string | null;
}

interface UninstallerState {
  isScanning: boolean;
  setIsScanning: Dispatch<SetStateAction<boolean>>;
  apps: AppWithIcon[];
  setApps: Dispatch<SetStateAction<AppWithIcon[]>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  scanned: boolean;
  setScanned: Dispatch<SetStateAction<boolean>>;
}

/* ── Maintenance ───────────────────────────────────── */

type TaskStatus = "idle" | "running" | "done" | "error";

interface TaskState {
  status: TaskStatus;
  message?: string;
}

interface MaintenanceState {
  taskStates: Record<string, TaskState>;
  setTaskStates: Dispatch<SetStateAction<Record<string, TaskState>>>;
}

/* ── Startup Items ─────────────────────────────────── */

interface StartupItemsState {
  isScanning: boolean;
  setIsScanning: Dispatch<SetStateAction<boolean>>;
  items: StartupItem[];
  setItems: Dispatch<SetStateAction<StartupItem[]>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  scanned: boolean;
  setScanned: Dispatch<SetStateAction<boolean>>;
}

/* ── Full Context ──────────────────────────────────── */

interface AppStateContextType {
  smartScan: SmartScanState;
  systemJunk: SystemJunkState;
  largeFiles: LargeFilesState;
  uninstaller: UninstallerState;
  maintenance: MaintenanceState;
  startupItems: StartupItemsState;
}

const AppStateContext = createContext<AppStateContextType | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // SmartScan
  const [ssScanState, setSsScanState] = useState<ScanState>("idle");
  const [ssProgress, setSsProgress] = useState(0);
  const [ssScanStatus, setSsScanStatus] = useState("");
  const [ssResults, setSsResults] = useState<ScanResults | null>(null);
  const [ssIsCleaning, setSsIsCleaning] = useState(false);
  const [ssCleaned, setSsCleaned] = useState(false);

  // SystemJunk
  const [sjIsScanning, setSjIsScanning] = useState(false);
  const [sjResults, setSjResults] = useState<SystemJunkResult[]>([]);
  const [sjSelected, setSjSelected] = useState<Set<string>>(new Set());
  const [sjIsCleaning, setSjIsCleaning] = useState(false);
  const [sjCleaned, setSjCleaned] = useState(false);

  // LargeFiles
  const [lfIsScanning, setLfIsScanning] = useState(false);
  const [lfFiles, setLfFiles] = useState<LargeFile[]>([]);
  const [lfSelected, setLfSelected] = useState<Set<string>>(new Set());
  const [lfSortBy, setLfSortBy] = useState<SortBy>("size");
  const [lfScanned, setLfScanned] = useState(false);

  // Uninstaller
  const [unIsScanning, setUnIsScanning] = useState(false);
  const [unApps, setUnApps] = useState<AppWithIcon[]>([]);
  const [unSearch, setUnSearch] = useState("");
  const [unSelected, setUnSelected] = useState<Set<string>>(new Set());
  const [unScanned, setUnScanned] = useState(false);

  // Maintenance
  const [mtTaskStates, setMtTaskStates] = useState<Record<string, TaskState>>(
    {},
  );

  // StartupItems
  const [siIsScanning, setSiIsScanning] = useState(false);
  const [siItems, setSiItems] = useState<StartupItem[]>([]);
  const [siSearch, setSiSearch] = useState("");
  const [siSelected, setSiSelected] = useState<Set<string>>(new Set());
  const [siScanned, setSiScanned] = useState(false);

  const value: AppStateContextType = {
    smartScan: {
      scanState: ssScanState,
      setScanState: setSsScanState,
      progress: ssProgress,
      setProgress: setSsProgress,
      scanStatus: ssScanStatus,
      setScanStatus: setSsScanStatus,
      results: ssResults,
      setResults: setSsResults,
      isCleaning: ssIsCleaning,
      setIsCleaning: setSsIsCleaning,
      cleaned: ssCleaned,
      setCleaned: setSsCleaned,
    },
    systemJunk: {
      isScanning: sjIsScanning,
      setIsScanning: setSjIsScanning,
      results: sjResults,
      setResults: setSjResults,
      selected: sjSelected,
      setSelected: setSjSelected,
      isCleaning: sjIsCleaning,
      setIsCleaning: setSjIsCleaning,
      cleaned: sjCleaned,
      setCleaned: setSjCleaned,
    },
    largeFiles: {
      isScanning: lfIsScanning,
      setIsScanning: setLfIsScanning,
      files: lfFiles,
      setFiles: setLfFiles,
      selected: lfSelected,
      setSelected: setLfSelected,
      sortBy: lfSortBy,
      setSortBy: setLfSortBy,
      scanned: lfScanned,
      setScanned: setLfScanned,
    },
    uninstaller: {
      isScanning: unIsScanning,
      setIsScanning: setUnIsScanning,
      apps: unApps,
      setApps: setUnApps,
      search: unSearch,
      setSearch: setUnSearch,
      selected: unSelected,
      setSelected: setUnSelected,
      scanned: unScanned,
      setScanned: setUnScanned,
    },
    maintenance: {
      taskStates: mtTaskStates,
      setTaskStates: setMtTaskStates,
    },
    startupItems: {
      isScanning: siIsScanning,
      setIsScanning: setSiIsScanning,
      items: siItems,
      setItems: setSiItems,
      search: siSearch,
      setSearch: setSiSearch,
      selected: siSelected,
      setSelected: setSiSelected,
      scanned: siScanned,
      setScanned: setSiScanned,
    },
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
