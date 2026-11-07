// Turns untrusted text (lesson titles, attachment names, usernames) into one safe path component.
// Shared by every Node script so the rules stay identical; download_accessible_videos.py mirrors them.
function safeName(name, fallback = 'item') {
  const cleaned = String(name || fallback)
    .replace(/[/\\:]/g, '-')
    .replace(/[?*"<>|]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
    .replace(/\s+/g, ' ')
    // A leading dot makes "." or ".." a path component that resolves outside the folder.
    .replace(/^[.\s]+/, '')
    .trim();
  return cleaned || fallback;
}

module.exports = { safeName };
