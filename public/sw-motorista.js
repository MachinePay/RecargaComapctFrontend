// Service worker do app do motorista. Existe para o Chrome do Android
// oferecer "Instalar app". Nao guarda nada em cache: tudo vem da rede, e sem
// internet a abertura do app mostra um aviso simples em vez da tela de erro.
const OFFLINE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CompactRecarga</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#070d0b;color:#eaf6ef;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><div style="font-size:48px">⚡</div><h1 style="font-size:22px">Sem internet</h1><p style="color:#93a89d">Conecte o celular a internet e abra o app de novo.</p></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
