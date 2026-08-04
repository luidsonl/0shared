export const FILES_CHANGED_EVENT = "files:changed";

export function dispatchFilesChanged() {
  window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT));
}
