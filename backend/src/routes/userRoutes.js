const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../middleware/authMiddleware');

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send('Username already exists');
    }

    const newUser = new User({
      username,
      password,
      role: role || 'USER'
    });

    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).send('User not found');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).send('Invalid password');
    }

    // Generate JWT token
    const token = generateToken(user.username, user.role);

    // Return LoginResponse format exactly as expected by the frontend
    res.status(200).json({
      token,
      id: user.id,
      username: user.username,
      role: user.role
    });
  } catch (err) {
    res.status(401).send(err.message);
  }
});

// Update user details
router.put('/:id', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).send('User not found');
    }

    if (username) user.username = username;
    if (password) user.password = password; // Trigger pre-save password hash hook
    if (role) user.role = role;

    const updatedUser = await user.save();
    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(404).send(err.message);
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const userExists = await User.exists({ _id: req.params.id });
    if (!userExists) {
      return res.status(404).send('User not found');
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).send('User deleted successfully');
  } catch (err) {
    res.status(404).send(err.message);
  }
});

module.exports = router;
