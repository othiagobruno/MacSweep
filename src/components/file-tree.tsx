import { useState } from "react";
import { Check, ChevronRight, File, FolderOpen, Minus } from "lucide-react";
import { formatBytes } from "../utils";
import type { SystemJunkResult } from "../types";

interface FileTreeProps {
  categories: SystemJunkResult[];
  selectedFiles: Set<string>;
  onToggleFile: (path: string) => void;
  onToggleCategory: (category: string) => void;
  onToggleAll: () => void;
}

export function FileTree({
  categories,
  selectedFiles,
  onToggleFile,
  onToggleCategory,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(category: string) {
    const next = new Set(expanded);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setExpanded(next);
  }

  function getCategoryState(cat: SystemJunkResult) {
    const total = cat.files.length;
    if (total === 0) return "none";
    const selectedCount = cat.files.filter((f) =>
      selectedFiles.has(f.path),
    ).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === total) return "all";
    return "partial";
  }

  function getCategorySelectedSize(cat: SystemJunkResult) {
    return cat.files
      .filter((f) => selectedFiles.has(f.path))
      .reduce((sum, f) => sum + f.size, 0);
  }

  function shortenPath(filePath: string) {
    const home = "/Users/";
    if (filePath.startsWith(home)) {
      const afterUsers = filePath.substring(home.length);
      const slashIdx = afterUsers.indexOf("/");
      if (slashIdx !== -1) {
        return "~" + afterUsers.substring(slashIdx);
      }
    }
    return filePath;
  }

  const sortedCategories = [...categories].sort(
    (a, b) => b.totalSize - a.totalSize,
  );

  return (
    <div className="file-tree">
      {sortedCategories.map((cat) => {
        const isExpanded = expanded.has(cat.category);
        const state = getCategoryState(cat);
        const selectedSize = getCategorySelectedSize(cat);
        const sortedFiles = [...cat.files].sort((a, b) => b.size - a.size);

        return (
          <div key={cat.category} className="file-tree-group">
            <div
              className={`file-tree-category ${isExpanded ? "expanded" : ""}`}
              onClick={() => toggleExpand(cat.category)}
            >
              <div className="file-tree-category-left">
                <div
                  className={`checkbox ${
                    state === "all"
                      ? "checked"
                      : state === "partial"
                        ? "indeterminate"
                        : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCategory(cat.category);
                  }}
                >
                  {state === "all" && <Check size={12} />}
                  {state === "partial" && <Minus size={12} />}
                </div>

                <ChevronRight
                  size={16}
                  className={`file-tree-chevron ${isExpanded ? "rotated" : ""}`}
                />

                <div className="result-row-icon">
                  <FolderOpen size={18} />
                </div>

                <div className="result-row-info">
                  <h4>{cat.category}</h4>
                  <p>{cat.files.length} items</p>
                </div>
              </div>

              <div className="file-tree-category-right">
                <span className="result-size">
                  {state === "none"
                    ? formatBytes(cat.totalSize)
                    : formatBytes(selectedSize)}
                </span>
              </div>
            </div>

            <div className={`file-tree-children ${isExpanded ? "open" : ""}`}>
              <div className="file-tree-children-inner">
                {sortedFiles.map((file) => {
                  const isSelected = selectedFiles.has(file.path);
                  return (
                    <div
                      key={file.path}
                      className={`file-tree-file ${isSelected ? "selected" : ""}`}
                      onClick={() => onToggleFile(file.path)}
                    >
                      <div className="file-tree-file-left">
                        <div
                          className={`checkbox ${isSelected ? "checked" : ""}`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                        <File size={14} className="file-tree-file-icon" />
                        <div className="file-tree-file-info">
                          <span className="file-tree-file-name">
                            {file.name}
                          </span>
                          <span className="file-tree-path">
                            {shortenPath(file.path)}
                          </span>
                        </div>
                      </div>
                      <span className="file-tree-file-size">
                        {formatBytes(file.size)}
                      </span>
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
