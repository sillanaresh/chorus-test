<p align="center">
  <img src="app-icon.png" alt="Chorus icon" width="128" />
</p>

<h1 align="center">Chorus</h1>

<p align="center">A local AI chat application for macOS and iOS.</p>

Chorus lets you talk to AI models with your own provider keys. It keeps chat history on your device. You can control the models and prompts used for each conversation. The desktop app also supports tools and projects.

> Chorus is designed for people who want one private place for daily AI work without sending their chat history to a separate Chorus service.

## Product overview

### What Chorus can do

-   Chat with models from OpenRouter, OpenAI, Anthropic, Google, Perplexity, and Grok.
-   Connect to local models through Ollama and LM Studio on desktop.
-   Stream answers as the model generates them.
-   Keep chats, messages, drafts, project data, and model settings in a local SQLite database.
-   Create, rename, pin, search, and delete chats.
-   Save a different model for each chat.
-   Add custom model settings and system prompts.
-   Attach images, PDFs, text files, and web pages when the selected model supports them.
-   Search the web from a chat when web tools are enabled.
-   Track token use and model cost when the provider returns usage data.
-   Organize work into projects with project context and attachments.
-   Compare answers from several models in the desktop app.
-   Let models review or revise other model responses in the desktop app.
-   Connect desktop tools through the Model Context Protocol, also called MCP.

### iPhone experience

The iOS app keeps the main chat flow focused on small screens.

-   Add and test an OpenRouter API key.
-   Refresh and search the available OpenRouter model list.
-   Set default Base and Strong models for new chats.
-   Switch between Base and Strong inside a chat with one button.
-   Choose any available OpenRouter model for either slot without changing the global defaults.
-   Turn web search on or off for each chat.
-   Start chats and stream model responses.
-   Dictate a message with the microphone button instead of typing it.
-   Open the chat list with a swipe from the left edge of a chat.
-   Search and manage local chat history.
-   Rename, pin, and delete chats.
-   Share a conversation as readable Markdown and structured JSON through the iOS share sheet.
-   Save personal memories across chats, inspect every saved item, and delete items at any time.
-   Use the same Chorus message styling as the desktop app.
-   Recover cleanly when iOS interrupts a response after the app moves to the background.

> iOS can suspend an application and stop a live model connection. Chorus detects an interrupted response when you return and provides a retry action. A future server job system would be required for generation that always continues while the app is suspended.

### Base and Strong models

The iOS Settings screen provides two model preferences. Base is the default for a new chat. Strong is available through the sparkle button beside the in-chat model picker.

Each new chat copies the current Settings choices into its own Base and Strong slots. The user can then open the model picker and assign any available OpenRouter model to the active slot. These chat-level changes do not alter the global defaults.

The sparkle button switches slots without clearing the conversation. Each chat remembers its active slot and its two model choices. If both Settings slots use the same model, Chorus displays a warning but still allows the user to save.

### Personal memory

Memory is local and disabled by default. The user can add an OpenAI API key and enable Memory in Settings. A message such as "Remember that I am allergic to shellfish" creates an explicit memory. Explicit corrections replace a memory with the same stable fact key.

Automatic learning is a separate opt-in setting. When enabled, Chorus queues a conversation for review after it becomes idle or the user leaves the chat. iOS may suspend the app before that work finishes, so pending work resumes the next time the app is active.

For a new conversation, Chorus finds a small set of relevant memories and adds them to the selected model's system context. It stores the memory text, categories, embeddings, deletion records, and chat links in SQLite. Deleted memories leave a local tombstone so automatic learning does not recreate the same fact.

The Memory screen lists everything Chorus has stored. The user can search the list and delete any item. The Settings screen can delete all memories.

See [PRIVACY.md](PRIVACY.md) for the current data handling summary.

### Voice input

The mobile composer has a microphone button. When the message box is empty, the send button becomes a microphone. Tap it to record, then tap stop to finish. Chorus sends the audio to OpenAI for transcription and adds the text to the message box, where you can edit it before sending. You can also cancel a recording without transcribing it.

Voice input uses the same OpenAI API key as Memory. The audio stays on the device except for the single transcription request. Chorus uses the `gpt-4o-transcribe` model with an English language hint, which handles accented English well. A short message costs a fraction of a cent.

### Grouped settings

The mobile Settings screen groups its options into categories: Appearance, Memory, and Models and Chat. The controls and their behavior are unchanged. The grouping makes a longer settings list easier to scan.

### Desktop experience

The macOS app includes the broader Chorus workflow.

-   Multi model comparison and response selection.
-   AI reviews, revisions, synthesis, and branching.
-   Projects, project summaries, and reusable context.
-   File attachments and generated media.
-   Desktop tools and MCP servers.
-   Quick Chat and macOS keyboard shortcuts.
-   Import, export, update, and native notification support.

## Technical overview

### Main technologies

