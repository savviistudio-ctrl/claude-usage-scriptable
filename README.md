# Claude Usage — Scriptable widget for iPhone

A [Scriptable](https://scriptable.app) script that shows your Claude subscription (Pro/Max) usage limits — the 5-hour session and weekly limits — as a Home Screen or Lock Screen widget.

## What it shows
- **5-hour** session usage %, with a bar and time until reset
- **Weekly** usage %, with time until reset
- **Weekly Opus / Sonnet** (Large widget, when your plan has them)

Bars turn orange at 70% and red at 90%.

## Setup
1. Install **Scriptable** from the App Store.
2. Create a new script and paste in `ClaudeUsage.js`.
3. Tap ▶. A claude.ai sign-in page opens inside Scriptable. Sign in with your **email and the code** Claude sends you. Google sign-in does not work inside apps.
4. Tap **Close**. Your usage appears.

## Add the widget
- **Home Screen:** long-press → Edit → Add Widget → Scriptable → Small, Medium or Large. Tap the widget and set **Script** to this script.
- **Lock Screen:** long-press the Lock Screen → Customize → Lock Screen → add Scriptable (circle, rectangle, or inline above the clock), then pick this script.

## Privacy
- No API key, password or token is stored in the script.
- Sign-in happens on claude.ai inside Scriptable's own browser; your session stays on your device.
- The only data saved is a small cache of your usage percentages (`claude_usage_cache.json`) in Scriptable's local folder.
- The script talks only to `claude.ai`.

## Notes
- It reads the same data as claude.ai **Settings → Usage**, using an unofficial endpoint (`/api/organizations/{id}/usage`). It is not an Anthropic product and may break if that endpoint changes.
- iOS decides how often widgets refresh (usually every 15–30 minutes). If a refresh fails, the widget shows the last saved numbers labeled "Cached". Running the script in the app updates them.
