export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,40}$/;

const ADJECTIVES = ["swift", "bright", "steady", "bold", "clever", "calm"];
const NOUNS = ["trader", "falcon", "orbit", "pixel", "summit", "vertex"];

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(value);
}

export function generateRandomUsername() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective}-${noun}-${Math.floor(100 + Math.random() * 900)}`;
}
