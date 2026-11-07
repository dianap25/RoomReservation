# Rezerwacja sal (`roombooking`)

Prosta aplikacja webowa do rezerwacji sal spotkań: REST API pod `/api/...` oraz jedna strona
w przeglądarce (`index.html`, `app.js`, `style.css`), która korzysta wyłącznie z tego API.
Dostęp do API wymaga zalogowania (HTTP Basic); każdy użytkownik widzi i anuluje tylko własne
rezerwacje. Nowa rezerwacja jest **oczekująca** i blokuje termin, a administrator ją potwierdza
albo anuluje; administrator zarządza też salami. Dane trzymane są w bazie H2 w pamięci; przy
każdym starcie wczytywane są dane startowe z `data.sql` (4 sale, 5 rezerwacji z marca 2027,
w tym jedna oczekująca, 4 konta).

Aplikacja jest pierwszą z aplikacji testowych do oceny narzędzia generującego testy
(rozdział 6 pracy). Została napisana jak zwykła aplikacja biznesowa z tej dziedziny,
bez dopasowywania kodu do narzędzia.

## Uruchomienie

Wymagana jest Java 17 lub nowsza. Z katalogu projektu:

```bash
./mvnw spring-boot:run
```

Strona: <http://localhost:8080>. API: <http://localhost:8080/api/rooms>,
<http://localhost:8080/api/bookings?date=2027-03-15> (po zalogowaniu).

Zbudowanie jara bez testów: `./mvnw -DskipTests package` (plik `target/roombooking-0.0.1-SNAPSHOT.jar`).

### Konta testowe

| E-mail (login) | Hasło | Rola |
|---|---|---|
| `anna.nowak@firma.pl` | `haslo-anna` | USER |
| `jan.kowalski@firma.pl` | `haslo-jan` | USER |
| `piotr.zielinski@firma.pl` | `haslo-piotr` | USER |
| `admin@firma.pl` | `haslo-admin` | ADMIN |

Hasła są zapisane w `data.sql` jako hasze BCrypt. Z `curl` loguje się opcją `-u`, np.
`curl -u anna.nowak@firma.pl:haslo-anna http://localhost:8080/api/me`.

## Logowanie i uprawnienia

- API jest bezstanowe: każde żądanie niesie nagłówek `Authorization: Basic …`; nie ma sesji
  ani cookie. Pliki strony (`/`, `index.html`, `app.js`, `style.css`) są publiczne.
- Brak lub złe dane logowania → 401 (`Wymagane logowanie` albo `Nieprawidłowy e-mail lub hasło`),
  bez nagłówka `WWW-Authenticate`, żeby przeglądarka nie otwierała własnego okna.
- Tworzenie i edycja sal (`POST`, `PUT /api/rooms`) wymaga roli ADMIN, inaczej 403
  (`Brak uprawnień do tej operacji`).
- Rezerwacje: lista dnia, podgląd, `mine` i anulowanie dotyczą wyłącznie rezerwacji zalogowanego
  użytkownika; cudza rezerwacja → 403 (`Brak dostępu do tej rezerwacji`). Organizator nowej
  rezerwacji to zawsze zalogowany użytkownik (imię i nazwisko oraz e-mail z konta).
- Administrator (`/api/admin/bookings`, inne role → 403) widzi rezerwacje wszystkich użytkowników
  i listę oczekujących, potwierdza oczekujące i anuluje oczekujące lub potwierdzone, zawsze bez
  opłaty.
- Dostępność sal (`/availability`) pokazuje zajętość wszystkich potwierdzonych rezerwacji,
  bez danych ich organizatorów.

## Punkty końcowe

Wszystkie poza plikami strony wymagają zalogowania (401 bez poprawnych danych).

| Metoda i ścieżka | Opis | Kody odpowiedzi |
|---|---|---|
| `GET /api/me` | zalogowany użytkownik (e-mail, nazwa, rola) | 200 |
| `GET /api/rooms` | lista sal posortowana po nazwie | 200 |
| `GET /api/rooms/{id}` | jedna sala | 200, 404 |
| `POST /api/rooms` | nowa sala (tylko ADMIN) | 201, 400, 403, 422 |
| `PUT /api/rooms/{id}` | zmiana sali (tylko ADMIN) | 200, 400, 403, 404, 422 |
| `GET /api/rooms/{id}/availability?date=YYYY-MM-DD` | dostępność sali co 30 minut | 200, 404 |
| `GET /api/bookings?date=YYYY-MM-DD&roomId=` | własne rezerwacje dnia (`roomId` opcjonalny) | 200 |
| `GET /api/bookings/mine` | wszystkie własne rezerwacje | 200 |
| `GET /api/bookings/{id}` | jedna własna rezerwacja | 200, 403, 404 |
| `POST /api/bookings/quote` | wycena bez zapisu (reguły R1–R4) | 200, 400, 404, 422 |
| `POST /api/bookings` | nowa rezerwacja (reguły R1–R6) | 201, 400, 404, 409, 422 |
| `POST /api/bookings/{id}/cancel` | anulowanie własnej rezerwacji | 200, 403, 404, 422 |
| `GET /api/admin/bookings?date=YYYY-MM-DD` | rezerwacje dnia wszystkich użytkowników (ADMIN) | 200, 403 |
| `GET /api/admin/bookings/pending` | oczekujące rezerwacje, po dacie i godzinie (ADMIN) | 200, 403 |
| `POST /api/admin/bookings/{id}/confirm` | potwierdzenie oczekującej rezerwacji (ADMIN) | 200, 403, 404, 422 |
| `POST /api/admin/bookings/{id}/cancel` | anulowanie rezerwacji bez opłaty (ADMIN) | 200, 403, 404, 422 |

