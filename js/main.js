// ============================================================================
// main.js - wersja 1.5.1 (generowanie PDF i obsługa zdarzeń)
// ============================================================================
// Zakładamy, że core.js, utils.js i renderer.js są załadowane przed main.js

// ============================================================================
// FUNKCJE GENERUJĄCE PDF
// ============================================================================

function pdfRenderPodmiot(data, tytul) {
  if (!data) return [];
  let content = [pdfSectionHeader(tytul, 0)];
  if (data.nazwa) content.push({ text: data.nazwa, bold: true, margin: [0, 0, 0, 1] });
  if (data.nip) content.push({ text: `NIP: ${data.prefiks ? data.prefiks + ' ' : ''}${data.nip}`, margin: [0, 0, 0, 1] });
  if (data.adres) {
    let adresTekst = `${data.adres.kodKraju || ''} ${data.adres.linia1}`;
    if (data.adres.linia2) adresTekst += `, ${data.adres.linia2}`;
    content.push({ text: adresTekst.trim(), margin: [0, 0, 0, 1] });
  }
  if (data.adresKoresp) {
    let adresKorespTekst = `${data.adresKoresp.kodKraju || ''} ${data.adresKoresp.linia1}`;
    if (data.adresKoresp.linia2) adresKorespTekst += `, ${data.adresKoresp.linia2}`;
    content.push({ text: `Adres koresp.: ${adresKorespTekst.trim()}`, margin: [0, 0, 0, 1], fontSize: 7 });
  }

  let gridItems = [];
  if (data.nrEORI) gridItems.push({ text: `EORI: ${data.nrEORI}`, fontSize: 7 });
  if (data.adres?.gln) gridItems.push({ text: `GLN: ${data.adres.gln}`, fontSize: 7 });
  if (data.nrKlienta) gridItems.push({ text: `Nr klienta: ${data.nrKlienta}`, fontSize: 7 });
  if (data.idNabywcy) gridItems.push({ text: `ID nabywcy: ${data.idNabywcy}`, fontSize: 7 });
  if (data.idWew) gridItems.push({ text: `ID wewn.: ${data.idWew}`, fontSize: 7 });
  if (data.kodUE && data.nrVatUE) gridItems.push({ text: `VAT UE: ${data.kodUE} ${data.nrVatUE}`, fontSize: 7 });
  if (data.kodKrajuId && data.nrID) gridItems.push({ text: `ID zagraniczny: ${data.kodKrajuId} ${data.nrID}`, fontSize: 7 });
  if (data.brakID) gridItems.push({ text: `bez identyfikatora podatkowego`, italics: true, fontSize: 7 });
  if (data.jst) gridItems.push({ text: `JST: ${data.jst === "1" ? "jednostka podrzędna" : "nie"}`, fontSize: 7 });
  if (data.gv) gridItems.push({ text: `GV: ${data.gv === "1" ? "członek grupy VAT" : "nie"}`, fontSize: 7 });
  if (data.status) gridItems.push({ text: `Status: ${taxpayerStatusMap[data.status] || data.status}`, fontSize: 7 });
  if (data.udzial) gridItems.push({ text: `Udział: ${parseFloat(data.udzial).toFixed(2)}%`, fontSize: 7 });

  if (gridItems.length > 0) {
    content.push(pdfCreateGrid(gridItems, 3));
  }

  // Dane kontaktowe
  if (data.kontakty && data.kontakty.length > 0) {
    let kontaktyText = [];
    for (let kontakt of data.kontakty) {
      if (kontakt.emaile.length > 0) kontaktyText.push(`e-mail: ${kontakt.emaile.join(', ')}`);
      if (kontakt.telefony.length > 0) kontaktyText.push(`tel.: ${kontakt.telefony.join(', ')}`);
    }
    if (kontaktyText.length > 0) {
      content.push({ text: kontaktyText.join(' • '), margin: [0, 1, 0, 0], fontSize: 7 });
    }
  }

  return content;
}

function pdfRenderPodmiotZKorekta(przed, po) {
  let content = [pdfSectionHeader('NABYWCA', 0)];
  content.push({ text: 'PRZED KOREKTĄ', fontSize: 8, color: '#7f8c8d', margin: [0, 0, 0, 1] });
  content.push(...pdfRenderPodmiot(przed, '').slice(1));
  content.push({ text: 'PO KOREKCIE', fontSize: 8, color: '#27ae60', margin: [0, 3, 0, 1] });
  content.push(...pdfRenderPodmiot(po, '').slice(1));
  return content;
}

function pdfRenderPodmiotUpowazniony(puData) {
  if (!puData) return null;

  let content = [pdfSectionHeader('PODMIOT UPOWAŻNIONY')];
  content.push({ text: `Nazwa: ${puData.nazwa}`, margin: [0, 0, 0, 1] });
  content.push({ text: `NIP: ${puData.nip}`, margin: [0, 0, 0, 1] });
  if (puData.nrEORI) content.push({ text: `EORI: ${puData.nrEORI}`, margin: [0, 0, 0, 1] });

  if (puData.adres) {
    let adresTekst = `${puData.adres.kodKraju || ''} ${puData.adres.linia1}`;
    if (puData.adres.linia2) adresTekst += `, ${puData.adres.linia2}`;
    content.push({ text: `Adres: ${adresTekst.trim()}`, margin: [0, 0, 0, 1] });
  }

  if (puData.adresKoresp) {
    let adresKorespTekst = `${puData.adresKoresp.kodKraju || ''} ${puData.adresKoresp.linia1}`;
    if (puData.adresKoresp.linia2) adresKorespTekst += `, ${puData.adresKoresp.linia2}`;
    content.push({ text: `Adres koresp.: ${adresKorespTekst.trim()}`, margin: [0, 0, 0, 1], fontSize: 8 });
  }

  const roleMapPU = { "1": "Organ egzekucyjny", "2": "Komornik sądowy", "3": "Przedstawiciel podatkowy" };
  if (puData.rola) content.push({ text: `Rola: ${roleMapPU[puData.rola] || puData.rola}`, margin: [0, 0, 0, 1] });

  if (puData.kontakty && puData.kontakty.length > 0) {
    for (let kontakt of puData.kontakty) {
      if (kontakt.emaile.length > 0) content.push({ text: `e-mail: ${kontakt.emaile.join(', ')}`, margin: [0, 0, 0, 1], fontSize: 8 });
      if (kontakt.telefony.length > 0) content.push({ text: `tel.: ${kontakt.telefony.join(', ')}`, margin: [0, 0, 0, 1], fontSize: 8 });
    }
  }

  return { stack: content, margin: [0, 0, 0, 1] };
}

function pdfRenderPodmiot3(p3Data) {
  if (!p3Data) return null;

  let content = [pdfSectionHeader(`PODMIOT TRZECI${p3Data.rolaInna ? ' (INNY)' : ''}`)];

  if (p3Data.nazwa) content.push({ text: p3Data.nazwa, bold: true, margin: [0, 0, 0, 1] });
  if (p3Data.nip) content.push({ text: `NIP: ${p3Data.prefiks ? p3Data.prefiks + ' ' : ''}${p3Data.nip}`, margin: [0, 0, 0, 1] });
  if (p3Data.idWew) content.push({ text: `ID wewn.: ${p3Data.idWew}`, margin: [0, 0, 0, 1] });
  if (p3Data.kodUE && p3Data.nrVatUE) content.push({ text: `VAT UE: ${p3Data.kodUE} ${p3Data.nrVatUE}`, margin: [0, 0, 0, 1] });
  if (p3Data.kodKrajuId && p3Data.nrID) content.push({ text: `ID zagraniczny: ${p3Data.kodKrajuId} ${p3Data.nrID}`, margin: [0, 0, 0, 1] });
  if (p3Data.brakID) content.push({ text: `bez identyfikatora podatkowego`, italics: true, margin: [0, 0, 0, 1] });

  if (p3Data.adres) {
    let adresTekst = `${p3Data.adres.kodKraju || ''} ${p3Data.adres.linia1}`;
    if (p3Data.adres.linia2) adresTekst += `, ${p3Data.adres.linia2}`;
    content.push({ text: adresTekst.trim(), margin: [0, 0, 0, 1] });
  }

  if (p3Data.adresKoresp) {
    let adresKorespTekst = `${p3Data.adresKoresp.kodKraju || ''} ${p3Data.adresKoresp.linia1}`;
    if (p3Data.adresKoresp.linia2) adresKorespTekst += `, ${p3Data.adresKoresp.linia2}`;
    content.push({ text: `Adres koresp.: ${adresKorespTekst.trim()}`, margin: [0, 0, 0, 1], fontSize: 7 });
  }

  content.push({ text: `Rola: ${roleMap[p3Data.rola] || p3Data.opisRoli || p3Data.rola || '—'}`, margin: [0, 1, 0, 1] });

  let gridItems = [];
  if (p3Data.nrEORI) gridItems.push({ text: `EORI: ${p3Data.nrEORI}`, fontSize: 7 });
  if (p3Data.nrKlienta) gridItems.push({ text: `Nr klienta: ${p3Data.nrKlienta}`, fontSize: 7 });
  if (p3Data.idNabywcy) gridItems.push({ text: `ID nabywcy: ${p3Data.idNabywcy}`, fontSize: 7 });
  if (p3Data.udzial) gridItems.push({ text: `Udział: ${parseFloat(p3Data.udzial).toFixed(2)}%`, fontSize: 7 });

  if (gridItems.length > 0) {
    content.push(pdfCreateGrid(gridItems, 3));
  }

  if (p3Data.kontakty && p3Data.kontakty.length > 0) {
    let kontaktyText = [];
    for (let kontakt of p3Data.kontakty) {
      if (kontakt.emaile.length > 0) kontaktyText.push(`e-mail: ${kontakt.emaile.join(', ')}`);
      if (kontakt.telefony.length > 0) kontaktyText.push(`tel.: ${kontakt.telefony.join(', ')}`);
    }
    if (kontaktyText.length > 0) {
      content.push({ text: kontaktyText.join(' • '), margin: [0, 1, 0, 0], fontSize: 7 });
    }
  }

  return { stack: content, margin: [0, 0, 0, 3] };
}

