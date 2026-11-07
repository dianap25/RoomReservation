(function () {
    'use strict';

    const state = {
        date: '2027-03-15',
        roomId: null,
        rooms: []
    };

    const el = {
        date: document.getElementById('date'),
        rooms: document.getElementById('rooms'),
        roomsMessage: document.getElementById('rooms-message'),
        availabilityTitle: document.getElementById('availability-title'),
        availabilityHint: document.getElementById('availability-hint'),
        availability: document.getElementById('availability'),
        form: document.getElementById('booking-form'),
        quote: document.getElementById('quote'),
        formMessage: document.getElementById('form-message'),
        bookingsTitle: document.getElementById('bookings-title'),
        bookingsMessage: document.getElementById('bookings-message'),
        bookings: document.getElementById('bookings')
    };

    const STATUS_LABELS = {
        CONFIRMED: 'Potwierdzona',
        CANCELLED: 'Anulowana'
    };

    async function api(method, path, body) {
        const options = { method: method, headers: {} };
        if (body !== undefined) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        const response = await fetch(path, options);
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        return { ok: response.ok, status: response.status, data: data };
    }

    function errorText(result) {
        if (result.data && result.data.message) {
            return result.data.message;
        }
        return 'Błąd serwera (' + result.status + ')';
    }

    function money(value) {
        return Number(value).toLocaleString('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' zł';
    }

    function time(value) {
        return value ? value.slice(0, 5) : '';
    }

    function dateLabel(isoDate) {
        return new Date(isoDate + 'T00:00:00').toLocaleDateString('pl-PL');
    }

    function clear(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined) {
            node.textContent = text;
        }
        return node;
    }

    function showMessage(node, text, kind) {
        node.textContent = text || '';
        node.className = 'message' + (text ? ' ' + kind : '');
    }

    function selectedRoom() {
        return state.rooms.find(function (room) { return room.id === state.roomId; }) || null;
    }

    // --- sale -----------------------------------------------------------

    async function loadRooms() {
        let result;
        try {
            result = await api('GET', '/api/rooms');
        } catch (e) {
            showMessage(el.roomsMessage, 'Nie udało się połączyć z serwerem.', 'error');
            return;
        }
        if (!result.ok) {
            showMessage(el.roomsMessage, errorText(result), 'error');
            return;
        }
        state.rooms = result.data;
        showMessage(el.roomsMessage, '');
        renderRooms();
    }

    function renderRooms() {
        clear(el.rooms);
        state.rooms.forEach(function (room) {
            const button = element('button', 'room' + (room.id === state.roomId ? ' selected' : ''));
            button.type = 'button';
            button.appendChild(element('span', 'room-name', room.name));
            button.appendChild(element('span', 'room-details',
                room.capacity + ' os. · ' + money(room.pricePerHour) + '/h · ' +
                time(room.opensAt) + '–' + time(room.closesAt)));
            button.addEventListener('click', function () { selectRoom(room.id); });
            el.rooms.appendChild(button);
        });
    }

    function selectRoom(roomId) {
        state.roomId = roomId;
        renderRooms();
        showMessage(el.formMessage, '');
        loadAvailability();
        refreshQuote();
    }

    // --- dostępność -----------------------------------------------------

    async function loadAvailability() {
        const room = selectedRoom();
        clear(el.availability);
        if (!room) {
            el.availabilityTitle.textContent = 'Dostępność';
            el.availabilityHint.hidden = false;
            return;
        }
        el.availabilityTitle.textContent = 'Dostępność: ' + room.name + ', ' + dateLabel(state.date);
        el.availabilityHint.hidden = true;

        let result;
        try {
            result = await api('GET', '/api/rooms/' + room.id + '/availability?date=' + state.date);
        } catch (e) {
            showMessage(el.formMessage, 'Nie udało się pobrać dostępności.', 'error');
            return;
        }
        if (!result.ok) {
            showMessage(el.formMessage, errorText(result), 'error');
            return;
        }
        renderAvailability(result.data);
    }

    function renderAvailability(slots) {
        clear(el.availability);
        slots.forEach(function (slot) {
            const cell = element('div', 'slot ' + (slot.free ? 'free' : 'busy'));
            cell.appendChild(element('span', 'slot-time', time(slot.start) + '–' + time(slot.end)));
            cell.appendChild(element('span', 'slot-label', slot.free ? 'wolne' : 'zajęte'));
            el.availability.appendChild(cell);
        });
    }

    // --- formularz i wycena ---------------------------------------------

    function bookingPayload() {
        const data = new FormData(el.form);
        return {
            roomId: state.roomId,
            organizerName: data.get('organizerName'),
            organizerEmail: data.get('organizerEmail'),
            date: state.date,
            startTime: data.get('startTime') || null,
            endTime: data.get('endTime') || null,
            attendees: Number(data.get('attendees')) || 0
        };
    }

    function formTouched() {
        const data = new FormData(el.form);
        return Boolean(data.get('organizerName') || data.get('organizerEmail'));
    }

    function refreshQuote() {
        if (formTouched()) {
            requestQuote();
        } else {
            clear(el.quote);
        }
    }

    let quoteTimer = null;

    function scheduleQuote() {
        clearTimeout(quoteTimer);
        quoteTimer = setTimeout(requestQuote, 300);
    }

    async function requestQuote() {
        clear(el.quote);
        if (!state.roomId) {
            showMessage(el.formMessage, 'Najpierw wybierz salę.', 'info');
            return;
        }
        let result;
        try {
            result = await api('POST', '/api/bookings/quote', bookingPayload());
        } catch (e) {
            showMessage(el.formMessage, 'Nie udało się pobrać wyceny.', 'error');
            return;
        }
        if (!result.ok) {
            showMessage(el.formMessage, errorText(result), 'error');
            return;
        }
        showMessage(el.formMessage, '');
        renderQuote(result.data);
    }

    function renderQuote(quote) {
        clear(el.quote);
        const rows = [
            ['Godziny', Number(quote.hours).toLocaleString('pl-PL', { minimumFractionDigits: 2 })],
            ['Cena bazowa', money(quote.basePrice)],
            ['Dopłata weekendowa', money(quote.weekendSurcharge)],
            ['Rabat', money(quote.discount)],
            ['Razem', money(quote.totalPrice)]
        ];
        rows.forEach(function (row) {
            el.quote.appendChild(element('dt', null, row[0]));
            el.quote.appendChild(element('dd', null, row[1]));
        });
    }

    async function submitBooking(event) {
        event.preventDefault();
        if (!state.roomId) {
            showMessage(el.formMessage, 'Najpierw wybierz salę.', 'info');
            return;
        }
        let result;
        try {
            result = await api('POST', '/api/bookings', bookingPayload());
        } catch (e) {
            showMessage(el.formMessage, 'Nie udało się zapisać rezerwacji.', 'error');
            return;
        }
        if (!result.ok) {
            showMessage(el.formMessage, errorText(result), 'error');
            return;
        }
        const booking = result.data;
        showMessage(el.formMessage,
            'Zarezerwowano salę ' + booking.roomName + ' w godzinach ' +
            time(booking.startTime) + '–' + time(booking.endTime) + ', cena ' + money(booking.totalPrice) + '.',
            'success');
        loadAvailability();
        loadBookings();
    }

    // --- rezerwacje dnia ------------------------------------------------

    async function loadBookings() {
        el.bookingsTitle.textContent = 'Rezerwacje: ' + dateLabel(state.date);
        let result;
        try {
            result = await api('GET', '/api/bookings?date=' + state.date);
        } catch (e) {
            showMessage(el.bookingsMessage, 'Nie udało się pobrać rezerwacji.', 'error');
            return;
        }
        if (!result.ok) {
            showMessage(el.bookingsMessage, errorText(result), 'error');
            return;
        }
        renderBookings(result.data);
    }

    function renderBookings(bookings) {
        clear(el.bookings);
        if (bookings.length === 0) {
            el.bookings.appendChild(element('li', 'empty', 'Brak rezerwacji w tym dniu.'));
            return;
        }
        bookings.forEach(function (booking) {
            const item = element('li', 'booking ' + booking.status.toLowerCase());
            item.appendChild(element('div', 'booking-head',
                booking.roomName + ' · ' + time(booking.startTime) + '–' + time(booking.endTime)));
            item.appendChild(element('div', 'booking-organizer',
                booking.organizerName + ' (' + booking.organizerEmail + '), ' + booking.attendees + ' os.'));
            item.appendChild(element('div', 'booking-status',
                STATUS_LABELS[booking.status] + ' · ' + money(booking.totalPrice)));
            if (booking.status === 'CONFIRMED') {
                const cancel = element('button', 'cancel', 'Anuluj');
                cancel.type = 'button';
                cancel.addEventListener('click', function () { cancelBooking(booking); });
                item.appendChild(cancel);
            }
            el.bookings.appendChild(item);
        });
    }

    async function cancelBooking(booking) {
        let result;
        try {
            result = await api('POST', '/api/bookings/' + booking.id + '/cancel');
        } catch (e) {
            showMessage(el.bookingsMessage, 'Nie udało się anulować rezerwacji.', 'error');
            return;
        }
        if (!result.ok) {
            showMessage(el.bookingsMessage, errorText(result), 'error');
            return;
        }
        showMessage(el.bookingsMessage,
            'Anulowano rezerwację sali ' + booking.roomName + ' (' + time(booking.startTime) + '–' +
            time(booking.endTime) + '). Opłata: ' + money(result.data.cancellationFee) +
            ', zwrot: ' + money(result.data.refund) + '.',
            'success');
        loadBookings();
        loadAvailability();
    }

    // --- start ----------------------------------------------------------

    el.date.addEventListener('change', function () {
        if (!el.date.value) {
            return;
        }
        state.date = el.date.value;
        showMessage(el.bookingsMessage, '');
        loadAvailability();
        loadBookings();
        refreshQuote();
    });

    el.form.addEventListener('input', scheduleQuote);
    el.form.addEventListener('submit', submitBooking);

    loadRooms();
    loadBookings();
})();
