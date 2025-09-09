# AI Chat App

A lightweight, **Angular + TailwindCSS** web application that lets you chat with OpenAI models through a clean, responsive UI.  
Built for speed, extendability and developer friendliness.

![AI Chat App UI](./docs/screenshot-main.png)

---

## ✨ Features

- Prompt input with `Enter` to send / `Shift + Enter` for new-lines
- Real-time or streaming AI responses (toggleable)
- Persistent chat history stored in `localStorage`
- “Clear chat” & “New conversation” actions
- Dark-/Light-mode switch
- Token & cost counters, storage usage indicator
- Import / Export conversations (JSON)
- Fully responsive mobile-first layout powered by TailwindCSS
- Robust error & loading states, retry last message
- Configurable OpenAI model (defaults to `gpt-4`)

Bonus:

- Local favorites / archive flag per conversation
- Keyboard accessibility & ARIA-labels
- Ready for further extension (multiple back-ends, theming, i18n…)

---

## 🔧 Prerequisites

| Tool              | Version (min) |
| ----------------- | ------------- |
| Node.js           | 18 LTS        |
| npm / pnpm / yarn | latest        |
| Angular CLI       | 17.x          |
| Git               | any           |

---

## 🚀 Getting Started

```bash
# 1. clone repository
git clone https://github.com/your-username/ai-chat-app.git
cd ai-chat-app

# 2. install dependencies
npm ci     # or yarn / pnpm

# 3. configure environment (see below)

# 4. run development server
npm start            # alias to: ng serve --open
```

The app is now available on <http://localhost:4200> and will reload on file changes.

---

## ⚙️ Environment Configuration

The project uses **Angular environments** (`src/environments/*`) plus runtime environment variables for secrets.

### Quick local setup

1. Copy `.env.example` ➜ `.env`
2. Fill in your OpenAI key:
   ```
   OPENAI_API_KEY=sk-********************************
   ```

During `ng serve` the key is injected via **dotenv** & dev server proxy.  
For production you should **never** hard-code keys: use platform-specific environment variables or a minimal back-end proxy.

### Key Parameters

| Variable         | Description                                                                        | Example  |
| ---------------- | ---------------------------------------------------------------------------------- | -------- |
| `OPENAI_API_KEY` | **Required.** Your secret key from <https://platform.openai.com/account/api-keys>. | `sk-…`   |
| `OPENAI_MODEL`   | Default model.                                                                     | `gpt-4o` |
| `OPENAI_TIMEOUT` | Request timeout (ms).                                                              | `60000`  |

---

## 🏗️ Project Structure

```
src/
 ├─ app/
 │   ├─ components/      # Presentation (ChatInterfaceComponent)
 │   ├─ services/        # AiService, ChatStorageService
 │   ├─ models/          # TypeScript interfaces & enums
 │   └─ app.module.ts
 ├─ assets/              # images, icons
 ├─ environments/        # environment.{development,production}.ts
 ├─ styles.scss          # global Tailwind imports & variables
 └─ index.html
```

### Core Modules

| Area               | File(s)                             | Responsibility                                       |
| ------------------ | ----------------------------------- | ---------------------------------------------------- |
| OpenAI integration | `ai.service.ts`                     | Compose requests, streaming, retries, error handling |
| Local persistence  | `chat-storage.service.ts`           | Conversation CRUD, auto-save, import/export          |
| UI layer           | `chat-interface.component.*`        | Form input, message list, settings panel             |
| Styles             | `tailwind.config.js`, `styles.scss` | Theme tokens, utilities                              |

---

## 🖥️ Scripts

| Command         | Purpose                     |
| --------------- | --------------------------- |
| `npm start`     | Dev server with hot reload  |
| `npm run build` | Production build to `dist/` |
| `npm run lint`  | ESLint & Angular ESLint     |
| `npm test`      | Karma / Jasmine unit tests  |

---

## ☁️ Deployment Guide

The build output is **static HTML/CSS/JS**, so you can host it anywhere:

### Static Hosts

1. `npm run build`
2. Upload `dist/ai-chat-app/` to **Vercel**, **Netlify**, **GitHub Pages**, **Cloudflare Pages**, S3 + CloudFront, etc.
3. Configure `OPENAI_API_KEY` as an **environment variable** in the host dashboard (if supported) or via an edge-function proxy.

### Docker

```dockerfile
FROM nginx:alpine
COPY dist/ai-chat-app /usr/share/nginx/html
# optionally copy custom nginx.conf to inject env vars at runtime
```

`docker build -t ai-chat-app . && docker run -p 8080:80 ai-chat-app`

---

## 🛠️ Troubleshooting

| Issue                                             | Fix                                                       |
| ------------------------------------------------- | --------------------------------------------------------- |
| **Blank page / 404** after refresh on static host | Ensure server redirects all routes to `index.html`        |
| `401 Unauthorized` from OpenAI                    | Verify `OPENAI_API_KEY` and that billing is enabled       |
| `429 Too Many Requests`                           | Hit rate-limit – reduce message frequency or upgrade plan |
| LocalStorage quota exceeded                       | Clear old conversations from settings › Storage Usage     |
| CORS errors in production                         | Serve requests through your own proxy/server              |

---

## 🤝 Contributing

1. Fork the repo & create a feature branch:  
   `git checkout -b feat/amazing-idea`
2. Commit with **conventional commits**:  
   `feat(ui): add rainbow mode`
3. Lint & test: `npm run lint && npm test`
4. Push and open a Pull Request explaining **what** and **why**

All contributions, issues and feature requests are welcome!  
See [CONTRIBUTING.md](CONTRIBUTING.md) for full details.

---

## 🗺️ Roadmap

- Multi-provider backend (HuggingFace, local LLMs)
- Conversation search & tags
- PWA offline support
- Theme & plugin system
- End-to-end Cypress tests

---

## 📜 License

[MIT](LICENSE) © 2025 AI Chat App Contributors
