// ============================================================================
// core.js - wersja 1.5.1 (rdzeń aplikacji)
// ============================================================================

// ============================================================================
// STAŁE I KONFIGURACJA
// ============================================================================
const ns = "http://crd.gov.pl/wzor/2025/06/25/13775/";

// ============================================================================
// SŁOWNIKI (przeniesione z Twojego script.js)
// ============================================================================
const paymentMap = { "1":"Gotówka", "2":"Karta", "3":"Bon", "4":"Czek", "5":"Kredyt", "6":"Przelew", "7":"Mobilna" };
const vatRateMap = {
  "23": "23%", "22": "22%", "8": "8%", "7": "7%", "5": "5%", "4": "4%", "3": "3%",
  "0 KR": "0% (kraj)", "0 WDT": "0% (WDT)", "0 EX": "0% (eksport)",
  "zw": "zwolnione", "oo": "odwrotne obciążenie",
  "np I": "niepodlegające (poza kraj)", "np II": "niepodlegające (art. 100)"
};
const gtuMap = {
  "GTU_01": "GTU_01 Alkohol", "GTU_02": "GTU_02 Paliwa", "GTU_03": "GTU_03 Olej opałowy",
  "GTU_04": "GTU_04 Tytoń", "GTU_05": "GTU_05 Odpady", "GTU_06": "GTU_06 Urządzenia elektroniczne",
  "GTU_07": "GTU_07 Pojazdy", "GTU_08": "GTU_08 Metale szlachetne", "GTU_09": "GTU_09 Leasing",
  "GTU_10": "GTU_10 Budowlanka", "GTU_11": "GTU_11 Usługi niematerialne", "GTU_12": "GTU_12 Usługi transportowe",
  "GTU_13": "GTU_13 Usługi magazynowe"
};
const procedureMap = {
  "WSTO_EE": "WSTO_EE", "IED": "IED", "TT_D": "TT_D", "I_42": "I_42",
  "I_63": "I_63", "B_SPV": "B_SPV", "B_SPV_DOSTAWA": "B_SPV_DOSTAWA",
  "B_MPV_PROWIZJA": "B_MPV_PROWIZJA"
};
const correctionTypeMap = {
  "1": "Korekta w dacie faktury pierwotnej",
  "2": "Korekta w dacie wystawienia",
  "3": "Korekta w innej dacie"
};
const invoiceTypeMap = {
  "VAT": "FAKTURA", "KOR": "FAKTURA KORYGUJĄCA", "ZAL": "FAKTURA ZALICZKOWA",
  "ROZ": "FAKTURA ROZLICZENIOWA", "UPR": "FAKTURA UPROSZCZONA",
  "KOR_ZAL": "FAKTURA KORYGUJĄCA FAKTURĘ ZALICZKOWĄ", "KOR_ROZ": "FAKTURA KORYGUJĄCA FAKTURĘ ROZLICZENIOWĄ"
};
const roleMap = {
  "1": "Faktor", "2": "Odbiorca", "3": "Podmiot pierwotny", "4": "Dodatkowy nabywca",
  "5": "Wystawca faktury", "6": "Dokonujący płatności", "7": "JST - wystawca",
  "8": "JST - odbiorca", "9": "Członek grupy VAT - wystawca",
  "10": "Członek grupy VAT - odbiorca", "11": "Pracownik"
};
const taxpayerStatusMap = {
  "1": "W likwidacji", "2": "Postępowanie restrukturyzacyjne",
  "3": "Upadłość", "4": "Przedsiębiorstwo w spadku"
};
const marzaTypeMap = {
  "P_PMarzy_2": "biura podróży",
  "P_PMarzy_3_1": "towary używane",
  "P_PMarzy_3_2": "dzieła sztuki",
  "P_PMarzy_3_3": "kolekcjonerskie/antyki"
};

// ============================================================================
// FUNKCJE POMOCNICZE (getText, fmtPrice, fmtQty, isValidUUID)
// ============================================================================

function getText(node, tag) {
  if (!node) return "";
  const el = node.getElementsByTagNameNS(ns, tag)[0];
  if (!el) return "";
  return el.textContent.trim();
}

function formatPrice(value, forPdf = false) {
  if (value === undefined || value === null || value === "") return forPdf ? "0,00" : "0,00";
  
  // Konwersja na liczbę
  let num;
  if (typeof value === 'string') {
    num = parseFloat(value.replace(/\s/g, '').replace(',', '.'));
  } else {
    num = parseFloat(value);
  }
  
  if (isNaN(num)) return forPdf ? "0,00" : "0,00";
  
  // Zaokrąglenie do 2 miejsc
  const rounded = Math.round(num * 100) / 100;
  const fixed = rounded.toFixed(2);
  const parts = fixed.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Formatowanie z spacjami co 3 cyfry
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  if (forPdf) {
    // Dla PDF - zamień zwykłe spacje na niełamliwe Unicode (\u00A0)
    const withNbsp = formattedInteger.replace(/ /g, '\u00A0');
    return `${withNbsp},${decimalPart}`;
  } else {
    // Dla HTML - niełamliwe spacje HTML
    const formattedIntegerHtml = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '&nbsp;');
    return `${formattedIntegerHtml},${decimalPart}`;
  }
}
	

