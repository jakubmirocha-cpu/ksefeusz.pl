// ============================================================================
// i18n.js - wersja 1.8.2 (tłumaczenie szablonu wizualizacji)
// ============================================================================
// Wspólne źródło prawdy dla obu torów renderowania (renderer.js = HTML,
// main.js = PDF) oraz dla słowników kodów w core.js.
//
// ZASADA: tłumaczeniu podlegają WYŁĄCZNIE statyczne elementy szablonu
// (etykiety, nagłówki sekcji, nazwy kolumn) oraz wartości wyliczane przez nas
// ze słowników kodów KSeF (forma płatności, typ faktury, stawka VAT, rola
// podmiotu). Treść merytoryczna wpisana przez wystawcę (nazwy towarów, adresy,
// przyczyna korekty, opisy, stopka) NIGDY nie jest tłumaczona — zostaje
// w języku oryginału. Formaty liczb i dat też zostają bez zmian (1 234,56 /
// 2026-01-15) — kwota to dana z XML, nie etykieta.
//
// KLUCZEM SŁOWNIKA JEST POLSKI NAPIS. Dzięki temu:
//  - brak wpisu = fallback do polskiego (nigdy pusta etykieta),
//  - kod czyta się naturalnie: t('Sprzedawca'),
//  - słowniki w core.js (paymentMap itd.) zostają polskie i tłumaczą się
//    przez t(map[kod]) — jedno miejsce, zero duplikacji.
//
// Klucze NIE zawierają dwukropka ani spacji na końcu — dodaje je kod:
//   `${t('Adres')}: ${wartosc}`
// ============================================================================

const I18N_LANGS = [
  { code: 'pl', label: 'Polski',     short: 'PL' },
  { code: 'en', label: 'English',    short: 'EN' },
  { code: 'de', label: 'Deutsch',    short: 'DE' },
  { code: 'fr', label: 'Français',   short: 'FR' },
  { code: 'uk', label: 'Українська', short: 'UA' }
];

// Aktywny język wizualizacji. Nie jest utrwalany (brak localStorage/cookies —
// zgodnie z polityką prywatności serwisu); po odświeżeniu wraca polski.
let currentLang = 'pl';

// Tłumaczy etykietę szablonu. `vars` podmienia znaczniki {nazwa}.
// Nieznany klucz / brak tłumaczenia → zwraca polski oryginał (klucz).
function t(key, vars) {
  if (key === undefined || key === null || key === '') return '';
  let out = String(key);
  if (currentLang !== 'pl') {
    const dict = I18N[currentLang];
    if (dict && dict[out] !== undefined) out = dict[out];
  }
  if (vars) {
    for (const k in vars) out = out.split('{' + k + '}').join(vars[k]);
  }
  return out;
}

// Wersja dla nagłówków pisanych wersalikami (sekcje PDF i HTML). Tłumaczymy
// napis pisany naturalnie, dopiero wynik idzie na wielkie litery — inaczej
// każdy napis musiałby siedzieć w słowniku dwa razy.
function tUpper(key) {
  return t(key).toUpperCase();
}

// Nagłówek kolumny łamany na dwie linie ("Cena netto" -> "Cena\nnetto").
// Powód jest mierniczy, nie estetyczny: pdfmake przy widths:'auto' i przeglądarka
// przy auto-layout rezerwują szerokość według najdłuższej NIEPRZERYWALNEJ
// sekwencji — bez twardego łamania kolumna "Cena po rabacie" zabierałaby dużo
// więcej miejsca niż jej realna zawartość. Łamiemy przy spacji najbliższej
// środka napisu, żeby obie linie wyszły podobnej długości w każdym języku.
// sep: '\n' dla PDF (pdfmake), '<br>' dla HTML.
function tWrap(key, sep) {
  const str = t(key);
  const mid = str.length / 2;
  let best = -1;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  if (best < 0) return str;
  return str.slice(0, best) + sep + str.slice(best + 1);
}

function setInvoiceLang(code) {
  if (!I18N_LANGS.some(l => l.code === code)) return;
  currentLang = code;
}

// Słowniki. Polski nie ma wpisu — jest kluczem (patrz komentarz na górze pliku).
const I18N = {};

