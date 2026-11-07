package pl.meetings.roombooking.user;

public record UserResponse(String email, String displayName, UserRole role) {

    public static UserResponse from(AppUser user) {
        return new UserResponse(user.getEmail(), user.getDisplayName(), user.getRole());
    }
}
