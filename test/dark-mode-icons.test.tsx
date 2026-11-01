import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import sharp from "sharp";

describe("Dark Mode Icons & iOS Assets Verification", () => {
  const publicDir = path.resolve(process.cwd(), "public");
  const layoutPath = path.resolve(process.cwd(), "src/app/layout.tsx");

  it("verifies public/logo-icon-dark.png exists and matches logo-dark.png dominant color", async () => {
    const darkLogoPath = path.join(publicDir, "logo-dark.png");
    const darkIconPath = path.join(publicDir, "logo-icon-dark.png");

    expect(fs.existsSync(darkIconPath)).toBe(true);

    const logoDarkImg = await sharp(darkLogoPath).raw().toBuffer({ resolveWithObject: true });
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let i = 0; i < logoDarkImg.data.length; i += 4) {
      if (logoDarkImg.data[i + 3] > 240) {
        rSum += logoDarkImg.data[i];
        gSum += logoDarkImg.data[i + 1];
        bSum += logoDarkImg.data[i + 2];
        count++;
      }
    }
    const expectedR = Math.round(rSum / count);
    const expectedG = Math.round(gSum / count);
    const expectedB = Math.round(bSum / count);

    const darkIconImg = await sharp(darkIconPath).raw().toBuffer({ resolveWithObject: true });
    let iconRSum = 0, iconGSum = 0, iconBSum = 0, iconCount = 0;
    for (let i = 0; i < darkIconImg.data.length; i += 4) {
      if (darkIconImg.data[i + 3] > 240) {
        iconRSum += darkIconImg.data[i];
        iconGSum += darkIconImg.data[i + 1];
        iconBSum += darkIconImg.data[i + 2];
        iconCount++;
      }
    }
    const actualR = Math.round(iconRSum / iconCount);
    const actualG = Math.round(iconGSum / iconCount);
    const actualB = Math.round(iconBSum / iconCount);

    expect(Math.abs(actualR - expectedR)).toBeLessThanOrEqual(2);
    expect(Math.abs(actualG - expectedG)).toBeLessThanOrEqual(2);
    expect(Math.abs(actualB - expectedB)).toBeLessThanOrEqual(2);
  });

  it("verifies iOS apple-icon.png is 180x180 and has dark background with high contrast logo", async () => {
    const appleIconPath = path.join(publicDir, "apple-icon.png");
    expect(fs.existsSync(appleIconPath)).toBe(true);

    const meta = await sharp(appleIconPath).metadata();
    expect(meta.width).toBe(180);
    expect(meta.height).toBe(180);

    const { data } = await sharp(appleIconPath).raw().toBuffer({ resolveWithObject: true });
    // Corner pixel should be dark background (#161d19)
    const bgR = data[0], bgG = data[1], bgB = data[2];
    expect(bgR).toBeLessThan(40);
    expect(bgG).toBeLessThan(40);
    expect(bgB).toBeLessThan(40);

    // Center pixel should be vibrant emerald green (R around 48, G around 183, B around 133)
    let foundLogoPixel = false;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 1] > 160 && data[i] > 30 && data[i] < 70) {
        foundLogoPixel = true;
        break;
      }
    }
    expect(foundLogoPixel).toBe(true);
  });

  it("verifies favicon-dark.ico exists in public and src/app with valid ICO structure and dark mode colors", async () => {
    const pubFaviconDark = path.join(publicDir, "favicon-dark.ico");
    const srcFaviconDark = path.resolve(process.cwd(), "src/app/favicon-dark.ico");

    expect(fs.existsSync(pubFaviconDark)).toBe(true);
    expect(fs.existsSync(srcFaviconDark)).toBe(true);

    const buf = fs.readFileSync(pubFaviconDark);
    expect(buf.readUInt16LE(0)).toBe(0); // Reserved
    expect(buf.readUInt16LE(2)).toBe(1); // ICO type
    const count = buf.readUInt16LE(4);
    expect(count).toBe(3); // 16x16, 32x32, 48x48

    // Read the 32x32 embedded image
    const offset = 6 + 1 * 16;
    expect(buf[offset]).toBe(32);
    expect(buf[offset + 1]).toBe(32);
    const size = buf.readUInt32LE(offset + 8);
    const imgOffset = buf.readUInt32LE(offset + 12);
    const data = buf.subarray(imgOffset, imgOffset + size);

    const img = await sharp(data).raw().toBuffer({ resolveWithObject: true });
    let rSum = 0, gSum = 0, bSum = 0, c = 0;
    for (let j = 0; j < img.data.length; j += 4) {
      if (img.data[j + 3] > 150) {
        rSum += img.data[j];
        gSum += img.data[j + 1];
        bSum += img.data[j + 2];
        c++;
      }
    }
    const r = Math.round(rSum / c);
    const g = Math.round(gSum / c);
    const b = Math.round(bSum / c);

    // Expect vibrant emerald green matching logo-dark.png (~48, ~184, ~134)
    expect(r).toBeGreaterThanOrEqual(40);
    expect(r).toBeLessThanOrEqual(60);
    expect(g).toBeGreaterThanOrEqual(170);
    expect(g).toBeLessThanOrEqual(200);
    expect(b).toBeGreaterThanOrEqual(120);
    expect(b).toBeLessThanOrEqual(145);
  });

  it("verifies metadata.icons in layout.tsx declares both light and dark mode variants for icon, apple, and favicon", () => {
    expect(fs.existsSync(layoutPath)).toBe(true);
    const content = fs.readFileSync(layoutPath, "utf-8");

    expect(content).toContain('url: "/favicon.ico"');
    expect(content).toContain('url: "/favicon-dark.ico"');
    expect(content).toContain('url: "/icon.png"');
    expect(content).toContain('url: "/icon-dark.png"');
    expect(content).toContain('url: "/apple-icon.png"');
    expect(content).toContain('url: "/apple-icon-dark.png"');
    expect(content).toContain('(prefers-color-scheme: dark)');
  });
});
