const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const REPO = 'Saranraj-dev007/Hangly-Win';
const TAG = 'v1.0.0';

function apiRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function uploadAsset(uploadUrlRaw, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const cleanUrl = uploadUrlRaw.split('{')[0] + `?name=${encodeURIComponent(fileName)}`;
    const urlObj = new URL(cleanUrl);
    const stat = fs.statSync(filePath);

    console.log(`Uploading ${fileName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);

    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'Hangly-Win-Release-Script',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Upload finished for ${fileName}: Status ${res.statusCode}`);
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(req);
  });
}

async function main() {
  console.log(`Creating release ${TAG} for ${REPO}...`);

  const releasePayload = {
    tag_name: TAG,
    target_commitish: 'main',
    name: 'Hangly-Win v1.0.0',
    body: [
      '# 🧿 Hangly-Win v1.0.0 — Official Windows Desktop App',
      '',
      'A lightweight, physics-based desktop decoration app for Windows 10 & 11.',
      'Traditional charms swing, sway, and interact at the top of your screen.',
      '',
      '## 📥 Downloads',
      '- **Installer (Recommended)**: [Hangly-Win-1.0.0-Setup.exe](https://github.com/Saranraj-dev007/Hangly-Win/releases/download/v1.0.0/Hangly-Win-1.0.0-Setup.exe)',
      '- **Standalone Portable**: [Hangly-Win-Portable.exe](https://github.com/Saranraj-dev007/Hangly-Win/releases/download/v1.0.0/Hangly-Win-Portable.exe)',
      '',
      '## ✨ Included Charms',
      '- 🧿 **Nazar Boncuğu** (Turkish Evil Eye)',
      '- 🪬 **Hamsa Hand** (Protective Amulet)',
      '- 🍋 **Nimbu-Mirchi** (Lemon & Green Chili Protection Charm)',
      '- 🔔 **Temple Bell / Ghanta** (Sacred Brass Bell)',
      '',
      '## 🎮 Key Features',
      '- **Realistic 2D Physics**: Real pendulum swinging, momentum inertia, and charm collisions powered by Matter.js.',
      '- **Interactive**: Left-click and drag charms; throw them across the screen; right-click charms for instant actions.',
      '- **Clean Transparent Overlay**: Floating unobtrusively at the top of your display with full click-through optimization.',
      '- **System Tray Control**: Quick toggles for overlay visibility, physics intensity, charm additions, and full settings dashboard.',
      '- **Auto-Start**: Optional start with Windows on login.'
    ].join('\n'),
    draft: false,
    prerelease: false
  };

  const createRes = await apiRequest({
    hostname: 'api.github.com',
    path: `/repos/${REPO}/releases`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'User-Agent': 'Hangly-Win-Release-Script',
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    }
  }, releasePayload);

  if (createRes.status !== 201) {
    console.error('Failed to create release:', createRes.status, createRes.body);
    process.exit(1);
  }

  const release = createRes.body;
  console.log(`Release created: ${release.html_url}`);
  console.log(`Upload URL: ${release.upload_url}`);

  const setupPath = path.join(__dirname, '..', 'dist', 'Hangly-Win-1.0.0-Setup.exe');
  const portablePath = path.join(__dirname, '..', 'dist', 'Hangly-Win-Portable.exe');

  if (fs.existsSync(setupPath)) {
    await uploadAsset(release.upload_url, setupPath, 'Hangly-Win-1.0.0-Setup.exe');
  } else {
    console.warn(`Setup file not found: ${setupPath}`);
  }

  if (fs.existsSync(portablePath)) {
    await uploadAsset(release.upload_url, portablePath, 'Hangly-Win-Portable.exe');
  } else {
    console.warn(`Portable file not found: ${portablePath}`);
  }

  console.log('All release assets uploaded successfully!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
