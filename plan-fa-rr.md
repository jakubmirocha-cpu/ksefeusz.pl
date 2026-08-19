# Plan wdrożenia FA_RR — faktury VAT RR (rolnik ryczałtowy)

Wersja docelowa: **1.8.0**
Schemat: `schemat_FA_RR(1)_v1-1E.xsd`, namespace `http://crd.gov.pl/wzor/2026/03/06/14189/`
Źródło: https://github.com/CIRFMF/ksef-api/blob/main/faktury/schemy/RR/

Szacunek: **~3,5 dnia, 6 commitów, ~1000 linii.**

---

## Ustalenia ze schematu, które zmieniają projekt

| Fakt | Konsekwencja |
|---|---|
| **`Podmiot1` = dostawca (rolnik), `Podmiot2` = nabywca — i to nabywca wystawia fakturę** (art. 116 ustawy o VAT) | Cały kierunek dokumentu jest odwrócony. Nagłówki sekcji nie mogą brzmieć „Sprzedawca / Nabywca" bez kwalifikatora. Numer KSeF, link weryfikacyjny i data wystawienia odnoszą się do **nabywcy** |
| `RachunekBankowy1` = *rachunek rolnika*, `RachunekBankowy2` = *rachunek nabywcy* | Payment container bierze `RachunekBankowy1` (rolnik jest odbiorcą przelewu), NIP do białej listy to NIP **Podmiot1**, ale wystawcą jest Podmiot2 — inaczej niż w FA(3), gdzie to zawsze ten sam podmiot |
| `TFormaPlatnosci` ma **jedną wartość: `1` = przelew** | Warunek `formaPlatnosci === "6"` w payment container to w RR martwy kod → guard trzeba sparametryzować |
| `TPodmiot1` = **`NIP` + `Nazwa`, oba wymagane** | Brak wariantu `BrakID`/`IDWew` (te są tylko w `Podmiot3`) → biała lista i link weryfikacyjny działają zawsze, bez guardów na brakujący NIP |
| `TStawkaPodatku` (`P_9`) = **tylko `6.5` i `7`** | Słownik dwuelementowy, żadnych zwolnień ani stawek specjalnych |
| **Dokument wyłącznie krajowy** | Brak tłumaczeń — patrz „Decyzja: bez i18n" niżej |

Czego w schemacie **nie ma** (czyli czego nie piszemy): `Adnotacje`, `WarunkiTransakcji`, `Zamowienie`, `Zalacznik`, `PodmiotUpowazniony`, `Zwolnienie`, `PMarzy`, `NoweSrodkiTransportu`, GTU, zaliczek, `Skonto`, `ZaplataCzesciowa`, `Umowy`, `Transport`.

Zostaje: `Naglowek`, `Podmiot1/2/3`, `FakturaRR`, `FakturaRRWiersz`, `Rozliczenie`, `Platnosc`, `DokumentZaplaty`, `DodatkowyOpis`, `Stopka`.

---

## Decyzja: bez i18n

Faktura VAT RR to konstrukcja art. 116 polskiej ustawy o VAT — wystawia ją polski podatnik VAT nabywający produkty rolne od **polskiego rolnika ryczałtowego**. Zagraniczny podmiot nie ma jak jej wystawić, a zryczałtowany zwrot podatku 6,5%/7% poza polskim systemem nie występuje. Tłumaczenie takiego dokumentu na EN/DE/FR/UK nie ma odbiorcy.

Precedens w projekcie: wizualizator UPO również jest świadomie tylko po polsku.

**Konsekwencja UI:** przy załadowanej fakturze RR przełącznik języka musi być **ukryty**, nie tylko bezczynny (zadanie w etapie 5).

---

## Etap 0 — fundament: router namespace + próbki *(~0,5 dnia)*

**Problem architektoniczny do rozstrzygnięcia na starcie.** Cały `core.js` czyta globalną stałą `const ns` (core.js:8). Trzy opcje:

