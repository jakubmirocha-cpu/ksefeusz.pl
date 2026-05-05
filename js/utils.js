// ============================================================================
// utils.js - wersja 1.6.11 (pomocnicze funkcje UI i nawigacji)
// ============================================================================
const APP_VERSION = '1.6.11';
const BUILD_DATE = '2026-05-05';

// ============================================================================
// STAŁE GLOBALNE (UI)
// ============================================================================

let currentXml = null;
let currentFileName = "";
let currentXmlContent = null;

// ============================================================================
// POMOCNICZE FUNKCJE UI
// ============================================================================

function showError(msg) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.style.display = "block";
  errorDiv.className = "error-message error";
  errorDiv.textContent = "❌ " + msg;
  setTimeout(() => { errorDiv.style.display = "none"; }, 5000);
}

function showSuccess(msg) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.style.display = "block";
  errorDiv.className = "error-message success";
  errorDiv.textContent = "✅ " + msg;
  setTimeout(() => { errorDiv.style.display = "none"; }, 5000);
}

function showLoading() {
  const loader = document.createElement('div');
  loader.id = 'loader';
  loader.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background: white; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 2000;`;
  loader.innerHTML = '⏳ Przetwarzanie...';
  document.body.appendChild(loader);
}

function hideLoading() {
  const loader = document.getElementById('loader');
  if (loader) loader.remove();
}

function formatujRachunek(nrRB) {
  if (!nrRB) return "";
  const czystyNr = nrRB.replace(/[\s-]/g, '');
  if (czystyNr.length === 26 && /^\d+$/.test(czystyNr)) {
    return czystyNr.replace(/(\d{2})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4 $5 $6 $7');
  }
  if (czystyNr.length > 0) {
    return czystyNr.replace(/(.{4})(?=.)/g, '$1 ');
  }
  return nrRB;
}

function calculateXmlHash(xmlContent) {
  let cleanContent = xmlContent;
  if (cleanContent.charCodeAt(0) === 0xFEFF) cleanContent = cleanContent.substring(1);
  return CryptoJS.enc.Base64.stringify(CryptoJS.SHA256(cleanContent));
}

// Dozwolone bezpośrednie dzieci elementu <Faktura> wg schematu FA(3)
const VALID_FAKTURA_CHILDREN = new Set([
  'Naglowek', 'Podmiot1', 'Podmiot2', 'PodmiotUpowazniony', 'Podmiot3',
  'Fa', 'Stopka', 'Zalacznik'
]);

function findUnknownFakturaElements(xmlDom) {
  const root = xmlDom.documentElement;
  const unknown = [];
  for (const child of root.children) {
    if (!VALID_FAKTURA_CHILDREN.has(child.localName)) {
      unknown.push(child);
    }
  }
  return unknown;
}

function generateVerificationUrl(nip, dataWystawienia, hash) {
  const dataParts = dataWystawienia.split('-');
  const dataFormat = `${dataParts[2]}-${dataParts[1]}-${dataParts[0]}`;
  let cleanHash = hash.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `https://qr.ksef.mf.gov.pl/invoice/${nip}/${dataFormat}/${cleanHash}`;
}

function extractKSeFNumberFromFilename(filename) {
  if (!filename) return null;
  const nameWithoutExt = filename.replace(/\.xml$/i, '');
  const ksefRegex = /(\d{10}-\d{8}-[0-9A-F]{12}-[0-9A-F]{2})/i;
  const match = nameWithoutExt.match(ksefRegex);
  return match ? match[1].toUpperCase() : null;
}

// Suma kontrolna NIP (wagi MF: 6,5,7,2,3,4,5,6,7) — dotyczy tylko pola NIP (polskie numery)
function isValidNIP(nip) {
  if (!nip) return false;
  const digits = nip.replace(/[-\s]/g, '');
  if (!/^\d{10}$/.test(digits)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * parseInt(digits[i]), 0);
  const check = sum % 11;
  return check !== 10 && check === parseInt(digits[9]);
}

