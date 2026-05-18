import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Finds the actual JVM PID. Critical to use `-x java` (exact process-name
// match) rather than `-f 'java.*\.jar'` — the latter also matches the
// `SCREEN -dmS minecraft java ... -jar paper.jar` wrapper whose command
// line contains those substrings, and picking that PID makes downstream
// tools like jstat / `ps -o etimes=` look at the wrong process.
export async function findJavaPid(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-x', 'java']);
    const first = stdout.trim().split(/\s+/)[0];
    const parsed = parseInt(first, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function getProcessAgeSeconds(pid: number): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'etimes=', '-p', String(pid)]);
    const seconds = parseInt(stdout.trim(), 10);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  } catch {
    return null;
  }
}
