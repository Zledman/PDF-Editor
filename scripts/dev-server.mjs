import net from 'node:net';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PDF_SERVER_PORT || 8082);
const HOST = '127.0.0.1';

const ARGS = new Set(process.argv.slice(2));
const SHOULD_RESTART = ARGS.has('--restart');
const SHOULD_HELP = ARGS.has('--help') || ARGS.has('-h');

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port });

    const finish = (listening) => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(listening);
    };

    socket.setTimeout(400);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(true)); // treat as "in use" to avoid double-start flakiness
    socket.once('error', (err) => {
      // ECONNREFUSED => nothing is listening.
      // EACCES can happen on locked-down environments; treat as "in use" to avoid printing scary Maven failures.
      if (err && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'EHOSTUNREACH')) {
        return finish(false);
      }
      return finish(true);
    });
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    // IMPORTANT (Windows): using `shell: true` will run through `cmd.exe` which
    // interprets `|`/`>` in PowerShell `-Command` strings. That breaks our PID
    // query (e.g. "Select-Object" gets treated as a separate cmd program).
    // Default to `shell: false` for correctness; callers can opt-in if needed.
    const child = spawn(cmd, args, { stdio: 'pipe', shell: false, ...opts });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => (out += d.toString()));
    child.stderr?.on('data', (d) => (err += d.toString()));
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code: code ?? 1, out, err }));
  });
}

async function killListenerOnPort(port) {
  if (process.platform !== 'win32') {
    throw new Error(
      `--restart is currently implemented for Windows only. Please stop the process on port ${port} manually and re-run.`
    );
  }

  // Find PID(s) listening on the port (PowerShell). This usually works without admin rights.
  const psCmd = [
    '-NoProfile',
    '-Command',
    `$p=${port}; ` +
    `$conns=Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; ` +
    `if(-not $conns){ exit 3 }; ` +
    `$pids=$conns | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique; ` +
    `$pids | ForEach-Object { Write-Output $_ }`,
  ];

  let res;
  try {
    res = await run('pwsh', psCmd);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      // pwsh not found, try powershell (Windows PowerShell)
      res = await run('powershell', psCmd);
    } else {
      throw err;
    }
  }
  if (res.code === 3) return { killed: false, pids: [] };
  if (res.code !== 0) {
    throw new Error(
      `Failed to query PID on port ${port}. ${res.err || res.out || `(exit ${res.code})`}`.trim()
    );
  }

  const pids = res.out
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!pids.length) return { killed: false, pids: [] };

  // Kill the PID(s).
  // Use taskkill for reliability on Windows, even if processes are owned by another terminal.
  for (const pid of pids) {
    const killRes = await run('taskkill', ['/PID', String(pid), '/F']);
    if (killRes.code !== 0) {
      throw new Error(
        `Failed to kill PID ${pid} on port ${port}. ${killRes.err || killRes.out || `(exit ${killRes.code})`}`.trim()
      );
    }
  }

  // Small wait to let the OS release the port.
  await new Promise((r) => setTimeout(r, 400));
  return { killed: true, pids };
}

try {
  if (SHOULD_HELP) {
    console.log('Usage: node scripts/dev-server.mjs [--restart]');
    console.log('');
    console.log('Options:');
    console.log('  --restart   If port is in use, stop the listener on that port first (Windows).');
    process.exit(0);
  }

  const inUse = await isPortListening(PORT);

  if (inUse && SHOULD_RESTART) {
    console.log(`[dev:server] Port ${PORT} is in use. Restart requested; stopping current listener...`);
    const { killed, pids } = await killListenerOnPort(PORT);
    if (killed) {
      console.log(`[dev:server] Stopped PID(s): ${pids.join(', ')}`);
    } else {
      console.log(`[dev:server] Port ${PORT} was in use, but no listener PID could be determined.`);
    }
  }

  const stillInUse = await isPortListening(PORT);

  if (stillInUse) {
    console.log(
      `[dev:server] Port ${PORT} is already in use. Assuming the Java server is already running. (No action taken)`
    );
    console.log(
      `[dev:server] If it is NOT your Spring Boot server, stop the process using the port and try again.`
    );
    process.exit(0);
  }

  console.log(`[dev:server] Starting Spring Boot on port ${PORT}...`);

  const mvn = spawn(
    'mvn',
    ['-DskipTests', `-Dspring-boot.run.arguments=--server.port=${PORT}`, 'spring-boot:run'],
    {
      cwd: 'server-java',
      stdio: 'inherit',
      shell: true,
    }
  );

  mvn.on('exit', (code) => process.exit(code ?? 1));
} catch (err) {
  console.error('[dev:server] Failed to start server:', err?.message || err);
  process.exit(1);
}


