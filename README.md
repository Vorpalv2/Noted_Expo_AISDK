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

## Privacy before deployment

The current Convex functions are public and do not authenticate users. A connected deployment stores every user's notes in one shared collection, so this build is suitable for local development and UI exploration only. Add authentication and user ownership checks before using it for private notes or sharing the deployment.

# Noted_Expo_AISDK
