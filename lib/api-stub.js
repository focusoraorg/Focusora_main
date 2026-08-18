// Focusora — API seam / stubs
export async function signIn() {
  throw new Error("Account sign-in requires the Focusora backend.");
}
export async function connectNotion() {
  throw new Error("Notion sync requires the Focusora backend.");
}
export async function fetchNotionTasks() {
  return [];
}
export async function suggestDailyPlan() {
  throw new Error("AI daily planning requires the Focusora backend.");
}
export async function breakTaskIntoBlocks() {
  throw new Error("AI task breakdown requires the Focusora backend.");
}
