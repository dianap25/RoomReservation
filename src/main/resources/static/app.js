(function () {
    'use strict';

    const AUTH_STORAGE_KEY = 'roombooking.auth';

    const state = {
        auth: null,
        user: null,
        date: '2027-03-15',
        roomId: null,
        rooms: []
    };

    const el = {
        userBar: document.getElementById('user-bar'),
        userLabel: document.getElementById('user-label'),
        logout: document.getElementById('logout'),
        loginPanel: document.getElementById('login-panel'),
        loginForm: document.getElementById('login-form'),
        loginMessage: document.getElementById('login-message'),
        app: document.getElementById('app'),
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
        bookings: document.getElementById('bookings'),
        adminPanel: document.getElementById('admin-panel'),
        adminMessage: document.getElementById('admin-message'),
        adminPending: document.getElementById('admin-pending'),
        adminDayTitle: document.getElementById('admin-day-title'),
        adminDay: document.getElementById('admin-day')
    };

    const STATUS_LABELS = {
        PENDING: 'Oczekująca',
        CONFIRMED: 'Potwierdzona',
        CANCELLED: 'Anulowana'
    };

    const ROLE_LABELS = {
        USER: 'użytkownik',
        ADMIN: 'administrator'
    };

    // --- pomocnicze ------------------------------------------------------

    function toBase64Utf8(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        bytes.forEach(function (b) { binary += String.fromCharCode(b); });
        return btoa(binary);
    }

    async function api(method, path, body) {
        const options = { method: method, headers: {} };
        if (state.auth) {
            options.headers['Authorization'] = state.auth;
        }
        if (body !== undefined) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        const response = await fetch(path, options);
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        if (response.status === 401 && state.user) {
            logout('Sesja wygasła, zaloguj się ponownie.');
        }
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

    function isAdmin() {
        return Boolean(state.user) && state.user.role === 'ADMIN';
    }

    // --- logowanie -------------------------------------------------------

    function readStoredAuth() {
        try {
            return sessionStorage.getItem(AUTH_STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function storeAuth(value) {
        try {
            if (value) {
                sessionStorage.setItem(AUTH_STORAGE_KEY, value);
            } else {
                sessionStorage.removeItem(AUTH_STORAGE_KEY);
            }
        } catch (e) {
            // brak sessionStorage: logowanie działa do przeładowania strony
        }
    }

    async function login(event) {
        event.preventDefault();
        const data = new FormData(el.loginForm);
        const email = String(data.get('email') || '').trim();
        const password = String(data.get('password') || '');
        if (!email || !password) {
            showMessage(el.loginMessage, 'Podaj e-mail i hasło.', 'error');
            return;
        }
        await signIn('Basic ' + toBase64Utf8(email + ':' + password));
    }

    async function signIn(authHeader) {
        state.auth = authHeader;
        let result;
        try {
            result = await api('GET', '/api/me');
        } catch (e) {
            state.auth = null;
            showMessage(el.loginMessage, 'Nie udało się połączyć z serwerem.', 'error');
            return;
        }
        if (!result.ok) {
            state.auth = null;
            showMessage(el.loginMessage, errorText(result), 'error');
            return;
        }
        state.user = result.data;
        storeAuth(authHeader);
        showMessage(el.loginMessage, '');
        el.loginForm.reset();
        renderUser();
        el.loginPanel.hidden = true;
        el.app.hidden = false;
        el.adminPanel.hidden = !isAdmin();
        loadRooms();
        loadBookings();
        loadAdminLists();
    }

    function logout(message) {
        state.auth = null;
        state.user = null;
        state.roomId = null;
        state.rooms = [];
        storeAuth(null);
        el.app.hidden = true;
        el.loginPanel.hidden = false;
        el.userBar.hidden = true;
        el.adminPanel.hidden = true;
        clear(el.rooms);
        clear(el.availability);
        clear(el.bookings);
        clear(el.quote);
        clear(el.adminPending);
        clear(el.adminDay);
        showMessage(el.formMessage, '');
        showMessage(el.bookingsMessage, '');
        showMessage(el.adminMessage, '');
        showMessage(el.loginMessage, message || '', 'info');
    }

    function renderUser() {
        el.userLabel.textContent = 'Zalogowano jako ' + state.user.displayName +
            ' (' + (ROLE_LABELS[state.user.role] || state.user.role) + ')';
        el.userBar.hidden = false;
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
        requestQuote();
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
            date: state.date,
            startTime: data.get('startTime') || null,
            endTime: data.get('endTime') || null,
            attendees: Number(data.get('attendees')) || 0
        };
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
            time(booking.startTime) + '–' + time(booking.endTime) + ', cena ' + money(booking.totalPrice) +
            '. Rezerwacja czeka na potwierdzenie przez administratora.',
            'success');
        loadAvailability();
        loadBookings();
        loadAdminLists();
    }

    // --- moje rezerwacje ------------------------------------------------

    async function loadBookings() {
        el.bookingsTitle.textContent = 'Moje rezerwacje: ' + dateLabel(state.date);
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
            el.bookings.appendChild(element('li', 'empty', 'Brak Twoich rezerwacji w tym dniu.'));
            return;
        }
        bookings.forEach(function (booking) {
            const item = element('li', 'booking ' + booking.status.toLowerCase());
            item.appendChild(element('div', 'booking-head',
                booking.roomName + ' · ' + time(booking.startTime) + '–' + time(booking.endTime)));
            item.appendChild(element('div', 'booking-organizer', booking.attendees + ' os.'));
            item.appendChild(element('div', 'booking-status',
                STATUS_LABELS[booking.status] + ' · ' + money(booking.totalPrice)));
            if (booking.status === 'PENDING' || booking.status === 'CONFIRMED') {
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
        loadAdminLists();
    }

    // --- panel administratora -------------------------------------------

    async function loadAdminLists() {
        if (!isAdmin()) {
            return;
        }
        el.adminDayTitle.textContent = 'Rezerwacje dnia ' + dateLabel(state.date) + ' (wszyscy użytkownicy)';
        let pending;
        let day;
        try {
            pending = await api('GET', '/api/admin/bookings/pending');
            day = await api('GET', '/api/admin/bookings?date=' + state.date);
        } catch (e) {
            showMessage(el.adminMessage, 'Nie udało się pobrać rezerwacji.', 'error');
            return;
        }
        if (!pending.ok) {
            showMessage(el.adminMessage, errorText(pending), 'error');
            return;
        }
        if (!day.ok) {
            showMessage(el.adminMessage, errorText(day), 'error');
            return;
        }
        renderAdminList(el.adminPending, pending.data, 'Brak oczekujących próśb.', true);
        renderAdminList(el.adminDay, day.data, 'Brak rezerwacji w tym dniu.', false);
    }

    function renderAdminList(list, bookings, emptyText, withDate) {
        clear(list);
        if (bookings.length === 0) {
            list.appendChild(element('li', 'empty', emptyText));
            return;
        }
        bookings.forEach(function (booking) {
            const item = element('li', 'booking ' + booking.status.toLowerCase());
            item.appendChild(element('div', 'booking-head',
                (withDate ? dateLabel(booking.date) + ' · ' : '') + booking.roomName + ' · ' +
                time(booking.startTime) + '–' + time(booking.endTime)));
            item.appendChild(element('div', 'booking-organizer',
                booking.organizerName + ' (' + booking.organizerEmail + '), ' + booking.attendees + ' os.'));
            item.appendChild(element('div', 'booking-status',
                STATUS_LABELS[booking.status] + ' · ' + money(booking.totalPrice)));
            if (booking.status === 'PENDING') {
                const confirm = element('button', 'confirm', 'Potwierdź');
                confirm.type = 'button';
                confirm.addEventListener('click', function () { adminConfirm(booking); });
                item.appendChild(confirm);
            }
            if (booking.status === 'PENDING' || booking.status === 'CONFIRMED') {
                const cancel = element('button', 'cancel', 'Anuluj');
                cancel.type = 'button';
                cancel.addEventListener('click', function () { adminCancel(booking); });
                item.appendChild(cancel);
            }
            list.appendChild(item);
        });
    }

    async function adminConfirm(booking) {
        let result;
        try {
            result = await api('POST', '/api/admin/bookings/' + booking.id + '/confirm');
        } catch (e) {
            showMessage(el.adminMessage, 'Nie udało się potwierdzić rezerwacji.', 'error');
            return;
        }
        if (!result.ok) {
            showMessage(el.adminMessage, errorText(result), 'error');
            return;
        }
        showMessage(el.adminMessage,
            'Potwierdzono rezerwację: ' + booking.organizerName + ', ' + booking.roomName + ', ' +
            dateLabel(booking.date) + ' ' + time(booking.startTime) + '–' + time(booking.endTime) + '.',
            'success');
        refreshAfterAdminAction();
    }

    async function adminCancel(booking) {
        let result;
        try {
            result = await api('POST', '/api/admin/bookings/' + booking.id + '/cancel');
        } catch (e) {
            showMessage(el.adminMessage, 'Nie udało się anulować rezerwacji.', 'error');
            return;
        }
        if (!result.ok) {
            showMessage(el.adminMessage, errorText(result), 'error');
            return;
        }
        showMessage(el.adminMessage,
            'Anulowano rezerwację: ' + booking.organizerName + ', ' + booking.roomName + ', ' +
            dateLabel(booking.date) + ' ' + time(booking.startTime) + '–' + time(booking.endTime) +
            '. Zwrot: ' + money(result.data.refund) + '.',
            'success');
        refreshAfterAdminAction();
    }

    function refreshAfterAdminAction() {
        loadAdminLists();
        loadBookings();
        loadAvailability();
    }

    // --- start ----------------------------------------------------------

    el.loginForm.addEventListener('submit', login);
    el.logout.addEventListener('click', function () { logout(''); });

    el.date.addEventListener('change', function () {
        if (!el.date.value) {
            return;
        }
        state.date = el.date.value;
        showMessage(el.bookingsMessage, '');
        showMessage(el.adminMessage, '');
        loadAvailability();
        loadBookings();
        loadAdminLists();
        if (state.roomId) {
            requestQuote();
        }
    });

    el.form.addEventListener('input', scheduleQuote);
    el.form.addEventListener('submit', submitBooking);

    const stored = readStoredAuth();
    if (stored) {
        signIn(stored);
    }
})();
