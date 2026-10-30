# Troubleshooting

[Tiếng Việt](../TROUBLESHOOTING.md) | English

This document summarizes technical pitfalls whose root causes have been measured on Windows 11 (`[VERIFIED]`), how to check the `PATH` environment variable, and how to distinguish quota exhaustion errors from task technical errors. Other operating systems (macOS, Linux) or other machines are currently `[NOT TESTED]`.

## 1. Symptoms, root causes, and fixes

| Symptom | Root cause | Fix |
|---|---|---|
| Calling `send_to_codex` is rejected when sending to a Codex conversation in the extension | The default `auto` mode rejects conversations in the extension because the daemon reports `notLoaded` (`[VERIFIED]`). | Always pass the parameter `transport: "terminal"` when calling `send_to_codex` so the message goes through `codex queue`. |
| Cannot connect to the Codex daemon or error `this CLI has no complete local package` | The bridge does not automatically start the Codex daemon; the `codex.exe` bundled with the IDE extension does not have a complete package to run the daemon (`[VERIFIED]`). | Install the full package with `npm i -g @openai/codex`, then run `codex app-server daemon start` (you can create a Task Scheduler task to run it automatically at login). |
| The bridge command `node scripts/install.mjs --claude` fails at the plugin installation step | The Claude CLI `claude plugin install` command does not support the `--json` option passed by the install script (`[VERIFIED]`). | Manually run `claude plugin install codex-claude-desktop-bridge@codex-claude-desktop-local --scope user`, back up `<HOME>/.claude/settings.json` and add the rule `mcp__plugin_codex-claude-desktop-bridge_codex-claude-desktop-bridge__send_to_codex` to `permissions.allow`, then run `/reload-plugins` or open a new session. |
| Claude sessions running in the VS Code extension do not appear in the bridge session list | Bridge `v0.4.0` only recognizes sessions with entrypoints `claude-desktop`, `cli`, and `sdk-cli`, ignoring `claude-vscode` (`[VERIFIED]`). | Update the bridge from the `main` branch starting from merge commit `3ac8488` (PR #5, 2026-10-29) onward. |
| The bridge reports `Codex executable was not found` or IDEs cannot find `npm` and `agy` even though the registry is correct | Applications launched from the taskbar inherit the `PATH` of `explorer.exe`. In one measured login session, `explorer.exe` only had the Machine-level `PATH`, so all IDEs missed the user-level `npm` and `agy` entries (`[VERIFIED]` for the measurement; why `explorer.exe` missed the user `PATH`: `[UNKNOWN]`). | Restarting the IDE does not fix this; you must sign out of Windows and sign back in. Fallback for Codex: set the environment variable `CODEX_CLAUDE_BRIDGE_CODEX_BIN` pointing to `<path to codex.exe>`. |
| `agy -p` in non-interactive mode is denied permission when reading files or calling tools (even with `permissions.allow` or `--settings` configured with `command(...)` rules with and without `*`) | `agy -p` in non-interactive mode ignores `permissions.allow` (issue `google-antigravity/antigravity-cli#548`) (`[VERIFIED]`). | For plain Q&A, no flag is needed. If reading files or calling tools is required, add `--dangerously-skip-permissions` (approves all tools for that run), and only use it with a very narrow prompt inside the project directory. |
| `agy -p` silently returns 0 bytes, or a multi-line prompt is split into multiple arguments | Command-line prompts longer than about 32,000 characters cause `agy -p` to silently return 0 bytes; multi-line prompts passed via `Start-Process -ArgumentList` are split into multiple arguments (`[VERIFIED]`). | Keep prompts under about 25,000 characters and always verify that the output is non-empty. For multi-line prompts, pass them via a file or `stdin` instead of `Start-Process -ArgumentList`. |
| Calling Gemini CLI (`gemini`) fails with `IneligibleTierError` | Google discontinued serving AI Pro and Ultra tiers through Gemini CLI starting 2026-06-18, requiring migration to Antigravity (`[VERIFIED]`). | Switch to Antigravity CLI (`agy`). |
| Gemini output miscounts characters or inserts words from another language into sentences | The `low` variant of the Gemini model miscounted by one character in one test; Gemini twice inserted words outside the target language into sentences (`[VERIFIED]`, small sample). | Do not use the `low` model variant for tasks requiring accuracy. Always proofread Gemini output before using or forwarding it. |
| `git commit -F -` used with a PowerShell here-string fails | Piping a PowerShell here-string into `git commit -F -` breaks the command (`[VERIFIED]`). | Write the commit message to a file and run `git commit -F <file>`. |
| Codex stops and refuses to automatically perform actions such as `push`, modifying Claude permission settings, or SSH writes to another machine when receiving a message from Claude | A message from Claude does not replace direct user confirmation in the Codex session. This is intended behavior (`[VERIFIED]`). | The user must confirm directly in the Codex session or run the command themselves; do not attempt to bypass this through another agent. |

## 2. How to check the PATH environment variable on Windows

When `codex`, `npm`, or `agy` cannot be found inside an IDE even though the paths in the Windows Registry are correct:

1. Understand the inheritance mechanism (`[VERIFIED]` for the measurement):
   - Every application launched from the taskbar inherits its environment block from the `explorer.exe` process.
   - In one measured login session, `explorer.exe` only retained the Machine-level `PATH` and missed the user-level `PATH` (which contains the global `npm` path and `%LOCALAPPDATA%\agy\bin`). Therefore, simply closing and reopening the IDE will not load the updated `PATH`. (The root cause of why `explorer.exe` missed the user `PATH` remains `[UNKNOWN]`).
2. How to measure and verify:
   - Method 1: Launch a command-line process directly from `explorer.exe` to print and inspect the actual `PATH` value that `explorer.exe` passes to child processes.
   - Method 2: Call the Windows `CreateEnvironmentBlock` API to retrieve the standard environment block combined from system and user settings, then compare it against the current environment block of `explorer.exe`.
3. How to fix:
   - Sign out of the current Windows session and sign back in so `explorer.exe` reloads the full `PATH`.
   - For `codex.exe`, you can use the fallback of setting the `CODEX_CLAUDE_BRIDGE_CODEX_BIN` environment variable directly to `<path to codex.exe>`.

## 3. Distinguishing quota exhaustion errors from task errors

When a command delegating a task to Codex or Gemini fails or does not return the expected result, distinguish clearly between the following two cases to follow the right procedure:

### 3.1. Signs of quota exhaustion / usage limit errors

- The output or error message contains the following keywords and status codes (this list is an initial estimate):
  - Keywords: `quota`, `usage limit`, `rate limit`, `resource exhausted`, `credits`.
  - HTTP status codes: `429`, `402`.
- How to handle confirmed quota exhaustion:
  - Do not retry in a loop. You may run a very short command (for example, asking for a one-word reply) exactly once to confirm that quota is truly exhausted before handing over the task.
  - Hand over that entire task to the remaining agent (if Codex is out of quota, switch to Gemini; if Gemini is out of quota, switch to Codex; if both are out of quota, Claude does the work itself and informs the user).
  - Verification status note: Handing over tasks upon quota exhaustion is labeled `[REPORTED]` (the maintainer states it was used in practice for two days, but this repository has no saved logs of it).
  - Safety boundary: Quota exhaustion does not permit handing over restricted tasks (such as writing to production, reading production DBs, handling credentials, irreversible deletion, `push`, or changing permissions) to another agent.

### 3.2. Signs of task errors (technical, configuration, or permission errors)

If none of the quota signs above are present, the issue is a task error and must not be handled by automatic handover like a quota exhaustion error:
- `agy -p` output is empty (0 bytes) without a quota error message: Check the prompt length (if it exceeds about 32,000 characters, it silently returns 0 bytes; shorten it to under about 25,000 characters).
- `IneligibleTierError`: Caused by mistakenly calling `gemini` (Gemini CLI) instead of `agy`.
- Tool permission denied in `agy -p`: Caused by non-interactive mode ignoring `permissions.allow` (issue `google-antigravity/antigravity-cli#548`), not an account or quota error.
- `notLoaded` error when sending a message to Codex: Caused by omitting the `transport: "terminal"` parameter.
- The agent refuses to perform an action or pauses to wait for confirmation (such as `push`, editing permission configuration files, or SSH writes to another machine): This is a safety mechanism working as designed. Never hand over this blocked task to another agent to bypass permissions.
