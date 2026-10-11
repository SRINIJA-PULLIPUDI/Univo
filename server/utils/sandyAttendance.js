const https = require("https");

async function fetchSandyAttendance({ rollNumber, password, campus = "ACET" }) {
  if (!rollNumber || !password) {
    throw new Error("Roll Number and Password are required for Sandy Attendance portal");
  }

  const payload = JSON.stringify({
    rollNumber: rollNumber.trim().toUpperCase(),
    password,
    campus: campus || "ACET",
    turnstileToken: null,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://attendance-api.sandyy.in/api/verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Origin": "https://attendance.sandyy.in",
          "Referer": "https://attendance.sandyy.in/",
        },
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            try {
              const errJson = JSON.parse(data);
              return reject(new Error(errJson.message || `Sandy portal error (HTTP ${res.statusCode})`));
            } catch (_) {
              return reject(new Error(`Sandy portal returned HTTP ${res.statusCode}`));
            }
          }

          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (err) {
            reject(new Error("Invalid JSON response from Sandy attendance portal"));
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout connecting to Sandy attendance portal"));
    });

    req.on("error", (err) => {
      reject(new Error(`Could not connect to Sandy attendance portal: ${err.message}`));
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  fetchSandyAttendance,
};
