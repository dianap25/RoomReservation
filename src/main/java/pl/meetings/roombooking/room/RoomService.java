package pl.meetings.roombooking.room;

import java.util.List;

public interface RoomService {

    List<Room> findAll();

    Room getById(Long id);

    Room create(RoomRequest request);

    Room update(Long id, RoomRequest request);
}
