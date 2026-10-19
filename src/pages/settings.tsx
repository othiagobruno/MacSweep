import { useEffect, useState } from "react";
import {
  ExternalLink,
  FolderOpen,
  FolderX,
  Globe,
  Info,
  Palette,
  Plus,
  RotateCcw,
  ScanSearch,
  X,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import logoFull from "../../assets/logo.png";
import { Switch } from "../components/checkbox";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PageHeader } from "../components/page";
import { useToast } from "../components/toast";
import { useIsActivePage } from "../contexts/navigation-context";
import { useSettings, type AppSettings } from "../contexts/settings-context";
import { api } from "../lib/api";
import { formatBytes } from "../utils";
import type { AppMeta, AppStats, ThemeId } from "../types";

type SettingsTab = "general" | "scanning" | "appearance" | "about";

const ACCENT_COLORS = [
  { name: "Purple", value: "#6c5ce7" },
  { name: "Blue", value: "#0a84ff" },
  { name: "Green", value: "#00b894" },
  { name: "Pink", value: "#e84393" },
  { name: "Orange", value: "#f39c12" },
  { name: "Red", value: "#ff5e57" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
];

const THEMES: Array<{ id: ThemeId; labelKey: string; descKey: string }> = [
  { id: "dark", labelKey: "settings.dark", descKey: "settings.darkDesc" },
  { id: "darker", labelKey: "settings.darker", descKey: "settings.darkerDesc" },
  { id: "light", labelKey: "settings.light", descKey: "settings.lightDesc" },
  {
    id: "system",
    labelKey: "settings.systemTheme",
    descKey: "settings.systemThemeDesc",
  },
];

function SettingRow({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`settings-row ${danger ? "danger" : ""}`}>
      <div className="settings-row-info">
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

function RangeSetting({
  value,
  min,
  max,
  suffix,
  label,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  suffix?: string;
  label: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="settings-range-wrap">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="settings-range"
        style={
          {
            "--range-pct": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
      <span className="settings-range-value">
        {format ? format(value) : `${value}${suffix ?? ""}`}
      </span>
    </div>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const toast = useToast();
  const isActive = useIsActivePage("settings");
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { settings, updateSetting, resetToDefaults } = useSettings();
  const [newFolder, setNewFolder] = useState("");
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!isActive || activeTab !== "about") return;
    void api.app.meta().then(setMeta);
    void api.app.stats().then(setStats);
  }, [isActive, activeTab]);

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

  function addExcludedFolder(folder: string) {
    const clean = folder.trim().replace(/\/+$/, "");
    if (clean && !settings.excludedFolders.includes(clean)) {
      update("excludedFolders", [...settings.excludedFolders, clean]);
    }
    setNewFolder("");
  }

  async function browseFolder() {
    const folder = await api.settings.chooseFolder();
    if (folder) addExcludedFolder(folder);
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <PageHeader
          title={t("settings.title")}
          subtitle={t("settings.subtitle")}
        />

        <div className="settings-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {activeTab === "general" && (
          <div className="settings-section fade-in" role="tabpanel">
            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.preferences")}
              </h3>

              <SettingRow
                title={t("settings.language")}
                description={t("settings.languageDesc")}
              >
                <select
                  className="settings-select"
                  value={settings.language}
                  aria-label={t("settings.language")}
                  onChange={(e) => update("language", e.target.value)}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </SettingRow>

              <SettingRow
                title={t("settings.launchAtLogin")}
                description={t("settings.launchAtLoginDesc")}
              >
                <Switch
                  checked={settings.launchAtLogin}
                  label={t("settings.launchAtLogin")}
                  onChange={(v) => update("launchAtLogin", v)}
                />
              </SettingRow>

              <SettingRow
                title={t("settings.showInMenuBar")}
                description={t("settings.showInMenuBarDesc")}
              >
                <Switch
                  checked={settings.showInMenuBar}
                  label={t("settings.showInMenuBar")}
                  onChange={(v) => update("showInMenuBar", v)}
                />
              </SettingRow>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.automation")}
              </h3>

              <SettingRow
                title={t("settings.autoScanInterval")}
                description={
                  settings.autoScanInterval > 0 ? (
                    <Trans
                      i18nKey="settings.autoScanIntervalDesc"
                      values={{ days: settings.autoScanInterval }}
                      components={{ strong: <strong /> }}
                    />
                  ) : (
                    <Trans
                      i18nKey="settings.autoScanOff"
                      components={{ strong: <strong /> }}
                    />
                  )
                }
              >
                <RangeSetting
                  value={settings.autoScanInterval}
                  min={0}
                  max={30}
                  label={t("settings.autoScanInterval")}
                  format={(v) => (v === 0 ? t("settings.off") : `${v}d`)}
                  onChange={(v) => update("autoScanInterval", v)}
                />
              </SettingRow>

              <SettingRow
                title={t("settings.notifications")}
                description={t("settings.notificationsDesc")}
              >
                <Switch
                  checked={settings.notifications}
                  disabled={settings.autoScanInterval === 0}
                  label={t("settings.notifications")}
                  onChange={(v) => update("notifications", v)}
                />
              </SettingRow>
            </div>
          </div>
        )}

        {activeTab === "scanning" && (
          <div className="settings-section fade-in" role="tabpanel">
            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.scanConfig")}
              </h3>

              <SettingRow
                title={t("settings.minFileSize")}
                description={
                  <Trans
                    i18nKey="settings.minFileSizeDesc"
                    values={{ size: settings.minFileSize }}
                    components={{ strong: <strong /> }}
                  />
                }
              >
                <RangeSetting
                  value={settings.minFileSize}
                  min={10}
                  max={1000}
                  suffix=" MB"
                  label={t("settings.minFileSize")}
                  onChange={(v) => update("minFileSize", v)}
                />
              </SettingRow>

              <SettingRow
                title={t("settings.scanDepth")}
                description={
                  <Trans
                    i18nKey="settings.scanDepthDesc"
                    values={{ depth: settings.scanDepth }}
                    components={{ strong: <strong /> }}
                  />
                }
              >
                <RangeSetting
                  value={settings.scanDepth}
                  min={1}
                  max={12}
                  label={t("settings.scanDepth")}
                  onChange={(v) => update("scanDepth", v)}
                />
              </SettingRow>

              <SettingRow
                title={t("settings.skipSystemFiles")}
                description={t("settings.skipSystemFilesDesc")}
              >
                <Switch
                  checked={settings.skipSystemFiles}
                  label={t("settings.skipSystemFiles")}
                  onChange={(v) => update("skipSystemFiles", v)}
                />
              </SettingRow>

              <SettingRow
                title={t("settings.scanHiddenFiles")}
                description={t("settings.scanHiddenFilesDesc")}
              >
                <Switch
                  checked={settings.scanHiddenFiles}
                  label={t("settings.scanHiddenFiles")}
                  onChange={(v) => update("scanHiddenFiles", v)}
                />
              </SettingRow>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.excludedFolders")}
              </h3>
              <p className="settings-group-desc">
                {t("settings.excludedFoldersDesc")}
              </p>

              <div className="settings-excluded-list">
                {settings.excludedFolders.length === 0 && (
                  <span className="settings-empty">
                    {t("settings.noExcluded")}
                  </span>
                )}
                {settings.excludedFolders.map((folder) => (
                  <div key={folder} className="settings-excluded-item">
                    <FolderX size={14} />
                    <span title={folder}>{folder}</span>
                    <button
                      className="settings-excluded-remove"
                      aria-label={`${t("common.delete")} ${folder}`}
                      onClick={() =>
                        update(
                          "excludedFolders",
                          settings.excludedFolders.filter((f) => f !== folder),
                        )
                      }
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="settings-add-folder">
                <input
                  type="text"
                  placeholder="~/Projects/build"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && addExcludedFolder(newFolder)
                  }
                  className="settings-add-input"
                />
                <button
                  className="btn btn-ghost"
                  onClick={() => addExcludedFolder(newFolder)}
                  disabled={!newFolder.trim()}
                >
                  <Plus size={14} />
                  {t("common.add")}
                </button>
                <button className="btn btn-secondary" onClick={browseFolder}>
                  <FolderOpen size={14} />
                  {t("common.browse")}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="settings-section fade-in" role="tabpanel">
            <div className="settings-group">
              <h3 className="settings-group-title">{t("settings.theme")}</h3>
              <div className="settings-theme-cards">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    className={`settings-theme-card ${settings.theme === theme.id ? "active" : ""}`}
                    aria-pressed={settings.theme === theme.id}
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
                  </button>
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
                    className={`settings-color-dot ${settings.accentColor === color.value ? "active" : ""}`}
                    style={
                      { "--dot-color": color.value } as React.CSSProperties
                    }
                    onClick={() => update("accentColor", color.value)}
                    title={color.name}
                    aria-label={color.name}
                    aria-pressed={settings.accentColor === color.value}
                  />
                ))}
                <label
                  className={`settings-color-custom ${
                    ACCENT_COLORS.some((c) => c.value === settings.accentColor)
                      ? ""
                      : "active"
                  }`}
                  title={t("settings.customColor")}
                >
                  <input
                    type="color"
                    value={settings.accentColor}
                    aria-label={t("settings.customColor")}
                    onChange={(e) => update("accentColor", e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.interface")}
              </h3>
              <SettingRow
                title={t("settings.compactSidebar")}
                description={t("settings.compactSidebarDesc")}
              >
                <Switch
                  checked={settings.compactSidebar}
                  label={t("settings.compactSidebar")}
                  onChange={(v) => update("compactSidebar", v)}
                />
              </SettingRow>
              <SettingRow
                title={t("settings.animations")}
                description={t("settings.animationsDesc")}
              >
                <Switch
                  checked={settings.animationsEnabled}
                  label={t("settings.animations")}
                  onChange={(v) => update("animationsEnabled", v)}
                />
              </SettingRow>
            </div>
          </div>
        )}

        {activeTab === "about" && (
          <div className="settings-section fade-in" role="tabpanel">
            <div className="settings-about-hero">
              <div className="settings-about-logo">
                <img src={logoFull} alt="MacSweep" />
              </div>
              <p className="settings-about-version">
                {t("settings.version", { version: meta?.version ?? "…" })}
              </p>
              <p className="settings-about-desc">{t("settings.aboutDesc")}</p>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.application")}
              </h3>

              <SettingRow
                title={t("settings.checkForUpdates")}
                description={t("settings.checkForUpdatesDesc")}
              >
                <button
                  className="btn btn-ghost"
                  onClick={() => void api.app.openReleases()}
                >
                  <ExternalLink size={14} />
                  {t("settings.checkNow")}
                </button>
              </SettingRow>

              <SettingRow
                title={t("settings.lifetime")}
                description={t("settings.lifetimeDesc", {
                  size: formatBytes(stats?.totalFreed ?? 0),
                  count: stats?.cleanCount ?? 0,
                })}
              >
                <span className="settings-value">
                  {formatBytes(stats?.totalFreed ?? 0)}
                </span>
              </SettingRow>

              <SettingRow
                title={t("settings.storageUsed")}
                description={t("settings.storageUsedDesc")}
              >
                <span className="settings-value">
                  {meta ? formatBytes(meta.dataSize) : "…"}
                </span>
              </SettingRow>

              <SettingRow
                title={t("settings.runtime")}
                description={
                  meta
                    ? `Electron ${meta.electron} · Chromium ${meta.chrome} · Node ${meta.node}`
                    : "…"
                }
              >
                <span />
              </SettingRow>

              <SettingRow
                title={t("settings.license")}
                description={t("settings.licenseDesc")}
              >
                <span className="settings-badge">MIT</span>
              </SettingRow>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">
                {t("settings.dangerZone")}
              </h3>
              <SettingRow
                danger
                title={t("settings.resetToDefaults")}
                description={t("settings.resetToDefaultsDesc")}
              >
                <button
                  className="btn btn-danger"
                  onClick={() => setConfirmReset(true)}
                >
                  <RotateCcw size={14} />
                  {t("common.reset")}
                </button>
              </SettingRow>
            </div>

            <div className="settings-footer-info">
              <p>{t("settings.footer1")}</p>
              <p>{t("settings.footer2", { year: new Date().getFullYear() })}</p>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmReset}
        title={t("settings.resetConfirmTitle")}
        message={t("settings.resetConfirmMessage")}
        confirmLabel={t("common.reset")}
        variant="danger"
        onConfirm={() => {
          setConfirmReset(false);
          resetToDefaults();
          toast.show({ tone: "success", title: t("settings.resetDone") });
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
