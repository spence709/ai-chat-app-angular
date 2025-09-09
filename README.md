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

## 🛠️ Troubleshooting

| Issue                                             | Fix                                                       |
| ------------------------------------------------- | --------------------------------------------------------- |
| **Blank page / 404** after refresh on static host | Ensure server redirects all routes to `index.html`        |
| `401 Unauthorized` from OpenAI                    | Verify `OPENAI_API_KEY` and that billing is enabled       |
| `429 Too Many Requests`                           | Hit rate-limit – reduce message frequency or upgrade plan |
| LocalStorage quota exceeded                       | Clear old conversations from settings › Storage Usage     |
| CORS errors in production                         | Serve requests through your own proxy/server              |

---
