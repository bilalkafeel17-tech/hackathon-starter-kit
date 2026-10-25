import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

// Unicode ranges covering standard emoji blocks
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE0F}]/u;

let hasEmoji = false;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(tsx?|jsx?|css|html|json)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (EMOJI_REGEX.test(line)) {
          console.error(`Emoji detected in ${fullPath}:${index + 1} -> ${line.trim()}`);
          hasEmoji = true;
        }
      });
    }
  }
}

scanDir(srcDir);

if (hasEmoji) {
  console.error('Emoji check failed: found emojis in client/src');
  process.exit(1);
} else {
  console.log('Emoji check passed: no emojis found in client/src');
  process.exit(0);
}