// ============================================================================
// ENGLISH
// ============================================================================
I18N.en = {
  // --- nagłówek dokumentu ---
  'Wizualizacja faktury ustrukturyzowanej XML': 'Visualisation of a structured XML invoice',
  'nr': 'no.',
  'Nr KSeF': 'KSeF no.',
  'brak numeru KSeF w nazwie pliku': 'no KSeF number in the file name',
  'błędna suma kontrolna': 'invalid checksum',
  'Suma kontrolna CRC-8 jest nieprawidłowa — numer może być uszkodzony': 'The CRC-8 checksum is invalid — the number may be corrupted',
  'Nieprawidłowa suma kontrolna NIP — sprawdź czy numer jest poprawny': 'Invalid NIP checksum — verify the number',
  'Wytworzono': 'Created',
  'System': 'System',
  '(brak numeru)': '(no number)',

  // --- typy faktur (invoiceTypeMap) ---
  'FAKTURA': 'INVOICE',
  'FAKTURA KORYGUJĄCA': 'CORRECTIVE INVOICE',
  'FAKTURA ZALICZKOWA': 'ADVANCE INVOICE',
  'FAKTURA ROZLICZENIOWA': 'SETTLEMENT INVOICE',
  'FAKTURA UPROSZCZONA': 'SIMPLIFIED INVOICE',
  'FAKTURA KORYGUJĄCA FAKTURĘ ZALICZKOWĄ': 'CORRECTION TO AN ADVANCE INVOICE',
  'FAKTURA KORYGUJĄCA FAKTURĘ ROZLICZENIOWĄ': 'CORRECTION TO A SETTLEMENT INVOICE',

  // --- podmioty ---
  'Sprzedawca': 'Seller',
  'Nabywca': 'Buyer',
  'Podmiot upoważniony': 'Authorised entity',
  'Podmiot trzeci': 'Third party',
  '(inny)': '(other)',
  'Nazwa': 'Name',
  'Adres': 'Address',
  'Adres koresp.': 'Mailing address',
  'Nr klienta': 'Customer no.',
  'Nr kontrahenta': 'Counterparty no.',
  'ID nabywcy': 'Buyer ID',
  'ID wewn.': 'Internal ID',
  'VAT UE': 'EU VAT',
  'ID zagraniczny': 'Foreign ID',
  'bez identyfikatora podatkowego': 'no tax identifier',
  '(bez identyfikatora)': '(no identifier)',
  'jednostka podrzędna': 'subordinate unit',
  'członek grupy VAT': 'VAT group member',
  'nie': 'no',
  'Status': 'Status',
  'Udział': 'Share',
  'Rola': 'Role',
  'e-mail': 'e-mail',
  'tel.': 'phone',

  // --- role podmiotu upoważnionego ---
  'Organ egzekucyjny': 'Enforcement authority',
  'Komornik sądowy': 'Court bailiff',
  'Przedstawiciel podatkowy': 'Tax representative',

  // --- roleMap (Podmiot3) ---
  'Faktor': 'Factor',
  'Odbiorca': 'Recipient',
  'Podmiot pierwotny': 'Original entity',
  'Dodatkowy nabywca': 'Additional buyer',
  'Wystawca faktury': 'Invoice issuer',
  'Dokonujący płatności': 'Payer',
  'JST - wystawca': 'Local government unit - issuer',
  'JST - odbiorca': 'Local government unit - recipient',
  'Członek grupy VAT - wystawca': 'VAT group member - issuer',
  'Członek grupy VAT - odbiorca': 'VAT group member - recipient',
  'Pracownik': 'Employee',

  // --- taxpayerStatusMap ---
  'W likwidacji': 'In liquidation',
  'Postępowanie restrukturyzacyjne': 'Restructuring proceedings',
  'Upadłość': 'Bankruptcy',
  'Przedsiębiorstwo w spadku': 'Inherited enterprise',

  // --- dane faktury ---
  'Dane faktury': 'Invoice details',
  'Numer': 'Number',
  'Data wystawienia': 'Date of issue',
  'Data sprzedaży': 'Date of sale',
  'Okres': 'Period',
  'Okres sprzedaży': 'Sales period',
  'Waluta': 'Currency',
  'Korygowane faktury': 'Corrected invoices',
  'Typ korekty': 'Correction type',
  'Przyczyna korekty': 'Reason for correction',
  'z dnia': 'dated',
  '(poza KSeF)': '(outside KSeF)',
  'Przed korektą': 'Before correction',
  'Po korekcie': 'After correction',
  'Dane sprzedawcy przed korektą': 'Seller details before correction',
  'Dane nabywców przed korektą': 'Buyer details before correction',
  'Nabywca przed korektą': 'Buyer before correction',

  // --- correctionTypeMap ---
  'Korekta w dacie faktury pierwotnej': 'Correction as of the original invoice date',
  'Korekta w dacie wystawienia': 'Correction as of the issue date',
  'Korekta w innej dacie': 'Correction as of another date',

  // --- płatność ---
  'Płatność': 'Payment',
  'Forma': 'Method',
  'Inna forma': 'Other method',
  'Termin': 'Due date',
  'od': 'from',
  'Rachunek': 'Bank account',
  'Rachunek faktora': 'Factor bank account',
  'rachunek własny': 'own account',
  'rach. własny (wierzytelności)': 'own account (receivables)',
  'rach. własny (pobranie)': 'own account (collection)',
  'rach. własny (gospodarka)': 'own account (operations)',
  'Zapłacono': 'Paid',
  'Tak, dnia': 'Yes, on',
  'Zapłaty częściowe': 'Partial payments',
  '(częściowa)': '(partial)',
  '(wieloczęściowa)': '(multi-instalment)',
  'z': 'of',
  'Skonto': 'Early payment discount',
  'Link do płatności': 'Payment link',
  'płatność online': 'pay online',
  'Link': 'Link',

  // --- paymentMap ---
  'Gotówka': 'Cash',
  'Karta': 'Card',
  'Bon': 'Voucher',
  'Czek': 'Cheque',
  'Kredyt': 'Credit',
  'Przelew': 'Bank transfer',
  'Mobilna': 'Mobile payment',

  // --- tabela pozycji ---
  'Opis / GTU': 'Description / GTU',
  'Opis': 'Description',
  'Indeks': 'Item code',
  'Ilość': 'Qty',
  'JM': 'Unit',
  'Cena': 'Price',
  'Cena netto': 'Net price',
  'Cena po rabacie': 'Discounted price',
  'Wart. netto': 'Net value',
  'Wart. brutto': 'Gross value',
  'Netto': 'Net',
  'Brutto': 'Gross',
  'VAT': 'VAT',
  'VAT%': 'VAT %',
  'RÓŻNICA': 'DIFFERENCE',
  '(przed korektą)': '(before correction)',
  '(brutto)': '(gross)',
  'Akcyza': 'Excise duty',
  'Opust': 'Discount',
  'Rabat': 'Discount',
  'Narzut': 'Surcharge',
  'Data': 'Date',
  'Kurs': 'Rate',
  'Zał.15': 'Annex 15',

  // --- gtuMap ---
  'GTU_01 Alkohol': 'GTU_01 Alcohol',
  'GTU_02 Paliwa': 'GTU_02 Fuels',
  'GTU_03 Olej opałowy': 'GTU_03 Heating oil',
  'GTU_04 Tytoń': 'GTU_04 Tobacco',
  'GTU_05 Odpady': 'GTU_05 Waste',
  'GTU_06 Urządzenia elektroniczne': 'GTU_06 Electronic devices',
  'GTU_07 Pojazdy': 'GTU_07 Vehicles',
  'GTU_08 Metale szlachetne': 'GTU_08 Precious metals',
  'GTU_09 Leasing': 'GTU_09 Leasing',
  'GTU_10 Budowlanka': 'GTU_10 Construction',
  'GTU_11 Usługi niematerialne': 'GTU_11 Intangible services',
  'GTU_12 Usługi transportowe': 'GTU_12 Transport services',
  'GTU_13 Usługi magazynowe': 'GTU_13 Warehousing services',

  // --- podsumowanie VAT / stawki (vatRateMap) ---
  'Kategoria': 'Category',
  'VAT(przel.)': 'VAT (conv.)',
  'RAZEM': 'TOTAL',
  'ryczałt taxi': 'taxi lump sum',
  '0% (kraj)': '0% (domestic)',
  '0% (WDT)': '0% (intra-EU supply)',
  '0% (eksport)': '0% (export)',
  'zwolnione': 'exempt',
  'niepodlegające': 'not subject to VAT',
  'niepodlegające (poza kraj)': 'not subject to VAT (outside Poland)',
  'niepodlegające (art. 100)': 'not subject to VAT (art. 100)',
  'art. 100': 'art. 100',
  'odwrotne obciążenie': 'reverse charge',
  'marża': 'margin scheme',

  // --- walidator spójności nagłówka ---
  'Niezgodność sum w nagłówku faktury': 'Totals in the invoice header do not match',
  'Suma wartości netto i VAT z pól P_13 / P_14 nie zgadza się z zadeklarowaną kwotą brutto (P_15)': 'The sum of net and VAT amounts from fields P_13 / P_14 does not match the declared gross amount (P_15)',
  'Suma netto (P_13)': 'Net total (P_13)',
  'Suma VAT (P_14)': 'VAT total (P_14)',
  'Netto + VAT': 'Net + VAT',
  'Brutto zadeklarowane (P_15)': 'Declared gross (P_15)',
  'Rozbieżność': 'Discrepancy',
  'KSeFeusz.pl prezentuje dane wyłącznie w formie wizualizacji oryginalnego pliku XML. W razie wątpliwości zweryfikuj dane źródłowe w pliku XML lub bezpośrednio w KSeF — wizualizator nie modyfikuje wartości z faktury.': 'KSeFeusz.pl only visualises the original XML file. If in doubt, verify the source data in the XML file or directly in KSeF — the visualiser does not modify any values from the invoice.',

  // --- rozliczenie ---
  'Rozliczenie': 'Settlement',
  'Obciążenie': 'Charge',
  'Suma obciążeń': 'Total charges',
  'Odliczenie': 'Deduction',
  'Suma odliczeń': 'Total deductions',
  'Do zapłaty': 'Amount due',
  'Do rozliczenia': 'To be settled',

  // --- zaliczki ---
  'Zaliczki częściowe': 'Partial advance payments',
  'Zaliczka': 'Advance payment',
  'Data otrzymania': 'Date received',
  'Kwota': 'Amount',
  'Kurs waluty': 'Exchange rate',
  'Faktury zaliczkowe': 'Advance invoices',
  'Faktura zaliczkowa': 'Advance invoice',
  'poza KSeF': 'outside KSeF',
  '(wystawiona poza KSeF)': '(issued outside KSeF)',

  // --- warunki transakcji ---
  'Warunki transakcji': 'Transaction terms',
  'Umowy': 'Contracts',
  'Zamówienia': 'Orders',
  'Partie towaru': 'Goods batches',
  'Incoterms': 'Incoterms',
  'Kurs umowny': 'Contractual rate',
  'Transakcja łańcuchowa': 'Chain transaction',
  'Tak (podmiot pośredniczący)': 'Yes (intermediary)',
  'Transport': 'Transport',
  'Rodzaj': 'Type',
  'Przewoźnik': 'Carrier',
  'Zlecenie': 'Order no.',
  'Zlecenie transportu': 'Transport order',
  'Ładunek': 'Cargo',
  'Termin transportu': 'Transport dates',
  'od:': 'from:',
  'do:': 'to:',
  'Wysyłka z': 'Dispatch from',
  'Wysyłka do': 'Dispatch to',
  'Wysyłka przez': 'Dispatch via',

  // --- rodzaje transportu ---
  'Morski': 'Sea',
  'Kolejowy': 'Rail',
  'Drogowy': 'Road',
  'Lotniczy': 'Air',
  'Przesyłka pocztowa': 'Postal consignment',
  'Stałe instalacje przesyłowe': 'Fixed transport installations',
  'Żegluga śródlądowa': 'Inland waterway',

  // --- rodzaje ładunku ---
  'Bańka': 'Can',
  'Beczka': 'Barrel',
  'Butla': 'Cylinder',
  'Karton': 'Carton',
  'Kanister': 'Jerrycan',
  'Klatka': 'Crate',
  'Kontener': 'Container',
  'Kosz/koszyk': 'Basket',
  'Łubianka': 'Punnet',
  'Opakowanie zbiorcze': 'Bulk packaging',
  'Paczka': 'Parcel',
  'Pakiet': 'Package',
  'Paleta': 'Pallet',
  'Pojemnik': 'Bin',
  'Pojemnik do ładunków masowych stałych': 'Solid bulk container',
  'Pojemnik do ładunków masowych w postaci płynnej': 'Liquid bulk container',
  'Pudełko': 'Box',
  'Puszka': 'Tin',
  'Skrzynia': 'Chest',
  'Worek': 'Sack',

  // --- adnotacje ---
  'Adnotacje': 'Annotations',
  'Metoda kasowa': 'Cash accounting',
  'Samofakturowanie': 'Self-billing',
  'Odwrotne obciążenie': 'Reverse charge',
  'Split payment': 'Split payment',
  'Procedura uproszczona WE': 'Simplified EC procedure',
  'Proc. uproszczona WE': 'Simplified EC proc.',
  'Zwolnienie': 'Exemption',
  'Tak': 'Yes',
  'Nie': 'No',
  'Nie dotyczy': 'Not applicable',
  'brak podstawy': 'no legal basis given',
  'Procedura marży': 'Margin scheme',
  'biura podróży': 'travel agents',
  'towary używane': 'second-hand goods',
  'dzieła sztuki': 'works of art',
  'kolekcjonerskie/antyki': 'collectibles/antiques',

  // --- nowe środki transportu ---
  'Nowe środki transportu': 'New means of transport',
  'Wewnątrzwspólnotowa dostawa nowych środków transportu': 'Intra-Community supply of new means of transport',
  'Art. 42 ust. 5': 'Art. 42(5)',
  'Nowy środek transportu': 'New means of transport',
  'Data dopuszczenia': 'Date of first registration',
  'Nr wiersza': 'Line no.',
  'Dane': 'Details',
  'rocznik': 'year',
  'Przebieg': 'Mileage',
  'Numery': 'Numbers',
  'nadwozie': 'body',
  'podwozie': 'chassis',
  'rama': 'frame',
  'Typ': 'Type',
  'Godziny robocze (jednostka pływająca)': 'Operating hours (vessel)',
  'Nr kadłuba': 'Hull no.',
  'Godziny robocze (statek powietrzny)': 'Operating hours (aircraft)',
  'Nr fabryczny': 'Serial no.',

  // --- dodatkowe informacje ---
  'Dodatkowe informacje': 'Additional information',
  'Powiązania': 'Related parties',
  'Zwrot akcyzy': 'Excise duty refund',
  'Kwota przed korektą': 'Amount before correction',
  'Status sprzedawcy': 'Seller status',
  'Okres korekty': 'Correction period',
  'Informacje ogólne': 'General information',
  'Dodatkowe informacje dla wierszy': 'Additional information per line',
  'Dodatkowe informacje dla wierszy zostały ukryte.': 'Additional line information has been hidden.',
  'Tabela została podzielona na {n} części ze względu na dużą liczbę etykiet ({k}).': 'The table has been split into {n} parts due to the large number of labels ({k}).',
  'Tabela może być szeroka - w razie potrzeby przewiń w PDF.': 'The table may be wide - scroll in the PDF if needed.',

  // --- zamówienie / załączniki / stopka ---
  'Zamówienie/Umowa': 'Order / Contract',
  'Wartość zamówienia': 'Order value',
  'Lp.': 'No.',
  'Numer umowy/UUID': 'Contract number / UUID',
  'Załączniki': 'Attachments',
  'Stopka faktury': 'Invoice footer',
  'Pełna nazwa': 'Full name',

  // --- weryfikacja KSeF ---
  'Weryfikacja faktury w KSeF': 'Invoice verification in KSeF',
  'Zeskanuj kod QR lub kliknij link poniżej:': 'Scan the QR code or click the link below:',
  'Zeskanuj kod QR lub kliknij link, aby zweryfikować fakturę w systemie KSeF Ministerstwa Finansów.': 'Scan the QR code or click the link to verify the invoice in the KSeF system of the Polish Ministry of Finance.',
  'Hash dokumentu': 'Document hash',
  'Link weryfikacyjny': 'Verification link',
  'Strona weryfikacyjna Ministerstwa Finansów': 'Verification page of the Polish Ministry of Finance',
  'Weryfikacja w KSeF niemożliwa': 'KSeF verification not possible',
  'Plik zawiera elementy spoza schematu FA(3). Hash dokumentu może nie odpowiadać oryginałowi z KSeF.': 'The file contains elements outside the FA(3) schema. The document hash may not match the original in KSeF.',
  'Weryfikacja niemożliwa — plik zawiera elementy spoza schematu FA(3).': 'Verification not possible — the file contains elements outside the FA(3) schema.',
  'Nieznane elementy': 'Unknown elements',

  // --- stopki i nota o tłumaczeniu ---
  'Strona {n} z {k}': 'Page {n} of {k}',
  'KSeFeusz.pl - darmowy wizualizator faktur ustrukturyzowanych KSeF wersja {v}': 'KSeFeusz.pl - free KSeF structured invoice visualiser, version {v}',
  'Wygenerowano przez KSeFeusz.pl · Darmowy wizualizator faktur ustrukturyzowanych KSeF · Wersja {v}': 'Generated by KSeFeusz.pl · Free KSeF structured invoice visualiser · Version {v}',
  'Tłumaczeniu podlegają jedynie statyczne elementy szablonu dokumentu (etykiety). Treść merytoryczna faktury pozostaje w języku oryginalnym.': 'Only the static elements of the document template (labels) are translated. The substantive content of the invoice remains in its original language.'
};

