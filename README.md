# Wataha Milicz — instrukcja wdrozenia (PWA)

Aplikacja jest skonfigurowana jako **Progressive Web App (PWA)** — uzytkownik moze ja
"zainstalowac" na telefonie z wlasna ikona, splash screenem i dzialaniem offline.

---

## 1. Struktura projektu

```
wataha-milicz/
├── index.html                    ← HTML entry (PWA meta + manifest)
├── package.json                  ← Vite + React
├── vite.config.js
├── push-server.js                ← (opcjonalnie) backend Web Push
├── public/
│   ├── manifest.webmanifest      ← konfiguracja PWA
│   ├── service-worker.js         ← SW: cache + push + notyfikacje
│   ├── icon-192.png              ← ikony aplikacji
│   ├── icon-512.png
│   ├── icon-192-maskable.png     ← maskable (Android adaptive)
│   ├── icon-512-maskable.png
│   ├── apple-touch-icon.png      ← iOS home screen
│   └── favicon-32.png
└── src/
    ├── App.jsx                   ← glowny komponent (przeklej zawartosc wataha-v9.jsx)
    └── main.jsx                  ← React root
```

---

## 2. Instalacja i uruchomienie lokalnie

```bash
npm install
npm run dev
# → http://localhost:5173
```

**Wazne:** Service Worker dziala tylko na **HTTPS** lub na `localhost`.
W przegladarce na komputerze przejdziesz przez DevTools → Application → Manifest,
zeby sprawdzic czy PWA jest poprawnie wykryta.

---

## 3. Build produkcyjny

```bash
npm run build
# → wynik w katalogu dist/
```

Skopiuj zawartosc `dist/` na serwer (Nginx / Apache / Vercel / Netlify / itp).

### Wazna konfiguracja serwera

Service Worker MUSI byc serwowany z naglowkiem `Content-Type: application/javascript`
**i koniecznie z scope `/`**. Domyslny build Vite to zalatwia, ale uwazaj na CDN-y,
ktore moga go "zoptymalizowac".

**Cache-Control dla SW** — ustaw `no-cache` na `service-worker.js`, zeby aktualizacje
trafialy do uzytkownikow szybko:

#### Nginx
```nginx
location = /service-worker.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

#### Vercel (`vercel.json`)
```json
{
  "headers": [
    { "source": "/service-worker.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
  ]
}
```

#### Netlify (`_headers`)
```
/service-worker.js
  Cache-Control: no-cache
```

---

## 4. Instalacja na telefonie

Po wejsciu na strone HTTPS:

- **Android Chrome:** aplikacja sama pokazuje **baner instalacji** (`beforeinstallprompt`).
  Uzytkownik widzi pasek "Zainstaluj Watahe" w aplikacji + opcje "Dodaj do ekranu glownego"
  w menu przegladarki.
- **iOS Safari:** Apple nie wspiera `beforeinstallprompt`. Uzytkownik musi recznie:
  Udostepnij → "Dodaj do ekranu poczatkowego". Ikona i nazwa juz sa skonfigurowane.

---

## 5. Powiadomienia push — JAK TO DZIALA

Aplikacja ma **dwa rodzaje** powiadomien:

### A) Notyfikacje lokalne (juz dzialaja)

Po zalogowaniu aplikacja prosi o zgode na powiadomienia.
Kazde nowe `data.notifs[0]` (np. dodana ustawka, wyscig, broadcast z panelu admina)
od razu wywoluje **systemowa notyfikacje** na telefonie — nawet gdy aplikacja jest w tle.

To dziala **bez serwera** — wystarczy zainstalowana PWA i zgoda od uzytkownika.

### B) Push notifications z serwera (wymagaja backendu)

Jesli chcesz wysylac powiadomienia gdy aplikacja jest **calkowicie zamknieta**,
potrzebujesz Web Push z VAPID:

#### Krok 1: Wygeneruj klucze VAPID (raz)

```bash
npx web-push generate-vapid-keys
# zapisz oba klucze!
```

#### Krok 2: Uruchom serwer push

```bash
cd /sciezka/do/wataha-milicz
npm install web-push express cors
VAPID_PUBLIC=BPx... VAPID_PRIVATE=Lw... node push-server.js
# → :4000
```

#### Krok 3: Subskrypcja w aplikacji

Aplikacja po zalogowaniu sie i przyznaniu zgody na notyfikacje powinna jeszcze
zasubskrybowac uzytkownika. Dodaj do `App.jsx` w `useEffect` po loginie:

```js
async function subscribePush(user) {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  if (Notification.permission !== "granted") return;

  const { key } = await fetch("https://twoj-serwer.pl/api/vapid-key").then(r => r.json());

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });

  await fetch("https://twoj-serwer.pl/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...sub.toJSON(), userId: user.id }),
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
```

#### Krok 4: Wysylanie

```bash
curl -X POST https://twoj-serwer.pl/api/send \
  -H "Content-Type: application/json" \
  -d '{"title":"Nowy Coffee Ride!","body":"Sobota 7:00 — 65 km","url":"/"}'
```

W `AdminScreen` mozna podpiac to pod przycisk "Wyslij do wszystkich" — zamiast
dodawac tylko do `data.notifs`, dodatkowo wywolaj `fetch` do `/api/send`.

---

## 6. Co jest w SW (`public/service-worker.js`)

- **install** — pre-cache app shell (HTML, manifest, ikony)
- **activate** — czysci stare cache'e
- **fetch** — *stale-while-revalidate* dla zasobow same-origin (offline first)
- **push** — odbiera powiadomienia z serwera i pokazuje native notyfikacje
- **notificationclick** — focus istniejacego okna lub otwarcie nowego po tapnieciu

Pamietaj: po kazdej zmianie SW lub manifestu **trzeba odswiezyc strone dwukrotnie**
albo wymusic update przez DevTools → Application → Service Workers → Update.

---

## 7. HTTPS — wymog dla PWA

Bez HTTPS nie dziala:
- Service Worker
- Web Push
- Powiadomienia
- Instalacja PWA

Najszybsze opcje:
- **Vercel** / **Netlify** — darmowy HTTPS automatycznie
- **Cloudflare Pages** — darmowy HTTPS
- Wlasny VPS + **Caddy** lub **Nginx + Let's Encrypt**

---

## 8. Czy moge ostatecznie sprawdzic, czy wszystko dziala?

Tak — w Chrome DevTools:

1. **F12 → Application → Manifest** — powinno byc zielone, bez bledow.
2. **F12 → Application → Service Workers** — status `activated and running`.
3. **F12 → Application → Storage** — Cache Storage zawiera `wataha-cache-v1`.
4. **Lighthouse → PWA** — celowac w wynik 100.

Z poziomu telefonu po dodaniu do ekranu glownego — ikonka powinna byc czarno-czerwona
z paw print Watahy, bez paska adresowego, ze splash screenem.

---

## TL;DR

```bash
npm install
npm run dev          # rozwoj
npm run build        # produkcja → dist/
# wgraj dist/ na serwer HTTPS
```

Notyfikacje lokalne dzialaja od razu. Push server tylko jesli chcesz wysylac
powiadomienia z poziomu serwera (np. broadcast do wszystkich uzytkownikow).
