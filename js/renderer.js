// ============================================================================
// renderer.js - wersja 1.8.0 (renderowanie HTML faktury)
// ============================================================================
// Zakładamy, że core.js i utils.js są załadowane przed renderer.js

// ============================================================================
// HELPERS
// ============================================================================

function nipHtml(nip) {
  if (!isValidNIP(nip)) {
    return `${nip} <span style="color:#e74c3c;font-size:0.9em" title="${t('Nieprawidłowa suma kontrolna NIP — sprawdź czy numer jest poprawny')}">⚠</span>`;
  }
  return nip;
}

// ============================================================================
// FUNKCJE GRUPUJĄCE WIERSZE KOREKT
// ============================================================================

// priceField — nazwa pola z ceną jednostkową w wierszu. FA(3) trzyma ją w cenaNetto,
// FA_RR w cena (tam nie ma pojęcia "netto"). Poza tym algorytm jest identyczny:
// UU_ID, StanPrzed, GTIN i NrWierszaFa nazywają się w obu schematach tak samo.
function groupCorrectionRows(wierszeArray, priceField = 'cenaNetto') {
  const grouped = [];
  const used = new Set();

  // Krok 1: Parowanie po UUID (1:1, identyczne UU_ID + przeciwne stanPrzed)
  for (let i = 0; i < wierszeArray.length; i++) {
    if (used.has(i)) continue;
    const current = wierszeArray[i];
    if (!isValidUUID(current.uuid)) continue;

    for (let j = i + 1; j < wierszeArray.length; j++) {
      if (used.has(j)) continue;
      const next = wierszeArray[j];
      if (!isValidUUID(next.uuid)) continue;

      if (next.uuid === current.uuid && current.stanPrzed !== next.stanPrzed) {
        const beforeRow = current.stanPrzed ? current : next;
        const afterRow = current.stanPrzed ? next : current;
        grouped.push({
          type: 'pair',
          before: beforeRow,
          after: afterRow,
          _firstIdx: Math.min(i, j)
        });
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  // Krok 2: Parowanie po GTIN/Indeks/nrWiersza
  // UWAGA: w obrębie jednego klucza może istnieć WIELE wierszy "przed" i WIELE "po"
  // (np. ten sam produkt skorygowany kilka razy). Zbieramy je w tablice i parujemy
  // 1:1 w kolejności pojawiania się (FIFO). Nadwyżka po którejś stronie idzie jako 'single'.
  const remainingMap = new Map(); // key -> { befores: [{idx,row}], afters: [{idx,row}] }

  for (let i = 0; i < wierszeArray.length; i++) {
    if (used.has(i)) continue;
    const row = wierszeArray[i];

    let key = null;
    if (row.gtin && row.gtin !== "") {
      key = `gtin:${row.gtin}`;
    } else if (row.indeks && row.indeks !== "") {
      key = `indeks:${row.indeks}`;
    } else if (row.nrWiersza && row.nrWiersza !== "") {
      key = `nr:${row.nrWiersza}`;
    }

    if (!key) {
      grouped.push({ type: 'single', row, isBefore: row.stanPrzed, _firstIdx: i });
      used.add(i);
      continue;
    }

    if (!remainingMap.has(key)) {
      remainingMap.set(key, { befores: [], afters: [] });
    }
    const entry = remainingMap.get(key);
    if (row.stanPrzed) entry.befores.push({ idx: i, row });
    else               entry.afters.push({ idx: i, row });
  }

  // Parowanie 3-stopniowe w obrębie grupy:
  //   (1) identyczna cena netto AND identyczna ilość       — najsilniejszy match
  //   (2) identyczna cena netto                              — korekta ilości
  //   (3) FIFO 1:1                                           — fallback (np. korekta ceny)
  // Pozostałe niesparowane → single
  const sameMoney = (x, y) => Math.abs((parseFloat(x) || 0) - (parseFloat(y) || 0)) < 0.001;
  const sameQty   = (x, y) => Math.abs((parseFloat(x) || 0) - (parseFloat(y) || 0)) < 0.0001;

  const pushPair = (b, a) => {
    grouped.push({
      type: 'pair',
      before: b.row,
      after: a.row,
      _firstIdx: Math.min(b.idx, a.idx)
    });
    used.add(b.idx);
    used.add(a.idx);
  };

  const matchPass = (befores, afters, predicate) => {
    for (let i = 0; i < befores.length; ) {
      const b = befores[i];
      const j = afters.findIndex(a => predicate(b.row, a.row));
      if (j >= 0) {
        pushPair(b, afters[j]);
        befores.splice(i, 1);
        afters.splice(j, 1);
      } else {
        i++;
      }
    }
  };

  for (const entry of remainingMap.values()) {
    const remB = entry.befores.slice();
    const remA = entry.afters.slice();

    // Stage 1: cena + ilość
    matchPass(remB, remA, (b, a) => sameMoney(b[priceField], a[priceField]) && sameQty(b.ilosc, a.ilosc));
    // Stage 2: sama cena
    matchPass(remB, remA, (b, a) => sameMoney(b[priceField], a[priceField]));
    // Stage 3: FIFO 1:1
    const n = Math.min(remB.length, remA.length);
    for (let k = 0; k < n; k++) pushPair(remB[k], remA[k]);

    // Nadwyżka jako single
    for (let k = n; k < remB.length; k++) {
      const b = remB[k];
      grouped.push({ type: 'single', row: b.row, isBefore: true, _firstIdx: b.idx });
      used.add(b.idx);
    }
    for (let k = n; k < remA.length; k++) {
      const a = remA[k];
      grouped.push({ type: 'single', row: a.row, isBefore: false, _firstIdx: a.idx });
      used.add(a.idx);
    }
  }

  // Sortowanie wg oryginalnej kolejności pierwszego wiersza grupy
  return grouped.sort((a, b) => a._firstIdx - b._firstIdx);
}

// ============================================================================
// FUNKCJE RENDERUJĄCE HTML
// ============================================================================

function renderNaglowekHTML(faData, fileName, naglowekData) {
  const title = faData.rodzajDisplay;
  const nrF = faData.nrFaktury;
  const kodWaluty = faData.kodWaluty;

  let tytulZNr = title;
  if (nrF) tytulZNr += ` ${t('nr')} ${nrF}`;

  const ksefNumber = extractKSeFNumberFromFilename(fileName);
  const isValid = ksefNumber && isValidKSeFNumber(ksefNumber);

  let ksefInfo = isValid
    ? `<span>${t('Nr KSeF')}: ${ksefNumber}</span>`
    : ksefNumber
      ? `<span>${t('Nr KSeF')}: ${ksefNumber} <span style="color:#e74c3c" title="${t('Suma kontrolna CRC-8 jest nieprawidłowa — numer może być uszkodzony')}">⚠ ${t('błędna suma kontrolna')}</span></span>`
      : `<span>${t('brak numeru KSeF w nazwie pliku')}</span>`;

  let dodatkoweInfo = [];
  if (naglowekData?.dataWytworzenia) dodatkoweInfo.push(`${t('Wytworzono')}: ${naglowekData.dataWytworzenia.replace('T', ' ').replace(/([+-]\d{2}:\d{2})$/, ' $1').replace(/Z$/, '')}`);
  if (naglowekData?.systemInfo) dodatkoweInfo.push(`${t('System')}: ${naglowekData.systemInfo}`);
  let dodatkoweInfoHtml = dodatkoweInfo.length > 0 ? ` | ${dodatkoweInfo.join(' | ')}` : '';

  return `
    <header>
      <div>
        <h1 style="margin: 0 0 1px 0; font-size: 18px;">${tytulZNr}</h1>
        <div style="font-size: 10px; color: #546e7a; margin-bottom: 1px;">${t('Wizualizacja faktury ustrukturyzowanej XML')}</div>
        <div style="font-size: 10px; color: #546e7a; display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
          ${ksefInfo}
          <span style="background: #f5f5f5; padding: 2px 5px; border-radius: 12px;">${kodWaluty}</span>
          ${dodatkoweInfoHtml}
        </div>
      </div>
    </header>
  `;
}

function renderPodmiotHTML(podmiot, tytul) {
  if (!podmiot) return '';

  let html = `<div class="col"><h2>${tytul}</h2>`;

  // Nazwa
  if (podmiot.nazwa) html += `<strong>${podmiot.nazwa}</strong><br>`;

  // NIP z prefiksem
  if (podmiot.nip) {
    const nipDisplay = podmiot.prefiks ? `${podmiot.prefiks} ${nipHtml(podmiot.nip)}` : nipHtml(podmiot.nip);
    html += `<div><strong>NIP:</strong> ${nipDisplay}</div>`;
  }

  // Adres
  if (podmiot.adres) {
    let adresTekst = `${podmiot.adres.kodKraju || ''} ${podmiot.adres.linia1}`;
    if (podmiot.adres.linia2) adresTekst += `, ${podmiot.adres.linia2}`;
    html += `<div>${adresTekst.trim()}</div>`;
  }

  // Adres korespondencyjny
  if (podmiot.adresKoresp) {
    let adresKorespTekst = `${podmiot.adresKoresp.kodKraju || ''} ${podmiot.adresKoresp.linia1}`;
    if (podmiot.adresKoresp.linia2) adresKorespTekst += `, ${podmiot.adresKoresp.linia2}`;
    html += `<div style="margin-top: 3px;"><strong>${t('Adres koresp.')}:</strong> ${adresKorespTekst.trim()}</div>`;
  }

  // Grid z dodatkowymi danymi
  let gridItems = [];
  if (podmiot.nrEORI) gridItems.push({html: `<span><strong>EORI:</strong> ${podmiot.nrEORI}</span>`});
  if (podmiot.adres?.gln) gridItems.push({html: `<span><strong>GLN:</strong> ${podmiot.adres.gln}</span>`});
  if (podmiot.nrKlienta) gridItems.push({html: `<span><strong>${t('Nr klienta')}:</strong> ${podmiot.nrKlienta}</span>`});
  if (podmiot.nrKontrahenta) gridItems.push({html: `<span><strong>${t('Nr kontrahenta')}:</strong> ${podmiot.nrKontrahenta}</span>`});
  if (podmiot.idNabywcy) gridItems.push({html: `<span><strong>${t('ID nabywcy')}:</strong> ${podmiot.idNabywcy}</span>`});
  if (podmiot.idWew) gridItems.push({html: `<span><strong>${t('ID wewn.')}:</strong> ${podmiot.idWew}</span>`});
  if (podmiot.kodUE && podmiot.nrVatUE) gridItems.push({html: `<span><strong>${t('VAT UE')}:</strong> ${podmiot.kodUE} ${podmiot.nrVatUE}</span>`});
  if (podmiot.kodKrajuId && podmiot.nrID) gridItems.push({html: `<span><strong>${t('ID zagraniczny')}:</strong> ${podmiot.kodKrajuId} ${podmiot.nrID}</span>`});
  if (podmiot.brakID) gridItems.push({html: `<span><em>${t('bez identyfikatora podatkowego')}</em></span>`});
  if (podmiot.jst) gridItems.push({html: `<span>JST: <strong>${podmiot.jst === "1" ? t('jednostka podrzędna') : t('nie')}</strong></span>`, hide: podmiot.jst !== "1"});
  if (podmiot.gv) gridItems.push({html: `<span>GV: <strong>${podmiot.gv === "1" ? t('członek grupy VAT') : t('nie')}</strong></span>`, hide: podmiot.gv !== "1"});
  if (podmiot.status) gridItems.push({html: `<span><strong>${t('Status')}:</strong> ${t(taxpayerStatusMap[podmiot.status]) || podmiot.status}</span>`});
  if (podmiot.udzial) gridItems.push({html: `<span><strong>${t('Udział')}:</strong> ${parseFloat(podmiot.udzial).toFixed(2)}%</span>`});

  if (gridItems.length > 0) {
    html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; margin-top: 1px; font-size: 9px;">';
    html += gridItems.map(item => `<div${item.hide ? ' class="hide-in-simplified"' : ''} style="white-space: normal;">${item.html}</div>`).join('');
    html += '</div>';
  }

  // Dane kontaktowe
  if (podmiot.kontakty && podmiot.kontakty.length > 0) {
    let kontaktyHtml = '';
    for (const kontakt of podmiot.kontakty) {
      let linie = [];
         if (kontakt.emaile.length > 0) linie.push(`<i class="fas fa-envelope"></i> ${kontakt.emaile.join(', ')}</span>`);
      if (kontakt.telefony.length > 0) linie.push(`<i class="fas fa-phone"></i> ${kontakt.telefony.join(', ')}`);
      if (linie.length > 0) {
        kontaktyHtml += `<div style="display: flex; gap: 3px; flex-wrap: wrap; margin-top: 1px; font-size: 9px;">${linie.join('')}</div>`;
      }
    }
    html += kontaktyHtml;
  }

  html += `</div>`;
  return html;
}

function renderPodmiotUpowaznionyHTML(puData) {
  if (!puData) return '';

  let html = `<div class="col" style="margin-top: 5px;"><h2>${tUpper('Podmiot upoważniony')}</h2>`;
  html += `<div><strong>${t('Nazwa')}:</strong> ${puData.nazwa}</div>`;
  html += `<div><strong>NIP:</strong> ${nipHtml(puData.nip)}</div>`;
  if (puData.nrEORI) html += `<div><strong>EORI:</strong> ${puData.nrEORI}</div>`;

  if (puData.adres) {
    let adresTekst = `${puData.adres.kodKraju || ''} ${puData.adres.linia1}`;
    if (puData.adres.linia2) adresTekst += `, ${puData.adres.linia2}`;
    html += `<div><strong>${t('Adres')}:</strong> ${adresTekst.trim()}</div>`;
  }

  if (puData.adresKoresp) {
    let adresKorespTekst = `${puData.adresKoresp.kodKraju || ''} ${puData.adresKoresp.linia1}`;
    if (puData.adresKoresp.linia2) adresKorespTekst += `, ${puData.adresKoresp.linia2}`;
    html += `<div><strong>${t('Adres koresp.')}:</strong> ${adresKorespTekst.trim()}</div>`;
  }

  const roleMapPU = { "1": "Organ egzekucyjny", "2": "Komornik sądowy", "3": "Przedstawiciel podatkowy" };
  if (puData.rola) html += `<div><strong>${t('Rola')}:</strong> ${t(roleMapPU[puData.rola]) || puData.rola}</div>`;

  if (puData.kontakty && puData.kontakty.length > 0) {
    for (const kontakt of puData.kontakty) {
      if (kontakt.emaile.length > 0) html += `<div><i class="fas fa-envelope"></i> ${kontakt.emaile.join(', ')}</div>`;
      if (kontakt.telefony.length > 0) html += `<div><i class="fas fa-phone"></i> ${kontakt.telefony.join(', ')}</div>`;
    }
  }

  html += `</div>`;
  return html;
}

function renderPodmiot3HTML(p3Data) {
  if (!p3Data) return '';

  let html = `<div class="col"><h2>${tUpper('Podmiot trzeci')} ${p3Data.rolaInna ? t('(inny)') : ''}</h2>`;

  if (p3Data.nazwa) html += `<strong>${p3Data.nazwa}</strong><br>`;

  if (p3Data.nip) html += `<div><strong>NIP:</strong> ${p3Data.prefiks ? p3Data.prefiks + ' ' : ''}${nipHtml(p3Data.nip)}</div>`;
  if (p3Data.idWew) html += `<div><strong>${t('ID wewn.')}:</strong> ${p3Data.idWew}</div>`;
  if (p3Data.kodUE && p3Data.nrVatUE) html += `<div><strong>${t('VAT UE')}:</strong> ${p3Data.kodUE} ${p3Data.nrVatUE}</div>`;
  if (p3Data.kodKrajuId && p3Data.nrID) html += `<div><strong>${t('ID zagraniczny')}:</strong> ${p3Data.kodKrajuId} ${p3Data.nrID}</div>`;
  if (p3Data.brakID) html += `<div><em>${t('bez identyfikatora podatkowego')}</em></div>`;

  if (p3Data.adres) {
    let adresTekst = `${p3Data.adres.kodKraju || ''} ${p3Data.adres.linia1}`;
    if (p3Data.adres.linia2) adresTekst += `, ${p3Data.adres.linia2}`;
    html += `<div>${adresTekst.trim()}</div>`;
  }

  if (p3Data.adresKoresp) {
    let adresKorespTekst = `${p3Data.adresKoresp.kodKraju || ''} ${p3Data.adresKoresp.linia1}`;
    if (p3Data.adresKoresp.linia2) adresKorespTekst += `, ${p3Data.adresKoresp.linia2}`;
    html += `<div style="margin-top: 3px;"><strong>${t('Adres koresp.')}:</strong> ${adresKorespTekst.trim()}</div>`;
  }

  html += `<div style="margin-top: 3px;"><strong>${t('Rola')}:</strong> ${t(roleMap[p3Data.rola]) || p3Data.opisRoli || p3Data.rola || '—'}</div>`;

  let gridItems = [];
  if (p3Data.nrEORI) gridItems.push(`<span><strong>EORI:</strong> ${p3Data.nrEORI}</span>`);
  if (p3Data.adres?.gln) gridItems.push(`<span><strong>GLN:</strong> ${p3Data.adres.gln}</span>`);
  if (p3Data.nrKlienta) gridItems.push(`<span><strong>${t('Nr klienta')}:</strong> ${p3Data.nrKlienta}</span>`);
  if (p3Data.idNabywcy) gridItems.push(`<span><strong>${t('ID nabywcy')}:</strong> ${p3Data.idNabywcy}</span>`);
  if (p3Data.udzial) gridItems.push(`<span><strong>${t('Udział')}:</strong> ${parseFloat(p3Data.udzial).toFixed(2)}%</span>`);

  if (gridItems.length > 0) {
    html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; margin-top: 1px; font-size: 9px;">';
    html += gridItems.join('');
    html += '</div>';
  }

  if (p3Data.kontakty && p3Data.kontakty.length > 0) {
    for (const kontakt of p3Data.kontakty) {
      if (kontakt.emaile.length > 0 || kontakt.telefony.length > 0) {
        html += '<div style="display: flex; gap: 3px; flex-wrap: wrap; margin-top: 1px; font-size: 9px;">';
        if (kontakt.emaile.length > 0) html += `<span><i class="fas fa-envelope"></i> ${kontakt.emaile.join(', ')}</span>`;
        if (kontakt.telefony.length > 0) html += `<span><i class="fas fa-phone"></i> ${kontakt.telefony.join(', ')}</span>`;
        html += '</div>';
      }
    }
  }

  html += `</div>`;
  return html;
}

function renderPodmiot1KHTML(p1kData) {
  if (!p1kData) return "";

  let html = `<div class="additional-info"><h2>${t('Dane sprzedawcy przed korektą')}</h2>`;
  html += '<div class="info-item" style="background: #fef5e7; grid-column: span 3;">';

  if (p1kData.nazwa) html += `<div><strong>${t('Nazwa')}:</strong> ${p1kData.nazwa}</div>`;
  if (p1kData.nip) {
    const nipDisplay = p1kData.prefiks ? `${p1kData.prefiks} ${nipHtml(p1kData.nip)}` : nipHtml(p1kData.nip);
    html += `<div><strong>NIP:</strong> ${nipDisplay}</div>`;
  }

  if (p1kData.adres) {
    let adresTekst = `${p1kData.adres.kodKraju || ''} ${p1kData.adres.linia1}`;
    if (p1kData.adres.linia2) adresTekst += `, ${p1kData.adres.linia2}`;
    html += `<div><strong>${t('Adres')}:</strong> ${adresTekst.trim()}</div>`;
    if (p1kData.adres.gln) html += `<div><small>GLN: ${p1kData.adres.gln}</small></div>`;
  }

  html += '</div></div>';
  return html;
}

function renderPodmiot2KFullHTML(p2kFullArray) {
  if (!p2kFullArray || p2kFullArray.length === 0) return "";

  let html = `<div class="additional-info"><h2>${t('Dane nabywców przed korektą')}</h2>`;

  for (let p2k of p2kFullArray) {
    html += '<div class="info-item" style="background: #fef5e7; grid-column: span 3; margin-bottom: 5px;">';
    html += `<span class="info-label">${t('Nabywca przed korektą')}</span>`;

    if (p2k.nazwa) html += `<div><strong>${t('Nazwa')}:</strong> ${p2k.nazwa}</div>`;

    if (p2k.nip) html += `<div><strong>NIP:</strong> ${nipHtml(p2k.nip)}</div>`;
    if (p2k.kodUE && p2k.nrVatUE) html += `<div><strong>${t('VAT UE')}:</strong> ${p2k.kodUE} ${p2k.nrVatUE}</div>`;
    if (p2k.kodKrajuId && p2k.nrID) html += `<div><strong>${t('ID zagraniczny')}:</strong> ${p2k.kodKrajuId} ${p2k.nrID}</div>`;
    if (p2k.brakID) html += `<div><em>${t('bez identyfikatora podatkowego')}</em></div>`;
    if (p2k.idNabywcy) html += `<div><small>ID nabywcy: ${p2k.idNabywcy}</small></div>`;

    if (p2k.adres) {
      let adresTekst = `${p2k.adres.kodKraju || ''} ${p2k.adres.linia1}`;
      if (p2k.adres.linia2) adresTekst += `, ${p2k.adres.linia2}`;
      html += `<div><strong>${t('Adres')}:</strong> ${adresTekst.trim()}</div>`;
      if (p2k.adres.gln) html += `<div><small>GLN: ${p2k.adres.gln}</small></div>`;
    }

    html += '</div>';
  }

  html += '</div>';
  return html;
}

function renderPaymentInfoHTML(p) {
  if (!p) return "—";

  let html = "";

  // Podstawowe dane
  if (p.formaPlatnosci) html += `<div><strong>${t('Forma')}:</strong> ${t(paymentMap[p.formaPlatnosci]) || p.formaPlatnosci}</div>`;
  if (p.platnoscInna && p.opisPlatnosci) html += `<div><strong>${t('Inna forma')}:</strong> ${p.opisPlatnosci}</div>`;

  // Termin
  if (p.terminData) html += `<div><strong>${t('Termin')}:</strong> ${p.terminData}</div>`;
  if (p.terminOpis) {
    const { ilosc, jednostka, zdarzenie } = p.terminOpis;
    if (ilosc && jednostka && zdarzenie) {
      html += `<div><strong>${t('Termin')}:</strong> ${ilosc} ${jednostka} ${t('od')} ${zdarzenie}</div>`;
    } else if (ilosc && jednostka) {
      html += `<div><strong>${t('Termin')}:</strong> ${ilosc} ${jednostka}</div>`;
    }
  }

  // Rachunki
  for (const rach of p.rachunki) {
    if (rach.nrRB) {
      let rachunekInfo = `<div style="margin-top: 5px;"><strong>${t('Rachunek')}:</strong> ${formatujRachunek(rach.nrRB)}`;
      if (rach.swift) rachunekInfo += ` (SWIFT: ${rach.swift})`;

      const typyMap = { "1": "rach. własny (wierzytelności)", "2": "rach. własny (pobranie)", "3": "rach. własny (gospodarka)" };
      if (rach.typWlasny) rachunekInfo += `<br><small>${t(typyMap[rach.typWlasny]) || t('rachunek własny')}</small>`;
      if (rach.nazwaBanku) rachunekInfo += `<br>${rach.nazwaBanku}`;
      if (rach.opis) rachunekInfo += `<br><small>${rach.opis}</small>`;
      rachunekInfo += `</div>`;
      html += rachunekInfo;
    }
  }

  for (const rach of p.rachunkiFaktora) {
    if (rach.nrRB) {
      let rachunekInfo = `<div style="margin-top: 5px;"><strong>${t('Rachunek faktora')}:</strong> ${formatujRachunek(rach.nrRB)}`;
      if (rach.swift) rachunekInfo += ` (SWIFT: ${rach.swift})`;
      const typyMap = { "1": "rach. własny (wierzytelności)", "2": "rach. własny (pobranie)", "3": "rach. własny (gospodarka)" };
      if (rach.typWlasny) rachunekInfo += `<br><small>${t(typyMap[rach.typWlasny]) || t('rachunek własny')}</small>`;
      if (rach.nazwaBanku) rachunekInfo += `<br>${rach.nazwaBanku}`;
      rachunekInfo += `</div>`;
      html += rachunekInfo;
    }
  }

  // Zapłacono
  if (p.zaplacono) html += `<div><strong>${t('Zapłacono')}:</strong> ${t('Tak, dnia')} ${p.dataZaplaty}</div>`;

  // Zapłaty częściowe
  if (p.znacznikZaplatyCzesciowej || p.zaplatyCzesciowe.length > 0) {
    let zaplatyText = `<div><strong>${t('Zapłaty częściowe')}:</strong> `;
    if (p.znacznikZaplatyCzesciowej === "1") zaplatyText += `${t('(częściowa)')} `;
    if (p.znacznikZaplatyCzesciowej === "2") zaplatyText += `${t('(wieloczęściowa)')} `;
    zaplatyText += `</div>`;
    html += zaplatyText;

    for (const z of p.zaplatyCzesciowe) {
      html += `<div style="margin-left: 10px;"><small>- ${formatPrice(z.kwota)} ${t('z')} ${z.data}`;
      if (z.forma) html += ` (${t(paymentMap[z.forma]) || z.forma})`;
      if (z.platnoscInna && z.opisPlatnosci) html += ` - ${z.opisPlatnosci}`;
      html += `</small></div>`;
    }
  }

  // Skonto
  if (p.skonto) {
    html += `<div><strong>${t('Skonto')}:</strong> ${p.skonto.warunki || ''} ${p.skonto.wysokosc ? '(' + p.skonto.wysokosc + ')' : ''}</div>`;
  }

  // Link i IPKSeF
  if (p.linkDoPlatnosci) html += `<div><strong>${t('Link do płatności')}:</strong> <a href="${p.linkDoPlatnosci}" target="_blank" style="color: #3498db;">${t('płatność online')}</a></div>`;
  if (p.ipksef) html += `<div><strong>IPKSeF:</strong> ${p.ipksef}</div>`;

  return html || "—";
}

// Efektywna cena jednostkowa po rabacie = kwotaNetto / ilość. Zwraca liczbę
// tylko wtedy gdy rzeczywiście jest rabat (cena × ilość ≠ kwotaNetto). Działa
// dla obu źródeł rabatu: jawnego P_10 (Opust) i rabatu zaszytego w kwotaNetto.
function rabatEffectivePrice(w) {
  if (w.czyMarza) return null;
  const il = parseFloat(w.ilosc) || 0;
  const cN = parseFloat(w.cenaNetto) || 0;
  const kwN = parseFloat(w.kwotaNetto) || 0;
  const expected = cN * il;
  if (il > 0 && expected > 0.01 && Math.abs(expected - kwN) > 0.01) {
    return kwN / il;
  }
  return null;
}

// Czy któryś wiersz ma rabat? Decyduje, czy w tabeli pojawia się kolumna
// "Cena po rabacie" (gdy żaden wiersz nie ma — kolumna w ogóle nie istnieje).
function hasAnyRabat(wiersze) {
  return wiersze.some(w => rabatEffectivePrice(w) !== null);
}

function rowHTML(w, isBefore = false, showRabatCol = false) {
  const net = w.kwotaNetto;
  const rateDisplay = w.stawkaVatDisplay;
  const vat = w.kwotaVat;
  const gross = w.kwotaBrutto;

  // Dla procedury marży pokazujemy "—" zamiast 0
  const pokazNetto = w.czyMarza ? '—' : formatPrice(net);
  const pokazVat = w.czyMarza ? '—' : formatPrice(vat);

  // Opis z dodatkami
  let pelnyOpis = w.opis || '';
  let dodatki = [];

  if (w.gtu) dodatki.push(w.gtuDisplay);
  if (w.procedura) dodatki.push(w.proceduraDisplay);
  if (w.pkwiu) dodatki.push(`PKWiU: ${w.pkwiu}`);
  if (w.cn) dodatki.push(`CN: ${w.cn}`);
  if (w.pkob) dodatki.push(`PKOB: ${w.pkob}`);
  if (w.kwotaAkcyzy && w.kwotaAkcyzy !== "0") dodatki.push(`${t('Akcyza')}: ${formatPrice(w.kwotaAkcyzy)}`);
  if (w.stawkaOSS) dodatki.push(`OSS: ${w.stawkaOSS}%`);
  // Rabat — dwa źródła, deduplikujemy:
  //  1) jawne P_10 (w.opusty) — pokazujemy jako "Opust: X" tylko gdy NIE pojawi się
  //     wyliczony "Rabat: X (Y%)" niżej (typowo P_10 jest wliczone w kwotaNetto i te dwa
  //     wpisy by się duplikowały). Pokazuje się tylko w rzadkim przypadku gdy P_10
  //     jest deklarowane bez wpływu na kwotaNetto.
  //  2) Rabat/narzut zaszyty w wartości netto (gdy cena × ilość ≠ kwotaNetto) —
  //     pokazuje wartość i procent, bardziej użyteczne.
  {
    const expectedN = (parseFloat(w.cenaNetto) || 0) * (parseFloat(w.ilosc) || 0);
    const actualN = parseFloat(w.kwotaNetto) || 0;
    const hasCalcRabat = !w.czyMarza && expectedN > 0.01 && Math.abs(expectedN - actualN) > 0.01;

    if (w.opusty && w.opusty !== "0" && !hasCalcRabat) {
      dodatki.push(`${t('Opust')}: ${formatPrice(w.opusty)}`);
    }
    if (hasCalcRabat) {
      const diff = expectedN - actualN;
      const pct = Math.abs(diff / expectedN * 100);
      dodatki.push(diff > 0
        ? `${t('Rabat')}: ${formatPrice(diff)} (${pct.toFixed(1)}%)`
        : `${t('Narzut')}: ${formatPrice(-diff)} (${pct.toFixed(1)}%)`);
    }
  }
  if (w.dataPozycji) dodatki.push(`${t('Data')}: ${w.dataPozycji}`);
  if (w.kursWaluty && w.kursWaluty !== "0") dodatki.push(`${t('Kurs')}: ${w.kursWaluty}`);
  if (w.zal15) dodatki.push(t('Zał.15'));
  // UUID (w.uuid) celowo nie pokazujemy w UI — to dane techniczne używane
  // wyłącznie do parowania wierszy w korektach (groupCorrectionRows).

  if (dodatki.length > 0) {
    pelnyOpis += ' <small>(' + dodatki.join(' | ') + ')</small>';
  }

  if (isBefore) {
    pelnyOpis += ` <small>${t('(przed korektą)')}</small>`;
  }

  // Logika dla ceny — dla marży cenaNetto=0 (netto nie jest ujawniane), pokazujemy cenaBrutto
  let cenaKomorka;
  if (w.cenaBrutto && w.cenaBrutto !== "0" && (w.cenaNetto === 0 || Math.abs(w.cenaNetto) < 0.01)) {
    cenaKomorka = `${formatPrice(w.cenaBrutto)} <small>${t('(brutto)')}</small>`;
  } else {
    cenaKomorka = formatPrice(w.cenaNetto);
  }

  let rowClass = isBefore ? 'before-row' : '';

  // Komórka "Cena po rabacie": efektywna cena jednostkowa (kwotaNetto / ilość)
  // — pokazujemy tylko gdy wiersz rzeczywiście ma rabat (rabatEffectivePrice ≠ null).
  let rabatCell = '';
  if (showRabatCol) {
    const eff = rabatEffectivePrice(w);
    rabatCell = eff !== null
      ? `<td class="right">${formatPrice(eff)}</td>`
      : '<td></td>';
  }

  return `
<tr class="${rowClass}">
  <td class="center">${w.nrWiersza || ''}</td>
  <td>${pelnyOpis}</td>
  <td>${w.indeks || '—'}</td>
  <td>${w.gtin || '—'}</td>
  <td class="right">${fmtQty(w.ilosc)}</td>
  <td class="center">${w.jednostka || ''}</td>
  <td class="right">${cenaKomorka}</td>
  ${rabatCell}
  <td class="right">${pokazNetto}</td>
  <td class="center">${rateDisplay}</td>
  <td class="right">${pokazVat}</td>
  <td class="right">${formatPrice(gross)}</td>
</tr>`;
}

// Czy podsumowanie VAT ma jakiekolwiek dane. Faktura potrafi nie mieć żadnego
// pola P_13/P_14 i P_15 = 0.00 (np. korekta samych danych nabywcy) — wtedy tabelka
// byłaby pustym nagłówkiem + wierszem RAZEM z zerami. Nie renderujemy jej wcale.
// Wspólna logika dla HTML (renderer.js) i PDF (main.js) — jedno źródło prawdy.
function hasVatSummaryData(faData) {
  const v = (faData && faData.vatSummary) || {};
  return Object.keys(v).some(k => (parseFloat(v[k]) || 0) !== 0);
}

function vatSummaryHTML(faData) {
  if (!hasVatSummaryData(faData)) return "";

  const v = faData.vatSummary;

  const fields = [
    { n: v.p13_1, v: v.p14_1, w: v.p14_1w, l: "23% / 22%" },
    { n: v.p13_2, v: v.p14_2, w: v.p14_2w, l: "8% / 7%" },
    { n: v.p13_3, v: v.p14_3, w: v.p14_3w, l: "5%" },
    { n: v.p13_4, v: v.p14_4, w: v.p14_4w, l: t("ryczałt taxi") },
    { n: v.p13_5, v: v.p14_5, l: "OSS" },
    { n: v.p13_6_1, l: t("0% (kraj)") },
    { n: v.p13_6_2, l: t("0% (WDT)") },
    { n: v.p13_6_3, l: t("0% (eksport)") },
    { n: v.p13_7, l: t("zwolnione") },
    { n: v.p13_8, l: t("niepodlegające") },
    { n: v.p13_9, l: t("art. 100") },
    { n: v.p13_10, l: t("odwrotne obciążenie") },
    { n: v.p13_11, l: t("marża") }
  ];

  let tn = 0, tv = 0;
  let czyKolumnaW = fields.some(f => f.w && parseFloat(f.w || 0) !== 0);

  let html = `<table class="vat-summary no-break""><tr><th>${t('Kategoria')}</th><th class="right">${t('Netto')}</th><th class="right">${t('VAT')}</th>`;
  if (czyKolumnaW) html += `<th class="right">${t('VAT(przel.)')}</th>`;
  html += `<th class="right">${t('Brutto')}</th></tr>`;

  fields.forEach(f => {
    const n = parseFloat(f.n || 0);
    const vatVal = parseFloat(f.v || 0);
    const w = f.w ? parseFloat(f.w || 0) : null;

    if (n !== 0 || vatVal !== 0 || (w && w !== 0)) {
      html += `<tr><td>${f.l}</td><td class="right">${formatPrice(n)}</td><td class="right">${formatPrice(vatVal)}</td>`;
      if (czyKolumnaW) html += `<td class="right">${w ? formatPrice(w) : '—'}</td>`;
      html += `<td class="right">${formatPrice(n + vatVal)}</td></tr>`;
      tn += n;
      tv += vatVal;
    }
  });

  const p15 = parseFloat(v.p15 || 0);
  html += `<tr><th>${t('RAZEM')}</th><th class="right">${formatPrice(tn)}</th><th class="right">${formatPrice(tv)}</th>`;
  if (czyKolumnaW) html += `<th class="right">—</th>`;
  html += `<th class="right">${formatPrice(p15)}</th></tr></table>`;

  return html;
}

// Czy wolno pokazać wiersze RÓŻNICA w korekcie.
// Wiersz RÓŻNICA to nasza nadbudowa nad danymi z XML, nie pole z faktury — pokazujemy go
// tylko wtedy, gdy delta wyliczona z wierszy (po − przed) zgadza się z deklaracją
// w polach P_13_X / P_14_X / P_15. Gdy sumy się rozjeżdżają, nie wiemy które wiersze
// wystawca faktycznie skorygował — wtedy prezentujemy czystą wizualizację XML,
// bez wierszy RÓŻNICA i bez komentarza. Tolerancja 0.02 zł (zaokrąglenia wystawcy).
// Wspólna logika dla HTML (renderer.js) i PDF (main.js) — jedno źródło prawdy.
function correctionDiffRowsAllowed(faData, wierszeArray) {
  if (!faData || !faData.rodzaj || !faData.rodzaj.startsWith("KOR")) return true;
  if (!wierszeArray || wierszeArray.length === 0) return true;

  const grouped = groupCorrectionRows(wierszeArray);
  // Bez par i tak nie ma z czego zbudować wiersza RÓŻNICA — nie ma co blokować.
  if (!grouped.some(g => g.type === 'pair')) return true;

  // Liczymy deltę tylko z par i wierszy-usunięć (StanPrzed bez pary).
  // Wiersze "po" bez pary są pomijane — mogą to być pozycje kontekstowe
  // (niezmienione pozycje z FV pierwotnej wklejone przez wystawcę dla przejrzystości).
  let calcN = 0, calcV = 0, calcG = 0;
  for (const g of grouped) {
    if (g.type === 'pair') {
      calcN += (parseFloat(g.after.kwotaNetto) || 0) - (parseFloat(g.before.kwotaNetto) || 0);
      calcV += (parseFloat(g.after.kwotaVat) || 0) - (parseFloat(g.before.kwotaVat) || 0);
      calcG += (parseFloat(g.after.kwotaBrutto) || 0) - (parseFloat(g.before.kwotaBrutto) || 0);
    } else if (g.isBefore) {
      calcN -= parseFloat(g.row.kwotaNetto) || 0;
      calcV -= parseFloat(g.row.kwotaVat) || 0;
      calcG -= parseFloat(g.row.kwotaBrutto) || 0;
    }
  }

  const TOL = 0.02;
  // Korekta nagłówkowa (np. skonto): wiersze mają wartości zerowe, kwoty siedzą tylko
  // w P_13/P_14/P_15 → brak bazy do porównania. Nie blokujemy — i tak nie powstaną
  // niezerowe wiersze RÓŻNICA (warunek diffNet/diffVat/... !== 0 ich nie przepuści).
  if (Math.abs(calcN) <= TOL && Math.abs(calcV) <= TOL && Math.abs(calcG) <= TOL) return true;

  const v = faData.vatSummary || {};
  const sumKeys = (keys) => keys.reduce((s, k) => s + (parseFloat(v[k]) || 0), 0);
  const declN = sumKeys(['p13_1','p13_2','p13_3','p13_4','p13_5','p13_6_1','p13_6_2','p13_6_3','p13_7','p13_8','p13_9','p13_10','p13_11']);
  const declV = sumKeys(['p14_1','p14_2','p14_3','p14_4','p14_5']);
  const declG = parseFloat(v.p15) || 0;

  return Math.abs(calcN - declN) <= TOL
      && Math.abs(calcV - declV) <= TOL
      && Math.abs(calcG - declG) <= TOL;
}

// Walidacja spójności nagłówka: czy suma netto (ΣP_13_X) + VAT (ΣP_14_X)
// zgadza się z zadeklarowaną kwotą brutto P_15. Niezależna od korekt —
// łapie błędne/oderwane P_15 na dowolnej fakturze. Zwraca obiekt z liczbami
// albo null gdy spójne lub gdy P_15 z definicji ≠ ΣP_13+ΣP_14 (faktura
// rozliczeniowa / z rozliczanymi zaliczkami). Tolerancja 0.02 zł.
// Wspólna logika dla HTML (renderer.js) i PDF (main.js) — jedno źródło prawdy.
function vatHeaderConsistencyCalc(faData) {
  const v = faData.vatSummary || {};

  // Faktura rozliczeniowa (art. 106f ust. 3): P_15 = kwota POZOSTAŁA do zapłaty
  // (pomniejszona o zaliczki) → P_15 ≠ ΣP_13+ΣP_14 zgodnie z prawem. Milczymy.
  if (faData.rodzaj === 'ROZ' || faData.rodzaj === 'KOR_ROZ') return null;
  if (faData.zaliczkiCzesciowe && faData.zaliczkiCzesciowe.zaplaty && faData.zaliczkiCzesciowe.zaplaty.length > 0) return null;

  const present = (k) => v[k] !== undefined && v[k] !== null && String(v[k]).trim() !== "";
  const netKeys = ['p13_1','p13_2','p13_3','p13_4','p13_5','p13_6_1','p13_6_2','p13_6_3','p13_7','p13_8','p13_9','p13_10','p13_11'];
  const vatKeys = ['p14_1','p14_2','p14_3','p14_4','p14_5'];

  // Brak P_15 albo brak jakiegokolwiek pola netto/VAT → nie ma czego porównywać.
  if (!present('p15')) return null;
  if (!netKeys.some(present) && !vatKeys.some(present)) return null;

  const sum = (keys) => keys.reduce((s, k) => s + (parseFloat(v[k]) || 0), 0);
  const net = sum(netKeys);
  const vat = sum(vatKeys);  // bez P_14_XW — VAT przeliczony (PLN) nie wchodzi do P_15
  const expected = net + vat;
  const p15 = parseFloat(v.p15) || 0;
  const diff = expected - p15;

  if (Math.abs(diff) <= 0.02) return null;
  return { net, vat, expected, p15, diff };
}

function vatHeaderConsistencyCheckHTML(faData) {
  const mm = vatHeaderConsistencyCalc(faData);
  if (!mm) return "";

  return `
    <div class="correction-mismatch no-break">
      <strong>⚠ ${t('Niezgodność sum w nagłówku faktury')}</strong>
      <p>${t('Suma wartości netto i VAT z pól P_13 / P_14 nie zgadza się z zadeklarowaną kwotą brutto (P_15)')}:</p>
      <table>
        <tr><td>${t('Suma netto (P_13)')}</td><td class="right">${formatPrice(mm.net)}</td></tr>
        <tr><td>${t('Suma VAT (P_14)')}</td><td class="right">${formatPrice(mm.vat)}</td></tr>
        <tr><td>${t('Netto + VAT').replace(/ /g, '&nbsp;')}</td><td class="right"><strong>${formatPrice(mm.expected)}</strong></td></tr>
        <tr><td>${t('Brutto zadeklarowane (P_15)')}</td><td class="right"><strong>${formatPrice(mm.p15)}</strong></td></tr>
        <tr><td>${t('Rozbieżność')}</td><td class="right"><strong>${formatPrice(mm.diff)}</strong></td></tr>
      </table>
      <small>${t('KSeFeusz.pl prezentuje dane wyłącznie w formie wizualizacji oryginalnego pliku XML. W razie wątpliwości zweryfikuj dane źródłowe w pliku XML lub bezpośrednio w KSeF — wizualizator nie modyfikuje wartości z faktury.')}</small>
    </div>
  `;
}

function renderRozliczenieHTML(r) {
  if (!r) return "";

  let html = `<div class="additional-info no-break"><h2>${t('Rozliczenie')}</h2><div class="info-grid">`;
  let hasContent = false;

  // Obciążenia
  for (let obc of r.obciazenia) {
    if (obc.kwota && obc.powod) {
      html += `<div class="info-item">
        <span class="info-label">${t('Obciążenie')}</span>
        <strong>${formatPrice(obc.kwota)}</strong><br>
        <small>${obc.powod}</small>
      </div>`;
      hasContent = true;
    }
  }

  if (r.sumaObciazen) {
    html += `<div class="info-item">
      <span class="info-label">${t('Suma obciążeń')}</span>
      <strong>${formatPrice(r.sumaObciazen)}</strong>
    </div>`;
    hasContent = true;
  }

  // Odliczenia
  for (let odl of r.odliczenia) {
    if (odl.kwota && odl.powod) {
      html += `<div class="info-item">
        <span class="info-label">${t('Odliczenie')}</span>
        <strong>${formatPrice(odl.kwota)}</strong><br>
        <small>${odl.powod}</small>
      </div>`;
      hasContent = true;
    }
  }

  if (r.sumaOdliczen) {
    html += `<div class="info-item">
      <span class="info-label">${t('Suma odliczeń')}</span>
      <strong>${formatPrice(r.sumaOdliczen)}</strong>
    </div>`;
    hasContent = true;
  }

  if (r.doZaplaty) {
    html += `<div class="info-item" style="background: #e8f8f5;">
      <span class="info-label">${t('Do zapłaty')}</span>
      <strong>${formatPrice(r.doZaplaty)}</strong>
    </div>`;
    hasContent = true;
  }

  if (r.doRozliczenia) {
    html += `<div class="info-item" style="background: #fef5e7;">
      <span class="info-label">${t('Do rozliczenia')}</span>
      <strong>${formatPrice(r.doRozliczenia)}</strong>
    </div>`;
    hasContent = true;
  }

  html += '</div></div>';
  return hasContent ? html : "";
}


function renderZaliczkaCzesciowaHTML(zaliczkiData) {
  if (!zaliczkiData || !zaliczkiData.zaplaty || zaliczkiData.zaplaty.length === 0) return "";

  let html = `<div class="additional-info"><h2>${t('Zaliczki częściowe')}</h2><div class="info-grid">`;

  for (let z of zaliczkiData.zaplaty) {
    html += `<div class="info-item" style="grid-column: span 3;">`;
    html += `<span class="info-label">${t('Zaliczka')}</span>`;
    if (z.dataOtrzymania) html += `<div><strong>${t('Data otrzymania')}:</strong> ${z.dataOtrzymania}</div>`;
    if (z.kwota) html += `<div><strong>${t('Kwota')}:</strong> ${formatPrice(z.kwota)}</div>`;
    if (z.kursWaluty) html += `<div><strong>${t('Kurs waluty')}:</strong> ${z.kursWaluty}</div>`;
    html += `</div>`;
  }

  html += '</div></div>';
  return html;
}

function renderWarunkiTransakcjiHTML(w) {
  if (!w) return '';

  let html = `<div class="additional-info"><h2>${t('Warunki transakcji')}</h2><div class="info-grid">`;
  let hasContent = false;

  // Umowy
  if (w.umowy && w.umowy.length > 0) {
    const umowyList = w.umowy.map(u => (u.nr && u.data) ? `${u.nr} ${t('z dnia')} ${u.data}` : (u.nr || u.data)).filter(Boolean);
    if (umowyList.length > 0) {
      html += `<div class="info-item"><span class="info-label">${t('Umowy')}:</span> ${umowyList.join('; ')}</div>`;
      hasContent = true;
    }
  }

  // Zamówienia
  if (w.zamowienia && w.zamowienia.length > 0) {
    const zamowieniaList = w.zamowienia.map(z => (z.nr && z.data) ? `${z.nr} ${t('z dnia')} ${z.data}` : (z.nr || z.data)).filter(Boolean);
    if (zamowieniaList.length > 0) {
      html += `<div class="info-item"><span class="info-label">${t('Zamówienia')}:</span> ${zamowieniaList.join('; ')}</div>`;
      hasContent = true;
    }
  }

  // Partie towaru
  if (w.partie && w.partie.length > 0) {
    html += `<div class="info-item"><span class="info-label">${t('Partie towaru')}:</span> ${w.partie.join(', ')}</div>`;
    hasContent = true;
  }

  // Warunki dostawy (Incoterms)
  if (w.warunkiDostawy) {
    html += `<div class="info-item"><span class="info-label">${t('Incoterms')}:</span> ${w.warunkiDostawy}</div>`;
    hasContent = true;
  }

  // Kurs umowny
  if (w.kursUmowny && w.walutaUmowna) {
    html += `<div class="info-item"><span class="info-label">${t('Kurs umowny')}:</span> 1 ${w.walutaUmowna} = ${w.kursUmowny} PLN</div>`;
    hasContent = true;
  }

  // Podmiot pośredniczący (transakcja łańcuchowa)
  if (w.podmiotPosredniczacy !== null) {
    const positive = w.podmiotPosredniczacy;
    html += `<div class="info-item${positive ? '' : ' hide-in-simplified'}"><span class="info-label">${t('Transakcja łańcuchowa')}:</span> ${positive ? t('Tak (podmiot pośredniczący)') : t('Nie')}</div>`;
    hasContent = true;
  }

  html += '</div>';

  // Transport
  const maTransport = w.transporty && w.transporty.length > 0;
  if (maTransport) {
    hasContent = true;
    html += '<div style="margin-top: 5px;">';
    for (let tr of w.transporty) {
      html += '<div class="info-item" style="grid-column: span 3; margin-bottom: 5px;">';
      html += `<span class="info-label">${t('Transport')}</span>`;

      // Rodzaj transportu
      if (tr.rodzaj) {
        const rodzajMap = { "1": "Morski", "2": "Kolejowy", "3": "Drogowy", "4": "Lotniczy", "5": "Przesyłka pocztowa", "7": "Stałe instalacje przesyłowe", "8": "Żegluga śródlądowa" };
        html += `<div><strong>${t('Rodzaj')}:</strong> ${t(rodzajMap[tr.rodzaj]) || tr.rodzaj}</div>`;
      } else if (tr.transportInny && tr.opisInnegoTransportu) {
        html += `<div><strong>${t('Rodzaj')}:</strong> ${tr.opisInnegoTransportu} ${t('(inny)')}</div>`;
      }

		  // Przewoźnik - rozszerzona wersja
	if (tr.przewoznik) {
	  html += `<div><strong>${t('Przewoźnik')}:</strong> `;
	  if (tr.przewoznik.nazwa) html += tr.przewoznik.nazwa;
	  html += `</div>`;

	  if (tr.przewoznik.nip) html += `<div><small>NIP: ${nipHtml(tr.przewoznik.nip)}</small></div>`;
	  if (tr.przewoznik.kodUE && tr.przewoznik.nrVatUE) html += `<div><small>${t('VAT UE')}: ${tr.przewoznik.kodUE} ${tr.przewoznik.nrVatUE}</small></div>`;
	  if (tr.przewoznik.kodKrajuId && tr.przewoznik.nrID) html += `<div><small>${t('ID zagraniczny')}: ${tr.przewoznik.kodKrajuId} ${tr.przewoznik.nrID}</small></div>`;
	  if (tr.przewoznik.brakID) html += `<div><small>${t('bez identyfikatora podatkowego')}</small></div>`;

	  if (tr.przewoznik.adres) {
		let adresTekst = `${tr.przewoznik.adres.kodKraju || ''} ${tr.przewoznik.adres.linia1}`;
		if (tr.przewoznik.adres.linia2) adresTekst += `, ${tr.przewoznik.adres.linia2}`;
		html += `<div><small>${t('Adres')}: ${adresTekst.trim()}</small></div>`;
		if (tr.przewoznik.adres.gln) html += `<div><small>GLN: ${tr.przewoznik.adres.gln}</small></div>`;
	  }
	}

      // Numer zlecenia
      if (tr.nrZlecenia) html += `<div><strong>${t('Zlecenie')}:</strong> ${tr.nrZlecenia}</div>`;

      // Ładunek
      if (tr.ladunek) {
        const ladunekMap = { "1": "Bańka", "2": "Beczka", "3": "Butla", "4": "Karton", "5": "Kanister", "6": "Klatka", "7": "Kontener", "8": "Kosz/koszyk", "9": "Łubianka", "10": "Opakowanie zbiorcze", "11": "Paczka", "12": "Pakiet", "13": "Paleta", "14": "Pojemnik", "15": "Pojemnik do ładunków masowych stałych", "16": "Pojemnik do ładunków masowych w postaci płynnej", "17": "Pudełko", "18": "Puszka", "19": "Skrzynia", "20": "Worek" };
        html += `<div><strong>${t('Ładunek')}:</strong> ${t(ladunekMap[tr.ladunek]) || tr.ladunek}`;
        if (tr.jednostkaOpakowania) html += ` (${tr.jednostkaOpakowania})`;
        html += `</div>`;
      } else if (tr.ladunekInny && tr.opisInnegoLadunku) {
        html += `<div><strong>${t('Ładunek')}:</strong> ${tr.opisInnegoLadunku} ${t('(inny)')}`;
        if (tr.jednostkaOpakowania) html += ` (${tr.jednostkaOpakowania})`;
        html += `</div>`;
      }

      // Daty transportu
      if (tr.dataRozp || tr.dataZak) {
        let daty = [];
        if (tr.dataRozp) daty.push(`${t('od:')} ${tr.dataRozp}`);
        if (tr.dataZak) daty.push(`${t('do:')} ${tr.dataZak}`);
        html += `<div><strong>${t('Termin')}:</strong> ${daty.join(' ')}</div>`;
      }

      // Miejsca
      if (tr.wysylkaZ) {
        let miejsce = `${tr.wysylkaZ.kodKraju || ''} ${tr.wysylkaZ.linia1}`;
        if (tr.wysylkaZ.linia2) miejsce += `, ${tr.wysylkaZ.linia2}`;
        html += `<div><strong>${t('Wysyłka z')}:</strong> ${miejsce.trim()}</div>`;
      }

      if (tr.wysylkaDo) {
        let miejsce = `${tr.wysylkaDo.kodKraju || ''} ${tr.wysylkaDo.linia1}`;
        if (tr.wysylkaDo.linia2) miejsce += `, ${tr.wysylkaDo.linia2}`;
        html += `<div><strong>${t('Wysyłka do')}:</strong> ${miejsce.trim()}</div>`;
      }

      if (tr.wysylkaPrzez && tr.wysylkaPrzez.length > 0) {
        const przezList = tr.wysylkaPrzez.map((p, idx) => {
          let miejsce = `${p.kodKraju || ''} ${p.linia1 || ''}`.trim();
          if (p.linia2) miejsce += `, ${p.linia2}`;
          return `${idx + 1}. ${miejsce}`;
        }).join('; ');
        html += `<div><strong>${t('Wysyłka przez')}:</strong> ${przezList}</div>`;
      }

      html += `</div>`;
    }
    html += '</div>';
    hasContent = true;
  }

  html += '</div>';
  return hasContent ? html : "";
}

function renderAdnotacjeHTML(a) {
  if (!a) return '';

  let innerHtml = '';
  let hasContent = false;
  let hasPositive = false;

  // Podstawowe adnotacje
  if (a.p16) {
    const pos = a.p16 === "1";
    if (pos) hasPositive = true;
    innerHtml += `<div class="info-item">${t('Metoda kasowa')}: <span class="info-label">${pos ? t('Tak') : t('Nie')}</span></div>`;
    hasContent = true;
  }
  if (a.p17) {
    const pos = a.p17 === "1";
    if (pos) hasPositive = true;
    innerHtml += `<div class="info-item">${t('Samofakturowanie')}: <span class="info-label">${pos ? t('Tak') : t('Nie')}</span></div>`;
    hasContent = true;
  }
  if (a.p18) {
    const pos = a.p18 === "1";
    if (pos) hasPositive = true;
    innerHtml += `<div class="info-item">${t('Odwrotne obciążenie')}: <span class="info-label">${pos ? t('Tak') : t('Nie')}</span></div>`;
    hasContent = true;
  }
  if (a.p18a) {
    const pos = a.p18a === "1";
    if (pos) hasPositive = true;
    innerHtml += `<div class="info-item">${t('Split payment')}: <span class="info-label">${pos ? t('Tak') : t('Nie')}</span></div>`;
    hasContent = true;
  }
  if (a.p23) {
    const pos = a.p23 === "1";
    if (pos) hasPositive = true;
    innerHtml += `<div class="info-item">${t('Procedura uproszczona WE')}: <span class="info-label">${pos ? t('Tak') : t('Nie')}</span></div>`;
    hasContent = true;
  }

  // Zwolnienie
  if (a.zwolnienie) {
    if (a.zwolnienie.p19) {
      hasPositive = true;
      let podstawa = a.zwolnienie.p19a || a.zwolnienie.p19b || a.zwolnienie.p19c;
      innerHtml += `<div class="info-item">${t('Zwolnienie')}: <span class="info-label">${t('Tak')} (${podstawa || t('brak podstawy')})</span></div>`;
      hasContent = true;
    } else if (a.zwolnienie.p19n) {
      innerHtml += `<div class="info-item">${t('Zwolnienie')}: <span class="info-label">${t('Nie dotyczy')}</span></div>`;
      hasContent = true;
    }
  }

  // Procedura marży
  if (a.proceduraMarzy) {
    if (a.proceduraMarzy.wystepuje) {
      hasPositive = true;
      let typy = [];
      if (a.proceduraMarzy.biuraPodrozy) typy.push(t("biura podróży"));
      if (a.proceduraMarzy.towaryUzywane) typy.push(t("towary używane"));
      if (a.proceduraMarzy.dzielaSztuki) typy.push(t("dzieła sztuki"));
      if (a.proceduraMarzy.antyki) typy.push(t("kolekcjonerskie/antyki"));
      innerHtml += `<div class="info-item">${t('Procedura marży')}: <span class="info-label">${t('Tak')} (${typy.join(', ')})</span></div>`;
      hasContent = true;
    } else if (a.proceduraMarzy.brak) {
      innerHtml += `<div class="info-item">${t('Procedura marży')}: <span class="info-label">${t('Nie')}</span></div>`;
      hasContent = true;
    }
  }

  if (!hasContent) return '';
  const simplifiedClass = hasPositive ? '' : ' hide-in-simplified';
  return `<div class="additional-info${simplifiedClass}"><h2>${t('Adnotacje')}</h2><div class="info-grid">${innerHtml}</div></div>`;
}

function renderNoweSrodkiHTML(a) {
  if (!a?.noweSrodkiTransportu) return '';

  const nst = a.noweSrodkiTransportu;

  if (nst.p22n) {
    return `<div class="additional-info hide-in-simplified"><h2>${t('Nowe środki transportu')}</h2><div class="info-grid"><div class="info-item" style="grid-column: span 3;">${t('Wewnątrzwspólnotowa dostawa nowych środków transportu')}: <span class="info-label">${t('Nie dotyczy')}</span></div></div></div>`;
  }

  let html = `<div class="additional-info"><h2>${t('Nowe środki transportu')}</h2><div class="info-grid">`;

  if (nst.p42_5 !== undefined) {
    html += `<div class="info-item"><span class="info-label">${t('Art. 42 ust. 5')}</span> ${nst.p42_5 ? t('Tak') : t('Nie')}</div>`;
  }

  for (let pojazd of nst.pojazdy) {
    html += `<div class="info-item" style="grid-column: span 3;">`;
    html += `<span class="info-label">${t('Nowy środek transportu')}</span>`;
    if (pojazd.dataDopuszczenia) html += `<div><strong>${t('Data dopuszczenia')}:</strong> ${pojazd.dataDopuszczenia}</div>`;
    if (pojazd.nrWiersza) html += `<div><strong>${t('Nr wiersza')}:</strong> ${pojazd.nrWiersza}</div>`;

    let dane = [];
    if (pojazd.marka) dane.push(pojazd.marka);
    if (pojazd.model) dane.push(pojazd.model);
    if (pojazd.kolor) dane.push(`(${pojazd.kolor})`);
    if (pojazd.nrRej) dane.push(`[${pojazd.nrRej}]`);
    if (pojazd.rokProd) dane.push(`${t('rocznik')} ${pojazd.rokProd}`);
    if (dane.length > 0) html += `<div><strong>${t('Dane')}:</strong> ${dane.join(' ')}</div>`;

    if (pojazd.przebieg) html += `<div><strong>${t('Przebieg')}:</strong> ${pojazd.przebieg} km</div>`;
    if (pojazd.vin || pojazd.nadwozie || pojazd.podwozie || pojazd.rama) {
      let numery = [];
      if (pojazd.vin) numery.push(`VIN: ${pojazd.vin}`);
      if (pojazd.nadwozie) numery.push(`${t('nadwozie')}: ${pojazd.nadwozie}`);
      if (pojazd.podwozie) numery.push(`${t('podwozie')}: ${pojazd.podwozie}`);
      if (pojazd.rama) numery.push(`${t('rama')}: ${pojazd.rama}`);
      html += `<div><strong>${t('Numery')}:</strong> ${numery.join(' ')}</div>`;
    }
    if (pojazd.typ) html += `<div><strong>${t('Typ')}:</strong> ${pojazd.typ}</div>`;
    if (pojazd.godzinyLodz) html += `<div><strong>${t('Godziny robocze (jednostka pływająca)')}:</strong> ${pojazd.godzinyLodz}</div>`;
    if (pojazd.kadlub) html += `<div><strong>${t('Nr kadłuba')}:</strong> ${pojazd.kadlub}</div>`;
    if (pojazd.godzinySamolot) html += `<div><strong>${t('Godziny robocze (statek powietrzny)')}:</strong> ${pojazd.godzinySamolot}</div>`;
    if (pojazd.fabryczny) html += `<div><strong>${t('Nr fabryczny')}:</strong> ${pojazd.fabryczny}</div>`;

    html += `</div>`;
  }

  html += '</div></div>';
  return html;
}

function renderFakturyZaliczkoweHTML(faData) {
  if (!faData.fakturyZaliczkowe || faData.fakturyZaliczkowe.length === 0) return "";

  let html = `<div class="additional-info"><h2>${t('Faktury zaliczkowe')}</h2><div class="info-grid">`;

  for (let fz of faData.fakturyZaliczkowe) {
    let zalInfo = '';
    if (fz.nrKSeF) {
      zalInfo = `KSeF: ${fz.nrKSeF}`;
    } else if (fz.nrPoza) {
      zalInfo = `${t('poza KSeF')}: ${fz.nrPoza}`;
    } else if (fz.znacznik) {
      zalInfo = t('(wystawiona poza KSeF)');
    }
    if (zalInfo) {
      html += `<div class="info-item"><span class="info-label">${t('Faktura zaliczkowa')}:</span> ${zalInfo}</div>`;
    }
  }

  html += '</div></div>';
  return html;
}

function renderDodatkoweInformacjeHTML(faData, p1Data) {
  let html = `<div class="additional-info"><h2>${t('Dodatkowe informacje')}</h2>`;
  let infoItems = [];

  if (faData.kodWaluty) infoItems.push({ label: t("Waluta"), value: faData.kodWaluty });
  if (faData.wz.length > 0) infoItems.push({ label: "WZ", value: faData.wz.join(', ') });
  if (faData.fp) infoItems.push({ label: t("Faktura zaliczkowa"), value: t("Tak") });
  if (faData.tp) infoItems.push({ label: t("Powiązania"), value: t("Tak") });
  if (faData.zwrotAkcyzy) infoItems.push({ label: t("Zwrot akcyzy"), value: t("Tak") });
  if (faData.kursWalutyZ) infoItems.push({ label: t("Kurs waluty"), value: faData.kursWalutyZ });
  if (faData.p15zk) infoItems.push({ label: t("Kwota przed korektą"), value: formatPrice(faData.p15zk) });

  // Status sprzedawcy
  if (p1Data?.status) {
    infoItems.push({ label: t("Status sprzedawcy"), value: t(taxpayerStatusMap[p1Data.status]) || p1Data.status });
  }

  // Okres korekty
  if (faData.okresFaKorygowanej) {
    infoItems.push({ label: t("Okres korekty"), value: faData.okresFaKorygowanej });
  }

  if (infoItems.length > 0) {
    html += '<div class="info-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; margin-bottom: 5px;">';
    for (let item of infoItems) {
      html += `
        <div class="info-item" style="border: 1px solid #e0e0e0; padding: 2px 2px; background: #fafafa; border-radius: 3px; display: flex; align-items: baseline; gap: 3px;">
          <span class="info-label" style="font-weight: bold; color: #2c3e50; font-size: 10px; text-transform: uppercase; white-space: nowrap;">${item.label}:</span>
          <span style="font-size: 10px;">${item.value}</span>
        </div>
      `;
    }
    const remaining = infoItems.length % 3;
    if (remaining !== 0) {
      for (let i = 0; i < 3 - remaining; i++) html += '<div style="border: none; padding: 3px 5px;"></div>';
    }
    html += '</div>';
  }

  // Dodatkowe opisy (klucz-wartość)
  if (faData.dodatkoweOpisy && faData.dodatkoweOpisy.length > 0) {

    // Grupuj opisy według numeru wiersza
    const opisyWedlugWiersza = new Map(); // nrWiersza -> array of {klucz, wartosc}
    const wszystkieKlucze = new Set();

    faData.dodatkoweOpisy.forEach(o => {
      if (o.nrWiersza) {
        if (!opisyWedlugWiersza.has(o.nrWiersza)) {
          opisyWedlugWiersza.set(o.nrWiersza, []);
        }
        opisyWedlugWiersza.get(o.nrWiersza).push({ klucz: o.klucz, wartosc: o.wartosc });
        wszystkieKlucze.add(o.klucz);
      }
    });

    // Opisy bez wiersza
    const opisyBezWiersza = faData.dodatkoweOpisy.filter(o => !o.nrWiersza);
    if (opisyBezWiersza.length > 0) {
      html += '<div style="margin-top: 10px;">';
      html += `<h3 style="font-size:12px; margin-bottom:2px;">${t('Informacje ogólne')}</h3>`;
      html += '<div class="info-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px;">';
      for (let opis of opisyBezWiersza) {
        html += `
          <div class="info-item" style="border: 1px solid #e0e0e0; padding: 3px 5px; background: #fafafa; border-radius: 3px; display: flex; align-items: baseline; gap: 2px;">
            <span class="info-label" style="font-weight: bold; color: #2c3e50; font-size: 10px; text-transform: uppercase; white-space: nowrap;">${opis.klucz}:</span>
            <span style="font-size: 10px;">${opis.wartosc}</span>
          </div>
        `;
      }
      const remaining = opisyBezWiersza.length % 3;
      if (remaining !== 0) {
        for (let i = 0; i < 3 - remaining; i++) html += '<div style="border: none; padding: 2px 2px;"></div>';
      }
      html += '</div></div>';
    }

    // Jeśli są opisy związane z wierszami - wyświetl ZBIORCZĄ TABELĘ
    if (opisyWedlugWiersza.size > 0) {
      const rdGroupEl = document.getElementById('rowDetailsToggleGroup');
      if (rdGroupEl) { rdGroupEl.style.display = 'inline-flex'; }
      const sortedWiersze = Array.from(opisyWedlugWiersza.keys()).sort((a, b) => parseInt(a) - parseInt(b));
      const sortedKlucze = Array.from(wszystkieKlucze).sort();
      html += '<div class="row-details-section" style="margin-top: 4px;">';
      html += `<h3 style="font-size:10px; margin-bottom:0px;">${t('Dodatkowe informacje dla wierszy')}</h3>`;

      // === ROZWIĄZANIE: GRUPOWANIE KOLUMN W WIERSZE ===
      const MAX_COLUMNS_PER_ROW = 5; // Maksymalnie 3 kolumny danych na wiersz tabeli

      // Oblicz ile wierszy potrzeba dla każdej pozycji
      const chunks = [];
      for (let i = 0; i < sortedKlucze.length; i += MAX_COLUMNS_PER_ROW) {
        chunks.push(sortedKlucze.slice(i, i + MAX_COLUMNS_PER_ROW));
      }

      html += `<table style="width:100%; border-collapse:collapse; font-size:9px;">`;

      // Dla każdej grupy kolumn tworzymy osobny fragment tabeli
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunkKlucze = chunks[chunkIndex];

        // Nagłówek dla tej grupy
        html += '<thead><tr>';
        html += `<th style="border:1px solid #bdc3c7; padding:1px 1px 1px 4px; background:#ecf0f1;">${t('Nr wiersza')}</th>`;
        for (let klucz of chunkKlucze) {
          html += `<th style="border:1px solid #bdc3c7; padding:1px 1px 1px 4px; background:#ecf0f1;">${klucz}</th>`;
        }
        html += '</tr></thead>';

        // Dane dla tej grupy
        html += '<tbody>';
        for (let nr of sortedWiersze) {
          // Grupuj wartości dla tego samego klucza
          const opisyMap = new Map();
          for (let o of opisyWedlugWiersza.get(nr)) {
            if (!opisyMap.has(o.klucz)) {
              opisyMap.set(o.klucz, []);
            }
            opisyMap.get(o.klucz).push(o.wartosc);
          }

          html += '<tr>';
          html += `<td style="border:1px solid #bdc3c7; padding:1px 1px 1px 4px; font-weight:bold; text-align:center;">${nr}</td>`;

          for (let klucz of chunkKlucze) {
            const wartosci = opisyMap.get(klucz);
            let wyswietlanaWartosc = '—';

            if (wartosci) {
              if (wartosci.length === 1) {
                wyswietlanaWartosc = wartosci[0];
                if (/^\d+([.,]\d{1,2})?$/.test(wyswietlanaWartosc.replace(/\s/g, ''))) {
                  wyswietlanaWartosc = formatPrice(wyswietlanaWartosc);
                }
              } else {
                wyswietlanaWartosc = wartosci.map(w => {
                  if (/^\d+([.,]\d{1,2})?$/.test(w.replace(/\s/g, ''))) {
                    return formatPrice(w);
                  }
                  return w;
                }).join(', ');
              }
            }

            html += `<td style="border:1px solid #bdc3c7; padding:1px 1px 1px 4px, ;">${wyswietlanaWartosc}</td>`;
          }

          html += '</tr>';
        }
        html += '</tbody>';

        // Dodaj odstęp między grupami
        if (chunkIndex < chunks.length - 1) {
          html += '<tr><td colspan="' + (chunkKlucze.length + 1) + '" style="padding:1px;"></td></tr>';
        }
      }

      html += '</table>';

      // Informacja o podziale
      if (chunks.length > 1) {
        html += '<p style="font-size:8px; color:#666; margin-top:2px; font-style:italic;">';
        html += `↕️ ${t('Tabela została podzielona na {n} części ze względu na dużą liczbę etykiet ({k}).', { n: chunks.length, k: sortedKlucze.length })}`;
        html += '</p>';
      }

      html += '</div>'; // koniec row-details-section
      html += `<div class="row-details-placeholder">${t('Dodatkowe informacje dla wierszy zostały ukryte.')}</div>`;
    }
  }

  html += '</div>';
  return html;
}

function renderZalacznikHTML(zalacznikData) {
  if (!zalacznikData || !zalacznikData.bloki || zalacznikData.bloki.length === 0) return "";

  let html = `<div class="additional-info"><h2>${t('Załączniki')}</h2>`;

  for (let blok of zalacznikData.bloki) {
    html += `<div class="info-item" style="grid-column: span 3; margin-bottom: 10px;">`;

    if (blok.naglowek) {
      html += `<span class="info-label" style="font-size:12px;">${blok.naglowek}</span><br>`;
    }

    // Metadane
    for (let meta of blok.metaDane) {
      html += `<p style="margin:3px 0;"><strong>${meta.klucz}:</strong> ${meta.wartosc}</p>`;
    }

    // Tekst (akapity)
    for (let akapit of blok.akapity) {
      html += `<p style="margin:5px 0;">${akapit}</p>`;
    }

    // Tabele
    for (let tabela of blok.tabele) {
      if (tabela.opis) html += `<p><strong>${tabela.opis}</strong></p>`;

      if (tabela.kolumny.length > 0 && tabela.wiersze.length > 0) {
        html += '<table style="width:100%; border-collapse:collapse; font-size: 8px; margin:5px 0; border:1px solid #bdc3c7;">';

        // Nagłówek
        html += '<thead><tr>';
        for (let kol of tabela.kolumny) {
          html += `<th style="border:1px solid #bdc3c7; padding:1px 1px 1px 4px; background:#ecf0f1;">${kol.nazwa || ''}</th>`;
        }
        html += '</tr></thead>';

        // Dane
        html += '<tbody>';
        for (let wiersz of tabela.wiersze) {
          html += '<tr>';
          for (let i = 0; i < tabela.kolumny.length; i++) {
            const wartosc = wiersz[i] || '—';
            html += `<td style="border:1px solid #bdc3c7; padding:1px 1px 1px 4px;">${wartosc}</td>`;
          }
          html += '</tr>';
        }
        html += '</tbody>';

        // Suma
        if (tabela.suma && tabela.suma.length > 0) {
          html += '<tfoot><tr>';
          for (let i = 0; i < tabela.kolumny.length; i++) {
            const wartosc = tabela.suma[i] || '—';
            html += `<td style="border:1px solid #bdc3c7; padding:1px 1px 1px 4px; font-weight:bold;">${wartosc}</td>`;
          }
          html += '</tr></tfoot>';
        }

        html += '</table>';
      }
    }

    html += `</div>`;
  }

  html += '</div>';
  return html;
}

function renderZamowienieHTML(zamowienieData) {
  if (!zamowienieData || !zamowienieData.wiersze || zamowienieData.wiersze.length === 0) return "";

  let html = `<div class="additional-info"><h2>${t('Zamówienie/Umowa')}</h2>`;

  if (zamowienieData.wartoscZamowienia) {
    html += `<div class="info-item"><span class="info-label">${t('Wartość zamówienia')}:</span> ${formatPrice(zamowienieData.wartoscZamowienia)}</div>`;
  }

  if (zamowienieData.wiersze.length > 0) {
    html += '<table style="width:100%; margin-top:5px;"><tr>';
    html += `<th>${t('Lp.')}</th><th>${t('Opis')}</th><th>${t('Indeks')}</th><th>${t('Ilość')}</th><th>${t('JM')}</th><th>${t('Cena')}</th><th>${t('Netto')}</th><th>${t('VAT%')}</th>`;
    html += `<th>${t('Numer umowy/UUID')}</th>`;  // DODANA KOLUMNA
    html += '</tr>';

    for (let w of zamowienieData.wiersze) {
      let opisPelny = w.opis || '';
      let dodatki = [];

      if (w.gtin) dodatki.push(`GTIN: ${w.gtin}`);
      if (w.pkwiu) dodatki.push(`PKWiU: ${w.pkwiu}`);
      if (w.cn) dodatki.push(`CN: ${w.cn}`);
      if (w.pkob) dodatki.push(`PKOB: ${w.pkob}`);
      if (w.kwotaAkcyzy && w.kwotaAkcyzy !== "0") dodatki.push(`${t('Akcyza')}: ${formatPrice(w.kwotaAkcyzy)}`);
      if (w.stawkaOSS) dodatki.push(`OSS: ${w.stawkaOSS}%`);
      if (w.gtu) dodatki.push(w.gtuDisplay);
      if (w.procedura) dodatki.push(w.proceduraDisplay);
      if (w.zal15) dodatki.push(t('Zał.15'));

      if (dodatki.length > 0) {
        opisPelny += '<br><small>' + dodatki.join(' | ') + '</small>';
      }

      if (w.stanPrzed) {
        opisPelny += ` <small>${t('(przed korektą)')}</small>`;
      }

      html += '<tr>';
      html += `<td class="center">${w.nrWiersza || ''}</td>`;
      html += `<td>${opisPelny}</td>`;
      html += `<td>${w.indeks || '—'}</td>`;
      html += `<td class="right">${fmtQty(w.ilosc)}</td>`;
      html += `<td class="center">${w.jednostka || ''}</td>`;
      html += `<td class="right">${formatPrice(w.cenaNetto)}</td>`;
      html += `<td class="right">${formatPrice(w.kwotaNetto)}</td>`;
      html += `<td class="center">${w.stawkaVatDisplay || ''}</td>`;
      html += `<td class="center"><small>${w.uuid}</small></td>`;  // DODANE
      html += '</tr>';
    }

    html += '</table>';
  }

  html += '</div>';
  return html;
}

function renderFooterHTML(stopkaData) {
  if (!stopkaData) return "";

  let html = '<div class="footer-section-invoice"><div class="footer-content-invoice">';
  let hasContent = false;

  if (stopkaData.informacje && stopkaData.informacje.length > 0) {
    for (let info of stopkaData.informacje) {
      if (info.stopkaFaktury) {
        html += `<div class="footer-line"><span class="footer-label">${t('Stopka faktury')}:</span> ${info.stopkaFaktury}</div>`;
        hasContent = true;
      }
    }
  }

  if (stopkaData.rejestry && stopkaData.rejestry.length > 0) {
    for (let rej of stopkaData.rejestry) {
      if (rej.pelnaNazwa) { html += `<div class="footer-line"><span class="footer-label">${t('Pełna nazwa')}:</span> ${rej.pelnaNazwa}</div>`; hasContent = true; }
      if (rej.krs) { html += `<div class="footer-line"><span class="footer-label">KRS:</span> ${rej.krs}</div>`; hasContent = true; }
      if (rej.regon) { html += `<div class="footer-line"><span class="footer-label">REGON:</span> ${rej.regon}</div>`; hasContent = true; }
      if (rej.bdo) { html += `<div class="footer-line"><span class="footer-label">BDO:</span> ${rej.bdo}</div>`; hasContent = true; }
    }
  }

  html += '</div></div>';
  return hasContent ? html : "";
}

function addQRCode(containerId, nip, dataWystawienia, hash) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const url = generateVerificationUrl(nip, dataWystawienia, hash);
  const canvas = document.createElement('canvas');
  canvas.className = 'qr-code';
  QRCode.toCanvas(canvas, url, { width: 180, margin: 2 }, function(error) {
    if (error) {
      console.error('Błąd generowania QR:', error);
      container.innerHTML = '<span style="color:red;">Błąd generowania kodu QR</span>';
      return;
    }
    container.innerHTML = '';
    container.appendChild(canvas);
    const infoDiv = document.createElement('div');
    infoDiv.className = 'qr-info';
    infoDiv.innerHTML = `
      <strong>${t('Weryfikacja faktury w KSeF')}</strong>
      <div>${t('Zeskanuj kod QR lub kliknij link poniżej:')}</div>
      <div class="qr-hash"><strong>${t('Hash dokumentu')}:</strong> ${hash}</div>
      <div class="qr-link">
        <a href="${url}" target="_blank">${url}</a>
      </div>
      <small>${t('Strona weryfikacyjna Ministerstwa Finansów')}</small>
    `;
    container.appendChild(infoDiv);
  });
}

// ============================================================================
// PAYMENT CONTAINER (dane do przelewu)
// ============================================================================

function escAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatNRB(nrb) {
  const d = nrb.replace(/\s/g, '');
  if (d.length === 26) return d.replace(/(\d{2})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4 $5 $6 $7');
  return nrb;
}

// opts pozwala obsłużyć FA_RR, gdzie te same dane leżą gdzie indziej:
//   rachunki      — w RR przelew idzie na RachunekBankowy1 (rachunek rolnika)
//   formaPrzelewu — w RR "1" znaczy przelew, w FA(3) "1" to gotówka (kolizja numeracji)
//   amount        — w RR kwotą jest DoZaplaty lub P_12_1, nie P_15
//   whiteList     — w RR wyłączona (uzasadnienie przy wywołaniu w renderRR)
function renderPaymentContainerHTML(p1Data, platnoscData, faData, qrId, opts = {}) {
  const rachunki = opts.rachunki || (platnoscData && platnoscData.rachunki);
  const formaPrzelewu = opts.formaPrzelewu || "6";
  const pokazBialaListe = opts.whiteList !== false;

  if (!platnoscData || !rachunki || rachunki.length === 0) return null;
  const forma = platnoscData.formaPlatnosci;
  if (forma && forma !== formaPrzelewu) return null;
  if (platnoscData.zaplacono) return null;

  const amount = (opts.amount !== undefined && opts.amount !== null && opts.amount !== ''
                    ? opts.amount : faData.vatSummary.p15) || "0";
  if (parseFloat(amount) <= 0) return null;

  const currency = faData.kodWaluty || "PLN";
  const title = faData.nrFaktury || "";
  const recipientName = p1Data?.nazwa || "";
  const nip = p1Data?.nip || "";
  const adres = p1Data?.adres || null;
  const isPLN = currency === "PLN";

  function copyRow(label, displayHtml, copyVal) {
    return `<div class="payment-field-row">
      <span class="payment-field-label">${label}</span>
      <span class="payment-field-value">${displayHtml}</span>
      <button class="payment-field-copy" data-copy="${escAttr(copyVal)}" onclick="copyPaymentField(this)">Kopiuj</button>
    </div>`;
  }

  let accountsHtml = '';
  rachunki.forEach((r, i) => {
    const label = rachunki.length > 1 ? `Nr rachunku ${i + 1}` : 'Nr rachunku';
    const cleanNrb = r.nrRB.replace(/\s/g, '').replace(/^PL/i, '');
    const blRow = (nip && pokazBialaListe) ? `<div class="payment-bl-row">
      <button class="payment-bl-check" onclick="checkWhiteList(this,'${escAttr(nip)}','${escAttr(cleanNrb)}')">Sprawdź białą listę</button>
      <span class="payment-bl-result"></span>
    </div>` : '';
    accountsHtml += `<div class="payment-field-row">
      <span class="payment-field-label">${label}</span>
      <span class="payment-field-value"><span class="payment-nrb">${escAttr(formatNRB(r.nrRB))}</span></span>
      <button class="payment-field-copy" data-copy="${escAttr(cleanNrb)}" onclick="copyPaymentField(this)">Kopiuj</button>
    </div>
    ${blRow}`;
  });

  const formattedAmountHtml = `${formatPrice(amount)}&nbsp;${currency}`;
  const formattedAmountCopy = amount.replace('.', ',');

  let adresHtml = '';
  if (adres && (adres.linia1 || adres.linia2)) {
    const adresDisplay = [adres.linia1, adres.linia2].filter(Boolean).map(l => escAttr(l)).join('<br>');
    const adresCopy = [adres.linia1, adres.linia2].filter(Boolean).join('\n');
    adresHtml = copyRow('Adres', adresDisplay, adresCopy);
  }

  const nipHtml = nip ? copyRow('NIP', escAttr(nip), nip) : '';

  const qrSection = isPLN ? `
    <div class="payment-qr-section">
      <div id="${qrId}"></div>
      <div class="payment-qr-label">Zeskanuj w aplikacji bankowej<br><small>standard ZBP</small></div>
    </div>` : '';

  return `<div class="payment-container">
    <button class="payment-toggle-btn" onclick="togglePaymentBox(this)">
      <i class="fa fa-university" aria-hidden="true"></i>
      <span class="payment-toggle-text">Pokaż dane do przelewu</span>
      <span class="payment-toggle-arrow">▾</span>
    </button>
    <div class="payment-box">
      <div class="payment-fields">
        ${copyRow('Odbiorca', escAttr(recipientName), recipientName)}
        ${adresHtml}
        ${nipHtml}
        ${accountsHtml}
        ${copyRow('Kwota', formattedAmountHtml, formattedAmountCopy)}
        ${copyRow('Tytuł przelewu', escAttr(title), title)}
      </div>
      ${qrSection}
    </div>
  </div>`;
}

function addPaymentQR(qrId, amount, nrb, nip, recipientName, title) {
  const el = document.getElementById(qrId);
  if (!el) return;
  const digits = nrb.replace(/\s/g, '');
  const grosze = String(Math.round(parseFloat(amount) * 100)).padStart(6, '0');
  const name = recipientName.substring(0, 20);
  const tit = title.substring(0, 32);
  // Format ZBP: NIP|KodKraju|NRB|Kwota|Odbiorca|Tytuł|||
  const qrText = `${nip || ''}|PL|${digits}|${grosze}|${name}|${tit}|||`;
  const canvas = document.createElement('canvas');
  QRCode.toCanvas(canvas, qrText, { width: 160, margin: 2 }, (err) => {
    if (!err) el.appendChild(canvas);
  });
}

// Gwiazdka o zakresie tłumaczenia. Pokazujemy TYLKO w języku obcym — po polsku
// wizualizacja jest w języku oryginału faktury i nota nie ma o czym informować.
function translationNoteHTML() {
  if (currentLang === 'pl') return '';
  return `<div style="text-align:center; margin-top:4px; font-size:9px; color:#95a5a6; font-style:italic;">* ${t('Tłumaczeniu podlegają jedynie statyczne elementy szablonu dokumentu (etykiety). Treść merytoryczna faktury pozostaje w języku oryginalnym.')}</div>`;
}

// ============================================================================
// GŁÓWNA FUNKCJA RENDERUJĄCA (HTML)
// ============================================================================

function render(xml, fileName, xmlContent) {
  const root = xml.documentElement;
  if (root.namespaceURI !== ns) { showError("Plik XML ma nieprawidłową przestrzeń nazw"); return; }

  document.getElementById("pages").innerHTML = "";
  document.getElementById("currentFile").textContent = fileName;
  document.getElementById("fileInfo").style.display = "flex";
  const rdToggle = document.getElementById('rowDetailsToggle');
  if (rdToggle) { rdToggle.checked = false; }
  document.getElementById("pages").classList.remove('hide-row-details');
  const rdGroup = document.getElementById('rowDetailsToggleGroup');
  if (rdGroup) { rdGroup.style.display = 'none'; }

  const fakturaNode = xml.getElementsByTagNameNS(ns, "Faktura")[0];
  if (!fakturaNode) { showError("Nieprawidłowa struktura XML - brak elementu Faktura"); return; }

  const faNode = fakturaNode.getElementsByTagNameNS(ns, "Fa")[0];
  if (!faNode) { showError("Brak elementu Fa w fakturze"); return; }

  // ===== PARSOWANIE DANYCH =====
  const naglowekNode = fakturaNode.getElementsByTagNameNS(ns, "Naglowek")[0];
  const naglowekData = naglowekNode ? {
    dataWytworzenia: getText(naglowekNode, "DataWytworzeniaFa"),
    systemInfo: getText(naglowekNode, "SystemInfo")
  } : null;

  const p1Node = fakturaNode.getElementsByTagNameNS(ns, "Podmiot1")[0];
  const p2Node = fakturaNode.getElementsByTagNameNS(ns, "Podmiot2")[0];
  const p3Nodes = fakturaNode.getElementsByTagNameNS(ns, "Podmiot3");
  const puNode = fakturaNode.getElementsByTagNameNS(ns, "PodmiotUpowazniony")[0];
  const p2kNode = faNode.getElementsByTagNameNS(ns, "Podmiot2K")[0];

  const p1Data = parsePodmiot(p1Node, 'podmiot1');
  const p2Data = parsePodmiot(p2Node, 'podmiot2');
  const p3DataArray = Array.from(p3Nodes).map(node => parsePodmiot(node, 'podmiot3'));
  const puData = parsePodmiotUpowazniony(puNode);
  const p2kData = p2kNode ? parsePodmiot(p2kNode, 'podmiot2') : null;

  const faData = parseFa(faNode);
  const platnoscData = parsePlatnosc(faNode.getElementsByTagNameNS(ns, "Platnosc")[0]);
  const rozliczenieData = parseRozliczenie(faNode.getElementsByTagNameNS(ns, "Rozliczenie")[0]);
  const adnotacjeData = parseAdnotacje(faNode.getElementsByTagNameNS(ns, "Adnotacje")[0]);
  const warunkiNode = faNode.getElementsByTagNameNS(ns, "WarunkiTransakcji")[0] || fakturaNode.getElementsByTagNameNS(ns, "WarunkiTransakcji")[0];
  const warunkiData = parseWarunkiTransakcji(warunkiNode);
  const stopkaData = parseStopka(fakturaNode.getElementsByTagNameNS(ns, "Stopka")[0]);
  const zalacznikData = parseZalacznik(fakturaNode.getElementsByTagNameNS(ns, "Zalacznik")[0]);

  const wierszeNodes = faNode.getElementsByTagNameNS(ns, "FaWiersz");
  const wierszeArray = Array.from(wierszeNodes).map(node => parseFaWiersz(node));
  if (wierszeArray.length > 5000) { showError("Faktura zawiera zbyt wiele wierszy (max 5000)"); return; }

  const xmlHash = calculateXmlHash(xmlContent);
  const unknownElements = findUnknownFakturaElements(xml);
  const nipSprzedawcy = p1Data?.nip;

  // ===== BUDOWANIE HTML =====
  let containerContent = renderNaglowekHTML(faData, fileName, naglowekData);

  // Sprzedawca / Nabywca + Podmiot upoważniony
  containerContent += `<div class="section two-cols">`;
  containerContent += renderPodmiotHTML(p1Data, tUpper('Sprzedawca'));

  containerContent += `<div class="col">`;
  if (p2kData) {
    containerContent += `<h2>${tUpper('Nabywca')}</h2>`;
    containerContent += `<div style="margin-bottom:5px; background:#fef5e7; padding:5px;">`;
    containerContent += `<small style="color:#7f8c8d;">${tUpper('Przed korektą')}</small><br>`;
    containerContent += renderPodmiotHTML(p2kData, "").replace('<div class="col">', '').replace('</div>', '');
    containerContent += `</div>`;
    containerContent += `<div style="background:#e8f8f5; padding:5px;">`;
    containerContent += `<small style="color:#27ae60;">${tUpper('Po korekcie')}</small><br>`;
    containerContent += renderPodmiotHTML(p2Data, "").replace('<div class="col">', '').replace('</div>', '');
    containerContent += `</div>`;
  } else {
    containerContent += renderPodmiotHTML(p2Data, tUpper('Nabywca')).replace('<div class="col">', '').replace('</div>', '');
  }

  if (puData) {
    containerContent += renderPodmiotUpowaznionyHTML(puData);
  }
  containerContent += `</div>`; // zamknięcie col
  containerContent += `</div>`; // zamknięcie two-cols

  // Podmioty trzecie
  if (p3DataArray.length > 0) {
    for (let i = 0; i < p3DataArray.length; i += 2) {
      containerContent += `<div class="section two-cols">`;
      containerContent += renderPodmiot3HTML(p3DataArray[i]);
      if (i + 1 < p3DataArray.length) {
        containerContent += renderPodmiot3HTML(p3DataArray[i + 1]);
      } else {
        containerContent += `<div class="col"></div>`;
      }
      containerContent += `</div>`;
    }
  }

  // Dane faktury i płatność
let korygowaneInfo = "";
if (faData.rodzaj.startsWith("KOR") && faData.daneKorygowane.length > 0) {
  let fakturyList = faData.daneKorygowane.map(dk => {
    let opis = `${dk.nr}&nbsp;${t('z dnia')}&nbsp;${dk.data}`;
    if (dk.nrKSeF) {
      opis += ` KSeF:&nbsp;${dk.nrKSeF}`;
    } else if (dk.pozaKSeF) {
      opis += `&nbsp;${t('(poza KSeF)').replace(/ /g, '&nbsp;')}`;
    }
    return opis;
  });

  korygowaneInfo = `<strong>${t('Korygowane faktury')}:</strong>&nbsp;${fakturyList.join('<br>')}<br>`;

  if (faData.typKorekty) {
    korygowaneInfo += `<strong>${t('Typ korekty').replace(/ /g, '&nbsp;')}:</strong>&nbsp;${faData.typKorektyDisplay}<br>`;
  }
}

  let przyczynaInfo = faData.przyczynaKorekty ? `<strong>${t('Przyczyna korekty')}:</strong> ${faData.przyczynaKorekty}<br>` : "";

  containerContent += `
    <div class="section two-cols">
      <div class="col">
        <h2>${tUpper('Dane faktury')}</h2>
        <strong>${t('Numer')}:</strong> ${faData.nrFaktury}<br>
        <strong>${t('Data wystawienia')}:</strong> ${faData.dataWystawienia}${faData.miejsceWystawienia ? ', ' + faData.miejsceWystawienia : ''}<br>
        ${faData.dataSprzedazy ? `<strong>${t('Data sprzedaży')}:</strong> ${faData.dataSprzedazy}<br>` : ''}
        ${faData.okresSprzedazy ? `<strong>${t('Okres')}:</strong> ${faData.okresSprzedazy.od} - ${faData.okresSprzedazy.do}<br>` : ''}
        ${korygowaneInfo}
        ${przyczynaInfo}
      </div>
      <div class="col">
        <h2>${tUpper('Płatność')}</h2>
        ${renderPaymentInfoHTML(platnoscData)}
      </div>
    </div>
  `;

  // Tabela z pozycjami
  const showRabatCol = hasAnyRabat(wierszeArray);
  let tableRows = "";
  if (faData.rodzaj.startsWith("KOR")) {
    const groupedRows = groupCorrectionRows(wierszeArray);
    // Wiersze RÓŻNICA tylko gdy suma delt zgadza się z deklaracją P_13/P_14/P_15.
    const showDiffRows = correctionDiffRowsAllowed(faData, wierszeArray);
    for (const item of groupedRows) {
      if (item.type === 'pair') {
        tableRows += rowHTML(item.before, true, showRabatCol);
        tableRows += rowHTML(item.after, false, showRabatCol);

        const diffNet = item.after.kwotaNetto - item.before.kwotaNetto;
        const diffVat = item.after.kwotaVat - item.before.kwotaVat;
        const diffGross = item.after.kwotaBrutto - item.before.kwotaBrutto;
        const diffQty = (parseFloat(item.after.ilosc) || 0) - (parseFloat(item.before.ilosc) || 0);
        const diffPrice = (parseFloat(item.after.cenaNetto) || 0) - (parseFloat(item.before.cenaNetto) || 0);

        if (showDiffRows && (diffNet !== 0 || diffQty !== 0 || diffPrice !== 0 || diffVat !== 0 || diffGross !== 0)) {
          // Gdy stawka VAT się zmieniła (np. 8% → 23%), w wierszu RÓŻNICY pokazujemy
          // tylko deltę kwot (VAT, brutto). Stawka jako "—" — różnica stawek nie ma sensu liczbowego.
          const stawkaRoznicowa = (item.before.stawkaVat === item.after.stawkaVat)
            ? item.before.stawkaVatDisplay
            : '—';
          // Pusta komórka w kolumnie "Cena po rabacie" — delta efektywnej ceny
          // jednostkowej dla wiersza RÓŻNICA nie ma czytelnego sensu dla użytkownika.
          const rabatEmpty = showRabatCol ? '<td></td>' : '';
          tableRows += `
<tr class="diff-row">
  <td></td>
  <td colspan="2"><b>${t('RÓŻNICA')}</b></td>
  <td></td>
  <td class="right">${diffQty !== 0 ? fmtQty(diffQty) : ''}</td>
  <td class="center">—</td>
  <td class="right">${diffPrice !== 0 ? formatPrice(diffPrice) : ''}</td>
  ${rabatEmpty}
  <td class="right">${diffNet !== 0 ? formatPrice(diffNet) : ''}</td>
  <td class="center">${stawkaRoznicowa}</td>
  <td class="right">${diffVat !== 0 ? formatPrice(diffVat) : ''}</td>
  <td class="right">${diffGross !== 0 ? formatPrice(diffGross) : ''}</td>
</tr>`;
        }
      } else {
        tableRows += rowHTML(item.row, item.isBefore, showRabatCol);
      }
    }
  } else {
    for (let w of wierszeArray) {
      tableRows += rowHTML(w, false, showRabatCol);
    }
  }

  // Twardy <br> w nagłówkach — z auto-layout przeglądarka mierzy szerokość po
  // najszerszej nieprzerywalnej sekwencji (analogicznie do \n w pdfmake).
  // Bez tego "Cena po rabacie" rezerwuje znacznie więcej miejsca niż realna zawartość.
  const rabatHeader = showRabatCol ? `<th class="right">${tWrap('Cena po rabacie', '<br>')}</th>` : '';
  // Faktura bez FaWiersz (np. korekta samych danych nabywcy) — same nagłówki kolumn
  // bez ani jednego wiersza to szum, nie informacja. Pomijamy całą tabelę.
  if (wierszeArray.length > 0) containerContent += `
    <table>
      <tr>
        <th>#</th>
        <th>${t('Opis / GTU')}</th>
        <th>${t('Indeks')}</th>
        <th>EAN/GTIN</th>
        <th class="right">${t('Ilość')}</th>
        <th class="center">${t('JM')}</th>
        <th class="right">${tWrap('Cena netto', '<br>')}</th>
        ${rabatHeader}
        <th class="right">${tWrap('Wart. netto', '<br>')}</th>
        <th class="center">${t('VAT%')}</th>
        <th class="right">${t('VAT')}</th>
        <th class="right">${tWrap('Wart. brutto', '<br>')}</th>
      </tr>
      ${tableRows}
    </table>
  `;

  // Podsumowanie i dodatkowe sekcje
  containerContent += vatSummaryHTML(faData);
  containerContent += vatHeaderConsistencyCheckHTML(faData);
  containerContent += renderRozliczenieHTML(rozliczenieData);
  containerContent += renderDodatkoweInformacjeHTML(faData, p1Data);
  containerContent += renderZaliczkaCzesciowaHTML(faData.zaliczkiCzesciowe);
  containerContent += renderPodmiot1KHTML(faData.podmiot1K);
  containerContent += renderPodmiot2KFullHTML(faData.podmiot2KFull);
  containerContent += renderWarunkiTransakcjiHTML(warunkiData);
  containerContent += renderNoweSrodkiHTML(adnotacjeData);
  containerContent += renderAdnotacjeHTML(adnotacjeData);
  containerContent += renderFakturyZaliczkoweHTML(faData);

    // Zamówienie
  const zamowienieData = parseZamowienie(faNode.getElementsByTagNameNS(ns, "Zamowienie")[0]);
  containerContent += renderZamowienieHTML(zamowienieData);
  containerContent += renderZalacznikHTML(zalacznikData);
  containerContent += renderFooterHTML(stopkaData);

  // Kod QR
  const qrContainerId = "qr-container-main";
  if (unknownElements.length > 0) {
    const serializer = new XMLSerializer();
    const elementsHtml = unknownElements.map(el => {
      const raw = serializer.serializeToString(el);
      const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre class="unknown-element-xml">${escaped}</pre>`;
    }).join('');
    containerContent += `
      <div class="qr-section">
        <div class="schema-warning">
          <strong>${t('Weryfikacja w KSeF niemożliwa')}</strong>
          ${t('Plik zawiera elementy spoza schematu FA(3). Hash dokumentu może nie odpowiadać oryginałowi z KSeF.')}
          <div class="unknown-elements-list">${elementsHtml}</div>
        </div>
      </div>
      ${translationNoteHTML()}
      <div style="text-align:center; margin-top:10px; font-size:10px; color:#7f8c8d;">
        ${t('KSeFeusz.pl - darmowy wizualizator faktur ustrukturyzowanych KSeF wersja {v}', { v: APP_VERSION })}
      </div>
    `;
  } else {
    containerContent += `
      <div class="qr-section">
        <div id="${qrContainerId}" class="qr-container"></div>
      </div>
      ${translationNoteHTML()}
      <div style="text-align:center; margin-top:10px; font-size:10px; color:#7f8c8d;">
        ${t('KSeFeusz.pl - darmowy wizualizator faktur ustrukturyzowanych KSeF wersja {v}', { v: APP_VERSION })}
      </div>
    `;
  }

  // Wstawienie do strony
  const container = document.createElement("div");
  const isFullView = document.getElementById('viewToggle')?.checked;
  container.className = "invoice-container" + (isFullView ? "" : " simplified");
  container.innerHTML = containerContent;
  document.getElementById("pages").appendChild(container);

  if (unknownElements.length === 0 && nipSprzedawcy && faData.dataWystawienia) {
    addQRCode(qrContainerId, nipSprzedawcy, faData.dataWystawienia, xmlHash);
  }

  // Payment container
  const paymentQrId = 'pqr-' + Date.now();
  const paymentHtml = renderPaymentContainerHTML(p1Data, platnoscData, faData, paymentQrId);
  if (paymentHtml) {
    const paymentEl = document.createElement('div');
    paymentEl.innerHTML = paymentHtml;
    document.getElementById("pages").appendChild(paymentEl.firstElementChild);
    if ((faData.kodWaluty || 'PLN') === 'PLN') {
      addPaymentQR(paymentQrId, faData.vatSummary.p15 || '0', platnoscData.rachunki[0].nrRB, p1Data?.nip || '', p1Data?.nazwa || '', faData.nrFaktury || '');
    }
  }

  // UI
  switchTab('faktura');
  const uploadArea = document.querySelector('#panel-faktura .upload-area');
  const newInvoiceBtn = document.getElementById('newInvoiceBtn');
  if (uploadArea) uploadArea.style.display = 'none';
  if (newInvoiceBtn) newInvoiceBtn.style.display = 'inline-flex';
  hideLoading();
}

// ============================================================================
// FA_RR — RENDEROWANIE HTML
// ----------------------------------------------------------------------------
// Osobne wejście renderRR() zamiast gałęzi w render(). Dokument różni się na tyle
// (odwrócone role podmiotów, brak VAT-u, inne kolumny tabeli), że rozgałęzianie
// w środku 300-linijkowej funkcji byłoby gorsze niż drugie wejście.
// Współdzielone z FA(3) zostają: renderNaglowekHTML, renderPodmiotHTML,
// renderPodmiot3HTML, renderRozliczenieHTML, renderDodatkoweInformacjeHTML,
// renderFooterHTML, groupCorrectionRows, addQRCode, renderPaymentContainerHTML.
//
// BEZ i18n: faktura VAT RR to konstrukcja art. 116 polskiej ustawy o VAT —
// wystawia ją polski podatnik nabywający produkty rolne od polskiego rolnika
// ryczałtowego. Etykiety nie przechodzą przez t(); renderRR wymusza język polski.
// ============================================================================

// Czy jest co pokazać w podsumowaniu (odpowiednik hasVatSummaryData dla FA(3)).
function hasRRSummaryData(rrData) {
  return ['wartoscNabycia', 'zwrotZryczaltowany', 'naleznoscOgolem']
    .some(k => (parseFloat(rrData[k]) || 0) !== 0);
}

// Podsumowanie RR: trzy kwoty zamiast tabelki VAT wg stawek.
// Kolumna "w PLN" pojawia się tylko dla faktur w walucie obcej (pola ...W).
function rrSummaryHTML(rrData) {
  if (!hasRRSummaryData(rrData)) return "";

  const waluta = rrData.kodWaluty || 'PLN';
  const czyKolumnaW = ['wartoscNabyciaW', 'zwrotZryczaltowanyW', 'naleznoscOgolemW']
    .some(k => (parseFloat(rrData[k]) || 0) !== 0);

  const wiersze = [
    { l: 'Wartość nabytych produktów rolnych lub wykonanych usług rolniczych', v: rrData.wartoscNabycia, w: rrData.wartoscNabyciaW },
    { l: 'Kwota zryczałtowanego zwrotu podatku', v: rrData.zwrotZryczaltowany, w: rrData.zwrotZryczaltowanyW },
    { l: 'Kwota należności ogółem', v: rrData.naleznoscOgolem, w: rrData.naleznoscOgolemW, sum: true }
  ];

  let html = `<table class="vat-summary no-break"><tr><th>Pozycja</th><th class="right">Kwota (${waluta})</th>`;
  if (czyKolumnaW) html += `<th class="right">w PLN</th>`;
  html += `</tr>`;

  for (const r of wiersze) {
    const tag = r.sum ? 'th' : 'td';
    html += `<tr><${tag}>${r.l}</${tag}><${tag} class="right">${formatPrice(r.v)}</${tag}>`;
    if (czyKolumnaW) html += `<${tag} class="right">${(parseFloat(r.w) || 0) !== 0 ? formatPrice(r.w) : '—'}</${tag}>`;
    html += `</tr>`;
  }
  html += `</table>`;

  // P_12_2 — kwota słownie. Pole wymagane w schemacie, w FA(3) nie istnieje.
  if (rrData.naleznoscSlownie) {
    html += `<div class="rr-slownie no-break">Słownie: ${rrData.naleznoscSlownie}</div>`;
  }
  return html;
}

// Walidator spójności nagłówka: P_11_1 + P_11_2 = P_12_1.
// Prostszy niż odpowiednik FA(3) — w RR nie ma faktur rozliczeniowych ani zaliczek,
// więc nie ma wyjątków, w których P_12_1 z definicji różni się od sumy.
// Przy korekcie wszystkie trzy pola to kwoty różnicy (mogą być ujemne) — porównanie
// działa tak samo, bo liczymy sumę, nie wartość bezwzględną. Tolerancja 0,02 zł.
function rrHeaderConsistencyCalc(rrData) {
  const present = (k) => rrData[k] !== undefined && rrData[k] !== null && String(rrData[k]).trim() !== "";
  if (!present('naleznoscOgolem')) return null;
  if (!present('wartoscNabycia') && !present('zwrotZryczaltowany')) return null;

  const wartosc = parseFloat(rrData.wartoscNabycia) || 0;
  const zwrot = parseFloat(rrData.zwrotZryczaltowany) || 0;
  const expected = wartosc + zwrot;
  const ogolem = parseFloat(rrData.naleznoscOgolem) || 0;
  const diff = expected - ogolem;

  if (Math.abs(diff) <= 0.02) return null;
  return { wartosc, zwrot, expected, ogolem, diff };
}

function rrHeaderConsistencyCheckHTML(rrData) {
  const mm = rrHeaderConsistencyCalc(rrData);
  if (!mm) return "";

  return `
    <div class="correction-mismatch no-break">
      <strong>⚠ Niezgodność sum w nagłówku faktury</strong>
      <p>Wartość nabycia powiększona o zryczałtowany zwrot podatku nie zgadza się z zadeklarowaną należnością ogółem:</p>
      <table>
        <tr><td>Wartość nabycia (P_11_1)</td><td class="right">${formatPrice(mm.wartosc)}</td></tr>
        <tr><td>Zryczałtowany zwrot (P_11_2)</td><td class="right">${formatPrice(mm.zwrot)}</td></tr>
        <tr><td>Suma</td><td class="right"><strong>${formatPrice(mm.expected)}</strong></td></tr>
        <tr><td>Należność ogółem (P_12_1)</td><td class="right"><strong>${formatPrice(mm.ogolem)}</strong></td></tr>
        <tr><td>Rozbieżność</td><td class="right"><strong>${formatPrice(mm.diff)}</strong></td></tr>
      </table>
      <small>KSeFeusz.pl prezentuje dane wyłącznie w formie wizualizacji oryginalnego pliku XML. W razie wątpliwości zweryfikuj dane źródłowe w pliku XML lub bezpośrednio w KSeF — wizualizator nie modyfikuje wartości z faktury.</small>
    </div>
  `;
}

// Bramka wierszy RÓŻNICA — odpowiednik correctionDiffRowsAllowed dla FA(3).
// Cała logika (pomijanie "po" bez pary, wyjście przy braku par, tolerancja 0,02)
// jest identyczna; zmienia się tylko deklaracja, z którą porównujemy deltę:
// P_11_1 / P_11_2 / P_12_1 zamiast ΣP_13 / ΣP_14 / P_15.
function rrCorrectionDiffRowsAllowed(rrData, wierszeArray) {
  if (!rrData || rrData.rodzaj !== 'KOR_VAT_RR') return true;
  if (!wierszeArray || wierszeArray.length === 0) return true;

  const grouped = groupCorrectionRows(wierszeArray, 'cena');
  if (!grouped.some(g => g.type === 'pair')) return true;

  let calcW = 0, calcZ = 0, calcO = 0;
  for (const g of grouped) {
    if (g.type === 'pair') {
      calcW += (parseFloat(g.after.wartoscBez) || 0) - (parseFloat(g.before.wartoscBez) || 0);
      calcZ += (parseFloat(g.after.kwotaZwrotu) || 0) - (parseFloat(g.before.kwotaZwrotu) || 0);
      calcO += (parseFloat(g.after.wartoscZ) || 0) - (parseFloat(g.before.wartoscZ) || 0);
    } else if (g.isBefore) {
      calcW -= parseFloat(g.row.wartoscBez) || 0;
      calcZ -= parseFloat(g.row.kwotaZwrotu) || 0;
      calcO -= parseFloat(g.row.wartoscZ) || 0;
    }
  }

  const TOL = 0.02;
  if (Math.abs(calcW) <= TOL && Math.abs(calcZ) <= TOL && Math.abs(calcO) <= TOL) return true;

  return Math.abs(calcW - (parseFloat(rrData.wartoscNabycia) || 0)) <= TOL
      && Math.abs(calcZ - (parseFloat(rrData.zwrotZryczaltowany) || 0)) <= TOL
      && Math.abs(calcO - (parseFloat(rrData.naleznoscOgolem) || 0)) <= TOL;
}

// Wiersz tabeli pozycji RR. Kolumna "Klasa/jakość" (P_6C) jest w schemacie
// wymagana, więc zawsze widoczna — to element odróżniający fakturę RR.
function rrRowHTML(w, isBefore = false) {
  let opis = w.nazwa || '';
  const dodatki = [];
  if (w.gtin) dodatki.push(`EAN/GTIN: ${w.gtin}`);
  if (w.pkwiu) dodatki.push(`PKWiU: ${w.pkwiu}`);
  if (w.cn) dodatki.push(`CN: ${w.cn}`);
  if (w.dataNabycia) dodatki.push(`Data nabycia: ${w.dataNabycia}`);
  if (w.kursWaluty && w.kursWaluty !== "0") dodatki.push(`Kurs: ${w.kursWaluty}`);
  if (dodatki.length > 0) opis += ' <small>(' + dodatki.join(' | ') + ')</small>';
  if (isBefore) opis += ' <small>(przed korektą)</small>';

  return `
<tr class="${isBefore ? 'before-row' : ''}">
  <td class="center">${w.nrWiersza || ''}</td>
  <td>${opis}</td>
  <td>${w.klasa || '—'}</td>
  <td class="right">${fmtQty(w.ilosc)}</td>
  <td class="center">${w.jednostka || ''}</td>
  <td class="right">${formatPrice(w.cena)}</td>
  <td class="right">${formatPrice(w.wartoscBez)}</td>
  <td class="center">${w.stawkaZwrotuDisplay}</td>
  <td class="right">${formatPrice(w.kwotaZwrotu)}</td>
  <td class="right">${formatPrice(w.wartoscZ)}</td>
</tr>`;
}

// Płatność RR. Rozdzielamy rachunki wprost, bo pomylenie ich kierunku to
// najgroźniejszy błąd w tym dokumencie: przelew idzie do ROLNIKA.
function renderRRPaymentInfoHTML(pl) {
  if (!pl) return '<em>Brak danych o płatności</em>';

  let html = '';
  if (pl.platnoscInna && pl.opisPlatnosci) {
    html += `<strong>Forma:</strong> ${pl.opisPlatnosci}<br>`;
  } else if (pl.formaPlatnosciDisplay) {
    html += `<strong>Forma:</strong> ${pl.formaPlatnosciDisplay}<br>`;
  }

  for (const r of pl.rachunkiRolnika) {
    html += `<strong>Rachunek rolnika:</strong> <span class="payment-nrb">${formatNRB(r.nrRB)}</span>`;
    if (r.nazwaBanku) html += ` <small>(${r.nazwaBanku})</small>`;
    html += '<br>';
    if (r.swift) html += `<small>SWIFT: ${r.swift}</small><br>`;
    if (r.opis) html += `<small>${r.opis}</small><br>`;
  }
  for (const r of pl.rachunkiNabywcy) {
    html += `<span class="hide-in-simplified"><strong>Rachunek nabywcy:</strong> <span class="payment-nrb">${formatNRB(r.nrRB)}</span>`;
    if (r.nazwaBanku) html += ` <small>(${r.nazwaBanku})</small>`;
    html += '</span><br>';
  }

  if (pl.ipksef) html += `<small>IPKSeF: ${pl.ipksef}</small><br>`;
  if (pl.linkDoPlatnosci) html += `<small>Link do płatności: ${escAttr(pl.linkDoPlatnosci)}</small><br>`;

  return html || '<em>Brak danych o płatności</em>';
}

// Dowód zapłaty nie jest w VAT RR ozdobnikiem: bez niego nabywca nie zwiększa
// podatku naliczonego o zryczałtowany zwrot (art. 116 ust. 6 ustawy o VAT).
function renderRRDokumentyZaplatyHTML(rrData) {
  if (!rrData.dokumentyZaplaty || rrData.dokumentyZaplaty.length === 0) return '';

  let html = `<div class="additional-info no-break"><h2>Dokumenty zapłaty</h2><div class="info-grid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:3px;">`;
  for (const d of rrData.dokumentyZaplaty) {
    html += `<div class="info-item" style="border:1px solid #e0e0e0; padding:2px; background:#fafafa; border-radius:3px; font-size:10px;">
      <strong>${d.nr}</strong>${d.data ? ` <span style="color:#7f8c8d;">z dnia ${d.data}</span>` : ''}
    </div>`;
  }
  const remaining = rrData.dokumentyZaplaty.length % 3;
  if (remaining !== 0) for (let i = 0; i < 3 - remaining; i++) html += '<div style="border:none;"></div>';
  html += '</div></div>';
  return html;
}

// Podmiot1K / Podmiot2K w RR zawierają tylko dane identyfikacyjne i adres,
// więc renderujemy je skrótowo.
function rrPodmiotKorektaHTML(pkData) {
  if (!pkData) return '';
  let html = '';
  if (pkData.nazwa) html += `<strong>${pkData.nazwa}</strong><br>`;
  if (pkData.nip) html += `<div><strong>NIP:</strong> ${nipHtml(pkData.nip)}</div>`;
  if (pkData.adres) {
    let a = `${pkData.adres.kodKraju || ''} ${pkData.adres.linia1 || ''}`;
    if (pkData.adres.linia2) a += `, ${pkData.adres.linia2}`;
    html += `<div>${a.trim()}</div>`;
  }
  return html;
}

// Sekcja podmiotu z ewentualnym stanem przed korektą (Podmiot1K / Podmiot2K).
function rrPodmiotSekcjaHTML(podmiot, podmiotK, tytul) {
  if (!podmiotK) {
    return renderPodmiotHTML(podmiot, tytul);
  }
  let html = `<div class="col"><h2>${tytul}</h2>`;
  html += `<div style="margin-bottom:5px; background:#fef5e7; padding:5px;">`;
  html += `<small style="color:#7f8c8d;">PRZED KOREKTĄ</small><br>`;
  html += rrPodmiotKorektaHTML(podmiotK);
  html += `</div><div style="background:#e8f8f5; padding:5px;">`;
  html += `<small style="color:#27ae60;">PO KOREKCIE</small><br>`;
  html += renderPodmiotHTML(podmiot, "").replace('<div class="col">', '').replace(/<\/div>$/, '');
  html += `</div></div>`;
  return html;
}

// ============================================================================
// GŁÓWNA FUNKCJA RENDERUJĄCA FA_RR (HTML)
// ============================================================================
function renderRR(xml, fileName, xmlContent) {
  const root = xml.documentElement;
  if (root.namespaceURI !== NS_FA_RR) { showError("Plik XML ma nieprawidłową przestrzeń nazw"); return; }
  setDocNs(NS_FA_RR);

  // Faktura VAT RR jest dokumentem wyłącznie krajowym — wymuszamy polski,
  // żeby przy wcześniej wybranym języku obcym nie powstał dokument-hybryda
  // (współdzielone helpery wołają t()).
  setInvoiceLang('pl');

  document.getElementById("pages").innerHTML = "";
  document.getElementById("currentFile").textContent = fileName;
  document.getElementById("fileInfo").style.display = "flex";
  const rdToggle = document.getElementById('rowDetailsToggle');
  if (rdToggle) { rdToggle.checked = false; }
  document.getElementById("pages").classList.remove('hide-row-details');
  const rdGroup = document.getElementById('rowDetailsToggleGroup');
  if (rdGroup) { rdGroup.style.display = 'none'; }

  const fakturaNode = xml.getElementsByTagNameNS(ns, "Faktura")[0];
  if (!fakturaNode) { showError("Nieprawidłowa struktura XML - brak elementu Faktura"); return; }
  const frrNode = fakturaNode.getElementsByTagNameNS(ns, "FakturaRR")[0];
  if (!frrNode) { showError("Brak elementu FakturaRR w dokumencie"); return; }

  // ===== PARSOWANIE =====
  const naglowekNode = fakturaNode.getElementsByTagNameNS(ns, "Naglowek")[0];
  const naglowekData = naglowekNode ? {
    dataWytworzenia: getText(naglowekNode, "DataWytworzeniaFa"),
    systemInfo: getText(naglowekNode, "SystemInfo")
  } : null;

  // UWAGA na kierunek: Podmiot1 = rolnik (dostawca), Podmiot2 = nabywca (wystawca)
  const p1Data = parsePodmiot(fakturaNode.getElementsByTagNameNS(ns, "Podmiot1")[0], 'podmiot1');
  const p2Data = parsePodmiot(fakturaNode.getElementsByTagNameNS(ns, "Podmiot2")[0], 'podmiot2');
  const p3DataArray = Array.from(fakturaNode.getElementsByTagNameNS(ns, "Podmiot3")).map(n => parsePodmiot(n, 'podmiot3'));

  const rrData = parseFakturaRR(frrNode);
  const platnoscData = parsePlatnoscRR(frrNode.getElementsByTagNameNS(ns, "Platnosc")[0]);
  const rozliczenieData = parseRozliczenie(frrNode.getElementsByTagNameNS(ns, "Rozliczenie")[0]);
  const stopkaData = parseStopka(fakturaNode.getElementsByTagNameNS(ns, "Stopka")[0]);

  const wierszeArray = rrData.wiersze;
  if (wierszeArray.length > 5000) { showError("Faktura zawiera zbyt wiele wierszy (max 5000)"); return; }

  const xmlHash = calculateXmlHash(xmlContent);
  const unknownElements = findUnknownFakturaElements(xml);
  // Numer KSeF i link weryfikacyjny odnoszą się do WYSTAWCY, a w VAT RR
  // wystawcą jest nabywca (Podmiot2) — nie rolnik.
  const nipWystawcy = p2Data && p2Data.nip;

  const jestKorekta = rrData.rodzaj === 'KOR_VAT_RR';

  // ===== BUDOWANIE HTML =====
  let c = renderNaglowekHTML(rrData, fileName, naglowekData);

  // Podmioty — nagłówki z kwalifikatorem roli
  c += `<div class="section two-cols">`;
  c += rrPodmiotSekcjaHTML(p1Data, rrData.podmiot1K, 'ROLNIK RYCZAŁTOWY (DOSTAWCA)');
  c += rrPodmiotSekcjaHTML(p2Data, rrData.podmiot2K, 'NABYWCA (WYSTAWCA FAKTURY)');
  c += `</div>`;

  if (p3DataArray.length > 0) {
    for (let i = 0; i < p3DataArray.length; i += 2) {
      c += `<div class="section two-cols">`;
      c += renderPodmiot3HTML(p3DataArray[i]);
      c += (i + 1 < p3DataArray.length) ? renderPodmiot3HTML(p3DataArray[i + 1]) : `<div class="col"></div>`;
      c += `</div>`;
    }
  }

  // Dane faktury + płatność
  let korygowaneInfo = '';
  if (jestKorekta && rrData.daneKorygowane.length > 0) {
    const lista = rrData.daneKorygowane.map(dk => {
      let o = `${dk.nr}&nbsp;z&nbsp;dnia&nbsp;${dk.data}`;
      if (dk.nrKSeF) o += ` KSeF:&nbsp;${dk.nrKSeF}`;
      else if (dk.pozaKSeF) o += `&nbsp;(poza&nbsp;KSeF)`;
      return o;
    });
    korygowaneInfo = `<strong>Korygowane faktury:</strong>&nbsp;${lista.join('<br>')}<br>`;
    if (rrData.typKorekty) korygowaneInfo += `<strong>Typ&nbsp;korekty:</strong>&nbsp;${rrData.typKorektyDisplay}<br>`;
  }
  if (rrData.nrFaKorygowany) korygowaneInfo += `<strong>Nr faktury korygowanej:</strong> ${rrData.nrFaKorygowany}<br>`;
  const przyczynaInfo = rrData.przyczynaKorekty ? `<strong>Przyczyna korekty:</strong> ${rrData.przyczynaKorekty}<br>` : '';

  c += `
    <div class="section two-cols">
      <div class="col">
        <h2>DANE FAKTURY</h2>
        <strong>Numer:</strong> ${rrData.nrFaktury}<br>
        <strong>Data wystawienia:</strong> ${rrData.dataWystawienia}${rrData.miejsceWystawienia ? ', ' + rrData.miejsceWystawienia : ''}<br>
        ${rrData.dataNabycia ? `<strong>Data nabycia:</strong> ${rrData.dataNabycia}<br>` : ''}
        ${korygowaneInfo}
        ${przyczynaInfo}
      </div>
      <div class="col">
        <h2>PŁATNOŚĆ</h2>
        ${renderRRPaymentInfoHTML(platnoscData)}
      </div>
    </div>
  `;

  // Tabela pozycji
  let tableRows = '';
  if (jestKorekta) {
    const grouped = groupCorrectionRows(wierszeArray, 'cena');
    const showDiffRows = rrCorrectionDiffRowsAllowed(rrData, wierszeArray);
    for (const item of grouped) {
      if (item.type === 'pair') {
        tableRows += rrRowHTML(item.before, true);
        tableRows += rrRowHTML(item.after, false);

        const dQty = (parseFloat(item.after.ilosc) || 0) - (parseFloat(item.before.ilosc) || 0);
        const dPrice = (parseFloat(item.after.cena) || 0) - (parseFloat(item.before.cena) || 0);
        const dWartosc = (parseFloat(item.after.wartoscBez) || 0) - (parseFloat(item.before.wartoscBez) || 0);
        const dZwrot = (parseFloat(item.after.kwotaZwrotu) || 0) - (parseFloat(item.before.kwotaZwrotu) || 0);
        const dOgolem = (parseFloat(item.after.wartoscZ) || 0) - (parseFloat(item.before.wartoscZ) || 0);

        if (showDiffRows && (dQty !== 0 || dPrice !== 0 || dWartosc !== 0 || dZwrot !== 0 || dOgolem !== 0)) {
          // Gdy stawka zwrotu się zmieniła (6,5% ↔ 7%), pokazujemy "—" — różnica
          // stawek nie ma sensu liczbowego (analogicznie do korekt stawki VAT w FA(3)).
          const stawka = (item.before.stawkaZwrotu === item.after.stawkaZwrotu)
            ? item.before.stawkaZwrotuDisplay
            : '—';
          tableRows += `
<tr class="diff-row">
  <td></td>
  <td colspan="2"><b>RÓŻNICA</b></td>
  <td class="right">${dQty !== 0 ? fmtQty(dQty) : ''}</td>
  <td class="center">—</td>
  <td class="right">${dPrice !== 0 ? formatPrice(dPrice) : ''}</td>
  <td class="right">${dWartosc !== 0 ? formatPrice(dWartosc) : ''}</td>
  <td class="center">${stawka}</td>
  <td class="right">${dZwrot !== 0 ? formatPrice(dZwrot) : ''}</td>
  <td class="right">${dOgolem !== 0 ? formatPrice(dOgolem) : ''}</td>
</tr>`;
        }
      } else {
        tableRows += rrRowHTML(item.row, item.isBefore);
      }
    }
  } else {
    for (const w of wierszeArray) tableRows += rrRowHTML(w, false);
  }

  // Korekta samych danych podmiotu bywa bez wierszy — same nagłówki kolumn
  // to szum, nie informacja (guard jak w FA(3) od v1.6.19).
  if (wierszeArray.length > 0) c += `
    <table>
      <tr>
        <th>#</th>
        <th>Nazwa produktu / usługi</th>
        <th>Klasa /<br>jakość</th>
        <th class="right">Ilość</th>
        <th class="center">JM</th>
        <th class="right">Cena<br>jedn.</th>
        <th class="right">Wartość<br>bez ZZP*</th>
        <th class="center">Stawka<br>ZZP</th>
        <th class="right">Kwota<br>ZZP</th>
        <th class="right">Wartość<br>z ZZP</th>
      </tr>
      ${tableRows}
    </table>
    <div class="rr-zzp-legend">* ZZP — zryczałtowany zwrot podatku</div>
  `;

  c += rrSummaryHTML(rrData);
  c += rrHeaderConsistencyCheckHTML(rrData);
  c += renderRozliczenieHTML(rozliczenieData);
  c += renderRRDokumentyZaplatyHTML(rrData);
  // p1Data celowo nie przekazujemy: helper pokazałby "Status sprzedawcy",
  // a w RR StatusInfoPodatnika ma nabywca — trafia do jego sekcji podmiotu.
  c += renderDodatkoweInformacjeHTML(rrData, null);
  c += renderFooterHTML(stopkaData);

  // QR weryfikacyjny KSeF
  const qrContainerId = "qr-container-main";
  if (unknownElements.length > 0) {
    const serializer = new XMLSerializer();
    const elementsHtml = unknownElements.map(el => {
      const raw = serializer.serializeToString(el);
      return `<pre class="unknown-element-xml">${raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
    }).join('');
    c += `
      <div class="qr-section">
        <div class="schema-warning">
          <strong>Weryfikacja w KSeF niemożliwa</strong>
          Plik zawiera elementy spoza schematu FA_RR(1). Hash dokumentu może nie odpowiadać oryginałowi z KSeF.
          <div class="unknown-elements-list">${elementsHtml}</div>
        </div>
      </div>`;
  } else {
    c += `<div class="qr-section"><div id="${qrContainerId}" class="qr-container"></div></div>`;
  }
  c += `<div style="text-align:center; margin-top:10px; font-size:10px; color:#7f8c8d;">
    KSeFeusz.pl - darmowy wizualizator faktur ustrukturyzowanych KSeF wersja ${APP_VERSION}
  </div>`;

  // ===== WSTAWIENIE DO STRONY =====
  const container = document.createElement("div");
  const isFullView = document.getElementById('viewToggle') && document.getElementById('viewToggle').checked;
  container.className = "invoice-container" + (isFullView ? "" : " simplified");
  container.innerHTML = c;
  document.getElementById("pages").appendChild(container);

  if (unknownElements.length === 0 && nipWystawcy && rrData.dataWystawienia) {
    addQRCode(qrContainerId, nipWystawcy, rrData.dataWystawienia, xmlHash);
  }

  // ===== PAYMENT CONTAINER =====
  // Przelew idzie do ROLNIKA, więc odbiorcą jest Podmiot1 i jego rachunek (RachunekBankowy1).
  // Kwota: DoZaplaty z Rozliczenia gdy wystawca je podał (uwzględnia potrącenia),
  // w przeciwnym razie P_12_1.
  // Biała lista jest WYŁĄCZONA: rolnik ryczałtowy jest zwolniony z VAT na podstawie
  // art. 43 ust. 1 pkt 3 i z reguły nie figuruje w wykazie podatników VAT. Odpowiedź
  // "rachunek nieprzypisany" byłaby regułą, nie ostrzeżeniem — czerwony krzyżyk przy
  // poprawnej fakturze wprowadzałby w błąd.
  const kwotaDoZaplaty = (rozliczenieData && rozliczenieData.doZaplaty)
    ? rozliczenieData.doZaplaty
    : rrData.naleznoscOgolem;

  const paymentQrId = 'pqr-' + Date.now();
  const paymentHtml = renderPaymentContainerHTML(p1Data, platnoscData, rrData, paymentQrId, {
    rachunki: platnoscData ? platnoscData.rachunkiRolnika : null,
    formaPrzelewu: "1",
    amount: kwotaDoZaplaty,
    whiteList: false
  });
  if (paymentHtml) {
    const el = document.createElement('div');
    el.innerHTML = paymentHtml;
    document.getElementById("pages").appendChild(el.firstElementChild);
    if ((rrData.kodWaluty || 'PLN') === 'PLN') {
      addPaymentQR(paymentQrId, kwotaDoZaplaty || '0', platnoscData.rachunkiRolnika[0].nrRB,
                   (p1Data && p1Data.nip) || '', (p1Data && p1Data.nazwa) || '', rrData.nrFaktury || '');
    }
  }

  // ===== UI =====
  switchTab('faktura');
  const uploadArea = document.querySelector('#panel-faktura .upload-area');
  const newInvoiceBtn = document.getElementById('newInvoiceBtn');
  if (uploadArea) uploadArea.style.display = 'none';
  if (newInvoiceBtn) newInvoiceBtn.style.display = 'inline-flex';
  hideLoading();
}
