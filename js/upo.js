// ============================================================================
// upo.js - wersja 1.6.9 (wizualizator UPO KSeF)
// ============================================================================

const UPO_NS = "http://upo.schematy.mf.gov.pl/KSeF/v4-3";

let currentUpoXml = null;
let currentUpoFileName = "";

// ============================================================================
// HELPERS PARSOWANIA
// ============================================================================

function upoGetText(node, tag) {
  if (!node) return "";
  const el = node.getElementsByTagNameNS(UPO_NS, tag)[0];
  return el ? el.textContent.trim() : "";
}

function upoFormatDate(str) {
  if (!str) return "—";
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : str;
}

function upoFormatDateTime(str) {
  if (!str) return "—";
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}` : str;
}

// ============================================================================
// PARSOWANIE UPO
// ============================================================================

function parseUpo(xmlDom) {
  const root = xmlDom.documentElement;

  // Uwierzytelnienie — IdKontekstu to choice
  const uwierzNode = root.getElementsByTagNameNS(UPO_NS, "Uwierzytelnienie")[0];
  const idKontekstuNode = uwierzNode ? uwierzNode.getElementsByTagNameNS(UPO_NS, "IdKontekstu")[0] : null;
  let idTyp = "", idWartosc = "";
  if (idKontekstuNode) {
    const nip = idKontekstuNode.getElementsByTagNameNS(UPO_NS, "Nip")[0];
    const idWew = idKontekstuNode.getElementsByTagNameNS(UPO_NS, "IdWewnetrzny")[0];
    const vatUE = idKontekstuNode.getElementsByTagNameNS(UPO_NS, "IdZlozonyVatUE")[0];
    const peppol = idKontekstuNode.getElementsByTagNameNS(UPO_NS, "IdDostawcyUslugPeppol")[0];
    if (nip)    { idTyp = "NIP";          idWartosc = nip.textContent.trim(); }
    else if (idWew)  { idTyp = "ID wewnętrzny"; idWartosc = idWew.textContent.trim(); }
    else if (vatUE)  { idTyp = "VAT UE";        idWartosc = vatUE.textContent.trim(); }
    else if (peppol) { idTyp = "Peppol";         idWartosc = peppol.textContent.trim(); }
  }

  const skrotUwierz = uwierzNode ? upoGetText(uwierzNode, "SkrotDokumentuUwierzytelniajacego") : "";
  const tokenKSeF   = uwierzNode ? upoGetText(uwierzNode, "NumerReferencyjnyTokenaKSeF") : "";

  // OpisPotwierdzenia — opcjonalne
  const opisNode = root.getElementsByTagNameNS(UPO_NS, "OpisPotwierdzenia")[0];
  const opis = opisNode ? {
    strona:    upoGetText(opisNode, "Strona"),
    liczbaStron: upoGetText(opisNode, "LiczbaStron"),
    od:        upoGetText(opisNode, "ZakresDokumentowOd"),
    do:        upoGetText(opisNode, "ZakresDokumentowDo"),
    calkowita: upoGetText(opisNode, "CalkowitaLiczbaDokumentow")
  } : null;

  // Dokumenty
  const dokNodes = root.getElementsByTagNameNS(UPO_NS, "Dokument");
  const dokumenty = Array.from(dokNodes).map(d => ({
    nipSprzedawcy:   upoGetText(d, "NipSprzedawcy"),
    nrKSeF:          upoGetText(d, "NumerKSeFDokumentu"),
    nrFaktury:       upoGetText(d, "NumerFaktury"),
    dataWystawienia: upoGetText(d, "DataWystawieniaFaktury"),
    dataPrzeslania:  upoGetText(d, "DataPrzeslaniaDokumentu"),
    dataNadania:     upoGetText(d, "DataNadaniaNumeruKSeF"),
    skrot:           upoGetText(d, "SkrotDokumentu"),
    trybWysylki:     upoGetText(d, "TrybWysylki")
  }));

  return {
    podmiotPrzyjmujacy: upoGetText(root, "NazwaPodmiotuPrzyjmujacego"),
    nrSesji:            upoGetText(root, "NumerReferencyjnySesji"),
    uwierzytelnienie:   { typ: idTyp, wartosc: idWartosc, skrot: skrotUwierz, token: tokenKSeF },
    opis,
    nazwaSchemy:        upoGetText(root, "NazwaStrukturyLogicznej"),
    kodFormularza:      upoGetText(root, "KodFormularza"),
    wersjaSchemy:       root.getAttribute("wersjaSchemy") || "",
    dokumenty
  };
}

// ============================================================================
// OBSŁUGA PLIKU
// ============================================================================

function handleUpoFile(file) {
  showLoading();
  currentUpoFileName = file.name.replace(/\.xml$/i, "");

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      if (!content.trim().startsWith('<')) throw new Error("Plik nie jest dokumentem XML.");

      const parser = new DOMParser();
      const xmlDom = parser.parseFromString(content, "application/xml");

      if (xmlDom.getElementsByTagName("parsererror").length > 0)
        throw new Error("Plik XML jest uszkodzony lub niepoprawnie sformatowany.");

      const root = xmlDom.documentElement;
      if (root.localName !== "Potwierdzenie" || root.namespaceURI !== UPO_NS) {
        if (root.namespaceURI === ns)
          throw new Error('To jest faktura FA(3), nie plik UPO. Uzyj zakladki "Wizualizator" aby ja zwizualizowac.');
        throw new Error("Plik nie jest dokumentem UPO KSeF. Oczekiwano schematu UPO v4-3.");
      }

      currentUpoXml = xmlDom;
      renderUpo(xmlDom, file.name);

    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  };
  reader.onerror = () => { hideLoading(); showError("Nie można odczytać pliku."); };
  reader.readAsText(file, "utf-8");
}

function loadSampleUpo(url, name) {
  showLoading();
  currentUpoFileName = name;
  fetch(url)
    .then(r => { if (!r.ok) throw new Error("Nie można pobrać pliku przykładowego."); return r.text(); })
    .then(content => {
      const parser = new DOMParser();
      const xmlDom = parser.parseFromString(content, "application/xml");
      if (xmlDom.getElementsByTagName("parsererror").length > 0)
        throw new Error("Plik przykładowy jest uszkodzony.");
      currentUpoXml = xmlDom;
      renderUpo(xmlDom, name + ".xml");
    })
    .catch(err => { hideLoading(); showError(err.message); });
}

function clearUpoFile() {
  currentUpoXml = null;
  currentUpoFileName = "";
  document.getElementById("upo-pages").innerHTML = "";
  document.getElementById("upoFileInfo").style.display = "none";
  document.querySelector(".upo-upload-area").style.display = "block";
  document.getElementById("fileInputUpo").value = "";
}

// ============================================================================
// RENDERER HTML
// ============================================================================

function renderUpo(xmlDom, fileName) {
  const data = parseUpo(xmlDom);
  const container = document.getElementById("upo-pages");

  // Sekcja OpisPotwierdzenia
  let opisHtml = "";
  if (data.opis) {
    opisHtml = `
      <div class="upo-card upo-card-full">
        <div class="upo-card-label">PODZIAŁ PLIKU UPO (PAGINACJA KSEF)</div>
        <div class="upo-card-row">
          Ten plik to strona <strong>${data.opis.strona}</strong> z <strong>${data.opis.liczbaStron}</strong>
          &nbsp;·&nbsp; Faktury ${data.opis.od}–${data.opis.do} z łącznie <strong>${data.opis.calkowita}</strong>
          ${data.opis.liczbaStron > 1 ? "&nbsp;·&nbsp; <em>Pozostałe strony UPO są w osobnych plikach XML</em>" : ""}
        </div>
      </div>`;
  }

  // Uwierzytelnienie — skrót lub token
  const uwierzDol = data.uwierzytelnienie.skrot
    ? `<div class="upo-card-row"><span>Skrót dok. uwierzytelniającego:</span><code class="upo-hash">${data.uwierzytelnienie.skrot}</code></div>`
    : data.uwierzytelnienie.token
      ? `<div class="upo-card-row"><span>Token KSeF:</span><code class="upo-hash">${data.uwierzytelnienie.token}</code></div>`
      : "";

  // Wiersze tabeli
  const wiersze = data.dokumenty.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.nipSprzedawcy || "—"}</td>
      <td class="upo-nr-ksef" title="${d.nrKSeF}">${d.nrKSeF || "—"}</td>
      <td>${d.nrFaktury || "—"}</td>
      <td>${upoFormatDate(d.dataWystawienia)}</td>
      <td>${upoFormatDateTime(d.dataPrzeslania)}</td>
      <td>${upoFormatDateTime(d.dataNadania)}</td>
      <td><span class="upo-badge ${d.trybWysylki === 'Online' ? 'upo-badge-online' : 'upo-badge-offline'}">${d.trybWysylki || "—"}</span></td>
      <td class="upo-hash-cell">${d.skrot || "—"}</td>
    </tr>`).join("");

  container.innerHTML = `
    <div class="upo-container">

      <div class="upo-header">
        <div>
          <h1>URZĘDOWE POTWIERDZENIE ODBIORU</h1>
          <div class="upo-subtitle">Krajowy System e-Faktur (KSeF) &nbsp;·&nbsp; ${data.kodFormularza || "FA (3)"} &nbsp;·&nbsp; ${data.nazwaSchemy || ""}${data.wersjaSchemy ? " &nbsp;·&nbsp; wersja schematu UPO: " + data.wersjaSchemy : ""}</div>
        </div>
      </div>

      <div class="upo-info-grid">
        <div class="upo-card">
          <div class="upo-card-label">PODMIOT PRZYJMUJĄCY</div>
          <div class="upo-card-value">${data.podmiotPrzyjmujacy || "—"}</div>
          <div class="upo-card-row"><span>Numer sesji:</span> <code class="upo-nr-sesji">${data.nrSesji || "—"}</code></div>
        </div>
        <div class="upo-card">
          <div class="upo-card-label">UWIERZYTELNIENIE</div>
          <div class="upo-card-row"><span>${data.uwierzytelnienie.typ || "ID"}:</span> <strong>${data.uwierzytelnienie.wartosc || "—"}</strong></div>
          ${uwierzDol}
        </div>
        ${opisHtml}
      </div>

      <div class="upo-docs-section">
        <div class="upo-section-header">
          Potwierdzone faktury
          <span class="upo-count-badge">${data.dokumenty.length} dok.</span>
        </div>
        <div class="upo-table-wrap">
          <table class="upo-table">
            <thead>
              <tr>
                <th>#</th>
                <th>NIP sprzedawcy</th>
                <th>Numer KSeF</th>
                <th>Numer faktury</th>
                <th>Data wystawienia</th>
                <th>Data przesłania</th>
                <th>Data nadania nr KSeF</th>
                <th>Tryb</th>
                <th>Hash dokumentu</th>
              </tr>
            </thead>
            <tbody>${wiersze}</tbody>
          </table>
        </div>
      </div>

      <div class="upo-footer-note">
        Wygenerowano przez KSeFeusz.pl · Darmowy wizualizator KSeF · Wersja ${APP_VERSION}
      </div>
    </div>`;

  // Pokaż filebar, ukryj upload
  document.getElementById("upoCurrentFile").textContent = fileName;
  document.getElementById("upoFileInfo").style.display = "flex";
  document.querySelector(".upo-upload-area").style.display = "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
  hideLoading();
}