// CRC-8 (polinom 0x07, init 0x00) — zgodnie ze specyfikacją CIRT MF
function crc8(str) {
  let crc = 0x00;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
    }
  }
  return crc;
}

function isValidKSeFNumber(ksefNumber) {
  if (!ksefNumber) return false;
  const n = ksefNumber.toUpperCase();
  if (n.length !== 35) return false;
  if (!/^\d{10}-\d{8}-[0-9A-F]{12}-[0-9A-F]{2}$/.test(n)) return false;
  const dataPart = n.substring(0, 32);
  const checksumStr = n.substring(33);
  return crc8(dataPart) === parseInt(checksumStr, 16);
}

// Po wczytaniu pliku, pokaż komunikat na telefonie
function showMobileMessage() {
  const mobileMsg = document.querySelector('.mobile-message');
  if (mobileMsg) {
    if (window.innerWidth <= 768) {
      mobileMsg.style.display = 'block';
    } else {
      mobileMsg.style.display = 'none';
    }
  }
}

// Wywołaj w funkcji render (po hideLoading)
showMobileMessage();

// Dodaj nasłuchiwanie na zmianę rozmiaru okna
window.addEventListener('resize', showMobileMessage);

// ============================================================================
// FUNKCJE POMOCNICZE INTERFEJSU
// ============================================================================
function goToPrivacy() { window.location.href = 'privacy.html'; }
function switchTab(tabName) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`panel-${tabName}`).classList.add('active');
  const activeBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

function clearPdfTab() {
  document.getElementById('fileInputPdf').value = '';
  document.getElementById('pdfUploadArea').style.display = 'block';
  document.getElementById('pdfStatus').style.display = 'none';
  document.getElementById('pdfSampleReady').style.display = 'none';
}

function showUploadArea() {
  const uploadArea = document.querySelector('#panel-faktura .upload-area');
  const fileInfo = document.getElementById('fileInfo');
  const newInvoiceBtn = document.getElementById('newInvoiceBtn');
  if (uploadArea) uploadArea.style.display = 'block';
  if (fileInfo) fileInfo.style.display = 'none';
  if (newInvoiceBtn) newInvoiceBtn.style.display = 'none';
  clearFile();
}

function clearFile() {
  currentXml = null; currentFileName = ""; currentXmlContent = null;
  document.getElementById("pages").innerHTML = "";
  document.getElementById("currentFile").textContent = "";
  document.getElementById("fileInfo").style.display = "none";
  document.getElementById("fileInput").value = "";
  const uploadArea = document.querySelector('#panel-faktura .upload-area');
  if (uploadArea) uploadArea.style.display = 'block';
  const newInvoiceBtn = document.getElementById('newInvoiceBtn');
  if (newInvoiceBtn) newInvoiceBtn.style.display = 'none';
}

function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    const offset = 100;
    const sectionPosition = section.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: sectionPosition, behavior: 'smooth' });
    document.querySelectorAll('.section-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function togglePaymentBox(btn) {
  const box = btn.nextElementSibling;
  const isOpen = box.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
  btn.querySelector('.payment-toggle-arrow').textContent = isOpen ? '▴' : '▾';
  btn.querySelector('.payment-toggle-text').textContent = isOpen ? 'Ukryj dane do przelewu' : 'Pokaż dane do przelewu';
}

function copyPaymentField(btn) {
  const text = btn.dataset.copy || '';
  const finish = () => {
    btn.textContent = 'Skopiowano';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Kopiuj'; btn.classList.remove('copied'); }, 1500);
  };
  if (!navigator.clipboard) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    finish();
    return;
  }
  navigator.clipboard.writeText(text).then(finish);
}

// Wersja w stopce
const footerVersion = document.getElementById('footerVersion');
if (footerVersion) footerVersion.textContent = APP_VERSION;
