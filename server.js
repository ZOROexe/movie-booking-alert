import 'dotenv/config';
import { spawn } from 'child_process';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const RESULT_PREFIX = '__MONITOR_RESULT__';

let isRunning = false;

function runMonitorInChildProcess() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
      cwd: __dirname,
      env: { ...process.env, MONITOR_JSON_RESULT: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', reject);

    child.on('close', (code) => {
      const resultLine = stdout
        .split('\n')
        .find((line) => line.startsWith(RESULT_PREFIX));

      if (code === 0) {
        if (resultLine) {
          resolve(JSON.parse(resultLine.slice(RESULT_PREFIX.length)));
        } else {
          resolve({ watchesChecked: 0, bookingsDetected: 0, notified: 0 });
        }
        return;
      }

      const message =
        stderr.trim() ||
        stdout.trim() ||
        `Monitor exited with code ${code ?? 'unknown'}`;
      reject(new Error(message));
    });
  });
}

app.get('/run', async (req, res) => {
  if (isRunning) {
    return res.status(409).json({
      ok: false,
      message: 'Monitor is already running',
    });
  }

  isRunning = true;
  try {
    const result = await runMonitorInChildProcess();
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(`❌ /run failed: ${error.message}`);
    res.status(500).json({ ok: false, message: error.message });
  } finally {
    isRunning = false;
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Scheduler server listening on http://localhost:${PORT}`);
});
