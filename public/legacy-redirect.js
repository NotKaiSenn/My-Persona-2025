const destination = document.getElementById('destination');
if (destination instanceof HTMLAnchorElement) {
  window.location.replace(destination.href + window.location.hash);
}
