// ============================================================================
// ui.js - wersja 1.8.8 (obsługa interfejsu strony: FAQ, menu mobilne, pole UPO)
// ============================================================================
// Kod, który do v1.8.8 stał w bloku <script> na dole index.html. Polityka CSP
// bez 'unsafe-inline' nie wykona żadnego kodu wpisanego w HTML, więc cała obsługa
// strony mieszka w plikach .js.

function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}

function syncMobileNav() {
  const activeTab = document.querySelector('.tab.active');
  const current = activeTab ? activeTab.dataset.tab : null;
  document.querySelectorAll('.nav-mobile-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === current);
  });
}
function toggleHamburger() {
  const nav = document.querySelector('.nav');
  const opening = !nav.classList.contains('open');
  nav.classList.toggle('open');
  document.getElementById('hamburger').setAttribute('aria-expanded', opening);
  if (opening) syncMobileNav();
}
function closeHamburger() {
  document.querySelector('.nav').classList.remove('open');
  document.getElementById('hamburger').setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.nav')) closeHamburger();
});
window.addEventListener('scroll', function() {
  if (document.querySelector('.nav').classList.contains('open')) closeHamburger();
}, { passive: true });

// Obsługa pliku UPO
document.getElementById('fileInputUpo').addEventListener('change', function(e) {
  if (e.target.files[0]) handleUpoFile(e.target.files[0]);
});
(function() {
  const upoArea = document.querySelector('.upo-upload-area');
  upoArea.addEventListener('dragover', function(e) { e.preventDefault(); upoArea.classList.add('dragover'); });
  upoArea.addEventListener('dragleave', function() { upoArea.classList.remove('dragover'); });
  upoArea.addEventListener('drop', function(e) {
    e.preventDefault(); upoArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleUpoFile(e.dataTransfer.files[0]);
  });
})();
