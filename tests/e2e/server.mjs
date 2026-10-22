// ============================================================================
//  STATISK SERVER FOR NETTLESERTESTENE (v7.13)
// ----------------------------------------------------------------------------
//  Appen har ingen byggesteg, så testene trenger bare filene servert fra
//  prosjektmappa på localhost (der emulatorbryteren kan slå inn). Uten
//  mellomlager, så en endring i koden alltid er det testen ser.
// ============================================================================
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROT = fileURLToPath(new URL("../../", import.meta.url));
const PORT = Number(process.env.E2E_PORT || 8099);
const TYPER = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};

createServer(async (req, res) => {
  try {
    const sti = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let fil = normalize(join(ROT, sti === "/" ? "index.html" : sti));
    if (!fil.startsWith(ROT) || fil.includes(`${sep}git ignore${sep}`) || fil.includes(`${sep}json files${sep}`)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(fil);
    res.writeHead(200, { "content-type": TYPER[extname(fil)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT, "127.0.0.1", () => console.log(`e2e-server på http://localhost:${PORT}`));