function pdfRenderPodmiot1K(p1kData) {
  if (!p1kData) return null;

  let content = [pdfSectionHeader('DANE SPRZEDAWCY PRZED KOREKTĄ')];

  if (p1kData.nazwa) content.push({ text: p1kData.nazwa, bold: true, margin: [0, 0, 0, 1] });

  if (p1kData.nip) {
    let nipText = p1kData.nip;
    if (p1kData.prefiks) nipText = `${p1kData.prefiks} ${nipText}`;
    content.push({ text: `NIP: ${nipText}`, margin: [0, 0, 0, 1] });
  }

  if (p1kData.adres) {
    let adresTekst = `${p1kData.adres.kodKraju || ''} ${p1kData.adres.linia1}`;
    if (p1kData.adres.linia2) adresTekst += `, ${p1kData.adres.linia2}`;
    content.push({ text: adresTekst.trim(), margin: [0, 0, 0, 1] });
    if (p1kData.adres.gln) content.push({ text: `GLN: ${p1kData.adres.gln}`, fontSize: 7, margin: [0, 0, 0, 1] });
  }

  return { stack: content, margin: [0, 0, 0, 5] };
}

function pdfRenderPodmiot2KFull(p2kFullArray) {
  if (!p2kFullArray || p2kFullArray.length === 0) return null;

  let content = [pdfSectionHeader('DANE NABYWCÓW PRZED KOREKTĄ')];

  for (let i = 0; i < p2kFullArray.length; i++) {
    const p2k = p2kFullArray[i];

    content.push({ text: `Nabywca ${i+1}:`, bold: true, margin: [0, 3, 0, 2] });

    if (p2k.nazwa) content.push({ text: p2k.nazwa, margin: [5, 0, 0, 1] });

    let details = [];
    if (p2k.nip) details.push(`NIP: ${p2k.nip}`);
    if (p2k.kodUE && p2k.nrVatUE) details.push(`VAT UE: ${p2k.kodUE} ${p2k.nrVatUE}`);
    if (p2k.kodKrajuId && p2k.nrID) details.push(`ID: ${p2k.kodKrajuId} ${p2k.nrID}`);
    if (p2k.brakID) details.push(`(bez identyfikatora)`);

    if (details.length > 0) {
      content.push({ text: details.join(' • '), margin: [5, 0, 0, 1], fontSize: 7 });
    }

    if (p2k.idNabywcy) content.push({ text: `ID nabywcy: ${p2k.idNabywcy}`, margin: [5, 0, 0, 1], fontSize: 7 });

    if (p2k.adres) {
      let adresTekst = `${p2k.adres.kodKraju || ''} ${p2k.adres.linia1}`;
      if (p2k.adres.linia2) adresTekst += `, ${p2k.adres.linia2}`;
      content.push({ text: adresTekst.trim(), margin: [5, 0, 0, 1], fontSize: 7 });
      if (p2k.adres.gln) content.push({ text: `GLN: ${p2k.adres.gln}`, margin: [5, 0, 0, 1], fontSize: 7 });
    }
  }

  return { stack: content, margin: [0, 0, 0, 5] };
}

function pdfRenderPaymentInfo(p) {
  if (!p) return { text: "—" };

  let parts = [];

  if (p.formaPlatnosci) parts.push(`Forma: ${paymentMap[p.formaPlatnosci] || p.formaPlatnosci}`);
  if (p.platnoscInna && p.opisPlatnosci) parts.push(`Inna: ${p.opisPlatnosci}`);

  if (p.terminData) parts.push(`Termin: ${p.terminData}`);
  if (p.terminOpis) {
    const { ilosc, jednostka, zdarzenie } = p.terminOpis;
    if (ilosc && jednostka && zdarzenie) parts.push(`Termin: ${ilosc} ${jednostka} od ${zdarzenie}`);
    else if (ilosc && jednostka) parts.push(`Termin: ${ilosc} ${jednostka}`);
  }

  for (let rach of p.rachunki) {
    if (rach.nrRB) {
      let rachunekParts = [`Rachunek: ${formatujRachunek(rach.nrRB)}`];
      if (rach.swift) rachunekParts.push(`SWIFT: ${rach.swift}`);
      const typyMap = { "1": "rach. własny (wierzytelności)", "2": "rach. własny (pobranie)", "3": "rach. własny (gospodarka)" };
      if (rach.typWlasny) rachunekParts.push(typyMap[rach.typWlasny] || 'rach. własny');
      if (rach.nazwaBanku) rachunekParts.push(rach.nazwaBanku);
      parts.push(rachunekParts.join(' • '));
    }
  }

  for (let rach of p.rachunkiFaktora) {
    if (rach.nrRB) {
      let rachunekParts = [`Rachunek faktora: ${formatujRachunek(rach.nrRB)}`];
      if (rach.swift) rachunekParts.push(`SWIFT: ${rach.swift}`);
      const typyMap = { "1": "rach. własny (wierzytelności)", "2": "rach. własny (pobranie)", "3": "rach. własny (gospodarka)" };
      if (rach.typWlasny) rachunekParts.push(typyMap[rach.typWlasny] || 'rach. własny');
      if (rach.nazwaBanku) rachunekParts.push(rach.nazwaBanku);
      parts.push(rachunekParts.join(' • '));
    }
  }

  if (p.zaplacono) parts.push(`Zapłacono: ${p.dataZaplaty}`);

  if (p.zaplatyCzesciowe.length > 0) {
    parts.push(`Zapłaty częściowe:`);
    for (let z of p.zaplatyCzesciowe) {
      let zaplata = `  - ${formatPrice(z.kwota, true)} z ${z.data}`;
      if (z.forma) zaplata += ` (${paymentMap[z.forma] || z.forma})`;
      parts.push(zaplata);
    }
  }

  if (p.skonto) {
    parts.push(`Skonto: ${p.skonto.warunki || ''} ${p.skonto.wysokosc ? '(' + p.skonto.wysokosc + ')' : ''}`);
  }

  if (p.linkDoPlatnosci) parts.push(`Link: ${p.linkDoPlatnosci}`);
  if (p.ipksef) parts.push(`IPKSeF: ${p.ipksef}`);

  return { stack: parts.map(t => ({ text: t, margin: [0, 1, 0, 1] })) };
}

function pdfRenderRozliczenie(r) {
  if (!r) return null;

  let content = [pdfSectionHeader('ROZLICZENIE')];

  for (let obc of r.obciazenia) {
    if (obc.kwota && obc.powod) {
      content.push({ text: `Obciążenie: ${formatPrice(obc.kwota, true)} - ${obc.powod}`, margin: [0, 0, 0, 1] });
    }
  }
  if (r.sumaObciazen) content.push({ text: `Suma obciążeń: ${formatPrice(r.sumaObciazen, true)}`, margin: [0, 0, 0, 1] });

  for (let odl of r.odliczenia) {
    if (odl.kwota && odl.powod) {
      content.push({ text: `Odliczenie: ${formatPrice(odl.kwota, true)} - ${odl.powod}`, margin: [0, 0, 0, 1] });
    }
  }
  if (r.sumaOdliczen) content.push({ text: `Suma odliczeń: ${formatPrice(r.sumaOdliczen, true)}`, margin: [0, 0, 0, 1] });

  if (r.doZaplaty) content.push({ text: `Do zapłaty: ${formatPrice(r.doZaplaty, true)}`, margin: [0, 0, 0, 1], bold: true });
  if (r.doRozliczenia) content.push({ text: `Do rozliczenia: ${formatPrice(r.doRozliczenia, true)}`, margin: [0, 0, 0, 1], bold: true });

  return { stack: content, margin: [0, 0, 0, 1] };
}

function pdfRenderZaliczkaCzesciowa(zaliczkiData) {
  if (!zaliczkiData || !zaliczkiData.zaplaty || zaliczkiData.zaplaty.length === 0) return null;

  let content = [pdfSectionHeader('ZALICZKI CZĘŚCIOWE')];

  for (let z of zaliczkiData.zaplaty) {
    let item = [];
    if (z.dataOtrzymania) item.push(`Data: ${z.dataOtrzymania}`);
    if (z.kwota) item.push(`Kwota: ${formatPrice(z.kwota, true)}`);
    if (z.kursWaluty) item.push(`Kurs: ${z.kursWaluty}`);

    if (item.length > 0) {
      content.push({ text: '• ' + item.join(' • '), margin: [0, 0, 0, 1], fontSize: 8 });
    }
  }

  return { stack: content, margin: [0, 0, 0, 5] };
}

function pdfRenderWarunkiTransakcji(w) {
  if (!w) return null;

  let content = [pdfSectionHeader('WARUNKI TRANSAKCJI')];
  let hasContent = false;

  if (w.umowy.length > 0) {
    let umowyList = w.umowy.map(u => (u.nr && u.data) ? `${u.nr} z ${u.data}` : (u.nr || u.data)).filter(Boolean);
    if (umowyList.length > 0) { content.push({ text: `Umowy: ${umowyList.join('; ')}`, margin: [0, 0, 0, 1] }); hasContent = true; }
  }

  if (w.zamowienia.length > 0) {
    let zamowieniaList = w.zamowienia.map(z => (z.nr && z.data) ? `${z.nr} z ${z.data}` : (z.nr || z.data)).filter(Boolean);
    if (zamowieniaList.length > 0) { content.push({ text: `Zamówienia: ${zamowieniaList.join('; ')}`, margin: [0, 0, 0, 1] }); hasContent = true; }
  }

  if (w.partie.length > 0) { content.push({ text: `Partie towaru: ${w.partie.join(', ')}`, margin: [0, 0, 0, 1] }); hasContent = true; }
  if (w.warunkiDostawy) { content.push({ text: `Incoterms: ${w.warunkiDostawy}`, margin: [0, 0, 0, 1] }); hasContent = true; }
  if (w.kursUmowny && w.walutaUmowna) { content.push({ text: `Kurs umowny: 1 ${w.walutaUmowna} = ${w.kursUmowny} PLN`, margin: [0, 0, 0, 1] }); hasContent = true; }
  if (w.podmiotPosredniczacy !== null) { content.push({ text: `Transakcja łańcuchowa: ${w.podmiotPosredniczacy ? 'Tak (podmiot pośredniczący)' : 'Nie'}`, margin: [0, 0, 0, 1] }); hasContent = true; }

  if (w.transporty && w.transporty.length > 0) {
    for (let t of w.transporty) {
      const transportDef = pdfRenderTransport(t);
      if (transportDef) { content.push(transportDef); hasContent = true; }
    }
  }

  if (!hasContent) return null;
  return { stack: content, margin: [0, 0, 0, 5] };
}

