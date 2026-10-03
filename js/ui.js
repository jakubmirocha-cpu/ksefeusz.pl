// ============================================================================
// ui.js - wersja 1.8.8 (obsługa przycisków i list strony, FAQ, menu mobilne, pole UPO)
// ============================================================================
// Polityka CSP bez 'unsafe-inline' nie wykona żadnego kodu wpisanego w HTML
// (onclick=…, <script> bez src), więc cała obsługa strony mieszka w plikach .js.
// Do v1.8.8 przyciski miały onclick=…, a FAQ i menu — blok <script> w index.html.

// ============================================================================
// AKCJE PRZYCISKÓW I LIST — data-action / data-change
// ============================================================================
// Przycisk mówi, co robi, atrybutem danych, a nie kodem w HTML:
//   <button data-action="tab" data-arg="pdf">          zamiast onclick="switchTab('pdf')"
//   <select data-change="lang">                         zamiast onchange="changeInvoiceLang(this.value)"
// Jeden nasłuch kliknięć i jeden nasłuch zmian dla całej strony obsługuje też HTML
// generowany później (boks „Dane do przelewu", tabela „Wiele faktur").
//
// Zasady — każda chroni przed konkretnym błędem:
//  - ZAMKNIĘTA MAPA. Nieznana akcja = nic + ostrzeżenie w konsoli. Nigdy window[nazwa]():
//    atrybut wstrzyknięty do strony mógłby wtedy wywołać dowolną funkcję i obejść CSP.
//  - Argumenty sprawdzane (zakładka z listy, pole pliku z listy, nazwa próbki ze wzorca,
//    indeks kolejki jako liczba całkowita) — inny argument = nic + ostrzeżenie.
//  - Funkcje strony wołane po nazwie w chwili kliknięcia, nie zapamiętane przy ładowaniu.
//  - Obsługiwany jest najbliższy element z data-action. Jeśli po drodze jest zwykły link
//    (<a href> bez data-action), działa link, a nie akcja otaczającego pola — to zastępuje
//    dawne event.stopPropagation() przy linku podatki.gov.pl w polu wyboru pliku.
//  - Ten nasłuch musi być zarejestrowany PRZED nasłuchem „kliknięcie obok zamyka menu"
//    (niżej): kolejność jak przy dawnym onclick — najpierw przycisk, potem document.
(function () {
  const ZAKLADKI = ['info', 'faktura', 'pdf', 'batch', 'upo'];
  const POLA_PLIKU = ['fileInput', 'fileInputPdf', 'fileInputBatch', 'fileInputUpo'];
  const NAZWA = /^[A-Za-z0-9_]+$/;       // nazwa próbki z samples/
  const SEKCJA = /^[A-Za-z0-9_-]+$/;     // id sekcji strony
  const ma = (obiekt, klucz) => Object.prototype.hasOwnProperty.call(obiekt, klucz);
  const odmowa = (co, el) => { console.warn(`KSeFeusz: ${co}`, el); };

  // Indeks pozycji kolejki „Wiele faktur" — liczba, nie tekst (generateBatchPdf(0)).
  function indeks(el) {
    const n = Number(el.dataset.index);
    if (el.dataset.index === '' || !Number.isInteger(n) || n < 0) { odmowa('nieprawidłowy indeks kolejki', el); return null; }
    return n;
  }
  function zIndeksem(fn) {
    return el => { const n = indeks(el); if (n !== null) fn(n); };
  }

  const AKCJE = {
    // Zakładki. data-close-menu: pozycja menu mobilnego (zamyka menu po przejściu),
    // data-scroll: po przejściu przewiń do sekcji (stopka „Jak to działa").
    'tab': el => {
      const zakladka = el.dataset.arg;
      if (!ZAKLADKI.includes(zakladka)) { odmowa('nieznana zakładka', el); return; }
      switchTab(zakladka);
      if ('closeMenu' in el.dataset) closeHamburger();
      const sekcja = el.dataset.scroll;
      if (sekcja !== undefined) {
        if (!SEKCJA.test(sekcja)) { odmowa('nieprawidłowa sekcja', el); return; }
        setTimeout(() => { const cel = document.getElementById(sekcja); if (cel) cel.scrollIntoView({ behavior: 'smooth' }); }, 50);
      }
    },
    'faq': el => toggleFaq(el),
    'menu': () => toggleHamburger(),
    'pick-file': el => {
      const id = el.dataset.arg;
      if (!POLA_PLIKU.includes(id)) { odmowa('nieznane pole wyboru pliku', el); return; }
      document.getElementById(id).click();
    },
    'sample': el => {
      const nazwa = el.dataset.arg;
      if (!NAZWA.test(nazwa || '')) { odmowa('nieprawidłowa nazwa próbki', el); return; }
      loadSampleFile(`samples/${nazwa}.xml`, nazwa);
    },
    'sample-upo': el => {
      const nazwa = el.dataset.arg;
      if (!NAZWA.test(nazwa || '')) { odmowa('nieprawidłowa nazwa próbki', el); return; }
      loadSampleUpo(`samples/${nazwa}.xml`, nazwa);
    },
    'print': () => window.print(),
    'showUploadArea': () => showUploadArea(),
    'downloadSamplePdf': () => downloadSamplePdf(),
    'generateUpoPdf': () => generateUpoPdf(),
    'clearUpoFile': () => clearUpoFile(),
    'confirmGenerateAll': () => confirmGenerateAll(),
    'confirmGenerateAllYes': () => confirmGenerateAllYes(),
    'closeBatchModal': () => closeBatchModal(),
    'clearBatchQueue': () => clearBatchQueue(),
    // HTML generowany: boks „Dane do przelewu" (renderer.js) i tabela kolejki (main.js)
    'payment-box': el => togglePaymentBox(el),
    'copy': el => copyPaymentField(el),
    'white-list': el => checkWhiteList(el, el.dataset.nip, el.dataset.nrb),
    'batch-pdf': zIndeksem(n => generateBatchPdf(n)),
    'batch-print': zIndeksem(n => printBatchPdf(n)),
    'batch-remove': zIndeksem(n => removeBatchEntry(n))
  };

  const ZMIANY = {
    'lang': el => {
      if (!I18N_LANGS.some(j => j.code === el.value)) { odmowa('nieznany język', el); return; }
      changeInvoiceLang(el.value);
    },
    'view-mode': el => toggleViewMode(el.checked),
    // Odwrócona logika jest celowa: zaznaczony przełącznik = szczegóły UKRYTE.
    'row-details': el => toggleRowDetails(!el.checked)
  };

  document.addEventListener('click', function (e) {
    // Kliknięcie, które samo trafiło w ukryte pole wyboru pliku (wywołane przez
    // pole.click() z akcji „pick-file"), nie uruchamia akcji pola, w którym leży.
    if (e.target instanceof HTMLInputElement && e.target.type === 'file') return;
    const el = e.target.closest('[data-action], a[href]');
    if (!el || !el.hasAttribute('data-action')) return;
    const nazwa = el.dataset.action;
    if (!ma(AKCJE, nazwa)) { odmowa(`nieznana akcja „${nazwa}"`, el); return; }
    if (el.tagName === 'A') e.preventDefault();   // link z akcją (logo) nie zmienia adresu strony
    AKCJE[nazwa](el);
  });

  document.addEventListener('change', function (e) {
    const el = e.target.closest ? e.target.closest('[data-change]') : null;
    if (!el) return;
    const nazwa = el.dataset.change;
    if (!ma(ZMIANY, nazwa)) { odmowa(`nieznana zmiana „${nazwa}"`, el); return; }
    ZMIANY[nazwa](el);
  });
})();

// ============================================================================
// FAQ, MENU MOBILNE, POLE UPO (do v1.8.8 blok <script> w index.html)
// ============================================================================

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
