# Plan uzupełnienia braków w wizualizacji — FA(3) i FA_RR

> **Stan: zrealizowany w wersji 1.8.8 (2026-09-30), jednym wydaniem.** Decyzje — na końcu dokumentu.
> W tym samym wydaniu weszło escapowanie tekstu z XML w torze HTML (osobny temat, opis w CLAUDE.md,
> sekcja „Tekst z XML a HTML").
> Kryteria ukończenia sprawdzają testy z `tools/audyt/` (lokalnie, poza gitem) — wszystkie przechodzą.

Stan wyjściowy: 1.8.7
Zasada: **co jest w XML, ma być w wizualizacji — w HTML i w PDF.** Wyjątki tylko świadome i opisane.

Szacunek pierwotny: ~2 dni, 7 commitów, ~350 linii, 4 nowe klucze i18n.

---

## Skąd ta lista

Trzy testy uruchomione na kodzie 1.8.7 (node + jsdom, poza repo):

| Test | Co robi | Wynik |
|---|---|---|
| **Pokrycie** | Z XSD generuje fakturę zawierającą każdy element schematu z unikalną wartością, renderuje HTML i PDF, szuka tych wartości w wyniku. Dla flag i kodów sprawdza, czy usunięcie elementu cokolwiek zmienia. Wszystkie gałęzie `choice`, wszystkie rodzaje faktury. | FA(3): 331 wystąpień elementów, FA_RR: 128 |
| **Powtarzalne** | Każdy element z `maxOccurs > 1` występuje dwa razy z różnymi wartościami. Czy widać oba? | 36 elementów w FA(3), 14 w RR |
| **Kolizje nazw** | Szuka w schemacie miejsc, gdzie ta sama nazwa elementu występuje na dwóch głębokościach tego samego kontenera. | 1 kontener: `Platnosc` |

Każda pozycja z listy została potem potwierdzona w kodzie. Znaczenie pól — z `xsd:documentation` i z broszury MF (`documentations/broszura-…-fa-3.pdf`).

---

## Ustalenia, które zmieniają projekt

| Fakt | Konsekwencja |
|---|---|
| **`getText(node, tag)` szuka na dowolnej głębokości** i bierze pierwsze trafienie. W `Platnosc` element `ZaplataCzesciowa` (z własnym `FormaPlatnosci`) stoi w XML **przed** `FormaPlatnosci` faktury | Forma płatności pierwszej zapłaty częściowej jest pokazywana jako forma płatności całej faktury. To nie brak, tylko **błędna dana** — etap 1 |
| **`ZnacznikZaplatyCzesciowej = 2` znaczy „zapłacono w całości"** (w dwóch lub więcej częściach), nie „płatność wieloczęściowa" | Dziś przy takiej fakturze pokazujemy boks „Dane do przelewu" z pełną kwotą i kodem QR — etap 1 |
| `TerminPlatnosci` może wystąpić **100 razy**, parser czyta `[0]` | Przy płatności w ratach widać tylko pierwszy termin — etap 2 |
| Tabela VAT w PDF nie ma kolumny `P_14_xW`, HTML ma | Na fakturze walutowej PDF nie pokazuje kwoty VAT w złotych — etap 3 |
| Prawie wszystkie rozjazdy HTML ↔ PDF biorą się z tego, że **ta sama lista jest napisana dwa razy** (pola tabeli VAT, „dodatki" wiersza zamówienia, grid podmiotu) | Tam, gdzie wynik jest zwykłym tekstem, wprowadzamy jedną wspólną funkcję — jak `groupCorrectionRows`. Inaczej za pół roku lista braków odrośnie |
| Oficjalny przykład w broszurze ma `ZdarzeniePoczatkowe = „od wystawienia faktury"` — z „od" w środku | Doklejamy własne „od". Nasza próbka `FA3_faktura_gtu_procedury.xml` renderuje się jako „14 dni od od daty wystawienia faktury" |
| Ta sama próbka ma `RachunekBankowyFaktora/OpisRachunku`, którego nie wyświetla ani HTML, ani PDF | Pułapka 45 z CLAUDE.md w praktyce: próbka zawierała pole, nikt nie sprawdził, czy widać je w wyniku |
| W FA_RR pole `NrFaKorygowany` jest podpisane „Nr faktury korygowanej" | Etykieta mówi co innego niż pole (patrz tabela niżej) — etap 6 |

---

## Co te pola znaczą i jak są ważne

### Błędy — pokazujemy coś niezgodnego z XML

| Pole | Znaczenie | Co dziś widać |
|---|---|---|
| `Platnosc/FormaPlatnosci`, `PlatnoscInna`, `OpisPlatnosci` | forma płatności **faktury** | Gdy jest zapłata częściowa: forma tej zapłaty. Zaliczka gotówką + reszta przelewem → „Forma: Gotówka" i znika boks „Dane do przelewu" |
| `ZnacznikZaplatyCzesciowej` | `1` — zapłacono w części; `2` — zapłacono w całości, w dwóch lub więcej częściach | HTML: „(częściowa)" / „(wieloczęściowa)". PDF: nic. Boks „Dane do przelewu": zawsze pełna kwota `P_15`, także gdy faktura jest opłacona |

### Wysokie — czytelnik podejmuje na tej podstawie decyzję

| Pole | Znaczenie | Kiedy występuje | Brakuje w |
|---|---|---|---|
| `TerminPlatnosci` (drugi i kolejne) | kolejne terminy płatności | płatność w ratach | HTML i PDF |
| `P_14_1W` … `P_14_4W` | kwota VAT przeliczona na złote. Art. 106e ust. 11 ustawy: kwoty podatku wykazuje się w złotych | każda faktura w walucie obcej z polskim VAT | PDF |
| `NrFaKorygowany` | **poprawny** numer faktury, gdy powodem korekty jest błędny numer. Błędny stoi w `NrFaKorygowanej` | korekta numeru faktury — to pole jest wtedy całą treścią korekty | HTML i PDF (w RR jest, ale źle podpisane) |

### Średnie — treść dokumentu, rzadsza albo pomocnicza

| Pole | Znaczenie | Kiedy występuje | Brakuje w |
|---|---|---|---|
| `Zalacznik/…/Tabela/TMetaDane` | opis tabeli w załączniku, para klucz–wartość. Przykład z broszury: „Nr gazomierza", „Typ odczytu" | faktury o złożonych rozliczeniach, w broszurze: za gaz. Wystawca musi wcześniej zgłosić zamiar ich wystawiania w e-US | HTML i PDF |
| `OpisRachunku` | do czego służy rachunek, np. „Rachunek prowadzony w walucie krajowej (PLN)". Przy kilku rachunkach mówi, na który płacić | dowolna faktura z rachunkiem | rachunek zwykły: PDF; rachunek faktora: HTML i PDF |
| `ZaplataCzesciowa/OpisPlatnosci` | opis „innej" formy zapłaty częściowej (np. kompensata) | zapłata częściowa inna niż kody 1–7 | PDF (dziś pojawia się tam przypadkiem, jako skutek błędu z etapu 1) |
| `ZamowienieWiersz/P_11VatZ` | kwota VAT od zamówionej pozycji | faktura zaliczkowa z zamówieniem | HTML i PDF |
| FA_RR: dane podmiotu „po korekcie" | adres korespondencyjny, GLN, e-mail, telefon, nr kontrahenta, status | korekta VAT RR ze zmianą danych podmiotu (`Podmiot1K` / `Podmiot2K`) | PDF |

### Niskie — dane techniczne i rzadkie

| Pole | Znaczenie | Brakuje w |
|---|---|---|
| `GLN` poza adresem głównym | Globalny Numer Lokalizacyjny — identyfikuje fizyczne miejsce (oddział, magazyn, punkt dostawy). Istotny w handlu sieciowym i EDI | `AdresKoresp` wszystkich podmiotów, adres podmiotu upoważnionego, `WysylkaZ` / `WysylkaDo` / `WysylkaPrzez`: HTML i PDF. Adres Podmiotu3 i przewoźnika: PDF |
| `KursWalutyZK` | kurs waluty sprzed korekty — przy korekcie faktury zaliczkowej w walucie obcej | HTML i PDF |
| Przewoźnik: `KodKraju` + `NrID`, `BrakID` | zagraniczny identyfikator podatkowy przewoźnika albo informacja, że go nie ma | PDF |
| `PKOBZ`, `P_12Z_XII`, `KwotaAkcyzyZ`, `P_12Z_Zal_15` | klasyfikacja, stawka OSS, akcyza i znacznik załącznika nr 15 w wierszu zamówienia | PDF |
| FA_RR: `RachunekBankowy2/SWIFT`, `OpisRachunku` obu rachunków, `LinkDoPlatnosci` | jak w FA(3) | SWIFT i opis rachunku nabywcy: HTML i PDF; opis rachunku rolnika i link: PDF |

### To nie są braki

Test zgłosił je jako „bez wpływu", ale nie niosą informacji, której nie byłoby gdzie indziej:

| Pole | Dlaczego nie |
|---|---|
| `KodFormularza`, `WariantFormularza` | stałe schematu |
| `DaneFaKorygowanej/NrKSeF` | flaga „jest numer KSeF" — sam numer stoi w następnym polu i jest pokazany |
| `FakturaZaliczkowa/NrKSeFZN` | flaga „poza KSeF" — zawsze w parze z `NrFaZaliczkowej`, pokazujemy „poza KSeF: numer" |
| `ZaplataCzesciowa/PlatnoscInna` | flaga towarzysząca `OpisPlatnosci` |
| `P_PMarzyN` | „procedura marży nie dotyczy" — oba tory pokazują „Procedura marży: Nie" |
| `P_9B`, `P_10` | pokazywane warunkowo (cena brutto, gdy brak netto; opust, gdy nie ma wyliczonego rabatu) |
| `UU_ID` | **świadomie ukryte** — patrz „Do decyzji" |

---

## Zasady wspólne dla wszystkich etapów

1. **Oba tory naraz.** Każde pole trafia do `renderer.js` i `main.js` w tym samym commicie.
2. **Jedna lista, nie dwie.** Gdy wynik jest zwykłym tekstem (dodatki wiersza, pola tabeli VAT, adres z GLN), piszemy jedną funkcję wołaną z obu torów.
3. **Tekst z XML trafia do HTML wyłącznie po `escDeep()`** (albo przez `escAttr()` tam, gdzie funkcja dostaje dane surowe). Wolny tekst z XML może zawierać `<` i `&` — zasady w CLAUDE.md, sekcja „Tekst z XML a HTML".
4. **Nie wyliczamy tego, czego nie ma w XML** — chyba że z wyraźnym oznaczeniem, skąd liczba pochodzi (jak przy wierszu RÓŻNICA).

---

## Etap 1 — płatność: dwa błędy *(~0,25 dnia, wydanie 1.8.8)*

**1a. Kolizja nazw**

- `js/core.js`: nowy `getChildText(node, tag)` obok `getText` — czyta tylko bezpośrednie dziecko (`node.children`, `localName === tag`, `namespaceURI === ns`).
- `parsePlatnosc`: `formaPlatnosci`, `platnoscInna`, `opisPlatnosci` przez `getChildText`. To jedyne takie miejsce w obu schematach — `parsePlatnoscRR` zostaje (w RR nie ma `ZaplataCzesciowa`).
- `pdfRenderPaymentInfo`: do wiersza zapłaty częściowej dopisać `z.opisPlatnosci` (HTML już ma). Bez tego po poprawce opis zniknie z PDF.

**1b. Znacznik zapłaty częściowej**

- Etykiety w obu torach: `1` → „zapłacono w części", `2` → „zapłacono w całości". Klucze `(częściowa)` i `(wieloczęściowa)` wypadają z czterech słowników.
- `renderPaymentContainerHTML`: przy `znacznikZaplatyCzesciowej === "2"` boks się nie pokazuje — tak jak przy `Zaplacono`.
- Kwota w boksie przy znaczniku `1` — **do decyzji** (punkt 2 na końcu).

Cały etap (bez kwoty z ostatniego punktu) został nałożony na kopię kodu w pamięci i sprawdzony — wyniki w „Kryteria ukończenia".

**Commit:** `Forma płatności faktury nie jest już przesłaniana przez zapłatę częściową; znacznik „zapłacono w całości"`

---

## Etap 2 — płatność: braki *(~0,25 dnia)*

- **Terminy.** `parsePlatnosc` zwraca `terminy: [{ data, opis }]` zamiast `terminData` / `terminOpis` (te dwa pola czytają tylko `renderPaymentInfoHTML` i `pdfRenderPaymentInfo`). Jeden wiersz na termin: `Termin: 2026-03-16 (14 dni od wystawienia faktury)`. Dziś data i opis tego samego terminu to dwa osobne wiersze „Termin:" — przy kilku terminach nie dałoby się ich sparować.
- **Podwójne „od".** `t('od')` doklejamy tylko wtedy, gdy `ZdarzeniePoczatkowe` nie zaczyna się od „od ".
- **Opis rachunku.** `parsePlatnosc`: `opis` także w `rachunkiFaktora`. HTML: linia pod rachunkiem faktora. PDF: `rach.opis` do `sub[]` dla obu rodzajów rachunków.

**Commit:** `Wszystkie terminy płatności, opis rachunku w PDF i dla faktora`

---

## Etap 3 — kwoty i korekty *(~0,25 dnia)*

- **VAT w złotych w PDF.** Tablica `fields` z `vatSummaryHTML` i `pdfVatSummary` jest tym samym kodem wpisanym dwa razy, a kopia w PDF nie ma pola `w`. Wyciągamy `vatSummaryFields(v)` do `renderer.js` (obok `hasVatSummaryData`), oba tory czytają z niej. `pdfVatSummary` dostaje kolumnę warunkową jak HTML; szerokości `['*', 45, 45, 50, 45]`.
- **`NrFaKorygowany`.** HTML: w `korygowaneInfo`, pod listą korygowanych faktur. PDF: wiersz w `faKvRows`. Etykieta „Poprawny numer faktury korygowanej". Niezależnie od tego, czy `daneKorygowane` jest niepuste.
- **`KursWalutyZK`.** `infoItems` w `renderDodatkoweInformacjeHTML` i `pdfRenderDodatkoweInformacje`, zaraz po `P_15ZK`. Etykieta „Kurs waluty przed korektą".

**Commit:** `VAT przeliczony na PLN w PDF, poprawny numer faktury korygowanej, kurs przed korektą`

---

## Etap 4 — załącznik i zamówienie *(~0,25 dnia)*

- **`TMetaDane`.** Parser już je czyta (`tabela.metaDane`). `renderZalacznikHTML` i `pdfRenderZalacznik`: pod `tabela.opis`, nad tabelą, linie „klucz: wartość" w stylu metadanych bloku. Także wtedy, gdy tabela nie ma wierszy.
- **Dodatki wiersza zamówienia.** Wspólna `zamowienieDodatki(w, forPdf)` w `renderer.js`. PDF dostaje przez to PKOB, akcyzę, stawkę OSS i „Zał.15".
- **`P_11VatZ`.** Kolumna „VAT" w tabeli zamówienia, w obu torach, tylko gdy choć jeden wiersz ma to pole. Uwaga: `parseZamowienie` dolicza VAT ze stawki, gdy pola brak — **wyliczonej kwoty nie pokazujemy**. Parser zwraca osobno `kwotaVatXml`; w wierszu bez pola stoi „—".

**Commit:** `Metadane tabel w załączniku, kwota VAT i komplet dodatków w wierszach zamówienia`

---

## Etap 5 — GLN i przewoźnik *(~0,25 dnia)*

- `js/core.js`: `adresZGln(adres)` = `adresInline(adres)` + ` (GLN: …)`, gdy GLN jest. Reguła z pułapki 47 rozszerzona: adres po etykiecie składa zawsze ta funkcja.
- Użycie w obu torach: adres korespondencyjny Podmiotu1/2/3 i podmiotu upoważnionego, adres podmiotu upoważnionego, `WysylkaZ`, `WysylkaDo`, `WysylkaPrzez`.
- GLN adresu głównego zostaje w gridzie. `pdfRenderPodmiot3` dostaje go do gridu (HTML ma).
- `pdfRenderTransport`, przewoźnik: „ID zagraniczny", „bez identyfikatora podatkowego", GLN — klucze i18n już są.

**Commit:** `GLN we wszystkich adresach, komplet danych przewoźnika w PDF`

---

## Etap 6 — FA_RR *(~0,25 dnia)*

Bez i18n, zgodnie z decyzją z CLAUDE.md.

- `pdfRenderRRPodmiotZKorekta`: część „PO KOREKCIE" przez `pdfRenderRRPodmiot(po, '').slice(1)` — tak jak robi to `pdfRenderPodmiotZKorekta` w FA(3). Wracają: adres korespondencyjny, GLN, kontakt, nr kontrahenta, status.
- Część „PRZED KOREKTĄ" w obu torach: adres przez `adresZGln`.
- `pdfRenderRRPaymentInfo`: opis rachunku rolnika, link do płatności.
- Rachunek nabywcy w obu torach: SWIFT i opis.
- Etykieta `NrFaKorygowany` w obu torach: „Poprawny numer faktury korygowanej".

**Commit:** `FA_RR — dane podmiotu po korekcie w PDF, opisy rachunków, poprawiona etykieta numeru`

---

## Etap 7 — próbki, i18n, wersja, dokumentacja *(~0,5 dnia)*

**Próbki** (walidacja XSD wg pułapki 46):

- `samples/FA3_faktura_gtu_procedury.xml` — dopisać: drugi `TerminPlatnosci`, GLN w adresie korespondencyjnym i w miejscach wysyłki, zagraniczny identyfikator przewoźnika, `Zalacznik` z tabelą i `TMetaDane`.
- nowa próbka testowa korekty faktury zaliczkowej w EUR — `P_14_1W`, `KursWalutyZ`, `KursWalutyZK`, `P_15ZK`, `NrFaKorygowany`, zamówienie z `P_11VatZ`. Waluta jest cechą całego dokumentu, więc nie da się tego dopisać do próbki w PLN.
- `samples/FA_RR_korekta.xml` — `Podmiot1K` przy podmiocie z adresem korespondencyjnym i kontaktem, opis rachunku, rachunek nabywcy ze SWIFT.
- Zapłaty częściowe zostają w przypadkach testowych, nie w próbkach — wchodzą w `choice` z `Zaplacono` i w interakcję z `Rozliczenie`.

**i18n** — cztery słowniki, propozycje tłumaczeń do przejrzenia:

| Klucz | EN | DE | FR | UK |
|---|---|---|---|---|
| `zapłacono w części` | partially paid | teilweise bezahlt | payé partiellement | оплачено частково |
| `zapłacono w całości` | paid in full | vollständig bezahlt | payé intégralement | оплачено повністю |
| `Poprawny numer faktury korygowanej` | Correct number of the corrected invoice | Richtige Nummer der korrigierten Rechnung | Numéro correct de la facture rectifiée | Правильний номер скоригованої фактури |
| `Kurs waluty przed korektą` | Exchange rate before correction | Wechselkurs vor der Korrektur | Taux de change avant rectification | Курс валюти до коригування |

Wypadają: `(częściowa)`, `(wieloczęściowa)`, `płatność online` (link do płatności pokazuje teraz sam adres). `VAT(przel.)` zmienia się w `VAT w PLN` (decyzja 3). Reszta nowych miejsc korzysta z istniejących kluczy (`VAT`, `ID zagraniczny`, `bez identyfikatora podatkowego`, `Akcyza`, `Zał.15`, `Termin`).

**Wersja** — wszystkie miejsca z listy w CLAUDE.md, plus sanity check grepem.

**CLAUDE.md:**

- nowe pułapki: `getText` szuka na dowolnej głębokości → `getChildText` tam, gdzie nazwa występuje też głębiej; elementy powtarzalne czytamy listą, nie `[0]`; znaczenie `ZnacznikZaplatyCzesciowej`; `P_11VatZ` tylko z XML; wspólne funkcje list zamiast dwóch kopii;
- poprawić pułapkę 13 — twierdzi, że `UU_ID` jest wyświetlany, a od 1.6.13 nie jest;
- sekcja „Payment container": nowy warunek wyświetlenia i reguła kwoty;
- sekcja o testowaniu: trzy testy z tego planu.

**Commit:** `Wersja 1.8.8 — uzupełnione braki wizualizacji` (decyzja 4: jedno wydanie)

---

## Kryteria ukończenia

1. **Test pokrycia**, FA(3) i RR: lista „bez wpływu" zawiera wyłącznie pozycje z tabeli „To nie są braki".
2. **Test powtarzalnych**: zero pozycji.
3. **Przypadki płatności** (faktura VAT, `P_15` = 2051):

| Przypadek | Dziś | Po zmianie |
|---|---|---|
| zaliczka gotówką, faktura przelewem | „Forma: Gotówka", brak boksu przelewu | „Forma: Przelew", boks jest |
| zaliczka kartą, faktura bez formy | „Forma: Karta", brak boksu | brak wiersza „Forma", boks jest |
| zaliczka „inną formą" (kompensata), faktura przelewem | „Forma: Przelew" **i** „Inna forma: kompensata" | „Forma: Przelew"; „kompensata" przy zapłacie, w HTML i PDF |
| znacznik `2`, dwie zapłaty składające się na `P_15` | „(wieloczęściowa)", boks z kwotą 2 051,00 | „zapłacono w całości", brak boksu |
| znacznik `1`, zapłacono 1000 | „(częściowa)", boks z kwotą 2 051,00 | „zapłacono w części"; kwota wg decyzji 2 |

   Wszystkie wiersze potwierdzone w 1.8.8 (`tools/audyt/platnosc.js`, 15 przypadków). Wiersz 5 po decyzji 2: kwota 1 051,00 z rozbiciem „Należność 2 051,00 PLN − zapłacono 1 000,00 PLN", kod QR na 105100 groszy.

4. **Testy dymne z CLAUDE.md**: pięć języków, brak wyjątków, kwoty identyczne z wersją polską, kontrola kluczy i18n.
5. **Próbki** przechodzą walidację XSD.

---

## Ryzyko

- **Boks „Dane do przelewu".** To jedyna zmiana w tym planie, która może komuś podpowiedzieć kwotę przelewu inną niż dotąd. Dlatego kwota przy zapłacie częściowej jest decyzją, a nie zadaniem.
- **Szerokości tabel w PDF.** Tabela VAT dostaje piątą kolumnę, tabela zamówienia dziesiątą (albo zostaje przy dziewięciu, jeśli zniknie UUID). Sprawdzić na fakturze z długimi nazwami.
- **Refaktor list do wspólnych funkcji** dotyka kodu, który działa. Kolejność: najpierw wspólna funkcja o identycznym wyniku, test pokrycia bez zmian w wyniku, dopiero potem nowe pola.

---

## Decyzje (Jakub, 2026-09-30)

1. **`UU_ID` zostaje ukryty, `UU_IDZ` zostaje pokazany** w kolumnie „Numer umowy/UUID" — wystawcy wpisują tam numer pozycji zamówienia lub umowy, więc to nie jest wyłącznie identyfikator techniczny. Kolumna „VAT" w tabeli zamówienia doszła obok.
2. **Kwota w „Dane do przelewu" przy znaczniku `1`: „całość, czyli z rozbiciem"** — `P_15 − Σ zapłat częściowych` z widocznym rozbiciem; gdy suma zapłat nie jest mniejsza od `P_15`, zostaje `P_15` z dopiskiem, ile wykazano jako zapłacone. `DoZaplaty` z `Rozliczenia` ma pierwszeństwo.
3. **Tak** — RAZEM w kolumnie VAT przeliczonego to suma `P_14_xW`, nagłówek „VAT w PLN".
4. **Jedno wydanie: 1.8.8.**
5. **Skrypty testów zapisane lokalnie, niepublicznie** — `tools/audyt/` w katalogu projektu, katalog w `.gitignore`, nie wgrywa się go na serwer.

## Co wyszło inaczej niż w planie

- `NrFaKorygowany` nie trafił do nowej próbki EUR — korekta numeru faktury i korekta zaliczki to dwa różne zdarzenia, a jedna próbka mieszająca oba byłaby myląca. Pole sprawdza test pokrycia.
- Próbka EUR nie ma `PKOBZ`, `KwotaAkcyzyZ` ani `P_12Z_XII` — nie pasują do zamówienia maszyny. Też sprawdza je test pokrycia.
- Test pokrycia uzupełniły trzy kolejne: bezpieczeństwo toru HTML, sekcja płatności i test dymny z kontrolą polskich etykiet (wersaliki też) — wszystkie w `tools/audyt/`.
