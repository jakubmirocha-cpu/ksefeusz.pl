# Polityka bezpieczeństwa

## Obsługiwane wersje

Poprawki bezpieczeństwa są wdrażane tylko do najnowszej wersji aplikacji dostępnej na [ksefeusz.pl](https://ksefeusz.pl).

## Zgłaszanie podatności

**Nie zgłaszaj podatności bezpieczeństwa publicznie przez Issues.**

Jeśli odkryłeś lukę bezpieczeństwa, napisz bezpośrednio na **kontakt@ksefeusz.pl** z tematem `[SECURITY]`. W wiadomości opisz:

- Rodzaj podatności (np. XSS, wyciек danych, błąd przetwarzania XML)
- Kroki do reprodukcji
- Potencjalny wpływ

Postaram się odpowiedzieć w ciągu 48 godzin i informować o postępach naprawy.

## Kontekst bezpieczeństwa

KSeFeusz.pl to aplikacja działająca **wyłącznie po stronie przeglądarki**:

- Żadne pliki XML ani dane faktur nie są wysyłane na zewnętrzne serwery
- Jedyne zewnętrzne żądanie sieciowe (na żądanie użytkownika) to weryfikacja rachunku bankowego w API Ministerstwa Finansów (`wl-api.mf.gov.pl`)
- Aplikacja nie używa cookies, localStorage ani żadnego mechanizmu przechowywania danych

Szczególnie istotne obszary: bezpieczne przetwarzanie XML (parser DOM przeglądarki, bez eval), poprawne sanitizowanie danych wyświetlanych w HTML.