function pdfRenderTransport(t) {
  let content = [];

  if (t.rodzaj) {
    const rodzajMap = { "1": "Morski", "2": "Kolejowy", "3": "Drogowy", "4": "Lotniczy", "5": "Przesyłka pocztowa", "7": "Stałe instalacje przesyłowe", "8": "Żegluga śródlądowa" };
    content.push({ text: `Transport - ${rodzajMap[t.rodzaj] || t.rodzaj}`, margin: [0, 0, 0, 1] });
  } else if (t.transportInny && t.opisInnegoTransportu) {
    content.push({ text: `Transport - ${t.opisInnegoTransportu} (inny)`, margin: [0, 0, 0, 1] });
  }

  if (t.przewoznik) {
    if (t.przewoznik.nazwa) content.push({ text: `Przewoźnik: ${t.przewoznik.nazwa}`, margin: [5, 0, 0, 2], fontSize: 8 });
    if (t.przewoznik.nip) content.push({ text: `NIP: ${t.przewoznik.nip}`, margin: [5, 0, 0, 2], fontSize: 8 });
    if (t.przewoznik.kodUE && t.przewoznik.nrVatUE) content.push({ text: `VAT UE: ${t.przewoznik.kodUE} ${t.przewoznik.nrVatUE}`, margin: [5, 0, 0, 2], fontSize: 8 });
    if (t.przewoznik.adres) {
      let adresTekst = `${t.przewoznik.adres.kodKraju || ''} ${t.przewoznik.adres.linia1}`;
      if (t.przewoznik.adres.linia2) adresTekst += `, ${t.przewoznik.adres.linia2}`;
      content.push({ text: adresTekst.trim(), margin: [0, 0, 0, 1], fontSize: 8 });
    }
  }

  if (t.nrZlecenia) content.push({ text: `Zlecenie transportu: ${t.nrZlecenia}`, margin: [0, 0, 0, 1] });

  if (t.ladunek) {
    const ladunekMap = { "1": "Bańka", "2": "Beczka", "3": "Butla", "4": "Karton", "5": "Kanister", "6": "Klatka", "7": "Kontener", "8": "Kosz/koszyk", "9": "Łubianka", "10": "Opakowanie zbiorcze", "11": "Paczka", "12": "Pakiet", "13": "Paleta", "14": "Pojemnik", "15": "Pojemnik do ładunków masowych stałych", "16": "Pojemnik do ładunków masowych w postaci płynnej", "17": "Pudełko", "18": "Puszka", "19": "Skrzynia", "20": "Worek" };
    let ladunekText = `Ładunek: ${ladunekMap[t.ladunek] || t.ladunek}`;
    if (t.jednostkaOpakowania) ladunekText += ` (${t.jednostkaOpakowania})`;
    content.push({ text: ladunekText, margin: [0, 0, 0, 1] });
  } else if (t.ladunekInny && t.opisInnegoLadunku) {
    let ladunekText = `Ładunek: ${t.opisInnegoLadunku} (inny)`;
    if (t.jednostkaOpakowania) ladunekText += ` (${t.jednostkaOpakowania})`;
    content.push({ text: ladunekText, margin: [0, 0, 0, 1] });
  }

  if (t.dataRozp || t.dataZak) {
    let daty = [];
    if (t.dataRozp) daty.push(`od: ${t.dataRozp}`);
    if (t.dataZak) daty.push(`do: ${t.dataZak}`);
    content.push({ text: `Termin transportu: ${daty.join(' ')}`, margin: [0, 0, 0, 1] });
  }

  if (t.wysylkaZ) {
    let miejsce = `${t.wysylkaZ.kodKraju || ''} ${t.wysylkaZ.linia1}`;
    if (t.wysylkaZ.linia2) miejsce += `, ${t.wysylkaZ.linia2}`;
    content.push({ text: `Wysyłka z: ${miejsce.trim()}`, margin: [0, 0, 0, 1] });
  }

  if (t.wysylkaDo) {
    let miejsce = `${t.wysylkaDo.kodKraju || ''} ${t.wysylkaDo.linia1}`;
    if (t.wysylkaDo.linia2) miejsce += `, ${t.wysylkaDo.linia2}`;
    content.push({ text: `Wysyłka do: ${miejsce.trim()}`, margin: [0, 0, 0, 1] });
  }

  if (t.wysylkaPrzez && t.wysylkaPrzez.length > 0) {
    const przezList = t.wysylkaPrzez.map((p, idx) => {
      let miejsce = `${p.kodKraju || ''} ${p.linia1 || ''}`.trim();
      if (p.linia2) miejsce += `, ${p.linia2}`;
      return `${idx + 1}. ${miejsce}`;
    }).join('; ');
    content.push({ text: `Wysyłka przez: ${przezList}`, margin: [0, 0, 0, 1] });
  }

  return { stack: content, margin: [5, 0, 0, 3] };
}

function pdfRenderAdnotacje(a) {
  if (!a) return null;

  function flagItem(label, valueTak, extra) {
    const valueText = valueTak ? (extra ? `Tak (${extra})` : 'Tak') : (extra || 'Nie');
    return {
      stack: [{
        text: [
          { text: label + ': ', fontSize: 7, color: '#4e4e4e' },
          { text: valueText, fontSize: 7, bold: true, color: valueTak ? '#1a5276' : '#333333' }
        ]
      }]
    };
  }

  let content = [pdfSectionHeader('ADNOTACJE')];
  let gridItems = [];

  if (a.p16)  gridItems.push(flagItem('Metoda kasowa',          a.p16  === "1"));
  if (a.p17)  gridItems.push(flagItem('Samofakturowanie',       a.p17  === "1"));
  if (a.p18)  gridItems.push(flagItem('Odwrotne obciążenie',    a.p18  === "1"));
  if (a.p18a) gridItems.push(flagItem('Split payment',          a.p18a === "1"));
  if (a.p23)  gridItems.push(flagItem('Proc. uproszczona WE',   a.p23  === "1"));

  if (a.proceduraMarzy) {
    if (a.proceduraMarzy.wystepuje) {
      let typy = [];
      if (a.proceduraMarzy.biuraPodrozy)   typy.push("biura podróży");
      if (a.proceduraMarzy.towaryUzywane)  typy.push("towary używane");
      if (a.proceduraMarzy.dzielaSztuki)   typy.push("dzieła sztuki");
      if (a.proceduraMarzy.antyki)         typy.push("kolekcjonerskie/antyki");
      gridItems.push(flagItem('Procedura marży', true, typy.join(', ')));
    } else {
      gridItems.push(flagItem('Procedura marży', false));
    }
  }

  if (gridItems.length > 0) {
    content.push(pdfCreateGrid(gridItems, 3));
  }

  if (a.zwolnienie) {
    if (a.zwolnienie.p19) {
      const podstawa = a.zwolnienie.p19a || a.zwolnienie.p19b || a.zwolnienie.p19c || 'brak podstawy';
      content.push({ text: [{ text: 'Zwolnienie: ', fontSize: 7, color: '#4e4e4e' }, { text: `Tak (${podstawa})`, fontSize: 7, bold: true, color: '#1a5276' }], margin: [2, 2, 0, 0] });
    } else if (a.zwolnienie.p19n) {
      content.push({ text: [{ text: 'Zwolnienie: ', fontSize: 7, color: '#4e4e4e' }, { text: 'Nie dotyczy', fontSize: 7, bold: true, color: '#333333' }], margin: [2, 2, 0, 0] });
    }
  }

  return { stack: content, margin: [0, 0, 0, 5] };
}

function pdfRenderNoweSrodki(a) {
  if (!a?.noweSrodkiTransportu) return null;

  const nst = a.noweSrodkiTransportu;
  let content = [pdfSectionHeader('NOWE ŚRODKI TRANSPORTU')];

  if (nst.p22n) {
    content.push({ text: 'Wewnątrzwspólnotowa dostawa nowych środków transportu: Nie dotyczy', margin: [0, 0, 0, 1] });
    return { stack: content, margin: [0, 0, 0, 5] };
  }

  if (nst.p42_5 !== undefined) content.push({ text: `Art. 42 ust. 5: ${nst.p42_5 ? "Tak" : "Nie"}`, margin: [0, 0, 0, 1] });

  for (let pojazd of nst.pojazdy) {
    content.push({ text: 'Nowy środek transportu', bold: true, margin: [0, 3, 0, 2] });
    if (pojazd.dataDopuszczenia) content.push({ text: `Data dopuszczenia: ${pojazd.dataDopuszczenia}`, margin: [5, 0, 0, 1] });
    if (pojazd.nrWiersza) content.push({ text: `Nr wiersza: ${pojazd.nrWiersza}`, margin: [5, 0, 0, 1] });

    let dane = [];
    if (pojazd.marka) dane.push(pojazd.marka);
    if (pojazd.model) dane.push(pojazd.model);
    if (pojazd.kolor) dane.push(`(${pojazd.kolor})`);
    if (pojazd.nrRej) dane.push(`[${pojazd.nrRej}]`);
    if (pojazd.rokProd) dane.push(`rocznik ${pojazd.rokProd}`);
    if (dane.length > 0) content.push({ text: `Dane: ${dane.join(' ')}`, margin: [5, 0, 0, 1] });

    if (pojazd.przebieg) content.push({ text: `Przebieg: ${pojazd.przebieg} km`, margin: [5, 0, 0, 1] });
    if (pojazd.vin || pojazd.nadwozie || pojazd.podwozie || pojazd.rama) {
      let numery = [];
      if (pojazd.vin) numery.push(`VIN: ${pojazd.vin}`);
      if (pojazd.nadwozie) numery.push(`nadwozie: ${pojazd.nadwozie}`);
      if (pojazd.podwozie) numery.push(`podwozie: ${pojazd.podwozie}`);
      if (pojazd.rama) numery.push(`rama: ${pojazd.rama}`);
      content.push({ text: `Numery: ${numery.join(' ')}`, margin: [5, 0, 0, 1] });
    }
    if (pojazd.typ) content.push({ text: `Typ: ${pojazd.typ}`, margin: [5, 0, 0, 1] });
    if (pojazd.godzinyLodz) content.push({ text: `Godziny robocze (jednostka pływająca): ${pojazd.godzinyLodz}`, margin: [5, 0, 0, 1] });
    if (pojazd.kadlub) content.push({ text: `Nr kadłuba: ${pojazd.kadlub}`, margin: [5, 0, 0, 1] });
    if (pojazd.godzinySamolot) content.push({ text: `Godziny robocze (statek powietrzny): ${pojazd.godzinySamolot}`, margin: [5, 0, 0, 1] });
    if (pojazd.fabryczny) content.push({ text: `Nr fabryczny: ${pojazd.fabryczny}`, margin: [5, 0, 0, 1] });
  }

  return { stack: content, margin: [0, 0, 0, 5] };
}

