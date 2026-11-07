# Rezerwacja sal (`roombooking`)

Prosta aplikacja webowa do rezerwacji sal spotkań: REST API pod `/api/...` oraz jedna strona
w przeglądarce (`index.html`, `app.js`, `style.css`), która korzysta wyłącznie z tego API.
Dane trzymane są w bazie H2 w pamięci; przy każdym starcie wczytywane są dane startowe
z `data.sql` (4 sale i 4 rezerwacje z marca 2027).

Aplikacja jest pierwszą z aplikacji testowych do oceny narzędzia generującego testy
(rozdział 6 pracy). Została napisana jak zwykła aplikacja biznesowa z tej dziedziny,
bez dopasowywania kodu do narzędzia.

## Uruchomienie

Wymagana jest Java 17 lub nowsza. Z katalogu projektu:

```bash
./mvnw spring-boot:run
```

Strona: <http://localhost:8080>. API: <http://localhost:8080/api/rooms>,
<http://localhost:8080/api/bookings?date=2027-03-15>.

Zbudowanie jara bez testów: `./mvnw -DskipTests package` (plik `target/roombooking-0.0.1-SNAPSHOT.jar`).

## Punkty końcowe

| Metoda i ścieżka | Opis | Kody odpowiedzi |
|---|---|---|
| `GET /api/rooms` | lista sal posortowana po nazwie | 200 |
| `GET /api/rooms/{id}` | jedna sala | 200, 404 |
| `POST /api/rooms` | nowa sala | 201, 400, 422 |
| `PUT /api/rooms/{id}` | zmiana sali | 200, 400, 404, 422 |
| `GET /api/rooms/{id}/availability?date=YYYY-MM-DD` | dostępność sali co 30 minut | 200, 404 |
| `GET /api/bookings?date=YYYY-MM-DD&roomId=` | rezerwacje dnia (`roomId` opcjonalny) | 200 |
| `GET /api/bookings/{id}` | jedna rezerwacja | 200, 404 |
| `GET /api/bookings/by-organizer?email=` | rezerwacje organizatora | 200 |
| `POST /api/bookings/quote` | wycena bez zapisu (reguły R1–R4) | 200, 400, 404, 422 |
| `POST /api/bookings` | nowa rezerwacja (reguły R1–R6) | 201, 400, 404, 409, 422 |
| `POST /api/bookings/{id}/cancel` | anulowanie rezerwacji | 200, 404, 422 |

Każdy błąd ma postać `{"status": …, "error": …, "message": …}` bez znacznika czasu.
Błędy walidacji (400) mają w `message` listę `pole: komunikat` posortowaną po nazwie pola
i rozdzieloną `; `.

## Reguły rezerwacji

Sprawdzane w tej kolejności, każda z własnym komunikatem:

- **R1** — sala musi istnieć (404).
- **R2** — początek wcześniej niż koniec, obie godziny o pełnej godzinie lub w połowie
  godziny, czas trwania od 1 do 8 godzin (422).
- **R3** — rezerwacja mieści się w godzinach otwarcia sali (422).
- **R4** — liczba osób nie przekracza pojemności sali (422).
- **R5** — początek rezerwacji nie jest w przeszłości (422).
- **R6** — brak nakładania z potwierdzonymi rezerwacjami tej sali tego dnia; przedziały są
  półotwarte, więc rezerwacje przylegające są dozwolone (409).

Wycena (`/quote`) sprawdza R1–R4, utworzenie rezerwacji R1–R6.

Anulowanie: rezerwacja musi istnieć i być potwierdzona, a jej początek jeszcze nie minął.
Przy anulowaniu co najmniej 24 h przed początkiem opłata wynosi 0, później 50% ceny.
Odpowiedź zawiera opłatę i kwotę zwrotu.

## Cennik

1. Godziny = minuty między początkiem a końcem podzielone przez 60.
2. Cena bazowa = godziny × cena sali za godzinę.
3. Dopłata weekendowa = 25% ceny bazowej w sobotę i niedzielę, w pozostałe dni 0.
4. Rabat = 10% z (cena bazowa + dopłata) przy rezerwacji na co najmniej 4 godziny, inaczej 0.
5. Razem = cena bazowa + dopłata − rabat.

Wszystkie kwoty mają dwa miejsca po przecinku (zaokrąglenie `HALF_UP`).

## Profil aplikacji

| Cecha | Wartość |
|---|---|
| Spring Boot | 3.5.16 |
| Java w `pom.xml` | 17 |
| Pakiet bazowy | `pl.meetings.roombooking` |
| Lombok | nie (rekordy, ręczne gettery i settery) |
| Dane | Spring Data JPA + H2 w pamięci, `data.sql` |
| Układ pakietów | według funkcji: `room`, `booking`, `pricing`, `common` |
| Serwisy | interfejs + klasa `…Impl` |
| Wstrzykiwanie | przez konstruktor |
| Obsługa błędów | metody `@ExceptionHandler` w każdym kontrolerze, odpowiedź `ResponseEntity<ErrorResponse>` |
| Walidacja | Bean Validation |
| Bieżący czas | tylko przez `TimeProvider` (bean `Clock`) |

Daty w danych startowych i w scenariuszu są stałe (marzec 2027), dzięki czemu
„rezerwacja w przyszłości” pozostaje prawdziwa, a nagranie jest powtarzalne.

## Scenariusz pomiarowy

Skrypt `eval/record-roombooking.sh` wykonuje 18 żądań do działającej aplikacji
(adres z `BASE_URL`, domyślnie `http://localhost:8080`), porównuje kody odpowiedzi
z oczekiwanymi i kończy się linią `ok=<n> bad=<n>`. Nagranie robi agent narzędzia:

```bash
./mvnw -DskipTests package testgen:record
```

a w drugim terminalu:

```bash
bash eval/record-roombooking.sh
```

Skrypt nie pobiera plików strony, więc w nagraniu są tylko żądania do API.
Profil Mavena `eval` (`./mvnw -Peval …`) dodaje JaCoCo i PIT na potrzeby pomiarów;
bez `-Peval` build pozostaje bez zmian.

Celowo nieodwiedzone w scenariuszu:

- `PUT /api/rooms/{id}`,
- `GET /api/bookings/by-organizer`,
- dopłata weekendowa,
- przekroczenie pojemności sali (R4),
- rezerwacja w przeszłości (R5),
- zły krok minut i czas trwania poza 1–8 h (R2),
- anulowanie z opłatą 50%,
- anulowanie rozpoczętej rezerwacji,
- zajęta nazwa sali.

## Zamrożenie kodu

Po nagraniu scenariusza kod aplikacji jest zamrożony: każda późniejsza zmiana oznacza nową
wersję aplikacji i powtórzenie wszystkich przebiegów pomiarowych. Nie należy też uruchamiać
`mvn clean`, bo kasuje `target/test-generation`.