// ============================================================================
// DEUTSCH
// ============================================================================
I18N.de = {
  // --- nagłówek dokumentu ---
  'Wizualizacja faktury ustrukturyzowanej XML': 'Visualisierung einer strukturierten XML-Rechnung',
  'nr': 'Nr.',
  'Nr KSeF': 'KSeF-Nr.',
  'brak numeru KSeF w nazwie pliku': 'keine KSeF-Nummer im Dateinamen',
  'błędna suma kontrolna': 'ungültige Prüfsumme',
  'Suma kontrolna CRC-8 jest nieprawidłowa — numer może być uszkodzony': 'Die CRC-8-Prüfsumme ist ungültig — die Nummer kann beschädigt sein',
  'Nieprawidłowa suma kontrolna NIP — sprawdź czy numer jest poprawny': 'Ungültige NIP-Prüfsumme — bitte die Nummer prüfen',
  'Wytworzono': 'Erstellt',
  'System': 'System',
  '(brak numeru)': '(keine Nummer)',

  // --- typy faktur (invoiceTypeMap) ---
  'FAKTURA': 'RECHNUNG',
  'FAKTURA KORYGUJĄCA': 'KORREKTURRECHNUNG',
  'FAKTURA ZALICZKOWA': 'ANZAHLUNGSRECHNUNG',
  'FAKTURA ROZLICZENIOWA': 'SCHLUSSRECHNUNG',
  'FAKTURA UPROSZCZONA': 'VEREINFACHTE RECHNUNG',
  'FAKTURA KORYGUJĄCA FAKTURĘ ZALICZKOWĄ': 'KORREKTUR EINER ANZAHLUNGSRECHNUNG',
  'FAKTURA KORYGUJĄCA FAKTURĘ ROZLICZENIOWĄ': 'KORREKTUR EINER SCHLUSSRECHNUNG',

  // --- podmioty ---
  'Sprzedawca': 'Verkäufer',
  'Nabywca': 'Käufer',
  'Podmiot upoważniony': 'Bevollmächtigte Stelle',
  'Podmiot trzeci': 'Dritte Partei',
  '(inny)': '(sonstige)',
  'Nazwa': 'Name',
  'Adres': 'Anschrift',
  'Adres koresp.': 'Postanschrift',
  'Nr klienta': 'Kundennr.',
  'Nr kontrahenta': 'Geschäftspartnernr.',
  'ID nabywcy': 'Käufer-ID',
  'ID wewn.': 'Interne ID',
  'VAT UE': 'USt-IdNr.',
  'ID zagraniczny': 'Ausländische ID',
  'bez identyfikatora podatkowego': 'ohne Steueridentifikationsnummer',
  '(bez identyfikatora)': '(ohne Identifikation)',
  'jednostka podrzędna': 'untergeordnete Einheit',
  'członek grupy VAT': 'Mitglied einer Organschaft',
  'nie': 'nein',
  'Status': 'Status',
  'Udział': 'Anteil',
  'Rola': 'Rolle',
  'e-mail': 'E-Mail',
  'tel.': 'Tel.',

  // --- role podmiotu upoważnionego ---
  'Organ egzekucyjny': 'Vollstreckungsbehörde',
  'Komornik sądowy': 'Gerichtsvollzieher',
  'Przedstawiciel podatkowy': 'Steuervertreter',

  // --- roleMap (Podmiot3) ---
  'Faktor': 'Factor',
  'Odbiorca': 'Empfänger',
  'Podmiot pierwotny': 'Ursprüngliche Partei',
  'Dodatkowy nabywca': 'Weiterer Käufer',
  'Wystawca faktury': 'Rechnungsaussteller',
  'Dokonujący płatności': 'Zahlender',
  'JST - wystawca': 'Gebietskörperschaft - Aussteller',
  'JST - odbiorca': 'Gebietskörperschaft - Empfänger',
  'Członek grupy VAT - wystawca': 'Organschaftsmitglied - Aussteller',
  'Członek grupy VAT - odbiorca': 'Organschaftsmitglied - Empfänger',
  'Pracownik': 'Mitarbeiter',

  // --- taxpayerStatusMap ---
  'W likwidacji': 'In Liquidation',
  'Postępowanie restrukturyzacyjne': 'Restrukturierungsverfahren',
  'Upadłość': 'Insolvenz',
  'Przedsiębiorstwo w spadku': 'Nachlassunternehmen',

  // --- dane faktury ---
  'Dane faktury': 'Rechnungsdaten',
  'Numer': 'Nummer',
  'Data wystawienia': 'Ausstellungsdatum',
  'Data sprzedaży': 'Lieferdatum',
  'Okres': 'Zeitraum',
  'Okres sprzedaży': 'Leistungszeitraum',
  'Waluta': 'Währung',
  'Korygowane faktury': 'Korrigierte Rechnungen',
  'Typ korekty': 'Korrekturart',
  'Przyczyna korekty': 'Korrekturgrund',
  'z dnia': 'vom',
  '(poza KSeF)': '(außerhalb KSeF)',
  'Przed korektą': 'Vor der Korrektur',
  'Po korekcie': 'Nach der Korrektur',
  'Dane sprzedawcy przed korektą': 'Verkäuferdaten vor der Korrektur',
  'Dane nabywców przed korektą': 'Käuferdaten vor der Korrektur',
  'Nabywca przed korektą': 'Käufer vor der Korrektur',

  // --- correctionTypeMap ---
  'Korekta w dacie faktury pierwotnej': 'Korrektur zum Datum der Originalrechnung',
  'Korekta w dacie wystawienia': 'Korrektur zum Ausstellungsdatum',
  'Korekta w innej dacie': 'Korrektur zu einem anderen Datum',

  // --- płatność ---
  'Płatność': 'Zahlung',
  'Forma': 'Zahlungsart',
  'Inna forma': 'Andere Zahlungsart',
  'Termin': 'Fälligkeit',
  'od': 'ab',
  'Rachunek': 'Bankkonto',
  'Rachunek faktora': 'Konto des Factors',
  'rachunek własny': 'eigenes Konto',
  'rach. własny (wierzytelności)': 'eigenes Konto (Forderungen)',
  'rach. własny (pobranie)': 'eigenes Konto (Einzug)',
  'rach. własny (gospodarka)': 'eigenes Konto (Betrieb)',
  'Zapłacono': 'Bezahlt',
  'Tak, dnia': 'Ja, am',
  'Zapłaty częściowe': 'Teilzahlungen',
  '(częściowa)': '(Teilzahlung)',
  '(wieloczęściowa)': '(mehrere Teilzahlungen)',
  'z': 'vom',
  'Skonto': 'Skonto',
  'Link do płatności': 'Zahlungslink',
  'płatność online': 'online bezahlen',
  'Link': 'Link',

  // --- paymentMap ---
  'Gotówka': 'Barzahlung',
  'Karta': 'Karte',
  'Bon': 'Gutschein',
  'Czek': 'Scheck',
  'Kredyt': 'Kredit',
  'Przelew': 'Überweisung',
  'Mobilna': 'Mobile Zahlung',

  // --- tabela pozycji ---
  'Opis / GTU': 'Bezeichnung / GTU',
  'Opis': 'Bezeichnung',
  'Indeks': 'Artikelnr.',
  'Ilość': 'Menge',
  'JM': 'Einheit',
  'Cena': 'Preis',
  'Cena netto': 'Nettopreis',
  'Cena po rabacie': 'Preis nach Rabatt',
  'Wart. netto': 'Nettobetrag',
  'Wart. brutto': 'Bruttobetrag',
  'Netto': 'Netto',
  'Brutto': 'Brutto',
  'VAT': 'USt',
  'VAT%': 'USt %',
  'RÓŻNICA': 'DIFFERENZ',
  '(przed korektą)': '(vor der Korrektur)',
  '(brutto)': '(brutto)',
  'Akcyza': 'Verbrauchsteuer',
  'Opust': 'Nachlass',
  'Rabat': 'Rabatt',
  'Narzut': 'Aufschlag',
  'Data': 'Datum',
  'Kurs': 'Kurs',
  'Zał.15': 'Anlage 15',

  // --- gtuMap ---
  'GTU_01 Alkohol': 'GTU_01 Alkohol',
  'GTU_02 Paliwa': 'GTU_02 Kraftstoffe',
  'GTU_03 Olej opałowy': 'GTU_03 Heizöl',
  'GTU_04 Tytoń': 'GTU_04 Tabak',
  'GTU_05 Odpady': 'GTU_05 Abfälle',
  'GTU_06 Urządzenia elektroniczne': 'GTU_06 Elektronikgeräte',
  'GTU_07 Pojazdy': 'GTU_07 Fahrzeuge',
  'GTU_08 Metale szlachetne': 'GTU_08 Edelmetalle',
  'GTU_09 Leasing': 'GTU_09 Leasing',
  'GTU_10 Budowlanka': 'GTU_10 Bauleistungen',
  'GTU_11 Usługi niematerialne': 'GTU_11 Immaterielle Leistungen',
  'GTU_12 Usługi transportowe': 'GTU_12 Transportleistungen',
  'GTU_13 Usługi magazynowe': 'GTU_13 Lagerleistungen',

  // --- podsumowanie VAT / stawki (vatRateMap) ---
  'Kategoria': 'Kategorie',
  'VAT(przel.)': 'USt (umger.)',
  'RAZEM': 'GESAMT',
  'ryczałt taxi': 'Taxi-Pauschale',
  '0% (kraj)': '0% (Inland)',
  '0% (WDT)': '0% (innergem. Lieferung)',
  '0% (eksport)': '0% (Ausfuhr)',
  'zwolnione': 'steuerfrei',
  'niepodlegające': 'nicht steuerbar',
  'niepodlegające (poza kraj)': 'nicht steuerbar (außerhalb Polens)',
  'niepodlegające (art. 100)': 'nicht steuerbar (Art. 100)',
  'art. 100': 'Art. 100',
  'odwrotne obciążenie': 'Reverse-Charge',
  'marża': 'Differenzbesteuerung',

  // --- walidator spójności nagłówka ---
  'Niezgodność sum w nagłówku faktury': 'Summen im Rechnungskopf stimmen nicht überein',
  'Suma wartości netto i VAT z pól P_13 / P_14 nie zgadza się z zadeklarowaną kwotą brutto (P_15)': 'Die Summe der Netto- und USt-Beträge aus den Feldern P_13 / P_14 stimmt nicht mit dem angegebenen Bruttobetrag (P_15) überein',
  'Suma netto (P_13)': 'Nettosumme (P_13)',
  'Suma VAT (P_14)': 'USt-Summe (P_14)',
  'Netto + VAT': 'Netto + USt',
  'Brutto zadeklarowane (P_15)': 'Angegebener Bruttobetrag (P_15)',
  'Rozbieżność': 'Abweichung',
  'KSeFeusz.pl prezentuje dane wyłącznie w formie wizualizacji oryginalnego pliku XML. W razie wątpliwości zweryfikuj dane źródłowe w pliku XML lub bezpośrednio w KSeF — wizualizator nie modyfikuje wartości z faktury.': 'KSeFeusz.pl stellt ausschließlich die Originaldaten der XML-Datei dar. Im Zweifelsfall prüfen Sie die Quelldaten in der XML-Datei oder direkt in KSeF — der Visualisierer verändert keine Werte der Rechnung.',

  // --- rozliczenie ---
  'Rozliczenie': 'Abrechnung',
  'Obciążenie': 'Belastung',
  'Suma obciążeń': 'Summe der Belastungen',
  'Odliczenie': 'Abzug',
  'Suma odliczeń': 'Summe der Abzüge',
  'Do zapłaty': 'Zahlbetrag',
  'Do rozliczenia': 'Zu verrechnen',

  // --- zaliczki ---
  'Zaliczki częściowe': 'Teilanzahlungen',
  'Zaliczka': 'Anzahlung',
  'Data otrzymania': 'Eingangsdatum',
  'Kwota': 'Betrag',
  'Kurs waluty': 'Wechselkurs',
  'Faktury zaliczkowe': 'Anzahlungsrechnungen',
  'Faktura zaliczkowa': 'Anzahlungsrechnung',
  'poza KSeF': 'außerhalb KSeF',
  '(wystawiona poza KSeF)': '(außerhalb KSeF ausgestellt)',

  // --- warunki transakcji ---
  'Warunki transakcji': 'Transaktionsbedingungen',
  'Umowy': 'Verträge',
  'Zamówienia': 'Bestellungen',
  'Partie towaru': 'Warenpartien',
  'Incoterms': 'Incoterms',
  'Kurs umowny': 'Vertraglicher Kurs',
  'Transakcja łańcuchowa': 'Reihengeschäft',
  'Tak (podmiot pośredniczący)': 'Ja (Zwischenhändler)',
  'Transport': 'Transport',
  'Rodzaj': 'Art',
  'Przewoźnik': 'Frachtführer',
  'Zlecenie': 'Auftragsnr.',
  'Zlecenie transportu': 'Transportauftrag',
  'Ładunek': 'Ladung',
  'Termin transportu': 'Transportzeitraum',
  'od:': 'von:',
  'do:': 'bis:',
  'Wysyłka z': 'Versand von',
  'Wysyłka do': 'Versand nach',
  'Wysyłka przez': 'Versand über',

  // --- rodzaje transportu ---
  'Morski': 'Seeverkehr',
  'Kolejowy': 'Schienenverkehr',
  'Drogowy': 'Straßenverkehr',
  'Lotniczy': 'Luftverkehr',
  'Przesyłka pocztowa': 'Postsendung',
  'Stałe instalacje przesyłowe': 'Feste Transportanlagen',
  'Żegluga śródlądowa': 'Binnenschifffahrt',

  // --- rodzaje ładunku ---
  'Bańka': 'Kanne',
  'Beczka': 'Fass',
  'Butla': 'Flasche',
  'Karton': 'Karton',
  'Kanister': 'Kanister',
  'Klatka': 'Gitterbox',
  'Kontener': 'Container',
  'Kosz/koszyk': 'Korb',
  'Łubianka': 'Spankorb',
  'Opakowanie zbiorcze': 'Sammelverpackung',
  'Paczka': 'Paket',
  'Pakiet': 'Bündel',
  'Paleta': 'Palette',
  'Pojemnik': 'Behälter',
  'Pojemnik do ładunków masowych stałych': 'Behälter für feste Schüttgüter',
  'Pojemnik do ładunków masowych w postaci płynnej': 'Behälter für flüssige Massengüter',
  'Pudełko': 'Schachtel',
  'Puszka': 'Dose',
  'Skrzynia': 'Kiste',
  'Worek': 'Sack',

  // --- adnotacje ---
  'Adnotacje': 'Vermerke',
  'Metoda kasowa': 'Ist-Besteuerung',
  'Samofakturowanie': 'Gutschriftverfahren',
  'Odwrotne obciążenie': 'Reverse-Charge',
  'Split payment': 'Split Payment',
  'Procedura uproszczona WE': 'Vereinfachtes EG-Verfahren',
  'Proc. uproszczona WE': 'Vereinf. EG-Verfahren',
  'Zwolnienie': 'Steuerbefreiung',
  'Tak': 'Ja',
  'Nie': 'Nein',
  'Nie dotyczy': 'Nicht zutreffend',
  'brak podstawy': 'keine Rechtsgrundlage angegeben',
  'Procedura marży': 'Differenzbesteuerung',
  'biura podróży': 'Reisebüros',
  'towary używane': 'Gebrauchtwaren',
  'dzieła sztuki': 'Kunstgegenstände',
  'kolekcjonerskie/antyki': 'Sammlerstücke/Antiquitäten',

  // --- nowe środki transportu ---
  'Nowe środki transportu': 'Neue Fahrzeuge',
  'Wewnątrzwspólnotowa dostawa nowych środków transportu': 'Innergemeinschaftliche Lieferung neuer Fahrzeuge',
  'Art. 42 ust. 5': 'Art. 42 Abs. 5',
  'Nowy środek transportu': 'Neues Fahrzeug',
  'Data dopuszczenia': 'Datum der Erstzulassung',
  'Nr wiersza': 'Positionsnr.',
  'Dane': 'Daten',
  'rocznik': 'Baujahr',
  'Przebieg': 'Laufleistung',
  'Numery': 'Nummern',
  'nadwozie': 'Karosserie',
  'podwozie': 'Fahrgestell',
  'rama': 'Rahmen',
  'Typ': 'Typ',
  'Godziny robocze (jednostka pływająca)': 'Betriebsstunden (Wasserfahrzeug)',
  'Nr kadłuba': 'Rumpfnr.',
  'Godziny robocze (statek powietrzny)': 'Betriebsstunden (Luftfahrzeug)',
  'Nr fabryczny': 'Seriennr.',

  // --- dodatkowe informacje ---
  'Dodatkowe informacje': 'Zusätzliche Angaben',
  'Powiązania': 'Verbundene Parteien',
  'Zwrot akcyzy': 'Verbrauchsteuererstattung',
  'Kwota przed korektą': 'Betrag vor der Korrektur',
  'Status sprzedawcy': 'Status des Verkäufers',
  'Okres korekty': 'Korrekturzeitraum',
  'Informacje ogólne': 'Allgemeine Angaben',
  'Dodatkowe informacje dla wierszy': 'Zusätzliche Angaben je Position',
  'Dodatkowe informacje dla wierszy zostały ukryte.': 'Zusätzliche Angaben je Position wurden ausgeblendet.',
  'Tabela została podzielona na {n} części ze względu na dużą liczbę etykiet ({k}).': 'Die Tabelle wurde wegen der großen Anzahl von Bezeichnungen ({k}) in {n} Teile aufgeteilt.',
  'Tabela może być szeroka - w razie potrzeby przewiń w PDF.': 'Die Tabelle kann breit sein - bei Bedarf im PDF scrollen.',

  // --- zamówienie / załączniki / stopka ---
  'Zamówienie/Umowa': 'Bestellung / Vertrag',
  'Wartość zamówienia': 'Bestellwert',
  'Lp.': 'Pos.',
  'Numer umowy/UUID': 'Vertragsnummer / UUID',
  'Załączniki': 'Anlagen',
  'Stopka faktury': 'Rechnungsfußzeile',
  'Pełna nazwa': 'Vollständiger Name',

  // --- weryfikacja KSeF ---
  'Weryfikacja faktury w KSeF': 'Rechnungsprüfung in KSeF',
  'Zeskanuj kod QR lub kliknij link poniżej:': 'Scannen Sie den QR-Code oder klicken Sie auf den Link unten:',
  'Zeskanuj kod QR lub kliknij link, aby zweryfikować fakturę w systemie KSeF Ministerstwa Finansów.': 'Scannen Sie den QR-Code oder klicken Sie auf den Link, um die Rechnung im KSeF-System des polnischen Finanzministeriums zu prüfen.',
  'Hash dokumentu': 'Dokument-Hash',
  'Link weryfikacyjny': 'Prüflink',
  'Strona weryfikacyjna Ministerstwa Finansów': 'Prüfseite des polnischen Finanzministeriums',
  'Weryfikacja w KSeF niemożliwa': 'Prüfung in KSeF nicht möglich',
  'Plik zawiera elementy spoza schematu FA(3). Hash dokumentu może nie odpowiadać oryginałowi z KSeF.': 'Die Datei enthält Elemente außerhalb des FA(3)-Schemas. Der Dokument-Hash entspricht möglicherweise nicht dem Original in KSeF.',
  'Weryfikacja niemożliwa — plik zawiera elementy spoza schematu FA(3).': 'Prüfung nicht möglich — die Datei enthält Elemente außerhalb des FA(3)-Schemas.',
  'Nieznane elementy': 'Unbekannte Elemente',

  // --- stopki i nota o tłumaczeniu ---
  'Strona {n} z {k}': 'Seite {n} von {k}',
  'KSeFeusz.pl - darmowy wizualizator faktur ustrukturyzowanych KSeF wersja {v}': 'KSeFeusz.pl - kostenloser Visualisierer strukturierter KSeF-Rechnungen, Version {v}',
  'Wygenerowano przez KSeFeusz.pl · Darmowy wizualizator faktur ustrukturyzowanych KSeF · Wersja {v}': 'Erstellt mit KSeFeusz.pl · Kostenloser Visualisierer strukturierter KSeF-Rechnungen · Version {v}',
  'Tłumaczeniu podlegają jedynie statyczne elementy szablonu dokumentu (etykiety). Treść merytoryczna faktury pozostaje w języku oryginalnym.': 'Übersetzt werden ausschließlich die statischen Elemente der Dokumentvorlage (Bezeichnungen). Der inhaltliche Text der Rechnung bleibt in der Originalsprache.'
};

