import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

const api = [];
page.on("response", async (res) => {
  if (!res.url().includes("/api/classify")) return;
  let body = "";
  try { body = await res.text(); } catch {}
  api.push({ status: res.status(), body: body.slice(0, 500) });
});

await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("#commit-message");
await page.fill("#commit-message", "fix: please work this time");
await page.click('button[type="submit"]');

// Expect print bay
await page.waitForSelector(".print-bay", { timeout: 3000 }).catch(() => null);
const during = await page.evaluate(() => ({
  bay: !!document.querySelector(".print-bay"),
  busy: document.querySelector('button[type="submit"]')?.getAttribute("aria-busy"),
  err: document.querySelector(".prompt__error")?.textContent ?? null,
}));

// Wait for either card or error (ritual floor 5s + api)
await Promise.race([
  page.waitForSelector(".dex-card", { timeout: 25000 }),
  page.waitForSelector(".prompt__error", { timeout: 25000 }),
]);

await page.waitForTimeout(1200); // allow pack animation

const after = await page.evaluate(() => {
  const card = document.querySelector(".dex-card");
  const pack = document.querySelector(".card-pack");
  const name = document.querySelector(".dex-card__name")?.textContent ?? null;
  const flavor = document.querySelector(".dex-card__flavor")?.textContent ?? null;
  const err = document.querySelector(".prompt__error")?.textContent ?? null;
  const bay = !!document.querySelector(".print-bay");
  const empty = !!document.querySelector(".tray-empty");
  let cardVisible = false;
  if (card) {
    const r = card.getBoundingClientRect();
    const style = getComputedStyle(card);
    cardVisible = r.width > 40 && r.height > 40 && style.visibility !== "hidden" && style.opacity !== "0";
  }
  let packInfo = null;
  if (pack) {
    const rig = pack.querySelector(".card-pack__rig");
    const front = pack.querySelector(".card-pack__face--front");
    const back = pack.querySelector(".card-pack__face--back");
    packInfo = {
      motion: pack.getAttribute("data-motion"),
      rigTransform: rig ? getComputedStyle(rig).transform : null,
      frontTransform: front ? getComputedStyle(front).transform : null,
      backTransform: back ? getComputedStyle(back).transform : null,
      frontOpacity: front ? getComputedStyle(front).opacity : null,
      packRect: pack.getBoundingClientRect(),
    };
  }
  return { name, flavor, err, bay, empty, cardVisible, hasCard: !!card, packInfo, statusBtn: document.querySelector('button[type="submit"]')?.getAttribute("data-state") };
});

await page.screenshot({ path: "tmp-classify-browser.png", fullPage: false });
console.log(JSON.stringify({ during, after, api, logs: logs.slice(0, 20) }, null, 2));
await browser.close();
