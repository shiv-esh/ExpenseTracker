package stqm.expenseTracker.service;


import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import stqm.expenseTracker.model.User;
import stqm.expenseTracker.repository.UserRepository;

import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

//    @Autowired
//    private PasswordEncoder passwordEncoder;  // For encoding passwords

    // Register a new user
    public void registerUser(User user) throws Exception {
        // Check if the username already exists
        Optional<User> existingUser = userRepository.findByUsername(user.getUsername());
        if (existingUser.isPresent()) {
            throw new Exception("Username already exists");
        }

        // Encrypt the password before saving
        user.setPassword(user.getPassword());

        // Set a default role (you could also allow role assignment dynamically)
        user.setRole("USER");

        // Save the new user
        userRepository.save(user);
    }
    // Update an existing user
    public void updateUser(Long id, User updatedUser) throws Exception {
        // Check if the user exists by id
        Optional<User> existingUserOpt = userRepository.findById(id);
        if (existingUserOpt.isEmpty()) {
            throw new Exception("User not found");
        }

        User existingUser = existingUserOpt.get();

        // Update fields (you can add more fields to update)
        existingUser.setUsername(updatedUser.getUsername());  // Update username
        existingUser.setPassword(updatedUser.getPassword());  // Update password (password encoding can be added here)
        existingUser.setRole(updatedUser.getRole());  // Update role if needed

        // Save the updated user
        userRepository.save(existingUser);
    }
    // Delete a user by id
    public void deleteUser(Long id) throws Exception {
        // Check if the user exists by id
        Optional<User> existingUserOpt = userRepository.findById(id);
        if (existingUserOpt.isEmpty()) {
            throw new Exception("User not found");
        }

        // Delete the user
        userRepository.deleteById(id);
    }


}
