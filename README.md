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
