/* Dane startowe aplikacji. Wiersze mają jawne id, dlatego po wstawieniu
   licznik identity jest przestawiany za ostatni użyty identyfikator. */

INSERT INTO room (id, name, capacity, price_per_hour, opens_at, closes_at) VALUES
    (1, 'Sala A', 8, 50.00, '08:00', '20:00'),
    (2, 'Sala B', 20, 120.00, '07:00', '22:00'),
    (3, 'Aula', 100, 400.00, '09:00', '18:00'),
    (4, 'Kabina', 2, 20.00, '08:00', '20:00');
ALTER TABLE room ALTER COLUMN id RESTART WITH 5;

INSERT INTO booking (id, room_id, organizer_name, organizer_email, date, start_time, end_time,
                     attendees, status, total_price, cancellation_fee, created_at) VALUES
    (1, 2, 'Anna Nowak', 'anna.nowak@firma.pl', '2027-03-15', '09:00', '11:00', 12, 'CONFIRMED', 240.00, NULL, '2027-01-10T10:00:00Z'),
    (2, 2, 'Jan Kowalski', 'jan.kowalski@firma.pl', '2027-03-15', '13:00', '18:00', 15, 'CONFIRMED', 540.00, NULL, '2027-01-10T10:00:00Z'),
    (3, 1, 'Anna Nowak', 'anna.nowak@firma.pl', '2027-03-16', '10:00', '12:00', 6, 'CONFIRMED', 100.00, NULL, '2027-01-10T10:00:00Z'),
    (4, 3, 'Piotr Zieliński', 'piotr.zielinski@firma.pl', '2027-03-20', '10:00', '14:00', 60, 'CANCELLED', 1800.00, 0.00, '2027-01-10T10:00:00Z'),
    (5, 1, 'Jan Kowalski', 'jan.kowalski@firma.pl', '2027-03-18', '14:00', '16:00', 5, 'PENDING', 100.00, NULL, '2027-01-10T10:00:00Z');
ALTER TABLE booking ALTER COLUMN id RESTART WITH 6;

/* Konta użytkowników (logowanie HTTP Basic, e-mail jako login). Hasła testowe:
   anna.nowak@firma.pl haslo-anna, jan.kowalski@firma.pl haslo-jan,
   piotr.zielinski@firma.pl haslo-piotr, admin@firma.pl haslo-admin. */
INSERT INTO app_user (id, email, display_name, password_hash, role) VALUES
    (1, 'anna.nowak@firma.pl', 'Anna Nowak', '$2a$10$MWmO6DmJRviqNsKYK4NiB.ZmASfenFTcTV.yU8Gu75adQAG/DRFeW', 'USER'),
    (2, 'jan.kowalski@firma.pl', 'Jan Kowalski', '$2a$10$6NAJOC1kwg3waCKs./waWuZDP1n1yAKqQM1I.bzpRHX5lIp0sMxxK', 'USER'),
    (3, 'piotr.zielinski@firma.pl', 'Piotr Zieliński', '$2a$10$DFrOKty9DJm7qXC2xxP6M.lMujvjrvjNUvZbs735ujTlmmjWcQJ16', 'USER'),
    (4, 'admin@firma.pl', 'Administrator', '$2a$10$wJrhKfa.UlKXZx07gziTVuVbFVtGsTFjHW74JbKvTqTyTfvSWiPqO', 'ADMIN');
ALTER TABLE app_user ALTER COLUMN id RESTART WITH 5;