Każdy błąd ma postać `{"status": …, "error": …, "message": …}` bez znacznika czasu, także 401
i 403 zwracane przez warstwę zabezpieczeń. Błędy walidacji (400) mają w `message` listę
`pole: komunikat` posortowaną po nazwie pola i rozdzieloną `; `.

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

Statusy: nowa rezerwacja jest **oczekująca** (`PENDING`); administrator zmienia ją na
**potwierdzoną** (`CONFIRMED`) albo **anulowaną** (`CANCELLED`). Oczekujące i potwierdzone
rezerwacje blokują termin w sprawdzaniu nakładania (R6) i w siatce dostępności. Potwierdzić
można tylko rezerwację oczekującą (inaczej 422).

Anulowanie przez użytkownika: rezerwacja musi należeć do zalogowanego użytkownika, istnieć,
nie być anulowana, a jej początek jeszcze nie minął. Oczekująca jest anulowana bez opłaty;
przy potwierdzonej opłata wynosi 0 co najmniej 24 h przed początkiem, później 50% ceny.
Anulowanie przez administratora jest zawsze bez opłaty. Odpowiedź zawiera opłatę i kwotę
zwrotu.

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
| Układ pakietów | według funkcji: `room`, `booking`, `pricing`, `user`, `security`, `common` |
| Serwisy | interfejs + klasa `…Impl` |
| Wstrzykiwanie | przez konstruktor |
| Obsługa błędów | metody `@ExceptionHandler` w każdym kontrolerze, odpowiedź `ResponseEntity<ErrorResponse>` |
| Walidacja | Bean Validation |
| Zabezpieczenia | Spring Security, HTTP Basic bez sesji, hasła BCrypt, role USER i ADMIN |
| Bieżący czas | tylko przez `TimeProvider` (bean `Clock`) |

Daty w danych startowych i w scenariuszu są stałe (marzec 2027), dzięki czemu
„rezerwacja w przyszłości” pozostaje prawdziwa, a nagranie jest powtarzalne.

## Scenariusz pomiarowy

Skrypt `eval/record-roombooking.sh` wykonuje 31 żądań do działającej aplikacji
(adres z `BASE_URL`, domyślnie `http://localhost:8080`), logując się kontami testowymi
z tabeli powyżej (pierwsze żądanie celowo bez logowania → 401), w tym blok administratora:
lista dnia, oczekujące, potwierdzenie, ponowne potwierdzenie (422), anulowanie i 404.
Porównuje kody odpowiedzi z oczekiwanymi i kończy się linią `ok=<n> bad=<n>`. Nagranie robi
agent narzędzia:

```bash
./mvnw -DskipTests package testgen:record
```

a w drugim terminalu:

```bash
bash eval/record-roombooking.sh
```

Skrypt nie pobiera plików strony, więc w nagraniu są tylko żądania do API. Nagranie ma
28 wpisów, nie 31: agent zapisuje tylko żądania, które dotarły do kontrolera, a trzy żądania
odrzucone przez warstwę zabezpieczeń (401 bez logowania, 403 dla roli USER przy tworzeniu
sali i 403 dla roli USER w API administratora) kończą się w łańcuchu filtrów Spring Security.
Podczas nagrywania żadna karta przeglądarki nie może wskazywać na aplikację, bo każde
pobranie strony dopisze wpis `GET /`.
Profil Mavena `eval` (`./mvnw -Peval …`) dodaje JaCoCo i PIT na potrzeby pomiarów;
bez `-Peval` build pozostaje bez zmian.

Celowo nieodwiedzone w scenariuszu:

- `PUT /api/rooms/{id}`,
- złe hasło (401 `Nieprawidłowy e-mail lub hasło`),
- dopłata weekendowa,
- przekroczenie pojemności sali (R4),
- rezerwacja w przeszłości (R5),
- zły krok minut i czas trwania poza 1–8 h (R2),
- anulowanie potwierdzonej rezerwacji przez jej właściciela (opłata 0 albo 50%),
- anulowanie rozpoczętej rezerwacji (przez właściciela lub administratora),
- anulowanie przez administratora rezerwacji już anulowanej,
- zajęta nazwa sali,
- rezerwacje zakładane kontem administratora.

## Zamrożenie kodu

Po nagraniu scenariusza kod aplikacji jest zamrożony: każda późniejsza zmiana oznacza nową
wersję aplikacji i powtórzenie wszystkich przebiegów pomiarowych (tak było z dodaniem
logowania, a potem oczekujących rezerwacji i panelu administratora). Nie należy też uruchamiać
`mvn clean`, bo kasuje `target/test-generation`.
