import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "multi-tenant-architecture.html");
const pdfPath = path.join(__dirname, "Dental-Booking-Platform-Architecture.pdf");

if (!fs.existsSync(htmlPath)) {
  console.error("HTML source not found:", htmlPath);
  process.exit(1);
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, {
    waitUntil: "networkidle0",
    timeout: 120000,
  });

  await page.waitForFunction(
    () => {
      const nodes = document.querySelectorAll("pre.mermaid");
      if (nodes.length === 0) return true;
      return [...nodes].every((n) => n.querySelector("svg") || n.getAttribute("data-processed") === "true");
    },
    { timeout: 90000 }
  );

  await new Promise((r) => setTimeout(r, 2000));

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" },
  });

  const stat = fs.statSync(pdfPath);
  console.log(`PDF written: ${pdfPath}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
} finally {
  await browser.close();
}