// ============================================================================
// FRANÇAIS
// ============================================================================
// UWAGA: francuskie apostrofy zapisujemy jako U+2019 (’), nie ASCII ('),
// żeby nie zamykały literałów JS. Jest to też poprawna typografia francuska.
I18N.fr = {
  // --- nagłówek dokumentu ---
  'Wizualizacja faktury ustrukturyzowanej XML': 'Visualisation d’une facture structurée XML',
  'nr': 'n°',
  'Nr KSeF': 'N° KSeF',
  'brak numeru KSeF w nazwie pliku': 'aucun numéro KSeF dans le nom du fichier',
  'błędna suma kontrolna': 'somme de contrôle invalide',
  'Suma kontrolna CRC-8 jest nieprawidłowa — numer może być uszkodzony': 'La somme de contrôle CRC-8 est invalide — le numéro peut être corrompu',
  'Nieprawidłowa suma kontrolna NIP — sprawdź czy numer jest poprawny': 'Somme de contrôle NIP invalide — vérifiez le numéro',
  'Wytworzono': 'Généré le',
  'System': 'Système',
  '(brak numeru)': '(sans numéro)',

  // --- typy faktur (invoiceTypeMap) ---
  'FAKTURA': 'FACTURE',
  'FAKTURA KORYGUJĄCA': 'FACTURE RECTIFICATIVE',
  'FAKTURA ZALICZKOWA': 'FACTURE D’ACOMPTE',
  'FAKTURA ROZLICZENIOWA': 'FACTURE DE SOLDE',
  'FAKTURA UPROSZCZONA': 'FACTURE SIMPLIFIÉE',
  'FAKTURA KORYGUJĄCA FAKTURĘ ZALICZKOWĄ': 'RECTIFICATION D’UNE FACTURE D’ACOMPTE',
  'FAKTURA KORYGUJĄCA FAKTURĘ ROZLICZENIOWĄ': 'RECTIFICATION D’UNE FACTURE DE SOLDE',

  // --- podmioty ---
  'Sprzedawca': 'Vendeur',
  'Nabywca': 'Acheteur',
  'Podmiot upoważniony': 'Entité habilitée',
  'Podmiot trzeci': 'Tiers',
  '(inny)': '(autre)',
  'Nazwa': 'Nom',
  'Adres': 'Adresse',
  'Adres koresp.': 'Adresse postale',
  'Nr klienta': 'N° client',
  'Nr kontrahenta': 'N° contrepartie',
  'ID nabywcy': 'ID acheteur',
  'ID wewn.': 'ID interne',
  'VAT UE': 'TVA intracom.',
  'ID zagraniczny': 'ID étranger',
  'bez identyfikatora podatkowego': 'sans identifiant fiscal',
  '(bez identyfikatora)': '(sans identifiant)',
  'jednostka podrzędna': 'unité subordonnée',
  'członek grupy VAT': 'membre d’un groupe TVA',
  'nie': 'non',
  'Status': 'Statut',
  'Udział': 'Part',
  'Rola': 'Rôle',
  'e-mail': 'e-mail',
  'tel.': 'tél.',

  // --- role podmiotu upoważnionego ---
  'Organ egzekucyjny': 'Autorité d’exécution',
  'Komornik sądowy': 'Huissier de justice',
  'Przedstawiciel podatkowy': 'Représentant fiscal',

  // --- roleMap (Podmiot3) ---
  'Faktor': 'Factor',
  'Odbiorca': 'Destinataire',
  'Podmiot pierwotny': 'Entité initiale',
  'Dodatkowy nabywca': 'Acheteur supplémentaire',
  'Wystawca faktury': 'Émetteur de la facture',
  'Dokonujący płatności': 'Payeur',
  'JST - wystawca': 'Collectivité territoriale - émetteur',
  'JST - odbiorca': 'Collectivité territoriale - destinataire',
  'Członek grupy VAT - wystawca': 'Membre d’un groupe TVA - émetteur',
  'Członek grupy VAT - odbiorca': 'Membre d’un groupe TVA - destinataire',
  'Pracownik': 'Salarié',

  // --- taxpayerStatusMap ---
  'W likwidacji': 'En liquidation',
  'Postępowanie restrukturyzacyjne': 'Procédure de restructuration',
  'Upadłość': 'Faillite',
  'Przedsiębiorstwo w spadku': 'Entreprise en succession',

  // --- dane faktury ---
  'Dane faktury': 'Données de la facture',
  'Numer': 'Numéro',
  'Data wystawienia': 'Date d’émission',
  'Data sprzedaży': 'Date de vente',
  'Okres': 'Période',
  'Okres sprzedaży': 'Période de vente',
  'Waluta': 'Devise',
  'Korygowane faktury': 'Factures rectifiées',
  'Typ korekty': 'Type de rectification',
  'Przyczyna korekty': 'Motif de la rectification',
  'z dnia': 'du',
  '(poza KSeF)': '(hors KSeF)',
  'Przed korektą': 'Avant rectification',
  'Po korekcie': 'Après rectification',
  'Dane sprzedawcy przed korektą': 'Données du vendeur avant rectification',
  'Dane nabywców przed korektą': 'Données des acheteurs avant rectification',
  'Nabywca przed korektą': 'Acheteur avant rectification',

  // --- correctionTypeMap ---
  'Korekta w dacie faktury pierwotnej': 'Rectification à la date de la facture initiale',
  'Korekta w dacie wystawienia': 'Rectification à la date d’émission',
  'Korekta w innej dacie': 'Rectification à une autre date',

  // --- płatność ---
  'Płatność': 'Paiement',
  'Forma': 'Mode',
  'Inna forma': 'Autre mode',
  'Termin': 'Échéance',
  'od': 'à compter de',
  'Rachunek': 'Compte bancaire',
  'Rachunek faktora': 'Compte du factor',
  'rachunek własny': 'compte propre',
  'rach. własny (wierzytelności)': 'compte propre (créances)',
  'rach. własny (pobranie)': 'compte propre (encaissement)',
  'rach. własny (gospodarka)': 'compte propre (exploitation)',
  'Zapłacono': 'Payée',
  'Tak, dnia': 'Oui, le',
  'Zapłaty częściowe': 'Paiements partiels',
  '(częściowa)': '(partiel)',
  '(wieloczęściowa)': '(échelonné)',
  'z': 'du',
  'Skonto': 'Escompte',
  'Link do płatności': 'Lien de paiement',
  'płatność online': 'payer en ligne',
  'Link': 'Lien',

  // --- paymentMap ---
  'Gotówka': 'Espèces',
  'Karta': 'Carte',
  'Bon': 'Bon',
  'Czek': 'Chèque',
  'Kredyt': 'Crédit',
  'Przelew': 'Virement bancaire',
  'Mobilna': 'Paiement mobile',

  // --- tabela pozycji ---
  'Opis / GTU': 'Désignation / GTU',
  'Opis': 'Désignation',
  'Indeks': 'Réf. article',
  'Ilość': 'Qté',
  'JM': 'Unité',
  'Cena': 'Prix',
  'Cena netto': 'Prix HT',
  'Cena po rabacie': 'Prix remisé',
  'Wart. netto': 'Montant HT',
  'Wart. brutto': 'Montant TTC',
  'Netto': 'HT',
  'Brutto': 'TTC',
  'VAT': 'TVA',
  'VAT%': 'TVA %',
  'RÓŻNICA': 'DIFFÉRENCE',
  '(przed korektą)': '(avant rectification)',
  '(brutto)': '(TTC)',
  'Akcyza': 'Accise',
  'Opust': 'Remise',
  'Rabat': 'Remise',
  'Narzut': 'Majoration',
  'Data': 'Date',
  'Kurs': 'Taux',
  'Zał.15': 'Annexe 15',

  // --- gtuMap ---
  'GTU_01 Alkohol': 'GTU_01 Alcool',
  'GTU_02 Paliwa': 'GTU_02 Carburants',
  'GTU_03 Olej opałowy': 'GTU_03 Fioul',
  'GTU_04 Tytoń': 'GTU_04 Tabac',
  'GTU_05 Odpady': 'GTU_05 Déchets',
  'GTU_06 Urządzenia elektroniczne': 'GTU_06 Appareils électroniques',
  'GTU_07 Pojazdy': 'GTU_07 Véhicules',
  'GTU_08 Metale szlachetne': 'GTU_08 Métaux précieux',
  'GTU_09 Leasing': 'GTU_09 Crédit-bail',
  'GTU_10 Budowlanka': 'GTU_10 Construction',
  'GTU_11 Usługi niematerialne': 'GTU_11 Services immatériels',
  'GTU_12 Usługi transportowe': 'GTU_12 Services de transport',
  'GTU_13 Usługi magazynowe': 'GTU_13 Services d’entreposage',

  // --- podsumowanie VAT / stawki (vatRateMap) ---
  'Kategoria': 'Catégorie',
  'VAT(przel.)': 'TVA (convertie)',
  'RAZEM': 'TOTAL',
  'ryczałt taxi': 'forfait taxi',
  '0% (kraj)': '0% (national)',
  '0% (WDT)': '0% (livraison intracom.)',
  '0% (eksport)': '0% (exportation)',
  'zwolnione': 'exonéré',
  'niepodlegające': 'hors champ de la TVA',
  'niepodlegające (poza kraj)': 'hors champ (hors Pologne)',
  'niepodlegające (art. 100)': 'hors champ (art. 100)',
  'art. 100': 'art. 100',
  'odwrotne obciążenie': 'autoliquidation',
  'marża': 'régime de la marge',

  // --- walidator spójności nagłówka ---
  'Niezgodność sum w nagłówku faktury': 'Incohérence des totaux dans l’en-tête de la facture',
  'Suma wartości netto i VAT z pól P_13 / P_14 nie zgadza się z zadeklarowaną kwotą brutto (P_15)': 'La somme des montants HT et TVA des champs P_13 / P_14 ne correspond pas au montant TTC déclaré (P_15)',
  'Suma netto (P_13)': 'Total HT (P_13)',
  'Suma VAT (P_14)': 'Total TVA (P_14)',
  'Netto + VAT': 'HT + TVA',
  'Brutto zadeklarowane (P_15)': 'TTC déclaré (P_15)',
  'Rozbieżność': 'Écart',
  'KSeFeusz.pl prezentuje dane wyłącznie w formie wizualizacji oryginalnego pliku XML. W razie wątpliwości zweryfikuj dane źródłowe w pliku XML lub bezpośrednio w KSeF — wizualizator nie modyfikuje wartości z faktury.': 'KSeFeusz.pl se limite à visualiser le fichier XML original. En cas de doute, vérifiez les données sources dans le fichier XML ou directement dans KSeF — le visualiseur ne modifie aucune valeur de la facture.',

  // --- rozliczenie ---
  'Rozliczenie': 'Règlement',
  'Obciążenie': 'Débit',
  'Suma obciążeń': 'Total des débits',
  'Odliczenie': 'Déduction',
  'Suma odliczeń': 'Total des déductions',
  'Do zapłaty': 'Net à payer',
  'Do rozliczenia': 'À régulariser',

  // --- zaliczki ---
  'Zaliczki częściowe': 'Acomptes partiels',
  'Zaliczka': 'Acompte',
  'Data otrzymania': 'Date de réception',
  'Kwota': 'Montant',
  'Kurs waluty': 'Taux de change',
  'Faktury zaliczkowe': 'Factures d’acompte',
  'Faktura zaliczkowa': 'Facture d’acompte',
  'poza KSeF': 'hors KSeF',
  '(wystawiona poza KSeF)': '(émise hors KSeF)',

  // --- warunki transakcji ---
  'Warunki transakcji': 'Conditions de la transaction',
  'Umowy': 'Contrats',
  'Zamówienia': 'Commandes',
  'Partie towaru': 'Lots de marchandises',
  'Incoterms': 'Incoterms',
  'Kurs umowny': 'Taux contractuel',
  'Transakcja łańcuchowa': 'Opération en chaîne',
  'Tak (podmiot pośredniczący)': 'Oui (intermédiaire)',
  'Transport': 'Transport',
  'Rodzaj': 'Type',
  'Przewoźnik': 'Transporteur',
  'Zlecenie': 'N° d’ordre',
  'Zlecenie transportu': 'Ordre de transport',
  'Ładunek': 'Chargement',
  'Termin transportu': 'Dates de transport',
  'od:': 'du :',
  'do:': 'au :',
  'Wysyłka z': 'Expédition depuis',
  'Wysyłka do': 'Expédition vers',
  'Wysyłka przez': 'Expédition via',

  // --- rodzaje transportu ---
  'Morski': 'Maritime',
  'Kolejowy': 'Ferroviaire',
  'Drogowy': 'Routier',
  'Lotniczy': 'Aérien',
  'Przesyłka pocztowa': 'Envoi postal',
  'Stałe instalacje przesyłowe': 'Installations de transport fixes',
  'Żegluga śródlądowa': 'Navigation intérieure',

  // --- rodzaje ładunku ---
  'Bańka': 'Bidon',
  'Beczka': 'Fût',
  'Butla': 'Bouteille',
  'Karton': 'Carton',
  'Kanister': 'Jerrican',
  'Klatka': 'Cage',
  'Kontener': 'Conteneur',
  'Kosz/koszyk': 'Panier',
  'Łubianka': 'Cageot',
  'Opakowanie zbiorcze': 'Emballage groupé',
  'Paczka': 'Colis',
  'Pakiet': 'Paquet',
  'Paleta': 'Palette',
  'Pojemnik': 'Récipient',
  'Pojemnik do ładunków masowych stałych': 'Conteneur pour vrac solide',
  'Pojemnik do ładunków masowych w postaci płynnej': 'Conteneur pour vrac liquide',
  'Pudełko': 'Boîte',
  'Puszka': 'Canette',
  'Skrzynia': 'Caisse',
  'Worek': 'Sac',

  // --- adnotacje ---
  'Adnotacje': 'Mentions',
  'Metoda kasowa': 'Comptabilité de caisse',
  'Samofakturowanie': 'Autofacturation',
  'Odwrotne obciążenie': 'Autoliquidation',
  'Split payment': 'Paiement scindé',
  'Procedura uproszczona WE': 'Procédure simplifiée CE',
  'Proc. uproszczona WE': 'Proc. simplifiée CE',
  'Zwolnienie': 'Exonération',
  'Tak': 'Oui',
  'Nie': 'Non',
  'Nie dotyczy': 'Sans objet',
  'brak podstawy': 'aucune base légale indiquée',
  'Procedura marży': 'Régime de la marge',
  'biura podróży': 'agences de voyages',
  'towary używane': 'biens d’occasion',
  'dzieła sztuki': 'objets d’art',
  'kolekcjonerskie/antyki': 'objets de collection/antiquités',

  // --- nowe środki transportu ---
  'Nowe środki transportu': 'Moyens de transport neufs',
  'Wewnątrzwspólnotowa dostawa nowych środków transportu': 'Livraison intracommunautaire de moyens de transport neufs',
  'Art. 42 ust. 5': 'Art. 42 al. 5',
  'Nowy środek transportu': 'Moyen de transport neuf',
  'Data dopuszczenia': 'Date de première mise en circulation',
  'Nr wiersza': 'N° de ligne',
  'Dane': 'Données',
  'rocznik': 'année',
  'Przebieg': 'Kilométrage',
  'Numery': 'Numéros',
  'nadwozie': 'carrosserie',
  'podwozie': 'châssis',
  'rama': 'cadre',
  'Typ': 'Type',
  'Godziny robocze (jednostka pływająca)': 'Heures de service (bateau)',
  'Nr kadłuba': 'N° de coque',
  'Godziny robocze (statek powietrzny)': 'Heures de vol (aéronef)',
  'Nr fabryczny': 'N° de série',

  // --- dodatkowe informacje ---
  'Dodatkowe informacje': 'Informations complémentaires',
  'Powiązania': 'Parties liées',
  'Zwrot akcyzy': 'Remboursement d’accise',
  'Kwota przed korektą': 'Montant avant rectification',
  'Status sprzedawcy': 'Statut du vendeur',
  'Okres korekty': 'Période de rectification',
  'Informacje ogólne': 'Informations générales',
  'Dodatkowe informacje dla wierszy': 'Informations complémentaires par ligne',
  'Dodatkowe informacje dla wierszy zostały ukryte.': 'Les informations complémentaires par ligne ont été masquées.',
  'Tabela została podzielona na {n} części ze względu na dużą liczbę etykiet ({k}).': 'Le tableau a été divisé en {n} parties en raison du grand nombre de libellés ({k}).',
  'Tabela może być szeroka - w razie potrzeby przewiń w PDF.': 'Le tableau peut être large - faites défiler dans le PDF si nécessaire.',

  // --- zamówienie / załączniki / stopka ---
  'Zamówienie/Umowa': 'Commande / Contrat',
  'Wartość zamówienia': 'Valeur de la commande',
  'Lp.': 'N°',
  'Numer umowy/UUID': 'Numéro de contrat / UUID',
  'Załączniki': 'Pièces jointes',
  'Stopka faktury': 'Pied de facture',
  'Pełna nazwa': 'Dénomination complète',

  // --- weryfikacja KSeF ---
  'Weryfikacja faktury w KSeF': 'Vérification de la facture dans KSeF',
  'Zeskanuj kod QR lub kliknij link poniżej:': 'Scannez le code QR ou cliquez sur le lien ci-dessous :',
  'Zeskanuj kod QR lub kliknij link, aby zweryfikować fakturę w systemie KSeF Ministerstwa Finansów.': 'Scannez le code QR ou cliquez sur le lien pour vérifier la facture dans le système KSeF du ministère polonais des Finances.',
  'Hash dokumentu': 'Empreinte du document',
  'Link weryfikacyjny': 'Lien de vérification',
  'Strona weryfikacyjna Ministerstwa Finansów': 'Page de vérification du ministère polonais des Finances',
  'Weryfikacja w KSeF niemożliwa': 'Vérification dans KSeF impossible',
  'Plik zawiera elementy spoza schematu FA(3). Hash dokumentu może nie odpowiadać oryginałowi z KSeF.': 'Le fichier contient des éléments hors du schéma FA(3). L’empreinte du document peut ne pas correspondre à l’original dans KSeF.',
  'Weryfikacja niemożliwa — plik zawiera elementy spoza schematu FA(3).': 'Vérification impossible — le fichier contient des éléments hors du schéma FA(3).',
  'Nieznane elementy': 'Éléments inconnus',

  // --- stopki i nota o tłumaczeniu ---
  'Strona {n} z {k}': 'Page {n} sur {k}',
  'KSeFeusz.pl - darmowy wizualizator faktur ustrukturyzowanych KSeF wersja {v}': 'KSeFeusz.pl - visualiseur gratuit de factures structurées KSeF, version {v}',
  'Wygenerowano przez KSeFeusz.pl · Darmowy wizualizator faktur ustrukturyzowanych KSeF · Wersja {v}': 'Généré par KSeFeusz.pl · Visualiseur gratuit de factures structurées KSeF · Version {v}',
  'Tłumaczeniu podlegają jedynie statyczne elementy szablonu dokumentu (etykiety). Treść merytoryczna faktury pozostaje w języku oryginalnym.': 'Seuls les éléments statiques du modèle de document (libellés) sont traduits. Le contenu de la facture reste dans sa langue d’origine.'
};