| Area              | Technology                                  |
| ----------------- | ------------------------------------------- |
| Application shell | Tauri 2                                     |
| Native layer      | Rust                                        |
| User interface    | React 18 and TypeScript                     |
| Build system      | Vite                                        |
| Styling           | Tailwind CSS and Radix UI components        |
| Data access       | TanStack Query and Tauri SQL                |
| Local database    | SQLite                                      |
| Model clients     | Provider adapters in TypeScript             |
| Desktop tools     | Model Context Protocol over local processes |
| Tests             | Vitest                                      |

### Architecture

```text
React user interface
        |
        v
TanStack Query hooks and Chorus API modules
        |
        +--------------------------+
        |                          |
        v                          v
SQLite through Tauri SQL     Model provider adapters
        |                          |
        v                          v
Local chat data              OpenRouter and other providers
                                   |
                                   v
                              Streamed responses

React user interface
        |
        v
Tauri commands and plugins
        |
        v
Rust native layer
```

The React application owns the screens and most product logic. Modules under `src/core/chorus/api` read and update local data. TanStack Query keeps the screen state in sync with SQLite.

Mobile model preferences and per-chat Base and Strong slot state are stored in the local application metadata table. The active slot is resolved to a normal saved chat model before a message is sent, so the existing provider and streaming paths remain unchanged.

Model provider classes under `src/core/chorus/ModelProviders` convert a Chorus conversation into each provider format. They stream response chunks back to the message layer. The app writes those chunks to the local database while it updates the visible answer.

The Rust code under `src-tauri/src` starts the Tauri application and registers native plugins. It also owns database migrations. On desktop, it manages menus, shortcuts, the tray, native windows, and platform permissions.

> Normal chat requests go from the installed application to the selected model provider. This repository does not require a separate Chorus chat backend for that flow.

### Data storage

Chorus uses SQLite for structured application data. This includes conversation history, projects, model settings, permissions, drafts, attachment records, cost data, personal memories, memory deletion records, and pending memory work.

Uploaded files and generated files are stored in the application data directory. See [DATA_STORAGE.md](DATA_STORAGE.md) for platform paths and backup instructions. See [SCHEMA.md](SCHEMA.md) for the generated database schema.

### Main source folders

```text
src/ui/                     React screens, components, themes, and hooks
src/ui/components/mobile/   iOS focused interface
src/core/chorus/            Chat, model, tool, and provider logic
src/core/chorus/api/        Database queries and product mutations
src-tauri/src/              Rust application setup and native behavior
src-tauri/src/migrations.rs SQLite migrations
script/                     Development, backup, and release scripts
```

## Development setup

### Requirements

-   Node.js 22 or later.
-   pnpm.
-   Rust and Cargo.
-   Xcode for macOS and iOS builds.
-   Git LFS.
-   ImageMagick is optional.

### Install

```bash
git lfs install --force
git lfs pull
pnpm install
pnpm run setup
```

### Run the macOS app

```bash
pnpm run dev
```

The setup and development scripts create an isolated application data directory for each working copy. This lets several development versions run without sharing one database.

### Run the iOS app

Initialize the generated Xcode project once:

```bash
pnpm run tauri:ios:init
```

Run on an available simulator:

```bash
VITE_CHORUS_MOBILE=1 pnpm tauri ios dev "iPhone 17"
```

The simulator name can be replaced with any simulator installed in Xcode.

### Build and check

```bash
pnpm run build
pnpm run test
pnpm run lint
pnpm run format:check
```

Create an iOS build with:

```bash
pnpm run tauri:ios:build
```

A physical device build requires an Apple development team and valid signing settings.

## Configuration

Provider keys are added in the application settings. The mobile app currently uses OpenRouter for its model list and chat flow. The optional memory feature uses OpenAI for structured extraction and embeddings. The desktop app supports the broader provider and local model set.

## App Store release notes

The iOS bundle is self-contained and does not need a local development server. Before an App Store submission, the developer still needs to:

-   Join the Apple Developer Program and configure distribution signing.
-   Add a public support URL and replace the contact placeholder in [PRIVACY.md](PRIVACY.md).
-   Publish the privacy policy at a public URL and add that URL in App Store Connect.
-   Complete the App Privacy answers for chat content sent to OpenRouter and memory text sent to OpenAI.
-   Provide App Review with working test provider keys or an approved full demo mode.
-   Decide how the public product handles provider costs. Do not link users to an external API credit purchase flow from the app without checking the current App Review payment rules.
-   Run TestFlight testing on real iPhones before submitting the production build.

The main Tauri configuration is in `src-tauri/tauri.conf.json`. Mobile overrides are in `src-tauri/tauri.ios.conf.json`.

## Nightly build

You can download the latest macOS nightly build from the [Chorus download service](https://cdn.crabnebula.app/download/chorus/chorus/latest/platform/dmg-aarch64?channel=qa). A new nightly build is created after changes are pushed to `main`.

## License

Chorus is available under the [MIT License](LICENSE).
