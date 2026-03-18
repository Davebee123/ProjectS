import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { validateBundle } from "../shared/content/validation";
import type { GameContentBundle } from "../shared/content/types";
import { loadContentSource, buildBundleFromSource, validateBuiltBundle } from "../tools/content/pipeline";
import { writeContentSourceFromBundle, writeRuntimeBundleFromSource } from "../tools/content/source-writer";

const repoRoot = path.resolve(__dirname, "..");

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function contentBridgePlugin(): Plugin {
  return {
    name: "content-bridge",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/content/")) {
          next();
          return;
        }

        try {
          if (req.method === "GET" && req.url === "/api/content/status") {
            sendJson(res, 200, { ok: true, mode: "local-files" });
            return;
          }

          if (req.method === "GET" && req.url === "/api/content/bundle") {
            const source = await loadContentSource(repoRoot);
            const issues = validateBuiltBundle(source);
            const bundle = buildBundleFromSource(source);
            sendJson(res, 200, { ok: true, bundle, issues });
            return;
          }

          if (req.method === "POST" && req.url === "/api/content/save") {
            const raw = await readBody(req);
            const bundle = JSON.parse(raw) as GameContentBundle;
            const issues = validateBundle(bundle);
            const errors = issues.filter((issue) => issue.severity === "error");

            if (errors.length > 0) {
              sendJson(res, 400, { ok: false, issues });
              return;
            }

            await writeContentSourceFromBundle(bundle, repoRoot);
            const runtimeBundle = await writeRuntimeBundleFromSource(repoRoot);
            const source = await loadContentSource(repoRoot);
            const postIssues = validateBuiltBundle(source);
            sendJson(res, 200, {
              ok: true,
              issues: postIssues,
              bundle: runtimeBundle,
            });
            return;
          }

          sendJson(res, 404, { ok: false, message: "Not found" });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), contentBridgePlugin()],
  server: {
    port: 5174,
    host: "127.0.0.1",
    fs: {
      allow: [".."],
    },
  },
});
