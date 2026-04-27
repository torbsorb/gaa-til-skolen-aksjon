# Frontend (Static Archive Mode)

This frontend can now run as a fully static archive after the competition.

## Run locally

```bash
npm install
npm run dev
```

## Build static site

```bash
npm run build
```

The build output can be hosted on any static host (Cloudflare Pages, GitHub Pages, Netlify, Render Static Site).

## Frozen results source

The app reads archived data from:

- `public/frozen-results.json`

Expected top-level keys:

- `metadata`
- `app_config`
- `classes`
- `standings`
- `results_table` (`table`, `edit_counts`, `base_date`)
- `logos`

Teacher/admin routes are intentionally locked and show an archive message.

## Export final results from backend DB

Before shutting down backend/Postgres, export final data:

```bash
cd backend
python scripts/export_frozen_results.py
```

This writes `frontend/public/frozen-results.json`.
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
