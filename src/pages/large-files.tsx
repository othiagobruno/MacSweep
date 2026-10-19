import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  File,
  FileSearch,
  FolderSearch,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "../components/checkbox";
import { ConfirmDialog } from "../components/confirm-dialog";
import {
  ActionBar,
  EmptyState,
  PageHeader,
  ScanHero,
  ScanningState,
} from "../components/page";
import { useToast } from "../components/toast";
import { useNavigation } from "../contexts/navigation-context";
import { useSettings } from "../contexts/settings-context";
import { api } from "../lib/api";
import { requestDiskRefresh } from "../lib/events";
import {
  formatBytes,
  formatDate,
  KIND_COLORS,
  shortenPath,
  sumBy,
} from "../utils";
import type { FileKind, LargeFile } from "../types";

type SortKey = "size" | "name" | "lastModified" | "lastAccessed";
type Phase = "idle" | "scanning" | "results";

const KINDS: FileKind[] = [
  "video",
  "archive",
  "diskImage",
  "audio",
  "image",
  "document",
  "other",
];

export function LargeFiles() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { navigate } = useNavigation();
  const { settings } = useSettings();

  const [phase, setPhase] = useState<Phase>("idle");
  const [files, setFiles] = useState<LargeFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<FileKind | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "size",
    desc: true,
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [isTrashing, setIsTrashing] = useState(false);

  async function scan() {
    setPhase("scanning");
    try {
      const results = await api.scan.largeFiles({
        minSizeMB: settings.minFileSize,
        maxDepth: settings.scanDepth,
        excludedFolders: settings.excludedFolders,
        scanHidden: settings.scanHiddenFiles,
        skipSystemFiles: settings.skipSystemFiles,
      });
      setFiles(results);
      setSelected(new Set());
    } catch {
      toast.show({ tone: "error", title: t("errors.scanFailed") });
    }
    setPhase("results");
  }

  const kindCounts = useMemo(() => {
    const counts = new Map<FileKind, number>();
    for (const f of files) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
    return counts;
  }, [files]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = files.filter(
      (f) =>
        (kind === "all" || f.kind === kind) &&
        (!q || f.path.toLowerCase().includes(q)),
    );
    const dir = sort.desc ? -1 : 1;
    return filtered.sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "size":
          return (a.size - b.size) * dir;
        default:
          return (
            (new Date(a[sort.key]).getTime() -
              new Date(b[sort.key]).getTime()) *
            dir
          );
      }
    });
  }, [files, kind, query, sort]);

  const selectedFiles = files.filter((f) => selected.has(f.path));
  const selectedSize = sumBy(selectedFiles, (f) => f.size);
  const visibleSelected = visible.filter((f) => selected.has(f.path)).length;

  function toggle(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allVisible =
        visible.length > 0 && visible.every((f) => next.has(f.path));
      for (const f of visible) {
        if (allVisible) next.delete(f.path);
        else next.add(f.path);
      }
      return next;
    });
  }

  function sortBy(key: SortKey) {
    setSort((prev) => ({
      key,
      desc: prev.key === key ? !prev.desc : key !== "name",
    }));
  }

  async function handleTrash() {
    setShowConfirm(false);
    setIsTrashing(true);
    try {
      const { moved, failed } = await api.shell.moveToTrash(
        Array.from(selected),
      );
      const movedSet = new Set(moved);
      setFiles((prev) => prev.filter((f) => !movedSet.has(f.path)));
      setSelected(new Set(failed));
      requestDiskRefresh();

      if (moved.length > 0) {
        toast.show({
          tone: failed.length ? "warning" : "success",
          title: t("largeFiles.trashSuccess", { count: moved.length }),
          message: failed.length
            ? t("largeFiles.trashPartial", { count: failed.length })
            : t("largeFiles.trashSuccessDesc"),
        });
      } else {
        toast.show({ tone: "error", title: t("largeFiles.trashFailed") });
      }
    } finally {
      setIsTrashing(false);
    }
  }

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      aria-sort={
        sort.key === k ? (sort.desc ? "descending" : "ascending") : "none"
      }
    >
      <button
        className={`th-sort ${sort.key === k ? "active" : ""}`}
        onClick={() => sortBy(k)}
      >
        {label}
        {sort.key === k &&
          (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </th>
  );

  return (
    <div className="page-container">
      <div className="page-scrollable">
        {phase !== "idle" && (
          <PageHeader
            title={t("largeFiles.title")}
            subtitle={t("largeFiles.subtitle")}
            actions={
              phase === "results" && (
                <button className="btn btn-sm btn-secondary" onClick={scan}>
                  <RotateCcw size={14} />
                  {t("common.rescan")}
                </button>
              )
            }
          />
        )}

        {phase === "idle" && (
          <ScanHero
            page="large-files"
            hint={t("largeFiles.scanStatus", {
              size: settings.minFileSize,
              depth: settings.scanDepth,
            })}
            onScan={scan}
            footer={
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => navigate("settings")}
              >
                <SlidersHorizontal size={14} />
                {t("largeFiles.adjustSettings")}
              </button>
            }
          />
        )}

        {phase === "scanning" && (
          <ScanningState page="large-files" label={t("largeFiles.scanning")} />
        )}

        {phase === "results" && files.length === 0 && (
          <EmptyState
            icon={<FileSearch size={48} />}
            title={t("largeFiles.noLargeFiles")}
            message={t("largeFiles.diskOrganized")}
          />
        )}

        {phase === "results" && files.length > 0 && (
          <div className="fade-in">
            <div className="filter-row">
              <div className="search-bar search-bar-inline">
                <Search size={16} />
                <input
                  type="search"
                  placeholder={t("common.search")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="chip-group" role="tablist">
                <button
                  role="tab"
                  aria-selected={kind === "all"}
                  className={`chip ${kind === "all" ? "active" : ""}`}
                  onClick={() => setKind("all")}
                >
                  {t("common.all")}{" "}
                  <span className="chip-count">{files.length}</span>
                </button>
                {KINDS.filter((k) => kindCounts.has(k)).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={kind === k}
                    className={`chip ${kind === k ? "active" : ""}`}
                    onClick={() => setKind(k)}
                  >
                    <span
                      className="chip-dot"
                      style={{ background: KIND_COLORS[k] }}
                    />
                    {t(`largeFiles.kinds.${k}`)}{" "}
                    <span className="chip-count">{kindCounts.get(k)}</span>
                  </button>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                icon={<Search size={40} />}
                title={t("largeFiles.noMatches")}
              />
            ) : (
              <table className="file-list">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <Checkbox
                        checked={visibleSelected === visible.length}
                        indeterminate={
                          visibleSelected > 0 &&
                          visibleSelected < visible.length
                        }
                        onChange={toggleVisible}
                        label={t("common.selectAll")}
                      />
                    </th>
                    <SortHeader k="name" label={t("common.name")} />
                    <SortHeader k="size" label={t("common.size")} />
                    <SortHeader
                      k="lastAccessed"
                      label={t("common.lastOpened")}
                    />
                    <th style={{ width: 72 }} />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((file) => (
                    <tr
                      key={file.path}
                      className={selected.has(file.path) ? "selected" : ""}
                      onClick={() => toggle(file.path)}
                      onDoubleClick={() => void api.shell.quickLook(file.path)}
                    >
                      <td>
                        <Checkbox
                          checked={selected.has(file.path)}
                          onChange={() => toggle(file.path)}
                          label={file.name}
                        />
                      </td>
                      <td>
                        <div className="file-name">
                          <File
                            size={16}
                            style={{
                              color: KIND_COLORS[file.kind],
                              flexShrink: 0,
                            }}
                          />
                          <div className="file-name-text">
                            <span className="file-name-title" title={file.name}>
                              {file.name}
                            </span>
                            <span className="file-name-path" title={file.path}>
                              {shortenPath(
                                file.path.slice(
                                  0,
                                  file.path.length - file.name.length - 1,
                                ),
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="cell-size">{formatBytes(file.size)}</td>
                      <td className="cell-muted">
                        {formatDate(file.lastAccessed, i18n.language)}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            title={t("common.quickLook")}
                            aria-label={t("common.quickLook")}
                            onClick={(e) => {
                              e.stopPropagation();
                              void api.shell.quickLook(file.path);
                            }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="icon-btn"
                            title={t("common.revealInFinder")}
                            aria-label={t("common.revealInFinder")}
                            onClick={(e) => {
                              e.stopPropagation();
                              void api.shell.revealInFinder(file.path);
                            }}
                          >
                            <FolderSearch size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {phase === "results" && files.length > 0 && (
        <ActionBar>
          <div className="toolbar-left">
            <span className="toolbar-info">
              {selected.size > 0
                ? `${t("largeFiles.selectedInfo", { count: selected.size })} · ${formatBytes(selectedSize)}`
                : t("largeFiles.summary", {
                    count: files.length,
                    size: formatBytes(sumBy(files, (f) => f.size)),
                  })}
            </span>
          </div>
          <div className="toolbar-right">
            <button
              className="btn btn-danger btn-sm"
              disabled={selected.size === 0 || isTrashing}
              onClick={() => setShowConfirm(true)}
            >
              <Trash2 size={14} />
              {t("largeFiles.moveToTrash")}
            </button>
          </div>
        </ActionBar>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        title={t("largeFiles.confirmTitle")}
        message={t("largeFiles.confirmMessage", {
          count: selected.size,
          size: formatBytes(selectedSize),
        })}
        confirmLabel={t("largeFiles.moveToTrash")}
        variant="danger"
        onConfirm={handleTrash}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
