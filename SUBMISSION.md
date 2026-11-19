# Mapa wymagań i oddanie

| Wymaganie | Realizacja / dowód |
|---|---|
| Plan, kolejność, czasy części | Plan wystąpienia; model.js; kontrola przeglądarki |
| Start/stop i ręczne sekundy | Nowa próba; timer.js; test zegara i realny stoper |
| Wiele kompletnych prób i notatki | Historia; model.saveTrial; brak częściowych zapisów |
| Plan vs wykonanie części i całości | Karty prób, Porównanie, summarizeTrial |
| Ranking modułów i remis kolejności | Pulpit, Laboratorium, compareParts + insertionSort |
| Dwie wybrane próby i uczciwy remis | Porównanie; compareTrials; test remisów |
| Własne wyszukiwanie i sortowanie | algorithms.js; osobne funkcje bez bibliotecznego sort w produkcie |
| Liczniki i przed → decyzja → po | Laboratorium; rzeczywisty ślad i liczniki |
| Kontrolny przykład i edycja danych | Scenariusz A/B, edytowanie w Historii |
| Walidacja, ID, 1000 rekordów | model.js; testy odrzuceń; duży zestaw w UI |
| JSON z wersją i atomowy import | model.js + ui.js; testy błędu i anulowania |
| 3 scenariusze | control, boundary, large w data/ i przyciskach |
| 10/100/1000, wzorzec, powtarzalność | benchmark.json; laboratorium; PDF strona 8 |
| Szukanie początek/koniec/brak | benchmark.json; testy i licznik w UI |
| Co najmniej 8 automatycznych testów | 36 przypadków domenowych, 23 kontrole przeglądarkowe |
| Lokalna demonstracja z czystej kopii | index.html, bez zależności aplikacji; kontrola pakietu |
| Dokładnie 10 slajdów | presentation.html i presentation.pdf |
| Dokładnie 10 stron PDF po polsku | docs/documentation.pdf; results/documents.json |
| Własne zrzuty i podpisy | docs/*.png, ilustracje w PDF i prezentacji |
| README, źródła i AI | README, PDF strona 10, slajd 9 |
| GitHub i oznaczenie commitu | repo poniżej; tag m2-v1.0.0; SHA w ODDANIE.txt w ZIP |
| Dodatkowy wykres zgodności | Pulpit — ostatnie 12 prób |

## Link do osobnego pola „Linki”

https://github.com/EdvinZe/asd1-m2-13-stagewise

Wersja: **m2-v1.0.0**. Pełny commit: `git rev-parse 'm2-v1.0.0^{commit}'`; SHA jest też podany wraz z gotowym archiwum.

## Czynności po stronie oddającego

- Rozpakować projekt i sprawdzić `index.html`; uruchomić testy samodzielnie.
- Jeśli repozytorium jest prywatne, nadać dostęp prowadzącemu. Jego loginu nie podano w zadaniu.
- W Dzienniku dodać wymagane pliki: aplikację z kodem/danymi/testami/README, osobną prezentację, dokumentację PDF. Sam link nie zastępuje plików.
- Osobno wkleić powyższy adres w polu „Linki”, podać SHA wersji oddawanej.
- Sprawdzić aktualny termin i limity formularza w Dzienniku. Karta podaje 23.11.2026, 23:59 oraz obronę 25.11.2026, 08:30–11:40; bieżącego formularza nie weryfikowano.
- Przećwiczyć scenariusz `DEFENSE.md`, rozumieć kod i uczciwie opisać pomoc AI oraz własne faktycznie wykonane zmiany.

Nie wysłano pracy do Dziennika, nie potwierdzono dostępu prowadzącego i nie deklarowano osobistej weryfikacji przez studenta.
