import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const assetsDir = path.join(root, 'assets');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error('dist/index.html not found. Run `expo export --platform web` first.');
}

const copies = [
  ['apple-touch-icon.png', 'apple-touch-icon.png'],
  ['icon-192.png', 'icon-192.png'],
  ['icon-512.png', 'icon-512.png'],
  ['favicon.png', 'favicon.png'],
];

for (const [srcName, destName] of copies) {
  fs.copyFileSync(path.join(assetsDir, srcName), path.join(distDir, destName));
}

const manifest = {
  name: 'Lira',
  short_name: 'Lira',
  description: 'Lira — cycle tracking and care-box subscription',
  display: 'standalone',
  start_url: '/',
  scope: '/',
  background_color: '#FFFCF7',
  theme_color: '#FFFCF7',
  icons: [
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
    },
  ],
};

fs.writeFileSync(
  path.join(distDir, 'manifest.webmanifest'),
  JSON.stringify(manifest, null, 2),
);

let html = fs.readFileSync(indexPath, 'utf8');

const headInsert = `
    <meta name="application-name" content="Lira" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Lira" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#FFFCF7" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <script>
      // PWA self-heal: if the cached index.html references a JS bundle that no
      // longer exists on the server (after a redeploy), the page renders blank.
      // Detect an empty #root after the JS should have hydrated and reload with
      // a cache-bust to fetch the fresh index.html and bundle.
      (function(){
        var attempted = false;
        function bust(){
          if (attempted) return; attempted = true;
          try {
            if ('caches' in window) {
              caches.keys().then(function(keys){ keys.forEach(function(k){ caches.delete(k); }); });
            }
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(rs){ rs.forEach(function(r){ r.unregister(); }); });
            }
          } catch(e){}
          var u = new URL(window.location.href);
          u.searchParams.set('_v', Date.now().toString());
          window.location.replace(u.toString());
        }
        window.addEventListener('error', function(ev){
          var t = ev && ev.target;
          if (t && t.tagName === 'SCRIPT' && t.src && t.src.indexOf('/_expo/') !== -1) {
            bust();
          }
        }, true);
        setTimeout(function(){
          var root = document.getElementById('root');
          if (!root || root.children.length === 0) bust();
        }, 4000);
      })();
    </script>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function(){
          navigator.serviceWorker.register('/sw.js').catch(function(){});
        });
      }
    </script>
    <style id="lira-splash-style">
      #lira-splash {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #FFFCF7;
        color: #4A2E1F;
        font-family: Cochin, "Hoefler Text", "Times New Roman", Georgia, serif;
        transition: opacity 0.35s ease;
      }
      #lira-splash.fade { opacity: 0; pointer-events: none; }
      #lira-splash .lira-name {
        font-size: 56px;
        letter-spacing: 0.08em;
        line-height: 1;
        margin-bottom: 14px;
      }
      #lira-splash .lira-sub {
        font-size: 13px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #8E6F58;
        margin-bottom: 28px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      #lira-splash .lira-dots {
        display: flex;
        gap: 8px;
      }
      #lira-splash .lira-dots span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #C99275;
        opacity: 0.4;
        animation: lira-dot 1.1s infinite ease-in-out;
      }
      #lira-splash .lira-dots span:nth-child(2) { animation-delay: 0.18s; }
      #lira-splash .lira-dots span:nth-child(3) { animation-delay: 0.36s; }
      @keyframes lira-dot {
        0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
        40% { opacity: 1; transform: scale(1); }
      }
      #lira-splash .lira-hint {
        position: absolute;
        bottom: 32px;
        font-size: 12px;
        color: #B89880;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
    </style>
    <script>
      // Hide the inline splash as soon as React renders into #root.
      (function(){
        function hide(){
          var s = document.getElementById('lira-splash');
          if (!s) return;
          s.classList.add('fade');
          setTimeout(function(){ if (s.parentNode) s.parentNode.removeChild(s); }, 400);
        }
        function watch(){
          var root = document.getElementById('root');
          if (!root) return;
          if (root.children.length > 0) { hide(); return; }
          var mo = new MutationObserver(function(){
            if (root.children.length > 0) { hide(); mo.disconnect(); }
          });
          mo.observe(root, { childList: true });
        }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', watch);
        } else {
          watch();
        }
      })();
    </script>`;

if (!html.includes('apple-mobile-web-app-title')) {
  html = html.replace('<title>Lira</title>', `<title>Lira</title>${headInsert}`);
}

const splashMarkup = `    <div id="lira-splash">
      <div class="lira-name">Lira</div>
      <div class="lira-sub">cycle &amp; care</div>
      <div class="lira-dots"><span></span><span></span><span></span></div>
      <div class="lira-hint">Загружаем…</div>
    </div>`;

if (!html.includes('id="lira-splash"')) {
  // Place splash right after <body>, before #root, so it paints with the HTML.
  html = html.replace(
    /<div id="root">/,
    `${splashMarkup}\n    <div id="root">`,
  );
}

fs.writeFileSync(indexPath, html);

const swSource = `// Lira PWA service worker — network-first for navigation requests so the
// cached index.html never pins us to a stale JS bundle hash after redeploy.
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isNav || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(function(){ return new Response('', { status: 504 }); }));
  }
});
`;
fs.writeFileSync(path.join(distDir, 'sw.js'), swSource);

console.log('Post-processed dist for iOS home-screen metadata + PWA self-heal.');