1. `parsePodmiot(node, typ, nsArg = ns)` — przewlekanie parametru przez ~15 funkcji. Bezpieczne, ale rozdmuchuje diff i każde wywołanie.
2. `let ns` ustawiane przez router przed parsowaniem dokumentu. Diff jednolinijkowy, działa bo parsowanie jest **w pełni synchroniczne** (także w batchu — pętla nie ma `await` między dokumentami).
3. Osobny `js/rr.js` z własnym kompletem parserów, na wzór `upo.js`. Zero ryzyka, ale duplikuje `parsePodmiot`, `parsePlatnosc`, `parseRozliczenie`, `parseStopka`.

**Rekomendacja: opcja 2.** Wspólne parsery to realna wartość — `Podmiot`, `Platnosc`, `Rozliczenie`, `Stopka` i `TKluczWartosc` są w RR **identyczne co do nazw pól**, więc `parsePodmiot` przechodzi bez jednej zmiany. Warunek: opisać w CLAUDE.md jako pułapkę („`ns` jest zmienne, ustawia je router; nie parsuj dwóch dokumentów naraz").

Zadania:
- `js/core.js`: `const ns` → `let ns`, plus `const NS_FA3` / `NS_FA_RR = 'http://crd.gov.pl/wzor/2026/03/06/14189/'` i `function setDocNs(uri)`.
- Router `detectDocType(xmlDom)` → `'FA3' | 'FA_RR' | 'UPO' | null`, po `documentElement.namespaceURI`. Podpiąć w trzech miejscach, gdzie dziś jest twarde `if (rootNs !== ns) throw` — main.js:1636 + ścieżka batch + drag&drop w inline `<script>`.
- `samples/FA_RR_przyklad.xml` i `samples/FA_RR_korekta.xml` — napisane ręcznie, **zwalidowane `xmllint --schema`** przeciw pobranemu XSD (jednorazowo, poza repo). Korekta musi mieć pary `StanPrzed` + `UU_ID`, żeby przetestować parowanie.

**Commit:** `Router typu dokumentu po namespace + próbki FA_RR`

---

## Etap 1 — parsowanie *(~0,5 dnia)*

Nowe w `core.js` (obok istniejących, nie zamiast):

```js
parseFakturaRR(node)       // odpowiednik parseFa
parseFakturaRRWiersz(node) // odpowiednik parseFaWiersz
```

`parseFakturaRR` zwraca `rrData` o **świadomie zbliżonych nazwach pól** do `faData`, żeby renderer mógł dzielić kod tam, gdzie to ma sens:

```
kodWaluty, kursWaluty, miejsceWystawienia (P_1M),
dataNabycia (P_4A), dataWystawienia (P_4B), nrFaktury (P_4C),
wartoscNabycia (P_11_1, +W), zwrotZryczaltowany (P_11_2, +W),
naleznoscOgolem (P_12_1, +W), naleznoscSlownie (P_12_2),
rodzaj ('VAT_RR' | 'KOR_VAT_RR'), rodzajDisplay,
przyczynaKorekty, typKorekty, typKorektyDisplay,
daneFaKorygowanej[], podmiot1K, podmiot2K,
dokumentyZaplaty[], dodatkoweOpisy[], wiersze[]
```

Wiersz: `nrWierszaFa, uuId, dataNabycia (P_4AA), nazwa (P_5), gtin, pkwiu, cn, jednostka (P_6A), ilosc (P_6B), klasa (P_6C), cena (P_7), wartoscBez (P_8), stawkaZwrotu (P_9), kwotaZwrotu (P_10), wartoscZ (P_11), stanPrzed`.

**`P_12_2` (kwota słownie)** — `TZnakowy`, tekst wystawcy. Pole nie istnieje w FA(3), więc to nowy element wizualizacji.

Nowe słowniki kodów:
- `rrStawkaMap = { '6.5': '6,5%', '7': '7%' }`
- `rrPaymentMap = { '1': 'przelew' }` — osobna mapa, bo kolizja numeracji z FA(3) (tam `1` = gotówka).

**Commit:** `Parsowanie FA_RR w core.js`

---

## Etap 2 — renderer HTML *(~1 dzień)*

Nowa funkcja `renderRR(xml, fileName, xmlContent)` w `renderer.js`, wołana przez router. **Nie przerabiamy `render()` na warunki `if (typ === 'RR')`** — dokument jest inny na tyle, że rozgałęzianie w środku 900-linijkowej funkcji byłoby gorsze niż drugie wejście.

Co się przenosi bez zmian (wywołanie funkcji, nie kopiowanie):
- sekcje podmiotów wraz z twardym 50/50 z v1.6.18
- `Podmiot3`, `Stopka`, `Rejestry`, `DodatkowyOpis`, `Rozliczenie`
- QR + link weryfikacyjny KSeF (`generateVerificationUrl`, `calculateXmlHash`) — mechanizm identyczny, **NIP bierzemy od wystawcy, czyli Podmiot2**
- payment container z białą listą i QR ZBP — z poprawkami z tabelki „Ustalenia"

Co nowe:
1. **Nagłówki sekcji podmiotów**: „Rolnik ryczałtowy (dostawca)" / „Nabywca (wystawca faktury)". Bez tego dokument jest nieczytelny dla kogoś, kto pierwszy raz widzi VAT RR.
2. **Tabela pozycji** — kolumny: Lp. | Nazwa | Klasa/jakość | J.m. | Ilość | Cena jedn. | Wartość | Stawka zwrotu | Kwota zwrotu | Wartość ze zwrotem. Kolumna „Klasa/jakość" (`P_6C`) jest **wymagana w schemacie**, więc zawsze widoczna. `GTIN`/`PKWiU`/`CN`/`UU_ID`/`P_4AA` → do `dodatki[]` pod wierszem, jak dziś.
3. **Podsumowanie zamiast tabelki VAT** — trzy wiersze: Wartość nabycia (`P_11_1`) / Zryczałtowany zwrot podatku (`P_11_2`) / **Należność ogółem (`P_12_1`)**, plus linia słownie (`P_12_2`) i kolumna `…W` gdy waluta obca.
4. **`DokumentZaplaty`** — sekcja „Dokumenty zapłaty" (nr + data). W VAT RR to nie ozdobnik: bez dowodu zapłaty nabywca nie odlicza zwrotu, więc warto wyeksponować.
5. Baner informacyjny w trybie pełnym: jedno zdanie, czym jest faktura VAT RR i że wystawia ją nabywca.

Guardy z v1.6.19 (`wiersze.length === 0`, puste podsumowanie) przenosimy — korekta samych danych rolnika bez wierszy jest w RR legalna.

**Commit:** `Wizualizacja HTML faktur VAT RR`

---

## Etap 3 — PDF *(~1 dzień)*

`generateRRPdfWithPdfMake()` w `main.js`, lustrzane do etapu 2. Reużywamy `pdfSectionHeader`, `pdfBox`, `pdfTwoBox` (ze stałą `COL_W` z v1.6.18), `pdfCreateGrid`, `pdfKvTable`, nagłówek/stopkę stron, `sanitizeSellerName`.

**Decyzja do podjęcia: nazwa pliku PDF.** Dziś `{numer}_{nazwaSprzedawcy}.pdf`. W RR „sprzedawcą" jest rolnik, ale plik porządkuje **nabywca** (bo to on wystawia i archiwizuje). Propozycja: `{P_4C}_{nazwaRolnika}.pdf` — konsekwentnie „druga strona transakcji", tak jak dziś.

**Commit:** `Eksport PDF faktur VAT RR`

---

## Etap 4 — korekty *(~0,5 dnia)*

`KOR_VAT_RR` używa **dokładnie tego samego mechanizmu** co FA(3) — `StanPrzed`, `UU_ID`, `GTIN`, `NrWierszaFa`. `groupCorrectionRows` przenosi się 1:1, wystarczy zmapować nazwy pól (`cenaNetto`→`cena`, `kwotaNetto`→`wartoscBez`, `ilosc`→`ilosc`).

Dwie nadbudowy do przemapowania:
- **Bramka RÓŻNICY** (`correctionDiffRowsAllowed`): deklaracja to teraz `P_11_1` (wartość nabycia), `P_11_2` (zwrot), `P_12_1` (ogółem) zamiast `ΣP_13 / ΣP_14 / P_15`. Cała logika (pomijanie `single, isBefore=false`, tolerancja 0,02, wyjście przy braku par) zostaje bez zmian — punkty 22 i 23 z CLAUDE.md obowiązują tak samo.
- **Walidator spójności nagłówka**: `P_11_1 + P_11_2 = P_12_1`. **Prostszy i mocniejszy niż w FA(3)** — nie ma guardów na faktury rozliczeniowe ani zaliczki, bo w RR takich nie ma. Zostaje jeden: przy korekcie wszystkie trzy pola to kwoty różnicy, więc mogą być ujemne — porównanie działa, ale trzeba dopuścić znak.

Wiersz RÓŻNICA w tabeli RR pokazuje delty: ilość, cena, wartość bez zwrotu, kwota zwrotu, wartość ze zwrotem. Kolumna „Stawka zwrotu" → `—` gdy stawka się zmieniła (analogicznie do punktu 15 z CLAUDE.md, tu przypadek 6,5% ↔ 7%).

**Commit:** `Korekty VAT RR — parowanie wierszy, bramka RÓŻNICY, walidator P_11_1+P_11_2=P_12_1`

---

## Etap 5 — UI strony *(~0,5 dnia)*

- Rozpoznanie typu jest automatyczne, więc **nie dodajemy nowej zakładki** — użytkownik wrzuca plik tam, gdzie zawsze. Osobna zakładka „Faktury RR" sugerowałaby, że trzeba wiedzieć z góry, co się ma.
- **Ukrycie przełącznika języka przy fakturze RR** — wszystkie trzy kontrolki (`#invoiceLang`, `#invoiceLangPdf`, `#invoiceLangBatch`). Dla wizualizatora: ukryć po rozpoznaniu typu dokumentu. Dla paneli PDF/batch: typ znany dopiero po wczytaniu pliku, więc przełącznik zostaje widoczny, a wybrany język jest ignorowany dla plików RR — do przemyślenia przy implementacji, czy nie dodać krótkiej adnotacji przy pasku.
- Przycisk próbki „Faktura VAT RR" w sekcji przykładów, obok istniejących.
- Batch: obsłużyć mieszaną kolejkę FA(3) + RR (router per plik — wychodzi za darmo z etapu 0).
- Komunikat błędu dla nieznanego namespace: wymienić obsługiwane typy zamiast dzisiejszego „Nieobsługiwana przestrzeń nazw faktury".
- FAQ + meta description: jedno zdanie o obsłudze VAT RR. To jedyne miejsce, gdzie ta funkcja jest w ogóle wyszukiwalna.

**Commit:** `Integracja FA_RR z UI, batch i przykładami`

---

## Etap 6 — wersja i dokumentacja *(~0,5 dnia)*

- Bump do **1.8.0** we wszystkich 9 miejscach z listy w CLAUDE.md + `Grep "1\.7\."` jako sanity check.
- CLAUDE.md: nowa sekcja „FA_RR — faktury dla rolnika ryczałtowego" (struktura, mapowanie pól, różnice wobec FA(3), decyzja o braku i18n) + **nowe pułapki**:
  - `ns` jest zmienne, ustawia je router; nie parsuj dwóch dokumentów naraz
  - odwrócone role podmiotów (wystawcą jest nabywca)
  - `FormaPlatnosci = 1` w RR vs `6` w FA(3)
  - `RachunekBankowy1` to rachunek rolnika, `RachunekBankowy2` nabywcy
- Testy dymne jsdom (jak przy i18n): renderowanie obu próbek, HTML + PDF, brak wyjątków.

---

## Ryzyko

Największe ryzyko nie jest techniczne, tylko dziedzinowe: musimy poprawnie oddać, że w VAT RR fakturę wystawia nabywca, a płatność idzie do rolnika. Pomylenie kierunku da dokument, który wygląda dobrze i jest merytorycznie odwrócony. Dlatego zaczynamy od próbek XML zwalidowanych przeciw XSD (etap 0), a nie od kodu.

## Do decyzji przed startem

1. **Zmienne `ns`** (opcja 2) czy osobny `js/rr.js` z duplikatami parserów?
2. **Nazwa pliku PDF** — `{P_4C}_{nazwaRolnika}.pdf`?
3. **Wersja 1.8.0** czy 1.7.x, jeśli i18n jeszcze nie wyszło na produkcję?