function pdfRenderFakturyZaliczkowe(faData) {
  if (!faData.fakturyZaliczkowe || faData.fakturyZaliczkowe.length === 0) return null;

  let content = [pdfSectionHeader('FAKTURY ZALICZKOWE')];

  for (let fz of faData.fakturyZaliczkowe) {
    if (fz.nrKSeF) {
      content.push({ text: `KSeF: ${fz.nrKSeF}`, margin: [0, 0, 0, 1] });
    } else if (fz.nrPoza) {
      content.push({ text: `poza KSeF: ${fz.nrPoza}`, margin: [0, 0, 0, 1] });
    } else if (fz.znacznik) {
      content.push({ text: `(wystawiona poza KSeF)`, margin: [0, 0, 0, 1] });
    }
  }

  return { stack: content, margin: [0, 0, 0, 5] };
}

function pdfRenderDodatkoweInformacje(faData, p1Data) {
  let content = [pdfSectionHeader('DODATKOWE INFORMACJE')];
  let infoItems = [];

  if (faData.kodWaluty) infoItems.push({ text: `Waluta: ${faData.kodWaluty}`, fontSize: 7 });
  if (faData.wz.length > 0) infoItems.push({ text: `WZ: ${faData.wz.join(', ')}`, fontSize: 7 });
  if (faData.fp) infoItems.push({ text: `Faktura zaliczkowa: Tak`, fontSize: 7 });
  if (faData.tp) infoItems.push({ text: `Powiązania: Tak`, fontSize: 7 });
  if (faData.zwrotAkcyzy) infoItems.push({ text: `Zwrot akcyzy: Tak`, fontSize: 7 });
  if (faData.kursWalutyZ) infoItems.push({ text: `Kurs waluty: ${faData.kursWalutyZ}`, fontSize: 7 });
  if (faData.p15zk) infoItems.push({ text: `Kwota przed korektą: ${formatPrice(faData.p15zk, true)}`, fontSize: 7 });
  if (p1Data?.status) infoItems.push({ text: `Status sprzedawcy: ${taxpayerStatusMap[p1Data.status] || p1Data.status}`, fontSize: 7 });
  if (faData.okresFaKorygowanej) infoItems.push({ text: `Okres korekty: ${faData.okresFaKorygowanej}`, fontSize: 7 });

  if (infoItems.length > 0) {
    content.push(pdfCreateGrid(infoItems, 3));
  }

  // === NOWA WERSJA: Dodatkowe opisy (klucz-wartość) dla PDF ===
  if (faData.dodatkoweOpisy && faData.dodatkoweOpisy.length > 0) {

    // Opisy bez wiersza - grid jak dotychczas
    const opisyBezWiersza = faData.dodatkoweOpisy.filter(o => !o.nrWiersza);
    if (opisyBezWiersza.length > 0) {
      content.push({ text: 'Informacje ogólne', margin: [0, 5, 0, 1], fontSize: 9, bold: true });
      for (const o of opisyBezWiersza) {
        content.push({
          columns: [
            { width: 'auto', text: `${o.klucz}:`, fontSize: 7, bold: true, margin: [0, 0, 4, 1] },
            { width: '*', text: o.wartosc, fontSize: 7, margin: [0, 0, 0, 1] }
          ]
        });
      }
    }

    // Opisy związane z wierszami - ZBIORCZA TABELA
    const opisyWedlugWiersza = new Map();
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

	if (opisyWedlugWiersza.size > 0) {
	  content.push({ text: 'Dodatkowe informacje dla wierszy', margin: [0, 5, 0, 2], fontSize: 9, bold: true });

	  const sortedWiersze = Array.from(opisyWedlugWiersza.keys()).sort((a, b) => parseInt(a) - parseInt(b));
	  const sortedKlucze = Array.from(wszystkieKlucze).sort();

	  // Dostosuj rozmiar czcionki do liczby kolumn
	  const fontSize = sortedKlucze.length > 8 ? 6 : (sortedKlucze.length > 5 ? 7 : 8);

	  // Przygotuj dane dla tabeli
	  const tableBody = [];

	  // Nagłówek
	  const headerRow = [{ text: 'Nr wiersza', style: 'tableHeader' }];
	  for (let klucz of sortedKlucze) {
		headerRow.push({ text: klucz, style: 'tableHeader' });
	  }
	  tableBody.push(headerRow);

	  // Wiersze danych
	  for (let nr of sortedWiersze) {
		// Grupuj wartości dla tego samego klucza
		const opisyMap = new Map();
		for (let o of opisyWedlugWiersza.get(nr)) {
		  if (!opisyMap.has(o.klucz)) {
			opisyMap.set(o.klucz, []);
		  }
		  opisyMap.get(o.klucz).push(o.wartosc);
		}

		const row = [{ text: nr.toString(), alignment: 'center' }];

		for (let klucz of sortedKlucze) {
		  const wartosci = opisyMap.get(klucz);
		  let wyswietlanaWartosc = '—';

		  if (wartosci) {
			if (wartosci.length === 1) {
			  wyswietlanaWartosc = wartosci[0];
			} else {
			  // Dla PDF używamy zwykłego tekstu, nie HTML
			  wyswietlanaWartosc = wartosci.join(', ');
			}
		  }

		  row.push({ text: wyswietlanaWartosc, fontSize: fontSize });
		}

		tableBody.push(row);
	  }

	  // Określ szerokości kolumn
	  const widths = ['auto', ...Array(sortedKlucze.length).fill('*')];

	  content.push({
		table: {
		  widths: widths,
		  body: tableBody
		},
		layout: 'lightHorizontalLines',
		margin: [0, 0, 0, 5],
		fontSize: fontSize
	  });

	  // Dodaj notkę jeśli dużo kolumn
	  if (sortedKlucze.length > 8) {
		content.push({ text: 'Tabela może być szeroka - w razie potrzeby przewiń w PDF.', fontSize: 6, color: '#666666', margin: [0, 0, 0, 1] });
	  }
	}
  }

  return { stack: content, margin: [0, 0, 0, 3] };
}

function pdfRenderZalacznik(zalacznikData) {
  if (!zalacznikData || !zalacznikData.bloki || zalacznikData.bloki.length === 0) return null;

  let content = [pdfSectionHeader('ZAŁĄCZNIKI')];

  for (let blok of zalacznikData.bloki) {
    if (blok.naglowek) content.push({ text: blok.naglowek, bold: true, margin: [0, 3, 0, 2] });

    for (let meta of blok.metaDane) {
      content.push({ text: `${meta.klucz}: ${meta.wartosc}`, margin: [5, 0, 0, 1], fontSize: 8 });
    }

    for (let akapit of blok.akapity) {
      content.push({ text: akapit, margin: [5, 0, 0, 2], fontSize: 8 });
    }

    for (let tabela of blok.tabele) {
      if (tabela.opis) content.push({ text: tabela.opis, margin: [5, 3, 0, 2], fontSize: 9 });

      if (tabela.kolumny.length > 0 && tabela.wiersze.length > 0) {
        const tableBody = [];

        // Nagłówek
        const naglowekRow = tabela.kolumny.map(kol => ({ text: kol.nazwa || '', style: 'tableHeader' }));
        tableBody.push(naglowekRow);

        // Dane
        for (let wiersz of tabela.wiersze) {
          const row = [];
          for (let i = 0; i < tabela.kolumny.length; i++) {
            row.push(wiersz[i] || '—');
          }
          tableBody.push(row);
        }

        // Suma
        if (tabela.suma && tabela.suma.length > 0) {
          tableBody.push(tabela.suma.map(s => ({ text: s || '—', bold: true })));
        }

        content.push({
          table: { widths: Array(tabela.kolumny.length).fill('auto'), body: tableBody },
          margin: [10, 0, 0, 5],
          fontSize: 8
        });
      }
    }
  }

  return { stack: content, margin: [0, 0, 0, 5] };
}

function pdfRenderFooter(stopkaData) {
  if (!stopkaData) return null;

  let content = [pdfSectionHeader('STOPKA FAKTURY')];

  if (stopkaData.informacje && stopkaData.informacje.length > 0) {
    for (let info of stopkaData.informacje) {
      if (info.stopkaFaktury) content.push({ text: info.stopkaFaktury, margin: [0, 0, 0, 1] });
    }
  }

  if (stopkaData.rejestry && stopkaData.rejestry.length > 0) {
    for (let rej of stopkaData.rejestry) {
      if (rej.pelnaNazwa) content.push({ text: `Pełna nazwa: ${rej.pelnaNazwa}`, margin: [0, 0, 0, 1] });
      if (rej.krs) content.push({ text: `KRS: ${rej.krs}`, margin: [0, 0, 0, 1] });
      if (rej.regon) content.push({ text: `REGON: ${rej.regon}`, margin: [0, 0, 0, 1] });
      if (rej.bdo) content.push({ text: `BDO: ${rej.bdo}`, margin: [0, 0, 0, 1] });
    }
  }

  return { stack: content, margin: [0, 0, 0, 5] };
}

function pdfCreateGrid(items, columns = 3) {
  if (!items || items.length === 0) return null;

  const rows = [];
  for (let i = 0; i < items.length; i += columns) {
    const row = items.slice(i, i + columns);
    while (row.length < columns) row.push({ text: '' });
    rows.push(row);
  }

  return {
    table: { widths: Array(columns).fill('*'), body: rows },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 2, paddingRight: () => 2, paddingTop: () => 1, paddingBottom: () => 1 }
  };
}

function pdfSectionHeader(title, topMargin) {
  if (topMargin === undefined) topMargin = 0;
  return { text: title, bold: true, fontSize: 9, color: '#1a5276', margin: [0, topMargin, 0, 3] };
}

function pdfBox(content, breakable) {
  const items = Array.isArray(content) ? content : [content];
  const box = {
    table: { widths: ['*'], body: [[{ stack: items }]] },
    layout: {
      hLineWidth: function() { return 0.5; },
      vLineWidth: function() { return 0.5; },
      hLineColor: function() { return '#aaaaaa'; },
      vLineColor: function() { return '#aaaaaa'; },
      paddingLeft: function() { return 6; },
      paddingRight: function() { return 6; },
      paddingTop: function() { return 4; },
      paddingBottom: function() { return 3; }
    },
    margin: [0, 0, 0, 3]
  };
  if (!breakable) box.unbreakable = true;
  return box;
}