// ============================================================================
// УКРАЇНСЬКА
// ============================================================================
I18N.uk = {
  // --- nagłówek dokumentu ---
  'Wizualizacja faktury ustrukturyzowanej XML': 'Візуалізація структурованої XML-фактури',
  'nr': '№',
  'Nr KSeF': '№ KSeF',
  'brak numeru KSeF w nazwie pliku': 'немає номера KSeF у назві файлу',
  'błędna suma kontrolna': 'помилкова контрольна сума',
  'Suma kontrolna CRC-8 jest nieprawidłowa — numer może być uszkodzony': 'Контрольна сума CRC-8 недійсна — номер може бути пошкоджений',
  'Nieprawidłowa suma kontrolna NIP — sprawdź czy numer jest poprawny': 'Недійсна контрольна сума NIP — перевірте номер',
  'Wytworzono': 'Створено',
  'System': 'Система',
  '(brak numeru)': '(без номера)',

  // --- typy faktur (invoiceTypeMap) ---
  'FAKTURA': 'ФАКТУРА',
  'FAKTURA KORYGUJĄCA': 'КОРИГУВАЛЬНА ФАКТУРА',
  'FAKTURA ZALICZKOWA': 'АВАНСОВА ФАКТУРА',
  'FAKTURA ROZLICZENIOWA': 'ПІДСУМКОВА ФАКТУРА',
  'FAKTURA UPROSZCZONA': 'СПРОЩЕНА ФАКТУРА',
  'FAKTURA KORYGUJĄCA FAKTURĘ ZALICZKOWĄ': 'КОРИГУВАННЯ АВАНСОВОЇ ФАКТУРИ',
  'FAKTURA KORYGUJĄCA FAKTURĘ ROZLICZENIOWĄ': 'КОРИГУВАННЯ ПІДСУМКОВОЇ ФАКТУРИ',

  // --- podmioty ---
  'Sprzedawca': 'Продавець',
  'Nabywca': 'Покупець',
  'Podmiot upoważniony': 'Уповноважена особа',
  'Podmiot trzeci': 'Третя сторона',
  '(inny)': '(інше)',
  'Nazwa': 'Назва',
  'Adres': 'Адреса',
  'Adres koresp.': 'Поштова адреса',
  'Nr klienta': '№ клієнта',
  'Nr kontrahenta': '№ контрагента',
  'ID nabywcy': 'ID покупця',
  'ID wewn.': 'Внутрішній ID',
  'VAT UE': 'ПДВ ЄС',
  'ID zagraniczny': 'Іноземний ID',
  'bez identyfikatora podatkowego': 'без податкового ідентифікатора',
  '(bez identyfikatora)': '(без ідентифікатора)',
  'jednostka podrzędna': 'підпорядкована одиниця',
  'członek grupy VAT': 'учасник групи ПДВ',
  'nie': 'ні',
  'Status': 'Статус',
  'Udział': 'Частка',
  'Rola': 'Роль',
  'e-mail': 'e-mail',
  'tel.': 'тел.',

  // --- role podmiotu upoważnionego ---
  'Organ egzekucyjny': 'Виконавчий орган',
  'Komornik sądowy': 'Судовий виконавець',
  'Przedstawiciel podatkowy': 'Податковий представник',

  // --- roleMap (Podmiot3) ---
  'Faktor': 'Фактор',
  'Odbiorca': 'Одержувач',
  'Podmiot pierwotny': 'Первинна сторона',
  'Dodatkowy nabywca': 'Додатковий покупець',
  'Wystawca faktury': 'Емітент фактури',
  'Dokonujący płatności': 'Платник',
  'JST - wystawca': 'Орган місцевого самоврядування - емітент',
  'JST - odbiorca': 'Орган місцевого самоврядування - одержувач',
  'Członek grupy VAT - wystawca': 'Учасник групи ПДВ - емітент',
  'Członek grupy VAT - odbiorca': 'Учасник групи ПДВ - одержувач',
  'Pracownik': 'Працівник',

  // --- taxpayerStatusMap ---
  'W likwidacji': 'У ліквідації',
  'Postępowanie restrukturyzacyjne': 'Процедура реструктуризації',
  'Upadłość': 'Банкрутство',
  'Przedsiębiorstwo w spadku': 'Підприємство у спадщині',

  // --- dane faktury ---
  'Dane faktury': 'Дані фактури',
  'Numer': 'Номер',
  'Data wystawienia': 'Дата виставлення',
  'Data sprzedaży': 'Дата продажу',
  'Okres': 'Період',
  'Okres sprzedaży': 'Період продажу',
  'Waluta': 'Валюта',
  'Korygowane faktury': 'Скориговані фактури',
  'Typ korekty': 'Тип коригування',
  'Przyczyna korekty': 'Причина коригування',
  'z dnia': 'від',
  '(poza KSeF)': '(поза KSeF)',
  'Przed korektą': 'До коригування',
  'Po korekcie': 'Після коригування',
  'Dane sprzedawcy przed korektą': 'Дані продавця до коригування',
  'Dane nabywców przed korektą': 'Дані покупців до коригування',
  'Nabywca przed korektą': 'Покупець до коригування',

  // --- correctionTypeMap ---
  'Korekta w dacie faktury pierwotnej': 'Коригування на дату первинної фактури',
  'Korekta w dacie wystawienia': 'Коригування на дату виставлення',
  'Korekta w innej dacie': 'Коригування на іншу дату',

  // --- płatność ---
  'Płatność': 'Оплата',
  'Forma': 'Форма',
  'Inna forma': 'Інша форма',
  'Termin': 'Термін',
  'od': 'від',
  'Rachunek': 'Банківський рахунок',
  'Rachunek faktora': 'Рахунок фактора',
  'rachunek własny': 'власний рахунок',
  'rach. własny (wierzytelności)': 'власний рахунок (вимоги)',
  'rach. własny (pobranie)': 'власний рахунок (інкасо)',
  'rach. własny (gospodarka)': 'власний рахунок (діяльність)',
  'Zapłacono': 'Оплачено',
  'Tak, dnia': 'Так, дня',
  'Zapłaty częściowe': 'Часткові платежі',
  '(częściowa)': '(часткова)',
  '(wieloczęściowa)': '(багаточасткова)',
  'z': 'від',
  'Skonto': 'Знижка за дострокову оплату',
  'Link do płatności': 'Посилання на оплату',
  'płatność online': 'оплатити онлайн',
  'Link': 'Посилання',

  // --- paymentMap ---
  'Gotówka': 'Готівка',
  'Karta': 'Картка',
  'Bon': 'Ваучер',
  'Czek': 'Чек',
  'Kredyt': 'Кредит',
  'Przelew': 'Банківський переказ',
  'Mobilna': 'Мобільний платіж',

  // --- tabela pozycji ---
  'Opis / GTU': 'Опис / GTU',
  'Opis': 'Опис',
  'Indeks': 'Артикул',
  'Ilość': 'К-сть',
  'JM': 'Од.',
  'Cena': 'Ціна',
  'Cena netto': 'Ціна нетто',
  'Cena po rabacie': 'Ціна зі знижкою',
  'Wart. netto': 'Сума нетто',
  'Wart. brutto': 'Сума брутто',
  'Netto': 'Нетто',
  'Brutto': 'Брутто',
  'VAT': 'ПДВ',
  'VAT%': 'ПДВ %',
  'RÓŻNICA': 'РІЗНИЦЯ',
  '(przed korektą)': '(до коригування)',
  '(brutto)': '(брутто)',
  'Akcyza': 'Акциз',
  'Opust': 'Знижка',
  'Rabat': 'Знижка',
  'Narzut': 'Націнка',
  'Data': 'Дата',
  'Kurs': 'Курс',
  'Zał.15': 'Додаток 15',

  // --- gtuMap ---
  'GTU_01 Alkohol': 'GTU_01 Алкоголь',
  'GTU_02 Paliwa': 'GTU_02 Паливо',
  'GTU_03 Olej opałowy': 'GTU_03 Мазут',
  'GTU_04 Tytoń': 'GTU_04 Тютюн',
  'GTU_05 Odpady': 'GTU_05 Відходи',
  'GTU_06 Urządzenia elektroniczne': 'GTU_06 Електронні пристрої',
  'GTU_07 Pojazdy': 'GTU_07 Транспортні засоби',
  'GTU_08 Metale szlachetne': 'GTU_08 Дорогоцінні метали',
  'GTU_09 Leasing': 'GTU_09 Лізинг',
  'GTU_10 Budowlanka': 'GTU_10 Будівництво',
  'GTU_11 Usługi niematerialne': 'GTU_11 Нематеріальні послуги',
  'GTU_12 Usługi transportowe': 'GTU_12 Транспортні послуги',
  'GTU_13 Usługi magazynowe': 'GTU_13 Складські послуги',

  // --- podsumowanie VAT / stawki (vatRateMap) ---
  'Kategoria': 'Категорія',
  'VAT(przel.)': 'ПДВ (перерах.)',
  'RAZEM': 'РАЗОМ',
  'ryczałt taxi': 'фіксована ставка таксі',
  '0% (kraj)': '0% (внутрішня)',
  '0% (WDT)': '0% (постачання в ЄС)',
  '0% (eksport)': '0% (експорт)',
  'zwolnione': 'звільнено',
  'niepodlegające': 'не підлягає оподаткуванню',
  'niepodlegające (poza kraj)': 'не підлягає (поза Польщею)',
  'niepodlegające (art. 100)': 'не підлягає (ст. 100)',
  'art. 100': 'ст. 100',
  'odwrotne obciążenie': 'зворотне нарахування',
  'marża': 'маржинальна схема',

  // --- walidator spójności nagłówka ---
  'Niezgodność sum w nagłówku faktury': 'Невідповідність сум у заголовку фактури',
  'Suma wartości netto i VAT z pól P_13 / P_14 nie zgadza się z zadeklarowaną kwotą brutto (P_15)': 'Сума значень нетто та ПДВ з полів P_13 / P_14 не збігається із задекларованою сумою брутто (P_15)',
  'Suma netto (P_13)': 'Сума нетто (P_13)',
  'Suma VAT (P_14)': 'Сума ПДВ (P_14)',
  'Netto + VAT': 'Нетто + ПДВ',
  'Brutto zadeklarowane (P_15)': 'Задеклароване брутто (P_15)',
  'Rozbieżność': 'Розбіжність',
  'KSeFeusz.pl prezentuje dane wyłącznie w formie wizualizacji oryginalnego pliku XML. W razie wątpliwości zweryfikuj dane źródłowe w pliku XML lub bezpośrednio w KSeF — wizualizator nie modyfikuje wartości z faktury.': 'KSeFeusz.pl лише візуалізує оригінальний XML-файл. У разі сумнівів перевірте вихідні дані у файлі XML або безпосередньо в KSeF — візуалізатор не змінює значень фактури.',

  // --- rozliczenie ---
  'Rozliczenie': 'Розрахунок',
  'Obciążenie': 'Нарахування',
  'Suma obciążeń': 'Сума нарахувань',
  'Odliczenie': 'Відрахування',
  'Suma odliczeń': 'Сума відрахувань',
  'Do zapłaty': 'До сплати',
  'Do rozliczenia': 'До врегулювання',

  // --- zaliczki ---
  'Zaliczki częściowe': 'Часткові аванси',
  'Zaliczka': 'Аванс',
  'Data otrzymania': 'Дата отримання',
  'Kwota': 'Сума',
  'Kurs waluty': 'Курс валюти',
  'Faktury zaliczkowe': 'Авансові фактури',
  'Faktura zaliczkowa': 'Авансова фактура',
  'poza KSeF': 'поза KSeF',
  '(wystawiona poza KSeF)': '(виставлена поза KSeF)',

  // --- warunki transakcji ---
  'Warunki transakcji': 'Умови операції',
  'Umowy': 'Договори',
  'Zamówienia': 'Замовлення',
  'Partie towaru': 'Партії товару',
  'Incoterms': 'Інкотермс',
  'Kurs umowny': 'Договірний курс',
  'Transakcja łańcuchowa': 'Ланцюгова операція',
  'Tak (podmiot pośredniczący)': 'Так (посередник)',
  'Transport': 'Транспорт',
  'Rodzaj': 'Вид',
  'Przewoźnik': 'Перевізник',
  'Zlecenie': '№ замовлення',
  'Zlecenie transportu': 'Замовлення на перевезення',
  'Ładunek': 'Вантаж',
  'Termin transportu': 'Терміни перевезення',
  'od:': 'з:',
  'do:': 'до:',
  'Wysyłka z': 'Відправлення з',
  'Wysyłka do': 'Відправлення до',
  'Wysyłka przez': 'Відправлення через',

  // --- rodzaje transportu ---
  'Morski': 'Морський',
  'Kolejowy': 'Залізничний',
  'Drogowy': 'Автомобільний',
  'Lotniczy': 'Авіаційний',
  'Przesyłka pocztowa': 'Поштове відправлення',
  'Stałe instalacje przesyłowe': 'Стаціонарні транспортні установки',
  'Żegluga śródlądowa': 'Внутрішнє судноплавство',

  // --- rodzaje ładunku ---
  'Bańka': 'Бідон',
  'Beczka': 'Бочка',
  'Butla': 'Балон',
  'Karton': 'Картон',
  'Kanister': 'Каністра',
  'Klatka': 'Клітка',
  'Kontener': 'Контейнер',
  'Kosz/koszyk': 'Кошик',
  'Łubianka': 'Лубʼянка',
  'Opakowanie zbiorcze': 'Групове паковання',
  'Paczka': 'Пакунок',
  'Pakiet': 'Пакет',
  'Paleta': 'Палета',
  'Pojemnik': 'Ємність',
  'Pojemnik do ładunków masowych stałych': 'Ємність для твердих насипних вантажів',
  'Pojemnik do ładunków masowych w postaci płynnej': 'Ємність для рідких наливних вантажів',
  'Pudełko': 'Коробка',
  'Puszka': 'Банка',
  'Skrzynia': 'Ящик',
  'Worek': 'Мішок',

  // --- adnotacje ---
  'Adnotacje': 'Примітки',
  'Metoda kasowa': 'Касовий метод',
  'Samofakturowanie': 'Самофактурування',
  'Odwrotne obciążenie': 'Зворотне нарахування',
  'Split payment': 'Розділений платіж',
  'Procedura uproszczona WE': 'Спрощена процедура ЄС',
  'Proc. uproszczona WE': 'Спрощ. процедура ЄС',
  'Zwolnienie': 'Звільнення',
  'Tak': 'Так',
  'Nie': 'Ні',
  'Nie dotyczy': 'Не стосується',
  'brak podstawy': 'підстава не вказана',
  'Procedura marży': 'Маржинальна схема',
  'biura podróży': 'туристичні агенції',
  'towary używane': 'вживані товари',
  'dzieła sztuki': 'твори мистецтва',
  'kolekcjonerskie/antyki': 'колекційні предмети/антикваріат',

  // --- nowe środki transportu ---
  'Nowe środki transportu': 'Нові транспортні засоби',
  'Wewnątrzwspólnotowa dostawa nowych środków transportu': 'Внутрішньосоюзне постачання нових транспортних засобів',
  'Art. 42 ust. 5': 'Ст. 42 п. 5',
  'Nowy środek transportu': 'Новий транспортний засіб',
  'Data dopuszczenia': 'Дата першої реєстрації',
  'Nr wiersza': '№ рядка',
  'Dane': 'Дані',
  'rocznik': 'рік випуску',
  'Przebieg': 'Пробіг',
  'Numery': 'Номери',
  'nadwozie': 'кузов',
  'podwozie': 'шасі',
  'rama': 'рама',
  'Typ': 'Тип',
  'Godziny robocze (jednostka pływająca)': 'Мотогодини (судно)',
  'Nr kadłuba': '№ корпусу',
  'Godziny robocze (statek powietrzny)': 'Льотні години (повітряне судно)',
  'Nr fabryczny': 'Заводський №',

  // --- dodatkowe informacje ---
  'Dodatkowe informacje': 'Додаткова інформація',
  'Powiązania': 'Повʼязані сторони',
  'Zwrot akcyzy': 'Повернення акцизу',
  'Kwota przed korektą': 'Сума до коригування',
  'Status sprzedawcy': 'Статус продавця',
  'Okres korekty': 'Період коригування',
  'Informacje ogólne': 'Загальна інформація',
  'Dodatkowe informacje dla wierszy': 'Додаткова інформація за рядками',
  'Dodatkowe informacje dla wierszy zostały ukryte.': 'Додаткову інформацію за рядками приховано.',
  'Tabela została podzielona na {n} części ze względu na dużą liczbę etykiet ({k}).': 'Таблицю поділено на {n} частин через велику кількість позначень ({k}).',
  'Tabela może być szeroka - w razie potrzeby przewiń w PDF.': 'Таблиця може бути широкою - за потреби прокрутіть у PDF.',

  // --- zamówienie / załączniki / stopka ---
  'Zamówienie/Umowa': 'Замовлення / Договір',
  'Wartość zamówienia': 'Вартість замовлення',
  'Lp.': '№',
  'Numer umowy/UUID': 'Номер договору / UUID',
  'Załączniki': 'Додатки',
  'Stopka faktury': 'Нижній колонтитул фактури',
  'Pełna nazwa': 'Повна назва',

  // --- weryfikacja KSeF ---
  'Weryfikacja faktury w KSeF': 'Перевірка фактури в KSeF',
  'Zeskanuj kod QR lub kliknij link poniżej:': 'Відскануйте QR-код або натисніть посилання нижче:',
  'Zeskanuj kod QR lub kliknij link, aby zweryfikować fakturę w systemie KSeF Ministerstwa Finansów.': 'Відскануйте QR-код або натисніть посилання, щоб перевірити фактуру в системі KSeF Міністерства фінансів Польщі.',
  'Hash dokumentu': 'Хеш документа',
  'Link weryfikacyjny': 'Посилання для перевірки',
  'Strona weryfikacyjna Ministerstwa Finansów': 'Сторінка перевірки Міністерства фінансів Польщі',
  'Weryfikacja w KSeF niemożliwa': 'Перевірка в KSeF неможлива',
  'Plik zawiera elementy spoza schematu FA(3). Hash dokumentu może nie odpowiadać oryginałowi z KSeF.': 'Файл містить елементи поза схемою FA(3). Хеш документа може не відповідати оригіналу в KSeF.',
  'Weryfikacja niemożliwa — plik zawiera elementy spoza schematu FA(3).': 'Перевірка неможлива — файл містить елементи поза схемою FA(3).',
  'Nieznane elementy': 'Невідомі елементи',

  // --- stopki i nota o tłumaczeniu ---
  'Strona {n} z {k}': 'Сторінка {n} з {k}',
  'KSeFeusz.pl - darmowy wizualizator faktur ustrukturyzowanych KSeF wersja {v}': 'KSeFeusz.pl - безкоштовний візуалізатор структурованих фактур KSeF, версія {v}',
  'Wygenerowano przez KSeFeusz.pl · Darmowy wizualizator faktur ustrukturyzowanych KSeF · Wersja {v}': 'Створено за допомогою KSeFeusz.pl · Безкоштовний візуалізатор структурованих фактур KSeF · Версія {v}',
  'Tłumaczeniu podlegają jedynie statyczne elementy szablonu dokumentu (etykiety). Treść merytoryczna faktury pozostaje w języku oryginalnym.': 'Перекладаються лише статичні елементи шаблону документа (позначення). Змістовна частина фактури залишається мовою оригіналу.'
};

// === KONIEC SŁOWNIKÓW ===
