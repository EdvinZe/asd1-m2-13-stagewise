# Plan obrony — ASD1-M2-13

## Kolejność wymagana w zadaniu

1. Pokaż 10 slajdów w `presentation/presentation.html` lub PDF.
2. Otwórz działające `index.html`, nie sam zrzut.
3. Laboratorium ASD → **Przykład kontrolny A/B** → potwierdź.
4. Porównanie: A = 320 s, Σ|Δ|=40 s; B = 300 s, Σ|Δ|=10 s. B bliższa planowi o 30 s.
5. Wyjaśnij wynik pośredni: treść A ma 200−180 = +20 s; największy moduł daje pierwsze miejsce rankingu.
6. Historia → edytuj B → wstęp z 60 na 90 → zapisz. Wynik B: |30|+|5|+|−5|=40 s. Z A jest remis.
7. Pokaż przypadek błędny: w nowej próbie pozostaw puste pole albo wpisz 7201. Nie nastąpi zapis. Możesz również zaimportować plik z błędnym JSON — dotychczasowy zestaw zostaje.
8. Uruchom `node tests/run.cjs` oraz `node tools/benchmark.cjs`.
9. Otwórz `app/algorithms.js`, wyjaśnij pętlę wyszukiwania, licznik i `compareParts`.

## Fragmenty do zrozumienia

### Dlaczego suma modułów?

Plan [60,180,60], wykonanie [80,160,60] → Δ=[20,−20,0]. Łączny czas 300 s zgadza się z planem, lecz dwie części mają złe proporcje. ΣΔ=0, ale Σ|Δ|=40 s. Mniejszy wynik jest lepszy. To nie procent jakości wystąpienia ani analiza treści.

### Jak działa `compareParts`?

`abs(right.deviation) - abs(left.deviation)` ustawia większy moduł wcześniej. Jeżeli różnica wynosi zero, `left.order - right.order` ustawia wcześniejszą część planu wcześniej. Znak samego odchylenia nie ustala ważności, ale mówi, czy skrócić, czy wydłużyć część.

### Dlaczego przy A są dwa porównania?

- Treść (+20) jest kluczem. Wstęp (+10) trzeba przesunąć w prawo: pierwsze porównanie.
- Klucz trafia na indeks 0; test `j>=0` nie jest porównaniem kluczy i nie zwiększa licznika.
- Zakończenie (−10) porównujemy ze wstępem (+10): moduły równe, wstęp ma wcześniejszą kolejność. Stop: drugie porównanie.

W roboczej tablicy podczas przesuwania może być dwa razy ten sam element. Klucz w tym czasie jest zachowany w osobnej zmiennej — dane nie zostały zgubione.

### Koszty i listy

- Tablice rekordów reprezentują listy; relacje wykorzystują ID. Części porządkuje pole `order`.
- Wyliczenie różnic i sum: O(p).
- Własne wstawianie: najlepszy O(p), najgorszy O(p²). Kopia tablicy O(p). Kopie stanów śladu to dodatkowy narzut dydaktyczny.
- Własne wyszukiwanie pierwszego dopasowania: O(t), dodatkowa pamięć O(1). Licznik rośnie przed sprawdzeniem ID, dlatego obejmuje trafiony rekord.

### Dlaczego import nie niszczy pracy?

`importJSON` najpierw parsuje i sprawdza wszystkie rekordy i relacje. Potwierdzenie dotyczy już gotowego, poprawnego kandydata. Dopiero potem `commit` podmienia stan. Transakcje edycji też pracują na kopii. Anulowanie lub wyjątek pozostawia poprzednią pracę.

## Ćwiczenia samodzielne przed obroną

1. Utwórz własne wystąpienie z trzema częściami i wykonaj dwie próby, jedną stoperem, drugą ręcznie.
2. Wyeksportuj JSON, zamknij stronę i odtwórz dane przez import.
3. Wyjaśnij wiersz wyniku i ranking bez czytania notatek.
4. W kopii kodu zmień regułę remisu z kolejności rosnącej na malejącą. Sprawdź, które testy wykryją zmianę; potem przywróć wymaganą regułę.
5. Uruchom testy osobiście i opisz własną weryfikację dopiero po jej faktycznym wykonaniu.

## AI

Powiedz uczciwie: użyto OpenAI Codex / OpenClaw do kodu, wyglądu, testów i dokumentów. Wyniki w dostarczonym projekcie uzyskał asystent. Opisz własne zmiany i kontrole wyłącznie wtedy, gdy rzeczywiście je wykonasz.