function pdfTwoBox(leftContent, rightContent) {
  const left = Array.isArray(leftContent) ? leftContent : [leftContent];
  const right = Array.isArray(rightContent) ? rightContent : [rightContent];
  return {
    table: {
      widths: ['*', '*'],
      body: [[{ stack: left }, { stack: right }]]
    },
    layout: {
      hLineWidth: function() { return 0.5; },
      vLineWidth: function() { return 0.5; },
      hLineColor: function() { return '#aaaaaa'; },
      vLineColor: function() { return '#aaaaaa'; },
      paddingLeft: function() { return 6; },
      paddingRight: function() { return 6; },
      paddingTop: function() { return 4; },
      paddingBottom: function() { return 3; }
    },
    unbreakable: true,
    margin: [0, 0, 0, 3]
  };
}

function pdfCreateTableBody(wiersze, rodzaj) {
  const header = ['#', 'Opis / GTU', 'Indeks', 'GTIN', 'Ilość', 'JM', 'Cena', 'Netto', 'VAT%', 'VAT', 'Brutto'];
  const body = [header.map(h => ({ text: h, style: 'tableHeader' }))];

  if (rodzaj.startsWith("KOR")) {
    const grouped = groupCorrectionRows(wiersze);
    for (const item of grouped) {
      if (item.type === 'pair') {
        body.push(pdfRowArray(item.before, true));
        body.push(pdfRowArray(item.after, false));

        const diffNet = item.after.kwotaNetto - item.before.kwotaNetto;
        const diffVat = item.after.kwotaVat - item.before.kwotaVat;
        const diffGross = item.after.kwotaBrutto - item.before.kwotaBrutto;
        const diffQty = (parseFloat(item.after.ilosc) || 0) - (parseFloat(item.before.ilosc) || 0);
        const diffPrice = (parseFloat(item.after.cenaNetto) || 0) - (parseFloat(item.before.cenaNetto) || 0);

        if (diffNet !== 0 || diffQty !== 0 || diffPrice !== 0) {
          body.push([
            { text: '', alignment: 'center' },
            { text: 'RÓŻNICA', colSpan: 2 }, { text: '' },
            { text: '', alignment: 'center' },
            { text: diffQty !== 0 ? fmtQty(diffQty) : '', alignment: 'right' },
            { text: '—', alignment: 'center' },
            { text: diffPrice !== 0 ? formatPrice(diffPrice, true) : '', alignment: 'right' },
            { text: diffNet !== 0 ? formatPrice(diffNet, true) : '', alignment: 'right' },
            { text: item.before.stawkaVatDisplay, alignment: 'center' },
            { text: diffVat !== 0 ? formatPrice(diffVat, true) : '', alignment: 'right' },
            { text: diffGross !== 0 ? formatPrice(diffGross, true) : '', alignment: 'right' }
          ]);
        }
      } else {
        body.push(pdfRowArray(item.row, item.isBefore));
      }
    }
  } else {
    for (let w of wiersze) body.push(pdfRowArray(w, false));
  }
  return body;
}

function pdfRowArray(w, isBefore) {
  // Opis z dodatkami
  let opisFragmenty = [{ text: w.opis || '', fontSize: 8 }];
  let dodatki = [];

  if (w.gtu) dodatki.push(w.gtuDisplay);
  if (w.procedura) dodatki.push(w.proceduraDisplay);
  if (w.pkwiu) dodatki.push(`PKWiU: ${w.pkwiu}`);
  if (w.cn) dodatki.push(`CN: ${w.cn}`);
  if (w.pkob) dodatki.push(`PKOB: ${w.pkob}`);
  if (w.kwotaAkcyzy && w.kwotaAkcyzy !== "0") dodatki.push(`Akcyza: ${formatPrice(w.kwotaAkcyzy, true)}`);
  if (w.stawkaOSS) dodatki.push(`OSS: ${w.stawkaOSS}%`);
  if (w.opusty && w.opusty !== "0") dodatki.push(`Opust: ${formatPrice(w.opusty. true)}`);
  if (w.dataPozycji) dodatki.push(`Data: ${w.dataPozycji}`);
  if (w.kursWaluty && w.kursWaluty !== "0") dodatki.push(`Kurs: ${w.kursWaluty}`);
  if (w.zal15) dodatki.push(`Zał.15`);
  if (isValidUUID(w.uuid)) dodatki.push(`UUID: ${w.uuid.substring(0,8)}`);

  if (dodatki.length > 0) {
    opisFragmenty.push({ text: ' (' + dodatki.join(' | ') + ')', fontSize: 6, color: '#666666' });
  }

  if (isBefore) {
    opisFragmenty.push({ text: ' (przed korektą)', fontSize: 6, color: '#555555', italics: true });
  }

  // LOGIKA DLA CENY - używamy formatPrice z parametrem true dla PDF!
  let cenaText;
  const nettoZerowe = w.cenaNetto === 0 || Math.abs(w.cenaNetto) < 0.01;

  if (w.cenaBrutto && w.cenaBrutto !== "0" && nettoZerowe) {
    // Faktura w cenach brutto (netto nieznane) - pokaż tylko cenę brutto z adnotacją
    cenaText = `${formatPrice(w.cenaBrutto, true)} (brutto)`;
  } else {
    // Wszystkie inne przypadki - pokazujemy tylko cenę netto
    cenaText = formatPrice(w.cenaNetto, true);
  }

  // Dla procedury marży - pokazujemy "—" zamiast 0
  let nettoText, vatText;

  if (w.czyMarza) {
    nettoText = { text: '—', alignment: 'right', fontSize: 8, color: '#666666' };
    vatText = { text: '—', alignment: 'right', fontSize: 8, color: '#666666' };
  } else {
    nettoText = { text: formatPrice(w.kwotaNetto, true), alignment: 'right', preserveWhiteSpace: true };
    vatText = { text: formatPrice(w.kwotaVat, true), alignment: 'right', preserveWhiteSpace: true };
  }

  return [
    { text: w.nrWiersza || '', alignment: 'center' },
    { text: opisFragmenty },
    { text: w.indeks || '—' },
    { text: w.gtin || '—' },
    { text: fmtQty(w.ilosc), alignment: 'right' },
    { text: w.jednostka || '', alignment: 'center' },
    { text: cenaText, alignment: 'right', preserveWhiteSpace: true },  // tu już mamy poprawnie sformatowaną cenę
    nettoText,
    { text: w.stawkaVatDisplay, alignment: 'center' },
    vatText,
    { text: formatPrice(w.kwotaBrutto, true), alignment: 'right', preserveWhiteSpace: true }
  ];
}

function pdfVatSummary(faData) {
  const v = faData.vatSummary;

  let tn = 0;
  let tv = 0;

  const body = [
    [{ text: 'Kategoria', style: 'tableHeader' }, { text: 'Netto', style: 'tableHeader', alignment: 'right' }, { text: 'VAT', style: 'tableHeader', alignment: 'right' }, { text: 'Brutto', style: 'tableHeader', alignment: 'right' }]
  ];

  const fields = [
    { n: v.p13_1, v: v.p14_1, l: "23% / 22%" },
    { n: v.p13_2, v: v.p14_2, l: "8% / 7%" },
    { n: v.p13_3, v: v.p14_3, l: "5%" },
    { n: v.p13_4, v: v.p14_4, l: "ryczałt taxi" },
    { n: v.p13_5, v: v.p14_5, l: "OSS" },
    { n: v.p13_6_1, l: "0% (kraj)" },
    { n: v.p13_6_2, l: "0% (WDT)" },
    { n: v.p13_6_3, l: "0% (eksport)" },
    { n: v.p13_7, l: "zwolnione" },
    { n: v.p13_8, l: "niepodlegające" },
    { n: v.p13_9, l: "art. 100" },
    { n: v.p13_10, l: "odwrotne obciążenie" },
    { n: v.p13_11, l: "marża" }
  ];

  fields.forEach(f => {
    // Proste parsowanie - po prostu konwertuj na liczbę
    const n = parseFloat(f.n) || 0;
    const vatVal = parseFloat(f.v) || 0;

    if (n !== 0 || vatVal !== 0) {
      body.push([
        f.l,
        { text: formatPrice(n, true), alignment: 'right', preserveWhiteSpace: true },
        { text: formatPrice(vatVal, true), alignment: 'right', preserveWhiteSpace: true },
        { text: formatPrice(n + vatVal, true), alignment: 'right', preserveWhiteSpace: true }
      ]);

	  tn += n;
      tv += vatVal
    }
  });

  const p15 = parseFloat(v.p15) || 0;
  body.push([
    { text: 'RAZEM', bold: true },
    { text: formatPrice(tn, true), alignment: 'right', bold: true, preserveWhiteSpace: true },
    { text: formatPrice(tv, true), alignment: 'right', bold: true, preserveWhiteSpace: true },
    { text: formatPrice(p15, true), alignment: 'right', bold: true, preserveWhiteSpace: true }
  ]);

  return {
    table: {
      widths: ['auto', 'auto', 'auto', 'auto'],
      body: body
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0.3,
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 0.5 : 0.3,
      hLineColor: () => '#aaaaaa',
      vLineColor: () => '#aaaaaa',
      paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 2, paddingBottom: () => 2
    },
    alignment: 'right'
  };
}

function pdfRenderZamowienie(zamowienieData) {
  if (!zamowienieData || !zamowienieData.wiersze || zamowienieData.wiersze.length === 0) return null;

  let content = [pdfSectionHeader('ZAMÓWIENIE / UMOWA')];

  if (zamowienieData.wartoscZamowienia) {
    content.push({ text: `Wartość zamówienia: ${formatPrice(zamowienieData.wartoscZamowienia, true)}`, margin: [0, 0, 0, 5] });
  }

  const tableBody = [
    ['Lp.', 'Opis', 'Indeks', 'Ilość', 'JM', 'Cena', 'Netto', 'VAT%', 'Numer umowy/UUID']  // DODANA KOLUMNA
  ];

  for (let w of zamowienieData.wiersze) {
    let opis = w.opis || '';
    let dodatki = [];

    if (w.gtin) dodatki.push(`GTIN: ${w.gtin}`);
    if (w.pkwiu) dodatki.push(`PKWiU: ${w.pkwiu}`);
    if (w.cn) dodatki.push(`CN: ${w.cn}`);
    if (w.gtu) dodatki.push(w.gtuDisplay);
    if (w.procedura) dodatki.push(w.proceduraDisplay);

    if (dodatki.length > 0) {
      opis += ' (' + dodatki.join(' | ') + ')';
    }

    if (w.stanPrzed) {
      opis += ' (przed korektą)';
    }

    tableBody.push([
      w.nrWiersza || '',
      opis,
      w.indeks || '—',
      fmtQty(w.ilosc),
      w.jednostka || '',
      formatPrice(w.cenaNetto, true),
      formatPrice(w.kwotaNetto, true),
      w.stawkaVatDisplay || '',
      w.uuid
    ]);
  }

  content.push({
    table: {
      widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],  // DODANA KOLUMNA
      body: tableBody
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 5]
  });

  return { stack: content };
}


