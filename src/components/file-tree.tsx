import { useState } from "react";
import { ChevronRight, FolderSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "./checkbox";
import { JunkIcon } from "./junk-meta";
import { api } from "../lib/api";
import { formatBytes, shortenPath, sumBy } from "../utils";
import type { SystemJunkResult } from "../types";

interface JunkTreeProps {
  categories: SystemJunkResult[];
  selected: Set<string>;
  filter: string;
  onToggleFile: (path: string) => void;
  onToggleCategory: (category: SystemJunkResult) => void;
}

export function JunkTree({
  categories,
  selected,
  filter,
  onToggleFile,
  onToggleCategory,
}: JunkTreeProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const query = filter.trim().toLowerCase();

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="file-tree">
      {categories.map((cat) => {
        const files = query
          ? cat.files.filter((f) => f.path.toLowerCase().includes(query))
          : cat.files;
        if (query && files.length === 0) return null;

        // While filtering, groups open automatically so matches are visible.
        const isOpen = query ? true : expanded.has(cat.id);
        const selectedCount = cat.files.filter((f) =>
          selected.has(f.path),
        ).length;
        const selectedSize = sumBy(
          cat.files.filter((f) => selected.has(f.path)),
          (f) => f.size,
        );
        const label = t(`junk.${cat.id}`);

        return (
          <div key={cat.id} className="file-tree-group">
            <div
              className={`file-tree-category ${isOpen ? "expanded" : ""}`}
              onClick={() => toggleExpand(cat.id)}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleExpand(cat.id);
                }
              }}
            >
              <div className="file-tree-category-left">
                <Checkbox
                  checked={selectedCount === cat.files.length}
                  indeterminate={
                    selectedCount > 0 && selectedCount < cat.files.length
                  }
                  onChange={() => onToggleCategory(cat)}
                  label={label}
                />
                <JunkIcon id={cat.id} />
                <div className="result-row-info">
                  <h4>{label}</h4>
                  <p>{t(`junk.${cat.id}Desc`)}</p>
                </div>
              </div>
              <div className="file-tree-category-right">
                <span className="result-count">
                  {t("common.itemsFound", { count: cat.files.length })}
                </span>
                <span className="result-size">
                  {formatBytes(
                    selectedCount > 0 ? selectedSize : cat.totalSize,
                  )}
                </span>
                <ChevronRight
                  size={16}
                  className={`file-tree-chevron ${isOpen ? "rotated" : ""}`}
                />
              </div>
            </div>

            <div className={`file-tree-children ${isOpen ? "open" : ""}`}>
              <div className="file-tree-children-inner">
                {isOpen &&
                  files.map((file) => {
                    const isSelected = selected.has(file.path);
                    return (
                      <div
                        key={file.path}
                        className={`file-tree-file ${isSelected ? "selected" : ""}`}
                        onClick={() => onToggleFile(file.path)}
                      >
                        <div className="file-tree-file-left">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => onToggleFile(file.path)}
                            label={file.name}
                          />
                          <div className="file-tree-file-info">
                            <span className="file-tree-file-name">
                              {file.name}
                            </span>
                            <span className="file-tree-path" title={file.path}>
                              {shortenPath(file.path)}
                            </span>
                          </div>
                        </div>
                        <div className="file-tree-file-right">
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
                          <span className="file-tree-file-size">
                            {formatBytes(file.size)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
