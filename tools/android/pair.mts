// Pairs the phone (USB or wireless debugging) with this PC's server: copies the pairing key into the app's private
// storage and forwards port 8787. Run once per phone, and again after reinstalling the app:  npm run pair
// The key goes through `adb shell run-as`, which works only for this debuggable app and only from adb, so no other app
// on the phone can plant a key of its own. The key is never printed.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadOrCreateKey } from '../../packages/agent/src/pairing.ts';

const APP = 'dev.wellness.shell';
const sdkAdb = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const adb = process.env.ADB ?? (sdkAdb && existsSync(sdkAdb) ? sdkAdb : 'adb');
const run = (args: string[], input?: string) => {
  const r = spawnSync(adb, args, { input, encoding: 'utf8' });
  if (r.error) throw new Error(`adb not found (${adb}); set ADB to its path`);
  return r;
};

const devices = run(['devices']).stdout.split('\n').slice(1).filter(l => /\tdevice$/.test(l.trim()));
if (devices.length !== 1) {
  console.error(devices.length ? 'More than one phone is connected; leave one, or set ANDROID_SERIAL.' : 'No phone found. Connect it with USB or wireless debugging first.');
  if (!process.env.ANDROID_SERIAL) process.exit(1);
}

const hex = loadOrCreateKey().toString('hex');
const write = run(['shell', `run-as ${APP} sh -c 'mkdir -p files && cat > files/pairing-key && chmod 600 files/pairing-key'`], hex + '\n');
if (write.status !== 0) {
  console.error(`Could not write the key into the app (${(write.stderr || write.stdout).trim()}). Is the debug build of ${APP} installed?`);
  process.exit(1);
}
const size = run(['shell', `run-as ${APP} sh -c 'wc -c < files/pairing-key'`]).stdout.trim();
if (size !== '65') { console.error(`Key check failed (size ${size}).`); process.exit(1); }
const reverse = run(['reverse', 'tcp:8787', 'tcp:8787']);
console.log(`Paired ${APP} with this PC's server${reverse.status === 0 ? ' and forwarded port 8787' : ' (adb reverse failed: run it by hand)'}. Restart the app if it is open.`);