function generatePdfWithPdfMake(action = 'download') {
  if (!currentXml || !currentXmlContent) {
    showError("Najpierw wczytaj plik XML");
    return;
  }

  const pdfBtn = document.getElementById("pdfBtn");
  const originalText = pdfBtn.innerHTML;

  try {
    pdfBtn.innerHTML = "⏳ Generowanie PDF...";
    pdfBtn.disabled = true;

    const parser = new DOMParser();
    const xml = parser.parseFromString(currentXmlContent, "application/xml");
    const fakturaNode = xml.getElementsByTagNameNS(ns, "Faktura")[0];
    const faNode = fakturaNode.getElementsByTagNameNS(ns, "Fa")[0];

    // Parsowanie danych
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

    const xmlHash = calculateXmlHash(currentXmlContent);
    const unknownElements = findUnknownFakturaElements(currentXml);
    const nipSprzedawcy = p1Data?.nip;
    const ksefNumber = extractKSeFNumberFromFilename(currentFileName);
    const isValidKSeF = ksefNumber && isValidKSeFFormat(ksefNumber);

    // Definicja dokumentu
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [25, 25, 25, 25],
      defaultStyle: { font: 'Roboto', fontSize: 8 },
      header: function(currentPage, _pageCount) {
        if (currentPage === 1) return {};
        let naglowek = faData.rodzajDisplay;
        if (faData.nrFaktury) naglowek += ` · ${faData.nrFaktury}`;
        return {
          columns: [
            { text: 'KSeFeusz.pl', fontSize: 7, color: '#bdc3c7', margin: [25, 12, 0, 0] },
            { text: naglowek, alignment: 'right', margin: [0, 12, 25, 0], fontSize: 7, color: '#95a5a6' }
          ]
        };
      },
      footer: function(currentPage, pageCount) {
        return {
          columns: [
            { text: `ksefeusz.pl`, fontSize: 7, color: '#bdc3c7', margin: [25, 5, 0, 0] },
            { text: `Strona ${currentPage} z ${pageCount}`, alignment: 'right', margin: [0, 5, 25, 0], fontSize: 7, color: '#515858' }
          ]
        };
      },
      content: [],
      styles: {
        header: { fontSize: 18, bold: true, color: '#1a5276' },
        subheader: { fontSize: 9, bold: true, color: '#1a5276' },
        tableHeader: { bold: true, fontSize: 8, color: '#000000', fillColor: '#e8e8e8' }
      }
    };

    // Nagłówek - dwukolumnowy: typ+numer po lewej, daty po prawej
    docDefinition.content.push({
      table: {
        widths: ['*', 'auto'],
        body: [[
          {
            border: [false, false, false, false],
            stack: [
              { text: faData.rodzajDisplay.toUpperCase(), fontSize: 12, color: '#1a5276', bold: true, margin: [0, 0, 0, 1] },
              { text: faData.nrFaktury || '(brak numeru)', fontSize: 14, bold: true, color: '#1a5276' }
            ]
          },
          {
            border: [false, false, false, false],
            alignment: 'right',
            stack: [
              { text: `Data wystawienia: ${faData.dataWystawienia}`, fontSize: 8, color: '#2c3e50' },
              faData.dataSprzedazy ? { text: `Data sprzedaży: ${faData.dataSprzedazy}`, fontSize: 8, color: '#555' } : { text: '' },
              faData.okresSprzedazy ? { text: `Okres: ${faData.okresSprzedazy.od} – ${faData.okresSprzedazy.do}`, fontSize: 7, color: '#666' } : { text: '' },
              { text: `Waluta: ${faData.kodWaluty}`, fontSize: 7, color: '#7f8c8d' }
            ]
          }
        ]]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 1]
    });

    // Linia rozdzielająca + metadane KSeF
    docDefinition.content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 545, y2: 0, lineWidth: 0.5, lineColor: '#bdc3c7' }],
      margin: [0, 0, 0, 2]
    });
    let metaItems = [];
    if (isValidKSeF) metaItems.push(`KSeF: ${ksefNumber}`);
    else metaItems.push('brak numeru KSeF w nazwie pliku');
    if (naglowekData?.systemInfo) metaItems.push(`System: ${naglowekData.systemInfo}`);
    if (naglowekData?.dataWytworzenia) metaItems.push(`Wytworzono: ${naglowekData.dataWytworzenia.replace('T', ' ').replace(/([+-]\d{2}:\d{2})$/, ' $1').replace(/Z$/, '')}`);
    docDefinition.content.push({ text: metaItems.join('  ·  '), fontSize: 7, color: '#95a5a6', margin: [0, 0, 0, 5] });

    // Sprzedawca i nabywca
    docDefinition.content.push(pdfTwoBox(
      pdfRenderPodmiot(p1Data, 'SPRZEDAWCA'),
      p2kData ? pdfRenderPodmiotZKorekta(p2Data, p2kData) : pdfRenderPodmiot(p2Data, 'NABYWCA')
    ));

    // Podmiot upoważniony
    if (puData) {
      const puContent = pdfRenderPodmiotUpowazniony(puData);
      if (puContent) docDefinition.content.push(pdfBox(puContent));
    }

    // Podmioty trzecie - parami obok siebie
    const p3Contents = p3DataArray.map(d => pdfRenderPodmiot3(d)).filter(c => c);
    for (let i = 0; i < p3Contents.length; i += 2) {
      if (p3Contents[i + 1]) {
        docDefinition.content.push(pdfTwoBox(p3Contents[i], p3Contents[i + 1]));
      } else {
        docDefinition.content.push(pdfTwoBox(p3Contents[i], []));
      }
    }

    // Dane faktury i płatność
    let daneFakturyContent = [
      { text: `Numer: ${faData.nrFaktury}`, margin: [0, 0, 0, 1] },
      { text: `Data wystawienia: ${faData.dataWystawienia}${faData.miejsceWystawienia ? ', ' + faData.miejsceWystawienia : ''}`, margin: [0, 0, 0, 1] }
    ];
    if (faData.dataSprzedazy) daneFakturyContent.push({ text: `Data sprzedaży: ${faData.dataSprzedazy}`, margin: [0, 0, 0, 1] });
    if (faData.okresSprzedazy) daneFakturyContent.push({ text: `Okres: ${faData.okresSprzedazy.od} - ${faData.okresSprzedazy.do}`, margin: [0, 0, 0, 1] });

    // Korekty
    if (faData.rodzaj.startsWith("KOR") && faData.daneKorygowane.length > 0) {
  let fakturyList = faData.daneKorygowane.map(dk => {
    let opis = `${dk.nr} z ${dk.data}`;
    if (dk.nrKSeF) {
      opis += ` KSeF: ${dk.nrKSeF}`;
    } else if (dk.pozaKSeF) {
      opis += ` (poza KSeF)`;
    }
    return { text: opis, margin: [0, 0, 0, 1], fontSize: 7 };
  });

  daneFakturyContent.push({ text: 'Korygowane faktury:', margin: [0, 0, 0, 1], bold: true });
  daneFakturyContent.push(...fakturyList);

  if (faData.typKorekty) {
    daneFakturyContent.push({ text: `Typ korekty: ${faData.typKorektyDisplay}`, margin: [0, 0, 0, 1], fontSize: 8 });
  }
}
    if (faData.przyczynaKorekty) daneFakturyContent.push({ text: `Przyczyna korekty: ${faData.przyczynaKorekty}`, margin: [0, 0, 0, 1] });

    docDefinition.content.push(pdfTwoBox(
      [pdfSectionHeader('DANE FAKTURY'), ...daneFakturyContent],
      [pdfSectionHeader('PŁATNOŚĆ'), pdfRenderPaymentInfo(platnoscData)]
    ));

    // Tabela z wierszami
    const tableBody = pdfCreateTableBody(wierszeArray, faData.rodzaj);
    docDefinition.content.push({
      table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'], body: tableBody },
      layout: {
        fillColor: function(rowIndex, node, _columnIndex) {
          if (rowIndex === 0) return '#e8e8e8';
          if (node.table.body[rowIndex] && node.table.body[rowIndex][1] && node.table.body[rowIndex][1].text === 'RÓŻNICA') return '#f5f5f5';
          return (rowIndex % 2 === 0) ? '#fafafa' : null;
        },
        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0.3,
        vLineWidth: () => 0.3,
        hLineColor: () => '#aaaaaa',
        vLineColor: () => '#aaaaaa',
        paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3
      },
      margin: [0, 5, 0, 5]
    });

    // Podsumowanie VAT - wyrównane do prawej
    docDefinition.content.push({
      columns: [
        { width: '*', text: '' },
        { width: 'auto', stack: [pdfVatSummary(faData)] }
      ],
      margin: [0, 0, 0, 5]
    });

    // Rozliczenie
    if (rozliczenieData) docDefinition.content.push(pdfBox(pdfRenderRozliczenie(rozliczenieData)));

    // Dodatkowe informacje (może być dzielona na strony)
    if (p1Data || faData.dodatkoweOpisy.length > 0) docDefinition.content.push(pdfBox(pdfRenderDodatkoweInformacje(faData, p1Data), true));

    // Zaliczki częściowe
    const zaliczkiContent = pdfRenderZaliczkaCzesciowa(faData.zaliczkiCzesciowe);
    if (zaliczkiContent) docDefinition.content.push(pdfBox(zaliczkiContent));

    // Dane sprzedawcy przed korektą
    const p1kContent = pdfRenderPodmiot1K(faData.podmiot1K);
    if (p1kContent) docDefinition.content.push(pdfBox(p1kContent));

    // Rozszerzone dane nabywców przed korektą
    const p2kFullContent = pdfRenderPodmiot2KFull(faData.podmiot2KFull);
    if (p2kFullContent) docDefinition.content.push(pdfBox(p2kFullContent));

    // Warunki transakcji
    if (warunkiData) docDefinition.content.push(pdfBox(pdfRenderWarunkiTransakcji(warunkiData)));

    // Adnotacje
    if (adnotacjeData) docDefinition.content.push(pdfBox(pdfRenderAdnotacje(adnotacjeData)));

    // Nowe środki transportu
    if (adnotacjeData?.noweSrodkiTransportu) docDefinition.content.push(pdfBox(pdfRenderNoweSrodki(adnotacjeData)));

    // Faktury zaliczkowe
    if (faData.fakturyZaliczkowe.length > 0) docDefinition.content.push(pdfBox(pdfRenderFakturyZaliczkowe(faData)));

    const zamowienieData = parseZamowienie(faNode.getElementsByTagNameNS(ns, "Zamowienie")[0]);
    if (zamowienieData) {
      const zamowienieContent = pdfRenderZamowienie(zamowienieData);
      if (zamowienieContent) docDefinition.content.push(pdfBox(zamowienieContent));
    }

    // Załącznik
    if (zalacznikData) docDefinition.content.push(pdfBox(pdfRenderZalacznik(zalacznikData)));

    // Stopka
    if (stopkaData) docDefinition.content.push(pdfBox(pdfRenderFooter(stopkaData)));


