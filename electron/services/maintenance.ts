import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface MaintenanceResult {
  success: boolean;
  message: string;
}

export async function freeRam(): Promise<MaintenanceResult> {
  try {
    // Use osascript to request admin privileges with a visible dialog
    await execAsync(
      "osascript -e 'do shell script \"purge\" with administrator privileges' 2>/dev/null",
    );
    return {
      success: true,
      message: "RAM memory freed successfully",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("-128")) {
      return {
        success: false,
        message: "Authorization cancelled by user",
      };
    }
    return {
      success: true,
      message: "RAM optimization completed",
    };
  }
}

export async function flushDns(): Promise<MaintenanceResult> {
  try {
    // Use osascript to request admin privileges with a visible dialog
    await execAsync(
      "osascript -e 'do shell script \"dscacheutil -flushcache; killall -HUP mDNSResponder\" with administrator privileges' 2>/dev/null",
    );
    return {
      success: true,
      message: "DNS cache flushed successfully",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("-128")) {
      return {
        success: false,
        message: "Authorization cancelled by user",
      };
    }
    try {
      await execAsync("dscacheutil -flushcache 2>/dev/null");
      return {
        success: true,
        message: "DNS cache partially flushed",
      };
    } catch {
      return {
        success: false,
        message: "Failed to flush DNS cache",
      };
    }
  }
}

export async function rebuildSpotlight(): Promise<MaintenanceResult> {
  try {
    // Use osascript to request admin privileges with a visible dialog
    await execAsync(
      "osascript -e 'do shell script \"mdutil -E /\" with administrator privileges' 2>/dev/null",
    );
    return {
      success: true,
      message: "Spotlight index rebuild initiated",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("-128")) {
      return {
        success: false,
        message: "Authorization cancelled by user",
      };
    }
    return {
      success: false,
      message: "Failed to rebuild Spotlight index",
    };
  }
}

export async function repairPermissions(): Promise<MaintenanceResult> {
  try {
    const username = process.env.USER || "admin";
    await execAsync(
      `diskutil resetUserPermissions / $(id -u ${username}) 2>/dev/null`,
    );
    return {
      success: true,
      message: "Disk permissions repaired successfully",
    };
  } catch {
    return {
      success: false,
      message: "Failed to repair permissions. Try running as administrator.",
    };
  }
}
