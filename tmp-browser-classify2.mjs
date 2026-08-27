import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
// dismiss boot
await page.evaluate(() => {
  try { sessionStorage.setItem("commitdex-booted", "1"); } catch {}
  document.documentElement.removeAttribute("data-boot");
});
await page.waitForTimeout(300);
await page.locator("#commit-message").click();
await page.keyboard.type("fix: please work this time", { delay: 15 });
const mid = await page.evaluate(() => ({
  val: document.querySelector("#commit-message")?.value,
  disabled: document.querySelector('form.prompt button[type="submit"]')?.disabled,
  boot: document.documentElement.dataset.boot ?? null,
}));
console.log("mid", JSON.stringify(mid));

const apiPromise = page.waitForResponse((r) => r.url().includes("/api/classify"), { timeout: 60000 });
await page.locator('form.prompt button[type="submit"]').first().click();
const during = await page.evaluate(() => ({
  bay: !!document.querySelector(".print-bay"),
  busy: document.querySelector('form.prompt button[type="submit"]')?.getAttribute("aria-busy"),
}));
const res = await apiPromise;
const body = await res.text();
console.log("api", res.status(), body.slice(0, 400));

await Promise.race([
  page.waitForSelector(".dex-card", { timeout: 20000 }),
  page.waitForSelector(".prompt__error", { timeout: 20000 }),
]);
await page.waitForTimeout(1400);

const after = await page.evaluate(() => {
  const card = document.querySelector(".dex-card");
  const pack = document.querySelector(".card-pack");
  let cardBox = null, frontBox = null, backBox = null;
  if (card) cardBox = card.getBoundingClientRect();
  if (pack) {
    frontBox = pack.querySelector(".card-pack__face--front")?.getBoundingClientRect();
    backBox = pack.querySelector(".card-pack__face--back")?.getBoundingClientRect();
  }
  return {
    name: document.querySelector(".dex-card__name")?.textContent ?? null,
    flavor: document.querySelector(".dex-card__flavor")?.textContent ?? null,
    err: document.querySelector(".prompt__error")?.textContent ?? null,
    bay: !!document.querySelector(".print-bay"),
    empty: !!document.querySelector(".tray-empty"),
    hasCard: !!card,
    cardBox,
    frontBox,
    backBox,
    motion: pack?.getAttribute("data-motion") ?? null,
    nameLen: (document.querySelector(".dex-card__name")?.textContent ?? "").length,
  };
});
await page.screenshot({ path: "tmp-classify-browser.png" });
console.log("after", JSON.stringify(after, null, 2));
await browser.close();