function fmtQty(v) {
  const n = parseFloat(v || 0);
  return Number.isInteger(n) ? n.toString() : n.toFixed(3);
}

function isValidUUID(uuid) {
  if (!uuid || uuid === "" || uuid === "0") return false;
  return true;
}

// ============================================================================
// PARSER: Podmiot (wersja uniwersalna)
// ============================================================================

function parsePodmiot(node, typ = 'podmiot1') {
  if (!node) return null;
  
  const daneId = node.getElementsByTagNameNS(ns, "DaneIdentyfikacyjne")[0];
  const adres = node.getElementsByTagNameNS(ns, "Adres")[0];
  const adresKoresp = node.getElementsByTagNameNS(ns, "AdresKoresp")[0];
  
  // Podstawowe dane identyfikacyjne
  const result = {
    typ: typ,
    nip: getText(daneId, "NIP"),
    nazwa: getText(daneId, "Nazwa"),
    prefiks: getText(node, "PrefiksPodatnika"),
    idWew: getText(daneId, "IDWew"),
    kodUE: getText(daneId, "KodUE"),
    nrVatUE: getText(daneId, "NrVatUE"),
    kodKrajuId: getText(daneId, "KodKraju"),
    nrID: getText(daneId, "NrID"),
    brakID: getText(daneId, "BrakID") === "1",
    
    // Adres
    adres: adres ? {
      kodKraju: getText(adres, "KodKraju"),
      linia1: getText(adres, "AdresL1"),
      linia2: getText(adres, "AdresL2"),
      gln: getText(adres, "GLN")
    } : null,
    
    adresKoresp: adresKoresp ? {
      kodKraju: getText(adresKoresp, "KodKraju"),
      linia1: getText(adresKoresp, "AdresL1"),
      linia2: getText(adresKoresp, "AdresL2"),
      gln: getText(adresKoresp, "GLN")
    } : null,
    
    // Dodatkowe pola specyficzne dla podmiotu
    nrEORI: getText(node, "NrEORI"),
    nrKlienta: getText(node, "NrKlienta"),
    idNabywcy: getText(node, "IDNabywcy"),
    status: getText(node, "StatusInfoPodatnika"),
    udzial: getText(node, "Udzial"),
    
    // Specjalne dla Podmiot2
    jst: getText(node, "JST"),
    gv: getText(node, "GV"),
    
    // Rola (dla Podmiot3)
    rola: getText(node, "Rola"),
    rolaInna: getText(node, "RolaInna") === "1",
    opisRoli: getText(node, "OpisRoli"),
    
    // Dane kontaktowe
    kontakty: Array.from(node.getElementsByTagNameNS(ns, "DaneKontaktowe")).map(kontakt => {
      const emaile = Array.from(kontakt.getElementsByTagNameNS(ns, "Email")).map(e => e.textContent.trim());
      const telefony = Array.from(kontakt.getElementsByTagNameNS(ns, "Telefon")).map(t => t.textContent.trim());
      return { emaile, telefony };
    })
  };
  
  return result;
}

// ============================================================================
// PARSER: PodmiotUpowazniony
// ============================================================================

function parsePodmiotUpowazniony(node) {
  if (!node) return null;
  
  const daneId = node.getElementsByTagNameNS(ns, "DaneIdentyfikacyjne")[0];
  const adres = node.getElementsByTagNameNS(ns, "Adres")[0];
  const adresKoresp = node.getElementsByTagNameNS(ns, "AdresKoresp")[0];
  
  return {
    nip: getText(daneId, "NIP"),
    nazwa: getText(daneId, "Nazwa"),
    nrEORI: getText(node, "NrEORI"),
    rola: getText(node, "RolaPU"),
    
    adres: adres ? {
      kodKraju: getText(adres, "KodKraju"),
      linia1: getText(adres, "AdresL1"),
      linia2: getText(adres, "AdresL2"),
      gln: getText(adres, "GLN")
    } : null,
    
    adresKoresp: adresKoresp ? {
      kodKraju: getText(adresKoresp, "KodKraju"),
      linia1: getText(adresKoresp, "AdresL1"),
      linia2: getText(adresKoresp, "AdresL2"),
      gln: getText(adresKoresp, "GLN")
    } : null,
    
    kontakty: Array.from(node.getElementsByTagNameNS(ns, "DaneKontaktowe")).map(kontakt => {
      const emaile = Array.from(kontakt.getElementsByTagNameNS(ns, "EmailPU")).map(e => e.textContent.trim());
      const telefony = Array.from(kontakt.getElementsByTagNameNS(ns, "TelefonPU")).map(t => t.textContent.trim());
      return { emaile, telefony };
    })
  };
}

// ============================================================================
// PARSER: Płatność
// ============================================================================

