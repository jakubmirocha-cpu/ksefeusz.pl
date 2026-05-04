# KSeFeusz.pl — Wizualizator faktur ustrukturyzowanych FA(3)

Darmowy, bezpieczny wizualizator faktur ustrukturyzowanych zgodnych ze schematem **FA(3)** Krajowego Systemu e-Faktur (KSeF). Działa w całości w przeglądarce — żadnych serwerów, żadnych ciasteczek, żadnych danych wysyłanych na zewnątrz.

🌐 **[ksefeusz.pl](https://ksefeusz.pl)**

---

## Funkcje

- **Pełna wizualizacja** — sprzedawca, nabywca, pozycje, korekty, VAT, płatności, adnotacje, warunki transakcji, QR kod weryfikacyjny i więcej
- **Generowanie PDF** — kompaktowy, czytelny wydruk gotowy do archiwizacji
- **Korekty** — widok par wierszy (przed/po) z wierszem różnic
- **Widok uproszczony / pełny** — domyślnie ukrywa sekcje bez danych
- **Przykładowe faktury** — trzy faktury z Ministerstwa Finansów do testów
- **Bezpieczeństwo** — plik XML nigdy nie opuszcza przeglądarki użytkownika

## Obsługiwany schemat

Struktura logiczna **FA(3)** — zgodna z aktualną wersją KSeF.
Schemat XSD: [Ministerstwo Finansów](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/struktura-logiczna-fa-3/)

## Uruchomienie lokalne

Nie wymaga instalacji ani serwera.

1. Pobierz repozytorium: kliknij **Code → Download ZIP** na tej stronie
2. Rozpakuj archiwum
3. Otwórz plik `index.html` w przeglądarce
4. Wczytaj plik `.xml` z fakturą KSeF

Lub przez git:

```bash
git clone https://github.com/jakubmirocha-cpu/ksefeusz.pl.git
```

## Struktura projektu

index.html          — strona główna
privacy.html        — polityka prywatności
css/
  style.css         — style strony (nav, hero, panele, footer)
  invoice.css       — style renderowania HTML faktury
  lib/              — Font Awesome (ikony)
  webfonts/         — pliki fontów
js/
  core.js           — parsowanie FA(3), słowniki
  utils.js          — funkcje pomocnicze, wersja aplikacji
  renderer.js       — renderowanie HTML faktury
  main.js           — generowanie PDF, obsługa zdarzeń
  upo.js	    - generowanie wizualizacji UPO
  lib/              — biblioteki zewnętrzne (pdfmake, qrcode, crypto-js)
samples/            — przykładowe faktury FA(3)
assets/             — grafiki (podgląd na stronie głównej)
documentations/     — schemat XSD i dokumentacja FA(3) z Ministerstwa Finansów

## Technologie

- Vanilla JavaScript (bez frameworków)
- [pdfmake](http://pdfmake.org/) — generowanie PDF
- [qrcode.js](https://github.com/davidshimjs/qrcodejs) — kod QR
- [crypto-js](https://github.com/brix/crypto-js) — SHA-256 do linku weryfikacyjnego KSeF
- [Font Awesome](https://fontawesome.com/) — ikony

## Licencja

Copyright © 2026 Jakub Mirocha / KSeFeusz.pl

Projekt udostępniany na licencji **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Oznacza to:

- ✅ Możesz używać, kopiować i modyfikować kod
- ✅ Możesz używać w celach komercyjnych (np. w swojej firmie do pracy z fakturami)
- ✅ Możesz dystrybuować zmodyfikowane wersje
- ⚠️ Musisz udostępnić kod źródłowy swoich zmian na tej samej licencji
- ⚠️ Jeśli udostępniasz to oprogramowanie przez sieć (SaaS), musisz opublikować kod źródłowy

Pełna treść licencji: [LICENSE](LICENSE)

## Kontakt

📧 [kontakt@ksefeusz.pl](mailto:kontakt@ksefeusz.pl)
🌐 [ksefeusz.pl](https://ksefeusz.pl)
