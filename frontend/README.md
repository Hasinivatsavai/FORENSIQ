# FORENSIQ frontend

The React interface talks to the FastAPI backend at the same origin under `/api`. In the full ZIP, run `npm ci` and `npm run dev` at the **project root** to start the UI, API and persistent SQLite storage together. The commands below are for frontend-only development with an independently running API.

From this directory, use Node 22.12+ or a supported newer LTS.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. The dev server proxies `/api` to `http://127.0.0.1:8000`. To change it, set `API_TARGET` in the dev server environment. With the API running, choose **Create account** on the opening screen or sign in with an existing account. Both forms establish a server-side session.

Run `npm run build` for optimized static files in `dist/`. In a split deployment, serve `/api/*` through the same public origin. The root project Dockerfile does this automatically. Static-only hosting cannot process sign-ins or persist evidence.

| Source | Responsibility |
| --- | --- |
| `src/main.jsx` | Session restoration, theme persistence, sign-out and the authentication-success animation |
| `src/Login.jsx`, `src/Identity.jsx`, `src/styles.css` | Accessible sign-in and account creation forms, theme controls, entry typography and layout |
| `src/api.js` | Same-origin API calls, CSRF request header, structured error handling and file responses |
| `src/motion/` | SVG plate, optical loupe, local image textures, pointer input, WebGL pigment field and fallback |
| `src/workspace/` | Navigation, dashboard, registers, details, access management and case workflows |
| `public/art/`, `public/fonts/` | Locally served visual assets and font licenses |

See `src/motion/README.md` for the animation source map.

Run `npm test` for the React interaction suite. `src/workspace/Dossier.jsx` renders an audited report snapshot, with print layout in `src/workspace/dossier.css`. The downloadable archives also include the production build in `dist/`.
