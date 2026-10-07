# Noted

A small Expo + Convex note-taking app. The Expo app runs on iOS, Android, and web.

## Run locally

```sh
npm install
npm run start
```

Without a Convex URL, notes are saved on the device with AsyncStorage and a few sample notes are shown on first launch.

## Connect Convex

1. Run `npx convex dev` and follow the prompts to create a Convex project.
2. Copy the deployment URL into `.env.local` as `EXPO_PUBLIC_CONVEX_URL` (see `.env.example`).
3. Restart Expo. Convex generates the typed backend files and syncs the notes schema and functions.

## AI writing assistant

The editor's writing assistant uses Vercel AI SDK with AI Gateway. Create an AI Gateway API key, then add it as `AI_GATEWAY_API_KEY` in the environment variables for the Convex deployment (use the Convex dashboard's deployment settings). Keep the key on the Convex backend; never add it to Expo's `EXPO_PUBLIC_` variables.

The assistant sends only the open note's title and body after the user chooses an action. It previews generated text before applying it. The note actions, prompts, and model call are in `convex/ai/`.

The app requires a signed-in user for cloud notes. Notes are scoped to their owner in Convex.

# Noted_Expo_AISDK


  ![Static Badge](https://img.shields.io/badge/TypeScript-v5.9-3178C6?logo=typescript&logoColor=white&color=3178C6)
  ![Static Badge](https://img.shields.io/badge/React_Native-v0.86-61DAFB?logo=react&logoColor=black&color=61DAFB)
  ![Static Badge](https://img.shields.io/badge/Expo-v57.0-000020?logo=expo&logoColor=white&color=000020)
  ![Static Badge](https://img.shields.io/badge/Convex-v1.46-EE342F?logo=convex&logoColor=white&color=EE342F)
  ![Static Badge](https://img.shields.io/badge/Vercel_AI_SDK-v7.0-000000?logo=vercel&logoColor=white&color=000000)
  ![Static Badge](https://img.shields.io/badge/OpenAI_GPT--4.1--nano-412991?logo=openai&logoColor=white&color=412991)
  ![Static Badge](https://img.shields.io/badge/Node.js-v18-339933?logo=nodedotjs&logoColor=white&color=339933)
  
  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  
  Most React Native apps still carry the weight of an entire backend they shouldn't have to manage themselves —
  Express servers, Postgres connections, hand-rolled auth, and scattered API routes that expose secrets if you blink
  wrong.
  
  Noted flips that model entirely.
  
  It's a cross-platform (iOS, Android, Web) note-taking app built on Expo + Convex + the Vercel AI SDK, and the
  architecture is a clean example of where the React Native ecosystem is actually heading in 2025.
  
  🏗️ The Stack
  
  • 📱 Expo ~57 + expo-router — file-based routing across all platforms, zero native config headaches
  • ⚡ Convex ^1.46 — replaces your entire backend: real-time database, serverless mutations/queries, and auth in a
  single dependency
  • 🤖 Vercel AI SDK ai ^7.0 — generateText() called from a Convex action, hitting OpenAI GPT-4.1-nano via AI Gateway
  • 🔐 @convex-dev/auth — auth that's actually part of your backend, not bolted on afterward
  • 💾 AsyncStorage — offline-first fallback when no Convex URL is configured
  • 🟦 TypeScript ~5.9 — end-to-end type safety across client and server
  
  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  
  ⚔️ Old Way vs. Noted's Way
  
  | | Old Way | Noted's Way |
  |---|---|---|
  | **Routing** | React Navigation + manual stack setup | expo-router — file-based, done |
  | **Database** | Spin up Postgres, write migrations | Convex schema — declare and ship |
  | **Real-time sync** | WebSockets + custom infra | Built into Convex, zero config |
  | **Auth** | Passport.js / Auth0 / hand-rolled | @convex-dev/auth, same deployment |
  | **AI calls** | Your own API route, manage secrets manually | Convex action + `generateText()`, keys stay server-s
  ide |
  | **Deploys** | EC2 / Railway / Render — your problem | Convex managed, Expo handles the app |

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  
  🧠 4 AI writing features, all previewed before applying:
  
  • ✏️ Improve writing
  • 📝 Summarize note
  • 💡 Suggest a title
  • ✅ Extract tasks → markdown checklist
  
  The AI key (AI_GATEWAY_API_KEY) lives in Convex's deployment env vars. It never touches the client. That's the
  right way to ship LLM features in a mobile app.
  
  The offline story is solid too — no Convex URL configured? The app falls back to local AsyncStorage seamlessly.
  Cloud sync is opt-in, not a hard dependency.
  
  This isn't a tutorial project. It's a reference architecture for anyone building AI-native mobile apps without also
  wanting to become a DevOps engineer.
  
  🔗 GitHub → https://github.com/Vorpalv2/Noted_Expo_AISDK
  
  #ReactNative #Expo #Convex #VercelAI #TypeScript #MobileDev #OpenAI #FullStack #AppDevelopment #AIEngineering
