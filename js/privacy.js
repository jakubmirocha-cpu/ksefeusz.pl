// ============================================================================
// privacy.js - wersja 1.9.0 (polityka prywatności: podświetlanie spisu treści)
// ============================================================================
// Do v1.8.8 blok <script> na dole privacy.html. Polityka CSP bez 'unsafe-inline'
// nie wykona kodu wpisanego w HTML.

const tocLinks = document.querySelectorAll('.toc a');
const sections = [...document.querySelectorAll('.section[id]')];
function updateToc() {
  const y = window.scrollY + 100;
  let activeId = sections[0]?.id;
  for (const s of sections) {
    if (s.offsetTop <= y) activeId = s.id;
  }
  tocLinks.forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + activeId);
  });
}
window.addEventListener('scroll', updateToc, { passive: true });
updateToc();
