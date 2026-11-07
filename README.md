# maidMod

Portfolio page built to feel like a Quickshell desktop. Vanilla HTML, CSS and JS — no
dependencies, no build step.

## Layout

```
src/
  index.html      the page — edit and open this
  css/            styles
  js/app.js       behaviour
  assets/         fonts + wallpaper
```

## Running it

Open `src/index.html` directly in a browser:

```bash
xdg-open src/index.html
```

It works over `file://` — no server or build step needed.

If you ever want to serve it over HTTP instead:

```bash
python3 -m http.server 8000
```

then open <http://localhost:8000/src/>.
