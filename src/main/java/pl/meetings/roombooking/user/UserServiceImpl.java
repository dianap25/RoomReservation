package pl.meetings.roombooking.user;

import org.springframework.stereotype.Service;

import pl.meetings.roombooking.common.UserNotFoundException;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;

    public UserServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public AppUser getByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UserNotFoundException(String.format("Użytkownik %s nie istnieje", email)));
    }
}
