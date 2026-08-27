import { toPng } from "html-to-image";

export async function downloadCardPng(node: HTMLElement, filename: string) {
  await document.fonts.ready;
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