// QR kod
if (unknownElements.length > 0) {
  const unknownNames = unknownElements.map(el => `<${el.prefix ? el.prefix + ':' : ''}${el.localName}>`).join(', ');
  docDefinition.content.push(pdfBox([
    pdfSectionHeader('WERYFIKACJA FAKTURY W KSEF', 0),
    { text: 'Weryfikacja niemożliwa — plik zawiera elementy spoza schematu FA(3).', fontSize: 8, color: '#c0392b', margin: [0, 0, 0, 3] },
    { text: `Nieznane elementy: ${unknownNames}`, fontSize: 7.5, color: '#555555' }
  ]));
} else if (nipSprzedawcy && faData.dataWystawienia) {
  const qrUrl = generateVerificationUrl(nipSprzedawcy, faData.dataWystawienia, xmlHash);
  docDefinition.content.push(pdfBox([
    pdfSectionHeader('WERYFIKACJA FAKTURY W KSEF', 0),
    {
      columns: [
        {
          width: 'auto',
          stack: [{ qr: qrUrl, fit: 110, margin: [0, 0, 12, 0] }]
        },
        {
          width: '*',
          stack: [
            { text: 'Zeskanuj kod QR lub kliknij link, aby zweryfikować fakturę w systemie KSeF Ministerstwa Finansów.', fontSize: 8, margin: [0, 0, 0, 5] },
            { text: 'Hash dokumentu:', fontSize: 7, color: '#888888', margin: [0, 0, 0, 1] },
            { text: xmlHash, fontSize: 6.5, font: 'Roboto', margin: [0, 0, 0, 4] },
            { text: 'Link weryfikacyjny:', fontSize: 7, color: '#888888', margin: [0, 0, 0, 1] },
            { text: qrUrl, fontSize: 6.5, decoration: 'underline', color: '#3498db', link: qrUrl, margin: [0, 0, 0, 0] }
          ]
        }
      ]
    }
  ]));
}

    // Stopka autora
    docDefinition.content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 545, y2: 0, lineWidth: 0.5, lineColor: '#ecf0f1' }],
      margin: [0, 8, 0, 4]
    });
    docDefinition.content.push({
      text: `Wygenerowano przez KSeFeusz.pl · Darmowy wizualizator faktur ustrukturyzowanych KSeF · Wersja ${APP_VERSION}`,
      fontSize: 7, color: '#5e6264', alignment: 'center', margin: [0, 0, 0, 0]
    });

    // Generowanie PDF
    const nrFakturyDoNazwy = faData.nrFaktury
      ? faData.nrFaktury.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
      : currentFileName;
    if (action === 'print') {
      pdfMake.createPdf(docDefinition).print();
      showSuccess("Wysłano do druku!");
    } else if (action === 'open') {
      pdfMake.createPdf(docDefinition).open();
    } else {
      pdfMake.createPdf(docDefinition).download(`${nrFakturyDoNazwy}.pdf`);
      showSuccess("PDF wygenerowany pomyślnie!");
    }
    setTimeout(() => document.getElementById("errorMessage").style.display = "none", 3000);

  } catch (error) {
    console.error('Błąd generowania PDF:', error);
    showError('❌ Nie udało się wygenerować PDF');
  } finally {
    pdfBtn.innerHTML = originalText;
    pdfBtn.disabled = false;
  }
}

// ============================================================================
// WIDOK UPROSZCZONY / PEŁNY
// ============================================================================
function toggleViewMode(showFull) {
  document.querySelectorAll('.invoice-container').forEach(container => {
    container.classList.toggle('simplified', !showFull);
  });
}

function toggleRowDetails(show) {
  document.getElementById('pages').classList.toggle('hide-row-details', !show);
}

// ============================================================================
// PRZYKŁADOWE FAKTURY
// ============================================================================
function loadSampleFile(url, name) {
  showLoading();
  currentFileName = name;
  fetch(url)
    .then(r => {
      if (!r.ok) throw new Error('Nie można pobrać pliku przykładowego.');
      return r.text();
    })
    .then(xmlContent => {
      if (!xmlContent.trim().startsWith('<')) throw new Error('Plik nie jest dokumentem XML.');
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlContent, "application/xml");
      if (xml.getElementsByTagName("parsererror").length > 0) throw new Error('Plik XML jest uszkodzony.');
      const rootNs = xml.documentElement.namespaceURI || '';
      if (rootNs !== ns) throw new Error('Nieobsługiwana przestrzeń nazw faktury.');
      const faktura = xml.getElementsByTagNameNS(ns, "Faktura")[0];
      if (!faktura) throw new Error('Brak elementu <Faktura> w dokumencie.');
      currentXml = xml;
      currentXmlContent = xmlContent;

      if (window.innerWidth <= 768) {
        switchTab('pdf');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('pdfUploadArea').style.display = 'none';
        document.getElementById('pdfStatus').style.display = 'none';
        document.getElementById('pdfSampleFileName').textContent = currentFileName;
        document.getElementById('pdfSampleReady').style.display = 'block';
        hideLoading();
      } else {
        switchTab('faktura');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        render(xml, currentFileName, xmlContent);
      }
    })
    .catch(err => {
      hideLoading();
      showError(err.message);
    });
}

function downloadSamplePdf() {
  generatePdfWithPdfMake('download');
  clearPdfTab();
}

// ============================================================================
// OBSŁUGA ZDARZEŃ
// ============================================================================
document.getElementById("fileInput").addEventListener("change", function() {
  showLoading();
  const f = this.files[0];
  if (!f) return;

  currentFileName = f.name.replace(/\.xml$/i, "");
  const r = new FileReader();

  r.onload = function(e) {
    try {
      const xmlContent = e.target.result;

      if (!xmlContent.trim().startsWith('<')) {
        throw new Error("Plik nie jest dokumentem XML. Upewnij się, że wczytujesz plik .xml pobrany z KSeF.");
      }

      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlContent, "application/xml");

      if (xml.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Plik XML jest uszkodzony lub niepoprawnie sformatowany.");
      }

      const rootNs = xml.documentElement.namespaceURI || '';
      const knownSchemas = {
        'http://crd.gov.pl/wzor/2023/06/29/11089/': 'FA(2)',
        'http://crd.gov.pl/wzor/2022/01/17/11089/': 'FA(1)',
      };
      if (rootNs !== ns) {
        const schemaName = knownSchemas[rootNs];
        if (schemaName) {
          throw new Error(`Plik jest fakturą ${schemaName}. KSeFeusz obsługuje tylko schemat FA(3).`);
        }
        if (xml.getElementsByTagName("Faktura")[0]) {
          throw new Error("Nieobsługiwana przestrzeń nazw faktury. Oczekiwano schematu FA(3).");
        }
        throw new Error("Plik XML nie jest fakturą KSeF. Wczytaj plik XML pobrany z systemu KSeF.");
      }

      const faktura = xml.getElementsByTagNameNS(ns, "Faktura")[0];
      if (!faktura) {
        throw new Error("Brak elementu <Faktura> w dokumencie. Plik może być niekompletny.");
      }

      currentXml = xml;
      currentXmlContent = xmlContent;

      render(xml, currentFileName, xmlContent);

    } catch (err) {
      hideLoading();
      showError(err.message);
      document.getElementById("pages").innerHTML = "";
    }
  };

  r.onerror = () => { hideLoading(); showError("Nie można odczytać pliku. Sprawdź czy plik nie jest zablokowany lub uszkodzony."); };
  r.readAsText(f);
});

document.getElementById("pdfBtn").addEventListener("click", generatePdfWithPdfMake);

document.getElementById("fileInputPdf").addEventListener("change", function() {
  const f = this.files[0];
  if (!f) return;

  const statusDiv = document.getElementById('pdfStatus');
  const statusMsg = document.getElementById('pdfStatusMsg');
  document.getElementById('pdfUploadArea').style.display = 'none';
  statusDiv.style.display = 'block';
  statusMsg.textContent = '⏳ Generowanie PDF...';

  currentFileName = f.name.replace(/\.xml$/i, "");
  const r = new FileReader();

  r.onload = function(e) {
    try {
      const xmlContent = e.target.result;

      if (!xmlContent.trim().startsWith('<')) {
        throw new Error("Plik nie jest dokumentem XML. Upewnij się, że wczytujesz plik .xml pobrany z KSeF.");
      }

      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlContent, "application/xml");

      if (xml.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Plik XML jest uszkodzony lub niepoprawnie sformatowany.");
      }

      const rootNs = xml.documentElement.namespaceURI || '';
      const knownSchemas = {
        'http://crd.gov.pl/wzor/2023/06/29/11089/': 'FA(2)',
        'http://crd.gov.pl/wzor/2022/01/17/11089/': 'FA(1)',
      };
      if (rootNs !== ns) {
        const schemaName = knownSchemas[rootNs];
        if (schemaName) throw new Error(`Plik jest fakturą ${schemaName}. KSeFeusz obsługuje tylko schemat FA(3).`);
        if (xml.getElementsByTagName("Faktura")[0]) throw new Error("Nieobsługiwana przestrzeń nazw faktury. Oczekiwano schematu FA(3).");
        throw new Error("Plik XML nie jest fakturą KSeF. Wczytaj plik XML pobrany z systemu KSeF.");
      }

      const faktura = xml.getElementsByTagNameNS(ns, "Faktura")[0];
      if (!faktura) throw new Error("Brak elementu <Faktura> w dokumencie. Plik może być niekompletny.");

      currentXml = xml;
      currentXmlContent = xmlContent;

      generatePdfWithPdfMake();

      statusMsg.textContent = '✅ PDF pobrany. Możesz wczytać kolejną fakturę.';
      setTimeout(() => clearPdfTab(), 3000);

    } catch (err) {
      showError(err.message);
      clearPdfTab();
    }
  };

  r.onerror = () => { showError("Nie można odczytać pliku. Sprawdź czy plik nie jest zablokowany lub uszkodzony."); clearPdfTab(); };
  r.readAsText(f);
});