function parsePlatnosc(node) {
  if (!node) return null;
  
  const terminElement = node.getElementsByTagNameNS(ns, "TerminPlatnosci")[0];
  const terminOpis = terminElement ? terminElement.getElementsByTagNameNS(ns, "TerminOpis")[0] : null;
  
  // Rachunki bankowe
  const rachunki = Array.from(node.getElementsByTagNameNS(ns, "RachunekBankowy")).map(rach => ({
    nrRB: getText(rach, "NrRB"),
    swift: getText(rach, "SWIFT"),
    nazwaBanku: getText(rach, "NazwaBanku"),
    opis: getText(rach, "OpisRachunku"),
    typWlasny: getText(rach, "RachunekWlasnyBanku")
  }));
  
  const rachunkiFaktora = Array.from(node.getElementsByTagNameNS(ns, "RachunekBankowyFaktora")).map(rach => ({
    nrRB: getText(rach, "NrRB"),
    swift: getText(rach, "SWIFT"),
    nazwaBanku: getText(rach, "NazwaBanku"),
    typWlasny: getText(rach, "RachunekWlasnyBanku")
  }));
  
  // Zapłaty częściowe
  const zaplatyCzesciowe = Array.from(node.getElementsByTagNameNS(ns, "ZaplataCzesciowa")).map(z => ({
    kwota: getText(z, "KwotaZaplatyCzesciowej"),
    data: getText(z, "DataZaplatyCzesciowej"),
    forma: getText(z, "FormaPlatnosci"),
    platnoscInna: getText(z, "PlatnoscInna") === "1",
    opisPlatnosci: getText(z, "OpisPlatnosci")
  }));
  
  const skontoNode = node.getElementsByTagNameNS(ns, "Skonto")[0];
  
  return {
    zaplacono: getText(node, "Zaplacono") === "1",
    dataZaplaty: getText(node, "DataZaplaty"),
    znacznikZaplatyCzesciowej: getText(node, "ZnacznikZaplatyCzesciowej"),
    zaplatyCzesciowe: zaplatyCzesciowe,
    
    terminData: terminElement ? getText(terminElement, "Termin") : null,
    terminOpis: terminOpis ? {
      ilosc: getText(terminOpis, "Ilosc"),
      jednostka: getText(terminOpis, "Jednostka"),
      zdarzenie: getText(terminOpis, "ZdarzeniePoczatkowe")
    } : null,
    
    formaPlatnosci: getText(node, "FormaPlatnosci"),
    platnoscInna: getText(node, "PlatnoscInna") === "1",
    opisPlatnosci: getText(node, "OpisPlatnosci"),
    
    rachunki: rachunki,
    rachunkiFaktora: rachunkiFaktora,
    
    skonto: skontoNode ? {
      warunki: getText(skontoNode, "WarunkiSkonta"),
      wysokosc: getText(skontoNode, "WysokoscSkonta")
    } : null,
    
    linkDoPlatnosci: getText(node, "LinkDoPlatnosci"),
    ipksef: getText(node, "IPKSeF")
  };
}

// ============================================================================
// PARSER: Wiersz faktury (FaWiersz)
// ============================================================================

