import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

// Reader for the HotSpot performance-data file (/tmp/hsperfdata_<user>/<pid>).
// The JVM memory-maps this file and continuously updates its counters; it's
// the same source `jstat` reads, but parsing it directly costs one 32 KB file
// read instead of spawning a second JVM every sample. Nothing is sent to the
// Minecraft JVM — no Attach API, no signals.
//
// Layout (PerfDataPrologue, v2):
//   0  u4 magic 0xcafec0c0 (always big-endian bytes)
//   4  u1 byte order (0 = big, 1 = little)
//   5  u1 major version   6 u1 minor version   7 u1 accessible
//   8  i4 used            12 i4 overflow       16 i8 mod time stamp
//   24 i4 entry offset    28 i4 entry count
// Each entry (PerfDataEntry):
//   0 i4 entry length  4 i4 name offset  8 i4 vector length
//   12 u1 data type ('J' = jlong, 'B' = byte vector/string)
//   13 u1 flags  14 u1 units  15 u1 variability  16 i4 data offset

const MAGIC = 0xcafec0c0;

export type PerfCounters = Map<string, number | string>;

export function parseHsperfdata(buf: Buffer): PerfCounters | null {
  if (buf.length < 32 || buf.readUInt32BE(0) !== MAGIC) return null;
  const little = buf.readUInt8(4) === 1;
  const i32 = (off: number) => (little ? buf.readInt32LE(off) : buf.readInt32BE(off));
  const i64 = (off: number) => Number(little ? buf.readBigInt64LE(off) : buf.readBigInt64BE(off));

  const entryOffset = i32(24);
  const entryCount = i32(28);
  const counters: PerfCounters = new Map();

  let off = entryOffset;
  for (let n = 0; n < entryCount && off + 20 <= buf.length; n++) {
    const entryLength = i32(off);
    if (entryLength <= 0 || off + entryLength > buf.length) break;
    const nameOffset = i32(off + 4);
    const vectorLength = i32(off + 8);
    const dataType = String.fromCharCode(buf.readUInt8(off + 12));
    const dataOffset = i32(off + 16);

    const nameStart = off + nameOffset;
    const nameEnd = buf.indexOf(0, nameStart);
    const name = buf.toString('utf-8', nameStart, nameEnd > nameStart ? nameEnd : nameStart);

    if (dataType === 'J' && vectorLength === 0) {
      counters.set(name, i64(off + dataOffset));
    } else if (dataType === 'B' && vectorLength > 0) {
      const start = off + dataOffset;
      const raw = buf.subarray(start, start + vectorLength);
      const zero = raw.indexOf(0);
      counters.set(name, raw.toString('utf-8', 0, zero >= 0 ? zero : raw.length));
    }
    off += entryLength;
  }
  return counters;
}

// The JVM writes its perf file under the *JVM user's* temp dir. We run as the
// same user in production, but scan every hsperfdata_* dir so a different
// owner still works when the file is readable.
export async function readHsperfdataForPid(pid: number): Promise<PerfCounters | null> {
  const tmp = os.tmpdir();
  let dirs: string[];
  try {
    dirs = (await fs.readdir(tmp)).filter((d) => d.startsWith('hsperfdata_'));
  } catch {
    return null;
  }
  for (const dir of dirs) {
    try {
      const buf = await fs.readFile(path.join(tmp, dir, String(pid)));
      const parsed = parseHsperfdata(buf);
      if (parsed) return parsed;
    } catch {
      // not this dir / not readable
    }
  }
  return null;
}

export function num(counters: PerfCounters, key: string): number {
  const v = counters.get(key);
  return typeof v === 'number' ? v : 0;
}

export function str(counters: PerfCounters, key: string): string {
  const v = counters.get(key);
  return typeof v === 'string' ? v : '';
}