// ============================================================================
// GENERATOR PDF
// ============================================================================

function generateUpoPdf() {
  if (!currentUpoXml) { showError("Najpierw wczytaj plik UPO XML."); return; }

  const btn = document.getElementById("upoPdfBtn");
  const orig = btn.innerHTML;
  btn.innerHTML = "⏳ Generowanie PDF...";
  btn.disabled = true;

  try {
    const data = parseUpo(currentUpoXml);

    // Identyfikacja uwierzytelnienia
    const uwierzStr = data.uwierzytelnienie.skrot
      ? `Skrót: ${data.uwierzytelnienie.skrot}`
      : data.uwierzytelnienie.token
        ? `Token KSeF: ${data.uwierzytelnienie.token}`
        : "";

    // Lewa karta: podmiot + sesja
    const lewaMeta = [
      pdfSectionHeader("PODMIOT PRZYJMUJĄCY", 0),
      { text: data.podmiotPrzyjmujacy || "—", bold: true, margin: [0, 0, 0, 3] },
      { text: "Numer sesji referencyjnej:", fontSize: 7, color: "#666", margin: [0, 0, 0, 1] },
      { text: data.nrSesji || "—", fontSize: 7, font: "Roboto" }
    ];

    // Prawa karta: uwierzytelnienie
    const prawaUwierz = [
      pdfSectionHeader("UWIERZYTELNIENIE", 0),
      { text: `${data.uwierzytelnienie.typ || "ID"}: ${data.uwierzytelnienie.wartosc || "—"}`, bold: true, margin: [0, 0, 0, 3] }
    ];
    if (uwierzStr) prawaUwierz.push({ text: uwierzStr, fontSize: 7, color: "#555", margin: [0, 0, 0, 0] });

    const docDefinition = {
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [30, 45, 30, 35],
      defaultStyle: { font: "Roboto", fontSize: 8 },

      header: function(currentPage) {
        if (currentPage === 1) return {};
        return {
          columns: [
            { text: "KSeFeusz.pl", fontSize: 7, color: "#bdc3c7", margin: [30, 12, 0, 0] },
            { text: `UPO · ${data.nrSesji || ""}`, alignment: "right", margin: [0, 12, 30, 0], fontSize: 7, color: "#95a5a6" }
          ]
        };
      },

      footer: function(currentPage, pageCount) {
        return {
          columns: [
            { text: "ksefeusz.pl", fontSize: 7, color: "#bdc3c7", margin: [30, 5, 0, 0] },
            { text: `Strona ${currentPage} z ${pageCount}`, alignment: "right", margin: [0, 5, 30, 0], fontSize: 7, color: "#515858" }
          ]
        };
      },

      content: [],
      styles: {
        tableHeader: { bold: true, fontSize: 7, fillColor: "#e8e8e8" }
      }
    };

    // Tytuł
    docDefinition.content.push({
      text: "URZĘDOWE POTWIERDZENIE ODBIORU",
      fontSize: 16, bold: true, color: "#1a5276", margin: [0, 0, 0, 2]
    });
    docDefinition.content.push({
      text: `Krajowy System e-Faktur (KSeF) · ${data.kodFormularza || "FA (3)"} · ${data.nazwaSchemy || ""}${data.wersjaSchemy ? " · wersja schematu UPO: " + data.wersjaSchemy : ""}`,
      fontSize: 8, color: "#666", margin: [0, 0, 0, 10]
    });

    // Dwie karty: podmiot | uwierzytelnienie
    docDefinition.content.push(pdfTwoBox(lewaMeta, prawaUwierz));

    // OpisPotwierdzenia — jeśli istnieje
    if (data.opis) {
      const wielostronicowy = parseInt(data.opis.liczbaStron) > 1;
      docDefinition.content.push(pdfBox([
        pdfSectionHeader("PODZIAŁ PLIKU UPO (PAGINACJA KSEF)", 0),
        { text: `Ten plik to strona ${data.opis.strona} z ${data.opis.liczbaStron}  ·  Faktury ${data.opis.od}–${data.opis.do} z łącznie ${data.opis.calkowita}${wielostronicowy ? "  ·  Pozostałe strony UPO są w osobnych plikach XML" : ""}`, fontSize: 8 }
      ]));
    }

    // Nagłówek tabeli dokumentów
    docDefinition.content.push(pdfSectionHeader(`Potwierdzone faktury (${data.dokumenty.length})`, 8));

    // Tabela
    const tableHeader = [
      "#", "NIP sprzedawcy", "Numer KSeF", "Numer faktury",
      "Data wystawienia", "Data przesłania", "Data nadania nr KSeF", "Tryb", "Hash dokumentu"
    ].map(h => ({ text: h, style: "tableHeader" }));

    const tableRows = data.dokumenty.map((d, i) => [
      { text: String(i + 1), fontSize: 7 },
      { text: d.nipSprzedawcy || "—", fontSize: 7 },
      { text: d.nrKSeF || "—", fontSize: 6, font: "Roboto" },
      { text: d.nrFaktury || "—", fontSize: 7 },
      { text: upoFormatDate(d.dataWystawienia), fontSize: 7 },
      { text: upoFormatDateTime(d.dataPrzeslania), fontSize: 6 },
      { text: upoFormatDateTime(d.dataNadania), fontSize: 6 },
      { text: d.trybWysylki || "—", fontSize: 7 },
      { text: d.skrot || "—", fontSize: 6, font: "Roboto" }
    ]);

    docDefinition.content.push({
      table: {
        headerRows: 1,
        widths: [14, 50, 120, "*", 45, 60, 60, 30, 155],
        body: [tableHeader, ...tableRows]
      },
      layout: {
        fillColor: (rowIndex) => rowIndex === 0 ? "#e8e8e8" : (rowIndex % 2 === 0 ? "#fafafa" : null),
        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0.3,
        vLineWidth: () => 0.3,
        hLineColor: () => "#aaaaaa",
        vLineColor: () => "#aaaaaa",
        paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3
      },
      margin: [0, 4, 0, 10]
    });

    // Stopka dokumentu
    docDefinition.content.push({
      text: `Wygenerowano przez KSeFeusz.pl · Darmowy wizualizator faktur ustrukturyzowanych KSeF · Wersja ${APP_VERSION}`,
      fontSize: 7, color: "#aaaaaa", alignment: "center", margin: [0, 6, 0, 0]
    });

    // Nazwa pliku — data z numeru sesji
    const sesjaDate = (data.nrSesji || "").substring(0, 8);
    const pdfName = `UPO_${sesjaDate || currentUpoFileName}.pdf`;
    pdfMake.createPdf(docDefinition).download(pdfName);

  } catch (err) {
    console.error("Błąd generowania PDF UPO:", err);
    showError("Nie udało się wygenerować PDF: " + err.message);
  } finally {
    btn.innerHTML = orig;
    btn.disabled = false;
  }
}