function parseFaWiersz(node, czyFakturaMarza = false) {
  if (!node) return null;
  
  const safeParse = (val) => {
    if (!val) return 0;
    const cleaned = String(val).replace(/,/g, '.').replace(/\s/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };
  
  const net = safeParse(getText(node, "P_11"));
  const rate = getText(node, "P_12");
  const rateNum = parseFloat(rate) || 0;
  const vatFromXml = safeParse(getText(node, "P_11Vat"));
  const grossFromXml = safeParse(getText(node, "P_11A"));
  
  const cenaNetto = safeParse(getText(node, "P_9A"));
  const cenaBrutto = safeParse(getText(node, "P_9B"));
  const ilosc = safeParse(getText(node, "P_8B"));
  
  let kwotaNetto, kwotaBrutto, kwotaVat;
  let stawkaVatDisplay = vatRateMap[rate] || (rate ? rate + "%" : "—");
  
  // Sprawdź czy to procedura marży (brak stawki VAT)
  const czyMarza = !rate && grossFromXml > 0 && cenaBrutto > 0;
  
  if (czyMarza) {
    // Procedura marży - pokazujemy tylko brutto
    kwotaNetto = 0;
    kwotaBrutto = grossFromXml;
    kwotaVat = 0;
    stawkaVatDisplay = "marża";
  }
  // Sprawdź czy mamy wartości brutto, a brakuje netto (faktura w cenach brutto)
  else if (grossFromXml > 0 && net === 0 && rateNum > 0) {
    kwotaBrutto = grossFromXml;
    kwotaNetto = kwotaBrutto / (1 + rateNum / 100);
    kwotaVat = kwotaBrutto - kwotaNetto;
    
    kwotaNetto = Math.round(kwotaNetto * 100) / 100;
    kwotaVat = Math.round(kwotaVat * 100) / 100;
  } 
  // Sprawdź czy mamy cenę brutto, a brakuje ceny netto
  else if (cenaBrutto > 0 && cenaNetto === 0 && rateNum > 0) {
    if (grossFromXml > 0) {
      kwotaBrutto = grossFromXml;
      kwotaNetto = kwotaBrutto / (1 + rateNum / 100);
      kwotaVat = kwotaBrutto - kwotaNetto;
    } else {
      kwotaBrutto = cenaBrutto * ilosc;
      kwotaNetto = kwotaBrutto / (1 + rateNum / 100);
      kwotaVat = kwotaBrutto - kwotaNetto;
    }
    
    kwotaNetto = Math.round(kwotaNetto * 100) / 100;
    kwotaVat = Math.round(kwotaVat * 100) / 100;
  } 
  // Standardowy przypadek
  else {
    kwotaNetto = net;
    kwotaBrutto = grossFromXml;
    kwotaVat = vatFromXml;
    
    if (kwotaVat === 0 && kwotaNetto !== 0 && rateNum > 0) {
      kwotaVat = kwotaNetto * (rateNum / 100);
      kwotaVat = Math.round(kwotaVat * 100) / 100;
    }

    if (kwotaBrutto === 0 && kwotaNetto !== 0) {
      if (kwotaVat !== 0) {
        kwotaBrutto = kwotaNetto + kwotaVat;
      } else if (rateNum > 0) {
        kwotaVat = kwotaNetto * (rateNum / 100);
        kwotaVat = Math.round(kwotaVat * 100) / 100;
        kwotaBrutto = kwotaNetto + kwotaVat;
      } else {
        kwotaBrutto = kwotaNetto;
      }
    }
  }
  
  // Dla stawek zwolnionych
  if (rate === 'zw' || rate === 'oo') {
    if (grossFromXml > 0 && kwotaNetto === 0) {
      kwotaNetto = grossFromXml;
      kwotaVat = 0;
    }
  }
  
  const znaczniki = [];
  const gtu = getText(node, "GTU");
  if (gtu) znaczniki.push(gtu);
  const procedura = getText(node, "Procedura");
  if (procedura) znaczniki.push(procedura);
  const zal15 = getText(node, "P_12_Zal_15");
  if (zal15 === "1") znaczniki.push("Zał.15");
  
  return {
    nrWiersza: getText(node, "NrWierszaFa"),
    uuid: getText(node, "UU_ID"),
    stanPrzed: getText(node, "StanPrzed") === "1",
    
    opis: getText(node, "P_7"),
    indeks: getText(node, "Indeks"),
    gtin: getText(node, "GTIN"),
    pkwiu: getText(node, "PKWiU"),
    cn: getText(node, "CN"),
    pkob: getText(node, "PKOB"),
    
    ilosc: ilosc,
    jednostka: getText(node, "P_8A"),
    
    cenaNetto: cenaNetto,
    cenaBrutto: cenaBrutto,
    opusty: getText(node, "P_10"),
    
    kwotaNetto: kwotaNetto,
    kwotaVat: kwotaVat,
    kwotaBrutto: kwotaBrutto,
    kwotaVatZXml: vatFromXml,
    kwotaBruttoZXml: grossFromXml,
    
    stawkaVat: rate,
    stawkaVatDisplay: stawkaVatDisplay,
    stawkaOSS: getText(node, "P_12_XII"),
    
    kwotaAkcyzy: getText(node, "KwotaAkcyzy"),
    dataPozycji: getText(node, "P_6A"),
    kursWaluty: getText(node, "KursWaluty"),
    
    gtu: gtu,
    gtuDisplay: gtuMap[gtu] || gtu,
    procedura: procedura,
    proceduraDisplay: procedureMap[procedura] || procedura,
    zal15: zal15 === "1",
    
    znaczniki: znaczniki,
    czyMarza: czyMarza
  };
}

// ============================================================================
// PARSER: Dane faktury (Fa)
// ============================================================================

function parseFa(faNode) {
  if (!faNode) return null;
  
  const okresFaNode = faNode.getElementsByTagNameNS(ns, "OkresFa")[0];
  const daneKorygList = Array.from(faNode.getElementsByTagNameNS(ns, "DaneFaKorygowanej"));
  
  // Podsumowanie VAT - zbierz wszystkie pola
  const vatSummary = {
    p13_1: getText(faNode, "P_13_1"),
    p14_1: getText(faNode, "P_14_1"),
    p14_1w: getText(faNode, "P_14_1W"),
    p13_2: getText(faNode, "P_13_2"),
    p14_2: getText(faNode, "P_14_2"),
    p14_2w: getText(faNode, "P_14_2W"),
    p13_3: getText(faNode, "P_13_3"),
    p14_3: getText(faNode, "P_14_3"),
    p14_3w: getText(faNode, "P_14_3W"),
    p13_4: getText(faNode, "P_13_4"),
    p14_4: getText(faNode, "P_14_4"),
    p14_4w: getText(faNode, "P_14_4W"),
    p13_5: getText(faNode, "P_13_5"),
    p14_5: getText(faNode, "P_14_5"),
    p13_6_1: getText(faNode, "P_13_6_1"),
    p13_6_2: getText(faNode, "P_13_6_2"),
    p13_6_3: getText(faNode, "P_13_6_3"),
    p13_7: getText(faNode, "P_13_7"),
    p13_8: getText(faNode, "P_13_8"),
    p13_9: getText(faNode, "P_13_9"),
    p13_10: getText(faNode, "P_13_10"),
    p13_11: getText(faNode, "P_13_11"),
    p15: getText(faNode, "P_15")
  };
  
  return {
    kodWaluty: getText(faNode, "KodWaluty"),
    dataWystawienia: getText(faNode, "P_1"),
    miejsceWystawienia: getText(faNode, "P_1M"),
    nrFaktury: getText(faNode, "P_2"),
    rodzaj: getText(faNode, "RodzajFaktury"),
    rodzajDisplay: invoiceTypeMap[getText(faNode, "RodzajFaktury")] || "FAKTURA",
    
    dataSprzedazy: getText(faNode, "P_6"),
    okresSprzedazy: okresFaNode ? {
      od: getText(okresFaNode, "P_6_Od"),
      do: getText(okresFaNode, "P_6_Do")
    } : null,
    
    wz: Array.from(faNode.getElementsByTagNameNS(ns, "WZ")).map(w => w.textContent.trim()),
    
    vatSummary: vatSummary,
    
    // Korekty
    przyczynaKorekty: getText(faNode, "PrzyczynaKorekty"),
    typKorekty: getText(faNode, "TypKorekty"),
    typKorektyDisplay: correctionTypeMap[getText(faNode, "TypKorekty")] || getText(faNode, "TypKorekty"),
    daneKorygowane: daneKorygList.map(dk => ({
      data: getText(dk, "DataWystFaKorygowanej"),
      nr: getText(dk, "NrFaKorygowanej"),
      nrKSeF: getText(dk, "NrKSeFFaKorygowanej"),
      pozaKSeF: getText(dk, "NrKSeFN") === "1"
    })),
    okresFaKorygowanej: getText(faNode, "OkresFaKorygowanej"),
    nrFaKorygowany: getText(faNode, "NrFaKorygowany"),
    zaliczkiCzesciowe: parseZaliczkaCzesciowa(faNode),
	podmiot1K: faNode.getElementsByTagNameNS(ns, "Podmiot1K")[0] ? 
    parsePodmiot1K(faNode.getElementsByTagNameNS(ns, "Podmiot1K")[0]) : null,
	
	  // Rozszerzone dane korekty (już masz daneKorygowane, ale dodajemy pełne)
	podmiot2KFull: Array.from(faNode.getElementsByTagNameNS(ns, "Podmiot2K")).map(p2kNode => {
    const daneId = p2kNode.getElementsByTagNameNS(ns, "DaneIdentyfikacyjne")[0];
    const adres = p2kNode.getElementsByTagNameNS(ns, "Adres")[0];
		return {
		  nip: getText(daneId, "NIP"),
		  nazwa: getText(daneId, "Nazwa"),
		  kodUE: getText(daneId, "KodUE"),
		  nrVatUE: getText(daneId, "NrVatUE"),
		  kodKrajuId: getText(daneId, "KodKraju"),
		  nrID: getText(daneId, "NrID"),
		  brakID: getText(daneId, "BrakID") === "1",
		  idNabywcy: getText(p2kNode, "IDNabywcy"),
		  adres: adres ? {
			kodKraju: getText(adres, "KodKraju"),
			linia1: getText(adres, "AdresL1"),
			linia2: getText(adres, "AdresL2"),
			gln: getText(adres, "GLN")
		  } : null
		};
	}),
	
    // Dodatkowe znaczniki
    fp: getText(faNode, "FP") === "1",
    tp: getText(faNode, "TP") === "1",
    zwrotAkcyzy: getText(faNode, "ZwrotAkcyzy") === "1",
    
    kursWalutyZ: getText(faNode, "KursWalutyZ"),
    p15zk: getText(faNode, "P_15ZK"),
    kursWalutyZK: getText(faNode, "KursWalutyZK"),
    
    // Faktury zaliczkowe
    fakturyZaliczkowe: Array.from(faNode.getElementsByTagNameNS(ns, "FakturaZaliczkowa")).map(fz => ({
      nrKSeF: getText(fz, "NrKSeFFaZaliczkowej"),
      nrPoza: getText(fz, "NrFaZaliczkowej"),
      znacznik: getText(fz, "NrKSeFZN") === "1"
    })),
    
    // Dodatkowe opisy
    dodatkoweOpisy: Array.from(faNode.getElementsByTagNameNS(ns, "DodatkowyOpis")).map(opis => ({
      nrWiersza: getText(opis, "NrWiersza"),
      klucz: getText(opis, "Klucz"),
      wartosc: getText(opis, "Wartosc")
    }))
  };
}

// ============================================================================
// PARSER: Adnotacje
// ============================================================================

function parseAdnotacje(node) {
  if (!node) return null;
  
  const zwolnienieNode = node.getElementsByTagNameNS(ns, "Zwolnienie")[0];
  const noweSrodkiNode = node.getElementsByTagNameNS(ns, "NoweSrodkiTransportu")[0];
  const pMarzyNode = node.getElementsByTagNameNS(ns, "PMarzy")[0];
  
  // Nowe środki transportu
  let noweSrodki = null;
  if (noweSrodkiNode && getText(noweSrodkiNode, "P_22N") === "1") {
    noweSrodki = { p22n: true, pojazdy: [] };
  } else if (noweSrodkiNode && getText(noweSrodkiNode, "P_22") === "1") {
    noweSrodki = {
      p42_5: getText(noweSrodkiNode, "P_42_5") === "1",
      pojazdy: Array.from(noweSrodkiNode.getElementsByTagNameNS(ns, "NowySrodekTransportu")).map(pojazd => ({
        dataDopuszczenia: getText(pojazd, "P_22A"),
        nrWiersza: getText(pojazd, "P_NrWierszaNST"),
        marka: getText(pojazd, "P_22BMK"),
        model: getText(pojazd, "P_22BMD"),
        kolor: getText(pojazd, "P_22BK"),
        nrRej: getText(pojazd, "P_22BNR"),
        rokProd: getText(pojazd, "P_22BRP"),
        przebieg: getText(pojazd, "P_22B"),
        vin: getText(pojazd, "P_22B1"),
        nadwozie: getText(pojazd, "P_22B2"),
        podwozie: getText(pojazd, "P_22B3"),
        rama: getText(pojazd, "P_22B4"),
        typ: getText(pojazd, "P_22BT"),
        godzinyLodz: getText(pojazd, "P_22C"),
        kadlub: getText(pojazd, "P_22C1"),
        godzinySamolot: getText(pojazd, "P_22D"),
        fabryczny: getText(pojazd, "P_22D1")
      }))
    };
  }
  
  return {
    p16: getText(node, "P_16"),
    p17: getText(node, "P_17"),
    p18: getText(node, "P_18"),
    p18a: getText(node, "P_18A"),
    p23: getText(node, "P_23"),
    
    zwolnienie: zwolnienieNode ? {
      p19: getText(zwolnienieNode, "P_19") === "1",
      p19a: getText(zwolnienieNode, "P_19A"),
      p19b: getText(zwolnienieNode, "P_19B"),
      p19c: getText(zwolnienieNode, "P_19C"),
      p19n: getText(zwolnienieNode, "P_19N") === "1"
    } : null,
    
    noweSrodkiTransportu: noweSrodki,
    
    proceduraMarzy: pMarzyNode ? {
      wystepuje: getText(pMarzyNode, "P_PMarzy") === "1",
      brak: getText(pMarzyNode, "P_PMarzyN") === "1",
      biuraPodrozy: getText(pMarzyNode, "P_PMarzy_2") === "1",
      towaryUzywane: getText(pMarzyNode, "P_PMarzy_3_1") === "1",
      dzielaSztuki: getText(pMarzyNode, "P_PMarzy_3_2") === "1",
      antyki: getText(pMarzyNode, "P_PMarzy_3_3") === "1"
    } : null
  };
}

// ============================================================================
// PARSER: Warunki transakcji
// ============================================================================

function parseWarunkiTransakcji(node) {
  if (!node) return null;
  
  // Umowy
  const umowy = Array.from(node.getElementsByTagNameNS(ns, "Umowy")).map(u => ({
    data: getText(u, "DataUmowy"),
    nr: getText(u, "NrUmowy")
  }));
  
  const zamowienia = Array.from(node.getElementsByTagNameNS(ns, "Zamowienia")).map(z => ({
    data: getText(z, "DataZamowienia"),
    nr: getText(z, "NrZamowienia")
  }));
  
  const partie = Array.from(node.getElementsByTagNameNS(ns, "NrPartiiTowaru")).map(p => p.textContent.trim());
  
  // Transport
  const transporty = Array.from(node.getElementsByTagNameNS(ns, "Transport")).map(t => {
    const przewoznikNode = t.getElementsByTagNameNS(ns, "Przewoznik")[0];
    const przewoznikDane = przewoznikNode ? przewoznikNode.getElementsByTagNameNS(ns, "DaneIdentyfikacyjne")[0] : null;
    const przewoznikAdres = przewoznikNode ? przewoznikNode.getElementsByTagNameNS(ns, "AdresPrzewoznika")[0] : null;
    
    const wysylkaZ = t.getElementsByTagNameNS(ns, "WysylkaZ")[0];
    const wysylkaDo = t.getElementsByTagNameNS(ns, "WysylkaDo")[0];
    const wysylkaPrzez = Array.from(t.getElementsByTagNameNS(ns, "WysylkaPrzez"));
    
    return {
      rodzaj: getText(t, "RodzajTransportu"),
      transportInny: getText(t, "TransportInny") === "1",
      opisInnegoTransportu: getText(t, "OpisInnegoTransportu"),
      
      przewoznik: przewoznikNode ? {
        nip: getText(przewoznikDane, "NIP"),
        nazwa: getText(przewoznikDane, "Nazwa"),
        kodUE: getText(przewoznikDane, "KodUE"),
        nrVatUE: getText(przewoznikDane, "NrVatUE"),
        kodKrajuId: getText(przewoznikDane, "KodKraju"),
        nrID: getText(przewoznikDane, "NrID"),
        brakID: getText(przewoznikDane, "BrakID") === "1",
        adres: przewoznikAdres ? {
          kodKraju: getText(przewoznikAdres, "KodKraju"),
          linia1: getText(przewoznikAdres, "AdresL1"),
          linia2: getText(przewoznikAdres, "AdresL2"),
          gln: getText(przewoznikAdres, "GLN")
        } : null
      } : null,
      
      nrZlecenia: getText(t, "NrZleceniaTransportu"),
      
      ladunek: getText(t, "OpisLadunku"),
      ladunekInny: getText(t, "LadunekInny") === "1",
      opisInnegoLadunku: getText(t, "OpisInnegoLadunku"),
      jednostkaOpakowania: getText(t, "JednostkaOpakowania"),
      
      dataRozp: getText(t, "DataGodzRozpTransportu"),
      dataZak: getText(t, "DataGodzZakTransportu"),
      
      wysylkaZ: wysylkaZ ? {
        kodKraju: getText(wysylkaZ, "KodKraju"),
        linia1: getText(wysylkaZ, "AdresL1"),
        linia2: getText(wysylkaZ, "AdresL2"),
        gln: getText(wysylkaZ, "GLN")
      } : null,
      
      wysylkaDo: wysylkaDo ? {
        kodKraju: getText(wysylkaDo, "KodKraju"),
        linia1: getText(wysylkaDo, "AdresL1"),
        linia2: getText(wysylkaDo, "AdresL2"),
        gln: getText(wysylkaDo, "GLN")
      } : null,
      
      wysylkaPrzez: wysylkaPrzez.map(wp => ({
        kodKraju: getText(wp, "KodKraju"),
        linia1: getText(wp, "AdresL1"),
        linia2: getText(wp, "AdresL2"),
        gln: getText(wp, "GLN")
      }))
    };
  });
  
  return {
    umowy: umowy,
    zamowienia: zamowienia,
    partie: partie,
    warunkiDostawy: getText(node, "WarunkiDostawy"),
    kursUmowny: getText(node, "KursUmowny"),
    walutaUmowna: getText(node, "WalutaUmowna"),
    podmiotPosredniczacy: getText(node, "PodmiotPosredniczacy") === "1",
    transporty: transporty
  };
}

// ============================================================================
// PARSER: Stopka
// ============================================================================

function parseStopka(node) {
  if (!node) return null;
  
  const informacje = Array.from(node.getElementsByTagNameNS(ns, "Informacje")).map(i => ({
    stopkaFaktury: getText(i, "StopkaFaktury")
  }));
  
  const rejestry = Array.from(node.getElementsByTagNameNS(ns, "Rejestry")).map(r => ({
    pelnaNazwa: getText(r, "PelnaNazwa"),
    krs: getText(r, "KRS"),
    regon: getText(r, "REGON"),
    bdo: getText(r, "BDO")
  }));
  
  return {
    informacje: informacje,
    rejestry: rejestry
  };
}

// ============================================================================
// PARSER: Załącznik
// ============================================================================

function parseZalacznik(node) {
  if (!node) return null;
  
  const bloki = Array.from(node.getElementsByTagNameNS(ns, "BlokDanych")).map(blok => {
    const metaDane = Array.from(blok.getElementsByTagNameNS(ns, "MetaDane")).map(m => ({
      klucz: getText(m, "ZKlucz"),
      wartosc: getText(m, "ZWartosc")
    }));
    
    const akapity = Array.from(blok.getElementsByTagNameNS(ns, "Akapit")).map(a => a.textContent.trim());
    
    const tabele = Array.from(blok.getElementsByTagNameNS(ns, "Tabela")).map(tabela => {
      const tMetaDane = Array.from(tabela.getElementsByTagNameNS(ns, "TMetaDane")).map(m => ({
        klucz: getText(m, "TKlucz"),
        wartosc: getText(m, "TWartosc")
      }));
      
      const naglowek = tabela.getElementsByTagNameNS(ns, "TNaglowek")[0];
      const kolumny = naglowek ? Array.from(naglowek.getElementsByTagNameNS(ns, "Kol")).map(k => ({
        nazwa: getText(k, "NKom"),
        typ: k.getAttribute("Typ")
      })) : [];
      
      const wiersze = Array.from(tabela.getElementsByTagNameNS(ns, "Wiersz")).map(w => 
        Array.from(w.getElementsByTagNameNS(ns, "WKom")).map(kom => kom.textContent.trim())
      );
      
      const suma = tabela.getElementsByTagNameNS(ns, "Suma")[0];
      const sumaKomorki = suma ? Array.from(suma.getElementsByTagNameNS(ns, "SKom")).map(s => s.textContent.trim()) : [];
      
      return {
        opis: getText(tabela, "Opis"),
        metaDane: tMetaDane,
        kolumny: kolumny,
        wiersze: wiersze,
        suma: sumaKomorki
      };
    });
    
    return {
      naglowek: getText(blok, "ZNaglowek"),
      metaDane: metaDane,
      akapity: akapity,
      tabele: tabele
    };
  });
  
  return {
    bloki: bloki
  };
}

// ============================================================================
// PARSER: Rozliczenie
// ============================================================================

function parseRozliczenie(node) {
  if (!node) return null;
  
  // Obciążenia
  const obciazenia = Array.from(node.getElementsByTagNameNS(ns, "Obciazenia")).map(obc => ({
    kwota: getText(obc, "Kwota"),
    powod: getText(obc, "Powod")
  }));
  
  const sumaObciazen = getText(node, "SumaObciazen");
  
  // Odliczenia
  const odliczenia = Array.from(node.getElementsByTagNameNS(ns, "Odliczenia")).map(odl => ({
    kwota: getText(odl, "Kwota"),
    powod: getText(odl, "Powod")
  }));
  
  const sumaOdliczen = getText(node, "SumaOdliczen");
  
  // Do zapłaty / Do rozliczenia
  const doZaplaty = getText(node, "DoZaplaty");
  const doRozliczenia = getText(node, "DoRozliczenia");
  
  return {
    obciazenia: obciazenia,
    sumaObciazen: sumaObciazen,
    odliczenia: odliczenia,
    sumaOdliczen: sumaOdliczen,
    doZaplaty: doZaplaty,
    doRozliczenia: doRozliczenia
  };
}

// ============================================================================
// PARSER: Zamowienie
// ============================================================================

function parseZamowienie(node) {
  if (!node) return null;
  
  const wartoscZamowienia = getText(node, "WartoscZamowienia");
  
  // Wiersze zamówienia
  const wiersze = Array.from(node.getElementsByTagNameNS(ns, "ZamowienieWiersz")).map(w => {
    // Obliczenia VAT dla zamówienia
    const netto = parseFloat(getText(w, "P_11NettoZ") || 0);
    const vatZ = getText(w, "P_11VatZ");
    const stawka = getText(w, "P_12Z");
    
    let vat;
    if (vatZ && vatZ !== "0") {
      vat = parseFloat(vatZ);
    } else {
      vat = netto * (parseFloat(stawka) || 0) / 100;
    }
    
    // Znaczniki
    const znaczniki = [];
    const gtuZ = getText(w, "GTUZ");
    if (gtuZ) znaczniki.push(gtuZ);
    const proceduraZ = getText(w, "ProceduraZ");
    if (proceduraZ) znaczniki.push(proceduraZ);
    const zal15Z = getText(w, "P_12Z_Zal_15");
    if (zal15Z === "1") znaczniki.push("Zał.15");
    
    return {
      nrWiersza: getText(w, "NrWierszaZam"),
      uuid: getText(w, "UU_IDZ"),               // DODANE
      stanPrzed: getText(w, "StanPrzedZ") === "1",
      
      opis: getText(w, "P_7Z"),
      indeks: getText(w, "IndeksZ"),
      gtin: getText(w, "GTINZ"),
      pkwiu: getText(w, "PKWiUZ"),
      cn: getText(w, "CNZ"),
      pkob: getText(w, "PKOBZ"),
      
      ilosc: getText(w, "P_8BZ"),
      jednostka: getText(w, "P_8AZ"),
      
      cenaNetto: getText(w, "P_9AZ"),
      kwotaNetto: netto,
      kwotaVat: vat,
      
      stawkaVat: stawka,
      stawkaVatDisplay: vatRateMap[stawka] || (stawka ? stawka + "%" : ""),
      stawkaOSS: getText(w, "P_12Z_XII"),
      
      kwotaAkcyzy: getText(w, "KwotaAkcyzyZ"),
      
      gtu: gtuZ,
      gtuDisplay: gtuMap[gtuZ] || gtuZ,
      procedura: proceduraZ,
      proceduraDisplay: procedureMap[proceduraZ] || proceduraZ,
      zal15: zal15Z === "1",
      
      znaczniki: znaczniki
    };
  });
  
  return {
    wartoscZamowienia: wartoscZamowienia,
    wiersze: wiersze
  };
}

// ============================================================================
// PARSER: ZaliczkaCzesciowa
// ============================================================================

function parseZaliczkaCzesciowa(node) {
  if (!node) return null;
  
  const zaplaty = Array.from(node.getElementsByTagNameNS(ns, "ZaliczkaCzesciowa")).map(z => ({
    dataOtrzymania: getText(z, "P_6Z"),
    kwota: getText(z, "P_15Z"),
    kursWaluty: getText(z, "KursWalutyZW")
  }));
  
  return {
    zaplaty: zaplaty
  };
}

// ============================================================================
// PARSER: Podmiot1K (dane sprzedawcy przed korektą)
// ============================================================================

function parsePodmiot1K(node) {
  if (!node) return null;
  
  const daneId = node.getElementsByTagNameNS(ns, "DaneIdentyfikacyjne")[0];
  const adres = node.getElementsByTagNameNS(ns, "Adres")[0];
  
  return {
    prefiks: getText(node, "PrefiksPodatnika"),
    nip: getText(daneId, "NIP"),
    nazwa: getText(daneId, "Nazwa"),
    adres: adres ? {
      kodKraju: getText(adres, "KodKraju"),
      linia1: getText(adres, "AdresL1"),
      linia2: getText(adres, "AdresL2"),
      gln: getText(adres, "GLN")
    } : null
  };
}

// ============================================================================
// EKSPORT FUNKCJI (do użycia w script.js)
// ============================================================================

// To pozwoli używać tych funkcji w głównym skrypcie
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ns, paymentMap, vatRateMap, gtuMap, procedureMap, correctionTypeMap,
    invoiceTypeMap, roleMap, taxpayerStatusMap, marzaTypeMap,
    getText, formatPrice, fmtQty, isValidUUID,
    parsePodmiot, parsePodmiotUpowazniony, parsePlatnosc,
    parseFaWiersz, parseFa, parseAdnotacje, parseWarunkiTransakcji,
    parseStopka, parseZalacznik, parseRozliczenie, parseZamowienie, 
	parseZaliczkaCzesciowa, parsePodmiot1K
  };
}