// ============================================================================
// BATCH PDF — kolejka wielu faktur
// ============================================================================

let batchQueue = []; // { xml, xmlContent, fileName, nrFaktury, rodzajDisplay, dostawca, kwotaBrutto, kodWaluty, done }

function parseBatchFile(xmlContent, fileName) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlContent, "application/xml");

  if (xml.getElementsByTagName("parsererror").length > 0)
    throw new Error("Plik XML jest uszkodzony lub niepoprawnie sformatowany.");

  const rootNs = xml.documentElement.namespaceURI || '';
  const knownSchemas = {
    'http://crd.gov.pl/wzor/2023/06/29/11089/': 'FA(2)',
    'http://crd.gov.pl/wzor/2022/01/17/11089/': 'FA(1)',
  };
  if (rootNs !== ns) {
    const schemaName = knownSchemas[rootNs];
    if (schemaName) throw new Error(`Plik jest fakturą ${schemaName}. KSeFeusz obsługuje tylko schemat FA(3).`);
    throw new Error("Plik XML nie jest fakturą KSeF.");
  }

  const fakturaNode = xml.getElementsByTagNameNS(ns, "Faktura")[0];
  if (!fakturaNode) throw new Error("Brak elementu <Faktura> w dokumencie.");

  const faNode = fakturaNode.getElementsByTagNameNS(ns, "Fa")[0];
  const faData = parseFa(faNode);

  const podmiot1Node = fakturaNode.getElementsByTagNameNS(ns, "Podmiot1")[0];
  const podmiot1 = parsePodmiot(podmiot1Node, 'podmiot1');

  return {
    xml,
    xmlContent,
    fileName: fileName.replace(/\.xml$/i, ""),
    nrFaktury: faData.nrFaktury || "—",
    rodzajDisplay: faData.rodzajDisplay || "FAKTURA",
    dostawca: podmiot1 ? (podmiot1.nazwa || "—") : "—",
    kwotaBrutto: faData.vatSummary ? (faData.vatSummary.p15 || "—") : "—",
    kodWaluty: faData.kodWaluty || "PLN",
    done: false
  };
}

function renderBatchTable() {
  const tbody = document.getElementById('batchTableBody');
  const count = document.getElementById('batchCount');

  if (batchQueue.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="batch-empty">Brak faktur w kolejce</td></tr>';
    count.textContent = '';
    return;
  }

  const done = batchQueue.filter(e => e.done || e.printed).length;
  count.textContent = `${done} / ${batchQueue.length} gotowych`;

  tbody.innerHTML = batchQueue.map((entry, i) => `
    <tr class="${entry.done || entry.printed ? 'batch-done' : ''}">
      <td class="batch-nr">${entry.rodzajDisplay} ${entry.nrFaktury}</td>
      <td>${entry.dostawca}</td>
      <td>${formatPrice(entry.kwotaBrutto)} ${entry.kodWaluty}</td>
      <td style="white-space:nowrap;">${
        !entry.done && !entry.printed
          ? '<span class="batch-status-chip batch-status-pending">Oczekuje</span>'
          : [
              entry.done    ? '<span class="batch-status-chip batch-status-pdf"><i class="fas fa-file-pdf"></i> PDF pobrany</span>' : '',
              entry.printed ? '<span class="batch-status-chip batch-status-print"><i class="fas fa-print"></i> Wydrukowany</span>' : ''
            ].join('<br>')
      }</td>
      <td style="white-space:nowrap; display:flex; gap:6px;">
        <button type="button" class="batch-btn-pdf" onclick="generateBatchPdf(${i})">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
        <button type="button" class="batch-btn-print" onclick="printBatchPdf(${i})" title="Drukuj">
          <i class="fas fa-print"></i>
        </button>
        <button type="button" class="batch-btn-remove" onclick="removeBatchEntry(${i})" title="Usuń">
          <i class="fas fa-times"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function generateBatchPdf(index) {
  const entry = batchQueue[index];
  if (!entry) return;
  currentXml = entry.xml;
  currentXmlContent = entry.xmlContent;
  currentFileName = entry.fileName;
  generatePdfWithPdfMake('download');
  batchQueue[index].done = true;
  renderBatchTable();
}

function printBatchPdf(index) {
  const entry = batchQueue[index];
  if (!entry) return;
  currentXml = entry.xml;
  currentXmlContent = entry.xmlContent;
  currentFileName = entry.fileName;
  generatePdfWithPdfMake('print');
  batchQueue[index].printed = true;
  renderBatchTable();
}

let batchModalConfirmFn = null;

function confirmGenerateAll() {
  const pending = batchQueue.map((_e, i) => i).filter(i => !batchQueue[i].done);
  if (pending.length === 0) { showError("Wszystkie faktury mają już wygenerowane PDF."); return; }
  const msg = `Zostanie pobranych <strong>${pending.length} ${pending.length === 1 ? 'plik PDF' : pending.length < 5 ? 'pliki PDF' : 'plików PDF'}</strong>.<br>Przeglądarka może zapytać o zgodę na pobieranie wielu plików — zatwierdź, aby kontynuować.`;
  document.getElementById('batchModalMsg').innerHTML = msg;
  document.getElementById('batchModalTitle').textContent = 'Generowanie PDF';
  document.getElementById('batchModalConfirmBtn').textContent = 'Generuj';
  batchModalConfirmFn = () => {
    closeBatchModal();
    batchQueue.map((_e, i) => i).filter(i => !batchQueue[i].done).forEach((i, seq) => {
      setTimeout(() => generateBatchPdf(i), seq * 400);
    });
  };
  document.getElementById('batchModalOverlay').style.display = 'flex';
}

function confirmPrintAll() {
  const count = batchQueue.length;
  if (count === 0) { showError("Brak faktur na liście."); return; }
  const msg = `Zostanie otwartych <strong>${count} ${count === 1 ? 'okno druku' : count < 5 ? 'okna druku' : 'okien druku'}</strong>.<br>Dla każdej faktury pojawi się dialog drukowania.`;
  document.getElementById('batchModalMsg').innerHTML = msg;
  document.getElementById('batchModalTitle').textContent = 'Drukowanie faktur';
  document.getElementById('batchModalConfirmBtn').textContent = 'Drukuj';
  batchModalConfirmFn = () => {
    closeBatchModal();
    batchQueue.forEach((_, i) => {
      setTimeout(() => printBatchPdf(i), i * 600);
    });
  };
  document.getElementById('batchModalOverlay').style.display = 'flex';
}

function confirmGenerateAllYes() {
  if (batchModalConfirmFn) batchModalConfirmFn();
}

function closeBatchModal() {
  document.getElementById('batchModalOverlay').style.display = 'none';
  batchModalConfirmFn = null;
}

function removeBatchEntry(index) {
  batchQueue.splice(index, 1);
  if (batchQueue.length === 0) {
    document.getElementById('batchPanel').style.display = 'none';
    document.getElementById('batchUploadArea').style.display = 'block';
  }
  renderBatchTable();
}

function clearBatchQueue() {
  batchQueue = [];
  document.getElementById('batchPanel').style.display = 'none';
  document.getElementById('batchUploadArea').style.display = 'block';
}

document.getElementById('fileInputBatch').addEventListener('change', function() {
  const files = Array.from(this.files);
  if (!files.length) return;

  let errors = [];
  let loaded = 0;

  files.forEach(f => {
    if (!f.name.toLowerCase().endsWith('.xml')) {
      errors.push(`${f.name}: nieprawidłowy format`);
      loaded++;
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const entry = parseBatchFile(e.target.result, f.name);
        const duplicate = batchQueue.find(e => e.nrFaktury === entry.nrFaktury);
        if (duplicate) {
          errors.push(`${f.name}: faktura ${entry.nrFaktury} już jest na liście — pominięto`);
        } else {
          batchQueue.push(entry);
        }
      } catch (err) {
        errors.push(`${f.name}: ${err.message}`);
      }
      loaded++;
      if (loaded === files.length) {
        if (errors.length) showError(errors.join('\n'));
        if (batchQueue.length > 0) {
          document.getElementById('batchUploadArea').style.display = 'none';
          document.getElementById('batchPanel').style.display = 'block';
        }
        renderBatchTable();
      }
    };
    reader.onerror = function() {
      errors.push(`${f.name}: nie można odczytać pliku`);
      loaded++;
      if (loaded === files.length && errors.length) showError(errors.join('\n'));
    };

    reader.readAsText(f);
  });

  this.value = '';
});

document.querySelectorAll('.section-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    scrollToSection(this.getAttribute('data-section'));
  });
});

window.addEventListener('beforeunload', function(e) {
  const pending = batchQueue.filter(entry => !entry.done);
  if (pending.length > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

window.addEventListener('scroll', function() {
  const scrollTopBtn = document.getElementById('scrollTop');
  if (window.scrollY > 400) {
    scrollTopBtn.classList.add('visible');
  } else {
    scrollTopBtn.classList.remove('visible');
  }

  // Reset aktywnej sekcji gdy użytkownik jest blisko góry strony
  if (window.scrollY < 150) {
    const firstBtn = document.querySelector('.section-btn');
    if (firstBtn && !firstBtn.classList.contains('active')) {
      document.querySelectorAll('.section-btn').forEach(btn => btn.classList.remove('active'));
      firstBtn.classList.add('active');
    }
  }
});

const uploadArea = document.querySelector('.upload-area');
if (uploadArea) {
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#3498db'; uploadArea.style.background = '#f0f7ff'; });
  uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#cbd5e0'; uploadArea.style.background = '#f8fafc'; });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault(); uploadArea.style.borderColor = '#cbd5e0'; uploadArea.style.background = '#f8fafc';
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xml')) {
      document.getElementById('fileInput').files = e.dataTransfer.files;
      document.getElementById('fileInput').dispatchEvent(new Event('change'));
    } else {
      showError('Nieprawidłowy format pliku. Przeciągnij plik .xml pobrany z KSeF.');
    }
  });
}
