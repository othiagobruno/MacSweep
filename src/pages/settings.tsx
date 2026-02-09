import {
  Globe,
  ScanSearch,
  Palette,
  Info,
  RotateCcw,
  FolderX,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings, type AppSettings } from "../contexts/settings-context";

type SettingsTab = "general" | "scanning" | "appearance" | "about";

const ACCENT_COLORS = [
  { name: "Purple", value: "#6c5ce7" },
  { name: "Blue", value: "#74b9ff" },
  { name: "Green", value: "#00d2a0" },
  { name: "Pink", value: "#e84393" },
  { name: "Orange", value: "#fdcb6e" },
  { name: "Red", value: "#ff6b6b" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
];

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className={`settings-toggle ${checked ? "active" : ""}`}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className="settings-toggle-knob" />
    </button>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { settings, updateSetting, resetToDefaults } = useSettings();
  const [newFolder, setNewFolder] = useState("");

  const tabs: Array<{
    id: SettingsTab;
    labelKey: string;
    icon: React.ReactNode;
  }> = [
    { id: "general", labelKey: "settings.general", icon: <Globe size={16} /> },
    {
      id: "scanning",
      labelKey: "settings.scanning",
      icon: <ScanSearch size={16} />,
    },
    {
      id: "appearance",
      labelKey: "settings.appearance",
      icon: <Palette size={16} />,
    },
    { id: "about", labelKey: "settings.about", icon: <Info size={16} /> },
  ];

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    updateSetting(key, value);
  }

  function addExcludedFolder() {
    const folder = newFolder.trim();
    if (folder && !settings.excludedFolders.includes(folder)) {
      update("excludedFolders", [...settings.excludedFolders, folder]);
      setNewFolder("");
    }
  }

  function removeExcludedFolder(folder: string) {
    update(
      "excludedFolders",
      settings.excludedFolders.filter((f) => f !== folder),
    );
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <div className="page-header">
          <h1 className="page-title">{t("settings.title")}</h1>
          <p className="page-subtitle">{t("settings.subtitle")}</p>
        </div>

        {/* Tabs */}
        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* General Tab */}
        {activeTab === "general" && (
          <div className="settings-section fade-in">
            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.preferences")}
              </h3>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.language")}</h4>
                  <p>{t("settings.languageDesc")}</p>
                </div>
                <select
                  className="settings-select"
                  value={settings.language}
                  onChange={(e) => update("language", e.target.value)}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.launchAtLogin")}</h4>
                  <p>{t("settings.launchAtLoginDesc")}</p>
                </div>
                <Toggle
                  checked={settings.launchAtLogin}
                  onChange={(v) => update("launchAtLogin", v)}
                />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.notifications")}</h4>
                  <p>{t("settings.notificationsDesc")}</p>
                </div>
                <Toggle
                  checked={settings.notifications}
                  onChange={(v) => update("notifications", v)}
                />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.showInMenuBar")}</h4>
                  <p>{t("settings.showInMenuBarDesc")}</p>
                </div>
                <Toggle
                  checked={settings.showInMenuBar}
                  onChange={(v) => update("showInMenuBar", v)}
                />
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.automation")}
              </h3>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.autoScanInterval")}</h4>
                  <p
                    dangerouslySetInnerHTML={{
                      __html: t("settings.autoScanIntervalDesc", {
                        days: settings.autoScanInterval,
                      }),
                    }}
                  />
                </div>
                <div className="settings-range-wrap">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={settings.autoScanInterval}
                    onChange={(e) =>
                      update("autoScanInterval", Number(e.target.value))
                    }
                    className="settings-range"
                  />
                  <span className="settings-range-value">
                    {settings.autoScanInterval}d
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scanning Tab */}
        {activeTab === "scanning" && (
          <div className="settings-section fade-in">
            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.scanConfig")}
              </h3>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.minFileSize")}</h4>
                  <p
                    dangerouslySetInnerHTML={{
                      __html: t("settings.minFileSizeDesc", {
                        size: settings.minFileSize,
                      }),
                    }}
                  />
                </div>
                <div className="settings-range-wrap">
                  <input
                    type="range"
                    min={1}
                    max={500}
                    value={settings.minFileSize}
                    onChange={(e) =>
                      update("minFileSize", Number(e.target.value))
                    }
                    className="settings-range"
                  />
                  <span className="settings-range-value">
                    {settings.minFileSize} MB
                  </span>
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.scanDepth")}</h4>
                  <p
                    dangerouslySetInnerHTML={{
                      __html: t("settings.scanDepthDesc", {
                        depth: settings.scanDepth,
                      }),
                    }}
                  />
                </div>
                <div className="settings-range-wrap">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={settings.scanDepth}
                    onChange={(e) =>
                      update("scanDepth", Number(e.target.value))
                    }
                    className="settings-range"
                  />
                  <span className="settings-range-value">
                    {settings.scanDepth}
                  </span>
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.skipSystemFiles")}</h4>
                  <p>{t("settings.skipSystemFilesDesc")}</p>
                </div>
                <Toggle
                  checked={settings.skipSystemFiles}
                  onChange={(v) => update("skipSystemFiles", v)}
                />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.scanHiddenFiles")}</h4>
                  <p>{t("settings.scanHiddenFilesDesc")}</p>
                </div>
                <Toggle
                  checked={settings.scanHiddenFiles}
                  onChange={(v) => update("scanHiddenFiles", v)}
                />
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.excludedFolders")}
              </h3>
              <p className="settings-group-desc">
                {t("settings.excludedFoldersDesc")}
              </p>

              <div className="settings-excluded-list">
                {settings.excludedFolders.map((folder) => (
                  <div key={folder} className="settings-excluded-item">
                    <FolderX size={14} />
                    <span>{folder}</span>
                    <button
                      className="settings-excluded-remove"
                      onClick={() => removeExcludedFolder(folder)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="settings-add-folder">
                <input
                  type="text"
                  placeholder="/path/to/folder"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addExcludedFolder()}
                  className="settings-add-input"
                />
                <button
                  className="btn btn-ghost"
                  onClick={addExcludedFolder}
                  disabled={!newFolder.trim()}
                >
                  <Plus size={14} />
                  {t("common.add")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === "appearance" && (
          <div className="settings-section fade-in">
            <div className="settings-group">
              <h3 className="settings-group-title">{t("settings.theme")}</h3>

              <div className="settings-theme-cards">
                {(
                  [
                    {
                      id: "dark" as const,
                      labelKey: "settings.dark",
                      descKey: "settings.darkDesc",
                    },
                    {
                      id: "darker" as const,
                      labelKey: "settings.darker",
                      descKey: "settings.darkerDesc",
                    },
                    {
                      id: "system" as const,
                      labelKey: "settings.systemTheme",
                      descKey: "settings.systemThemeDesc",
                    },
                  ] as const
                ).map((theme) => (
                  <div
                    key={theme.id}
                    className={`settings-theme-card ${
                      settings.theme === theme.id ? "active" : ""
                    }`}
                    onClick={() => update("theme", theme.id)}
                  >
                    <div className={`settings-theme-preview ${theme.id}`}>
                      <div className="settings-theme-bar" />
                      <div className="settings-theme-content">
                        <div className="settings-theme-line short" />
                        <div className="settings-theme-line" />
                        <div className="settings-theme-line medium" />
                      </div>
                    </div>
                    <h4>{t(theme.labelKey)}</h4>
                    <p>{t(theme.descKey)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.accentColor")}
              </h3>

              <div className="settings-color-picker">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`settings-color-dot ${
                      settings.accentColor === color.value ? "active" : ""
                    }`}
                    style={
                      {
                        "--dot-color": color.value,
                      } as React.CSSProperties
                    }
                    onClick={() => update("accentColor", color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.interface")}
              </h3>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.compactSidebar")}</h4>
                  <p>{t("settings.compactSidebarDesc")}</p>
                </div>
                <Toggle
                  checked={settings.compactSidebar}
                  onChange={(v) => update("compactSidebar", v)}
                />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.animations")}</h4>
                  <p>{t("settings.animationsDesc")}</p>
                </div>
                <Toggle
                  checked={settings.animationsEnabled}
                  onChange={(v) => update("animationsEnabled", v)}
                />
              </div>
            </div>
          </div>
        )}

        {/* About Tab */}
        {activeTab === "about" && (
          <div className="settings-section fade-in">
            <div className="settings-about-hero">
              <div className="settings-about-logo">
                <Sparkles size={32} />
              </div>
              <h2>MacSweep</h2>
              <p className="settings-about-version">{t("settings.version")}</p>
              <p className="settings-about-desc">{t("settings.aboutDesc")}</p>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.application")}
              </h3>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.checkForUpdates")}</h4>
                  <p>{t("settings.checkForUpdatesDesc")}</p>
                </div>
                <button className="btn btn-ghost">
                  {t("common.checkNow")}
                </button>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.license")}</h4>
                  <p>{t("settings.licenseDesc")}</p>
                </div>
                <span className="settings-badge">{t("settings.active")}</span>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>{t("settings.storageUsed")}</h4>
                  <p>{t("settings.storageUsedDesc")}</p>
                </div>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  24.5 MB
                </span>
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.dangerZone")}
              </h3>

              <div className="settings-row danger">
                <div className="settings-row-info">
                  <h4>{t("settings.resetToDefaults")}</h4>
                  <p>{t("settings.resetToDefaultsDesc")}</p>
                </div>
                <button className="btn btn-danger" onClick={resetToDefaults}>
                  <RotateCcw size={14} />
                  {t("common.reset")}
                </button>
              </div>
            </div>

            <div className="settings-footer-info">
              <p>{t("settings.footer1")}</p>
              <p>{t("settings.footer2")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
