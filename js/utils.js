// ============================================================================
// utils.js - wersja 1.5.0 (pomocnicze funkcje UI i nawigacji)
// ============================================================================
const APP_VERSION = '1.5.0';
const BUILD_DATE = '2026-04-24';

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
  const ksefRegex = /(\d{10}-\d{8}-[A-Z0-9]{10,14}-[A-F0-9]{2,4})/i;
  const match = nameWithoutExt.match(ksefRegex);
  return match ? match[1] : null;
}

function isValidKSeFFormat(ksefNumber) {
  if (!ksefNumber) return false;
  const pattern = /^\d{10}-\d{8}-[A-Z0-9]{10,14}-[A-F0-9]{2,4}$/i;
  return pattern.test(ksefNumber);
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

// Wersja w stopce
const footerVersion = document.getElementById('footerVersion');
if (footerVersion) footerVersion.textContent = APP_VERSION;
