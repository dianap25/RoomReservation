package pl.meetings.roombooking.room;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import pl.meetings.roombooking.common.BookingRuleViolationException;
import pl.meetings.roombooking.common.RoomNotFoundException;

@Service
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;

    public RoomServiceImpl(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @Override
    public List<Room> findAll() {
        return roomRepository.findAll(Sort.by("name"));
    }

    @Override
    public Room getById(Long id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new RoomNotFoundException(String.format("Sala o id %d nie istnieje", id)));
    }

    @Override
    public Room create(RoomRequest request) {
        validateOpeningHours(request);
        ensureNameFree(request.name(), null);
        Room room = new Room(request.name(), request.capacity(), request.pricePerHour(),
                request.opensAt(), request.closesAt());
        return roomRepository.save(room);
    }

    @Override
    public Room update(Long id, RoomRequest request) {
        Room room = getById(id);
        validateOpeningHours(request);
        ensureNameFree(request.name(), id);
        room.setName(request.name());
        room.setCapacity(request.capacity());
        room.setPricePerHour(request.pricePerHour());
        room.setOpensAt(request.opensAt());
        room.setClosesAt(request.closesAt());
        return roomRepository.save(room);
    }

    private void validateOpeningHours(RoomRequest request) {
        if (!request.opensAt().isBefore(request.closesAt())) {
            throw new BookingRuleViolationException(
                    "Godzina otwarcia musi być wcześniejsza niż godzina zamknięcia");
        }
    }

    private void ensureNameFree(String name, Long exceptRoomId) {
        Optional<Room> existing = roomRepository.findByName(name);
        if (existing.isPresent() && !existing.get().getId().equals(exceptRoomId)) {
            throw new BookingRuleViolationException(String.format("Sala o nazwie '%s' już istnieje", name));
        }
    }
}
