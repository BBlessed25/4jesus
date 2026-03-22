# Eagles Nest — New Church Facility Volunteer Registration

Single-page volunteer registration site for **Eagles Nest Church** / **Gospel Pillars** — **Eagles Nest New Church Facility Project**.

Visitors can sign up to serve during the build (skills, availability Mon–Sat), and optionally note financial support via the published INTERAC details.

**Project window:** 23 March – 4 April  

## Stack

- [React](https://react.dev/) 19 · [Vite](https://vite.dev/) 8  
- [Tailwind CSS](https://tailwindcss.com/) 4  
- [React Router](https://reactrouter.com/) · [react-helmet-async](https://github.com/staylor/react-helmet-async) · [react-hot-toast](https://react-hot-toast.com/)

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173`).

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start dev server         |
| `npm run build`| Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint                   |

## Project layout

- `src/pages/RegistrationPage.jsx` — Hero, copy, form (volunteering + optional giving), footer  
- `src/App.jsx` — Layout, nav scroll to sections  
- `src/components/SEO.jsx` — Default meta title / description  
- `public/bg.png`, `public/logo2.jpeg` — Background and logo assets  

## Form submission

Submit currently shows a success toast only. To collect responses, connect `handleSubmit` in `RegistrationPage.jsx` to your backend, form API (e.g. Formspree), or church workflow.

## License / usage

Private project for church use; **© Gospel Pillars 2026**.
