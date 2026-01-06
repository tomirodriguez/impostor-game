import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#e94560"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="160" fill="none" stroke="url(#accent)" stroke-width="24"/>
  <text x="256" y="310" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="220" font-weight="900" fill="url(#accent)">?</text>
  <circle cx="320" cy="180" r="24" fill="#e94560"/>
</svg>`;

const sizes = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon.ico', size: 32 },
];

async function generateIcons() {
  const svgBuffer = Buffer.from(svgContent);
  
  for (const { name, size } of sizes) {
    const outputPath = join(publicDir, name);
    
    if (name.endsWith('.ico')) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath.replace('.ico', '.png'));
      console.log(`Generated: ${name.replace('.ico', '.png')} (${size}x${size})`);
    } else {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`Generated: ${name} (${size}x${size})`);
    }
  }
  
  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
