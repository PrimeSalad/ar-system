import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distPath = path.resolve(packageRoot, "dist");

if (path.dirname(distPath) !== packageRoot || path.basename(distPath) !== "dist") {
  throw new Error(`Refusing to clean unexpected path: ${distPath}`);
}

rmSync(distPath, { recursive: true, force: true });
