// Opens a page in a new tab within the key press that asked, which is what gets it past pop-up blockers. With no press
// active the browser would block it, so it is not tried and the caller shows the link instead (noopener makes open()
// return null either way, so this is the only sign there is).
export function openTab(url) {
  const ua = navigator.userActivation;
  if (ua && !ua.isActive) return false;
  open(url, '_blank', 'noopener,noreferrer');
  return true;
}
