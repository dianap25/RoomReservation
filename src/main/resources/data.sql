/* Dane startowe aplikacji. Wiersze mają jawne id, dlatego po wstawieniu
   licznik identity jest przestawiany za ostatni użyty identyfikator. */

INSERT INTO room (id, name, capacity, price_per_hour, opens_at, closes_at) VALUES
    (1, 'Sala A', 8, 50.00, '08:00', '20:00'),
    (2, 'Sala B', 20, 120.00, '07:00', '22:00'),
    (3, 'Aula', 100, 400.00, '09:00', '18:00'),
    (4, 'Kabina', 2, 20.00, '08:00', '20:00');
ALTER TABLE room ALTER COLUMN id RESTART WITH 5;
