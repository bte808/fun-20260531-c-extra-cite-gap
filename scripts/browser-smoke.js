import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGET_URL = process.env.CITE_GAP_URL || "http://localhost:5201/index.html";
const screenshots = {
  desktop: join(tmpdir(), "cite-gap-desktop.png"),
  mobile: join(tmpdir(), "cite-gap-mobile.png")
};

async function main() {
  const chromePath = findChrome();
  const port = 9300 + Math.floor(Math.random() * 500);
  const profileDir = await mkdtemp(join(tmpdir(), "cite-gap-chrome-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ], {
    stdio: "ignore"
  });

  try {
    await waitForDebugPort(port);
    const desktop = await runScenario({
      port,
      width: 1280,
      height: 900,
      mobile: false,
      screenshotPath: screenshots.desktop
    });
    const mobile = await runScenario({
      port,
      width: 390,
      height: 844,
      mobile: true,
      screenshotPath: screenshots.mobile
    });

    assert.equal(desktop.title, "Cite Gap Audit");
    assert.equal(desktop.missingKeys, 1);
    assert.equal(desktop.unusedKeys, 1);
    assert.ok(desktop.report.includes("lost2026"));
    assert.ok(desktop.sourceChecks >= 1);
    assert.ok(mobile.horizontalOverflow <= 1, `mobile overflow: ${mobile.horizontalOverflow}px`);
    assert.ok(mobile.visibleButtons >= 3, "mobile controls should remain visible");

    console.log(JSON.stringify({
      ok: true,
      desktop,
      mobile,
      screenshots
    }, null, 2));
  } finally {
    chrome.kill("SIGTERM");
    await rm(profileDir, { recursive: true, force: true });
  }
}

async function runScenario({ port, width, height, mobile, screenshotPath }) {
  const tab = await createTab(port, TARGET_URL);
  const cdp = new CdpSession(tab.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile
  });
  await cdp.navigate(TARGET_URL);
  await cdp.evaluate("document.fonts && document.fonts.ready");
  await cdp.evaluate(`
    (() => {
      document.querySelector("#clear").click();
      document.querySelector("#draft").value = [
        "Supported note \\\\cite{ok2024}.",
        "A synthetic method improves recall by 12 percent across 44 practice sessions.",
        "A missing key appears here \\\\cite{lost2026}."
      ].join("\\n\\n");
      document.querySelector("#references").value = "@article{ok2024,\\n}\\n- [unused2020] Unused synthetic source";
      document.querySelector("#analyze").click();
    })()
  `);
  await cdp.sleep(120);

  const result = await cdp.evaluate(`
    (() => {
      const readMetric = (label) => {
        const metric = Array.from(document.querySelectorAll(".metric")).find((node) => node.textContent.includes(label));
        return metric ? Number(metric.querySelector("strong").textContent) : -1;
      };
      const html = document.documentElement;
      const body = document.body;
      return {
        title: document.title,
        score: Number(document.querySelector("#score-value").textContent),
        missingKeys: readMetric("Missing refs"),
        unusedKeys: readMetric("Unused refs"),
        sourceChecks: readMetric("Source checks"),
        report: document.querySelector("#markdown-output").value,
        status: document.querySelector("#status-line").textContent,
        visibleButtons: Array.from(document.querySelectorAll("button")).filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
        }).length,
        clientWidth: html.clientWidth,
        scrollWidth: Math.max(html.scrollWidth, body.scrollWidth),
        horizontalOverflow: Math.max(html.scrollWidth, body.scrollWidth) - html.clientWidth
      };
    })()
  `);

  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
  await cdp.close();
  return result;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);

  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new Error("Chrome-compatible browser not found. Set CHROME_PATH to run browser smoke verification.");
  }
  return found;
}

async function waitForDebugPort(portNumber) {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const response = await fetch(`http://localhost:${portNumber}/json/version`);
      if (response.ok) return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Chrome DevTools port did not become ready.");
}

async function createTab(portNumber, url) {
  const response = await fetch(`http://localhost:${portNumber}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT"
  });
  assert.equal(response.ok, true, `Unable to create tab: ${response.status}`);
  return response.json();
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
  }

  open() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
      this.ws.addEventListener("message", (event) => this.handleMessage(event.data));
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 8000);
    });
  }

  async navigate(url) {
    const loaded = this.waitForEvent("Page.loadEventFired");
    await this.send("Page.navigate", { url });
    await loaded;
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
    }
    return result.result.value;
  }

  waitForEvent(method) {
    return new Promise((resolve) => {
      const waiters = this.events.get(method) || [];
      waiters.push(resolve);
      this.events.set(method, waiters);
    });
  }

  sleep(ms) {
    return sleep(ms);
  }

  close() {
    this.ws.close();
  }

  handleMessage(raw) {
    const message = JSON.parse(raw);
    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
      return;
    }

    const waiters = this.events.get(message.method);
    if (waiters && waiters.length) {
      const resolve = waiters.shift();
      resolve(message.params || {});
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
