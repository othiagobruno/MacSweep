export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getExtColor(ext: string): string {
  const colors: Record<string, string> = {
    ".dmg": "#ff6b81",
    ".zip": "#fdcb6e",
    ".pkg": "#a29bfe",
    ".iso": "#74b9ff",
    ".mp4": "#ff7675",
    ".mov": "#ff7675",
    ".avi": "#ff7675",
    ".mkv": "#ff7675",
    ".app": "#6c5ce7",
    ".pdf": "#e17055",
    ".psd": "#0984e3",
    ".sketch": "#fdcb6e",
  };
  return colors[ext] || "#636e72";
}
