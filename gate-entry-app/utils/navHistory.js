// utils/navHistory.js - The pages visited in THIS app session (27 Nov 2026),
// used by the hybrid "← Back" button in AppShell:
//   came from another page in the app  -> go back to it
//   refresh / typed link / first page after login -> the page's parent
// Login, the start route and "Set a new password" reset the history.
const RESET = ['/', '/index', '/LoginScreen', '/change-password'];
const stack = [];

export function recordPath(path) {
  if (!path) return;
  if (RESET.includes(path)) { stack.length = 0; return; }
  if (stack[stack.length - 1] === path) return;
  if (stack.length >= 2 && stack[stack.length - 2] === path) { stack.pop(); return; }   // went back
  stack.push(path);
  if (stack.length > 50) stack.shift();
}

export function previousPath() {
  return stack.length >= 2 ? stack[stack.length - 2] : null;
}

export function clearHistory() {
  stack.length = 0;
}
