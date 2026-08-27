import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll("#commit-message, input.prompt__input, form.prompt")];
  const buttons = [...document.querySelectorAll('button[type="submit"], .btn')].map((b) => ({
    text: b.textContent?.trim(),
    disabled: b.disabled,
    busy: b.getAttribute("aria-busy"),
    state: b.getAttribute("data-state"),
    cls: b.className,
    inPrompt: !!b.closest("form.prompt"),
    visible: b.getBoundingClientRect().height > 0,
  }));
  const prompts = [...document.querySelectorAll("form.prompt")].map((f, i) => {
    const input = f.querySelector("input");
    return {
      i,
      inputId: input?.id,
      value: input?.value,
      disabled: input?.disabled,
      rect: input?.getBoundingClientRect(),
    };
  });
  const boot = document.querySelector("[data-boot], .boot-overlay, #boot");
  return {
    inputCount: document.querySelectorAll("#commit-message").length,
    promptCount: document.querySelectorAll("form.prompt").length,
    prompts,
    buttons: buttons.filter((b) => /print|scan|submit/i.test(b.text || "") || b.inPrompt),
    boot: boot ? { tag: boot.tagName, html: boot.outerHTML.slice(0, 200) } : null,
    bodyBoot: document.documentElement.dataset.boot,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
