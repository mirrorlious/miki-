const BROWSE_PREVIEW_MODE_KEY = 'yang-memorizer-mvp:browse-preview-mode'

try {
  const savedMode = window.localStorage?.getItem(BROWSE_PREVIEW_MODE_KEY)
  if (savedMode === 'text') {
    window.localStorage.setItem(BROWSE_PREVIEW_MODE_KEY, 'auto')
  }
} catch {
  // Ignore storage failures; this is only a UI preference migration.
}
