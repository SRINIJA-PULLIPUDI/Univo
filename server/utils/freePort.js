const { execSync } = require("child_process");

const port = process.env.PORT || 5000;

function freePort(targetPort) {
  try {
    if (process.platform === "win32") {
      const output = execSync("netstat -ano -p tcp", { encoding: "utf8" });
      const lines = output.split("\n");
      const pids = new Set();
      for (const line of lines) {
        if (line.includes(`:${targetPort}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (pid && pid !== process.pid) {
            pids.add(pid);
          }
        }
      }
      if (pids.size === 0) {
        console.log(`[freePort] Port ${targetPort} is already free.`);
        return;
      }
      for (const pid of pids) {
        console.log(`[freePort] Terminating process PID ${pid} listening on port ${targetPort}...`);
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
          console.log(`[freePort] Successfully terminated PID ${pid}.`);
        } catch (e) {
          console.warn(`[freePort] Could not terminate PID ${pid}: ${e.message}`);
        }
      }
    } else {
      const output = execSync(`lsof -t -i:${targetPort}`, { encoding: "utf8" });
      const pids = output.trim().split("\n").filter(Boolean);
      for (const pidStr of pids) {
        const pid = parseInt(pidStr, 10);
        if (pid && pid !== process.pid) {
          console.log(`[freePort] Terminating process PID ${pid} on port ${targetPort}...`);
          try {
            process.kill(pid, "SIGKILL");
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.log(`[freePort] Port ${targetPort} is already free.`);
  }
}

if (require.main === module) {
  freePort(port);
}

module.exports = freePort;
