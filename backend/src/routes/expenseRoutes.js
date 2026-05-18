const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const User = require('../models/User');
const Category = require('../models/Category');

// Helper to manually populate DBRefs since Mongoose does not natively populate legacy DBRef objects
const getPopulatedExpenses = async (query) => {
  const expenses = await Expense.find(query);
  
  // Fetch all users and categories into lookup maps for O(1) in-memory population
  const users = await User.find();
  const categories = await Category.find();

  const userMap = {};
  users.forEach(u => userMap[u._id.toString()] = u);

  const categoryMap = {};
  categories.forEach(c => categoryMap[c._id.toString()] = c);

  // Return plain objects with fully populated user and category fields
  return expenses.map(exp => {
    const doc = exp.toJSON(); // Applies base transform (converts _id to id, extracts $id)
    
    // doc.user is currently the $id (ObjectId string) due to toJSON transform
    if (doc.user && userMap[doc.user.toString()]) {
      doc.user = userMap[doc.user.toString()].toJSON();
    }

    // doc.category is currently the $id (ObjectId string) due to toJSON transform
    if (doc.category && categoryMap[doc.category.toString()]) {
      doc.category = categoryMap[doc.category.toString()].toJSON();
    }

    return doc;
  });
};

// Record an expense
router.post('/record', async (req, res) => {
  try {
    console.log('[POST /record] Incoming payload:', req.body);
    const { description, amount, date, user, category } = req.body;

    if (!user || !category) {
      console.error('[POST /record] Validation Error: User or Category is missing in request body.');
      return res.status(400).json({ error: 'User and Category objects are required.' });
    }

    // Validate existence of referenced elements and map to standard ObjectIds
    const userId = user.id || user._id;
    const categoryId = category.id || category._id;

    if (!userId || !categoryId) {
      console.error('[POST /record] Validation Error: User ID or Category ID is missing.');
      return res.status(400).json({ error: 'User ID and Category ID are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(categoryId)) {
      console.error('[POST /record] Validation Error: Invalid ObjectId format.', { userId, categoryId });
      return res.status(400).json({ error: 'Invalid user or category ID format.' });
    }

    const newExpense = new Expense({
      description,
      amount: parseFloat(amount),
      date: new Date(date + 'T00:00:00Z'), // Force UTC to avoid timezone shifts
      user: {
        $ref: 'users',
        $id: new mongoose.Types.ObjectId(userId)
      },
      category: {
        $ref: 'categories',
        $id: new mongoose.Types.ObjectId(categoryId)
      }
    });

    const saved = await newExpense.save();
    
    // Fetch manually populated version of the saved expense to return to frontend
    const populatedList = await getPopulatedExpenses({ _id: saved._id });
    const populated = populatedList[0];

    console.log('[POST /record] Expense saved successfully:', populated);
    res.status(201).json(populated);
  } catch (err) {
    console.error('[POST /record] Server exception caught:', err.stack || err.message);
    res.status(400).json({ error: err.message });
  }
});

// Get all expenses
router.get('/', async (req, res) => {
  try {
    const expenses = await getPopulatedExpenses({});
    res.status(200).json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get expenses by user
router.get('/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(200).json([]); // Spring Boot returns empty list if user doesn't exist
    }

    const expenses = await getPopulatedExpenses({ 'user.$id': user._id });
    res.status(200).json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get daily total for a user
router.get('/total', async (req, res) => {
  try {
    const { username, date } = req.query;
    if (!username || !date) {
      return res.status(400).json({ error: 'Username and date parameters are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(200).json(0.0);
    }

    // Set date boundaries to match UTC day
    const start = new Date(date + 'T00:00:00Z');
    const end = new Date(date + 'T23:59:59.999Z');

    const expenses = await Expense.find({
      'user.$id': user._id,
      date: { $gte: start, $lte: end }
    });

    const sum = expenses.reduce((acc, curr) => acc + curr.amount, 0.0);
    res.status(200).json(sum);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get total expense amount by date range
router.get('/total/range', async (req, res) => {
  try {
    const { username, startDate, endDate } = req.query;
    if (!username || !startDate || !endDate) {
      return res.status(400).json({ error: 'Username, startDate, and endDate are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(200).json(0.0);
    }

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59.999Z');

    const expenses = await Expense.find({
      'user.$id': user._id,
      date: { $gte: start, $lte: end }
    });

    const sum = expenses.reduce((acc, curr) => acc + curr.amount, 0.0);
    res.status(200).json(sum);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get analytics (category totals by date range)
router.get('/analytics', async (req, res) => {
  try {
    const { username, startDate, endDate } = req.query;
    if (!username || !startDate || !endDate) {
      return res.status(400).json({ error: 'Username, startDate, and endDate are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(200).json({});
    }

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59.999Z');

    // Fetch matching expenses
    const expenses = await Expense.find({
      'user.$id': user._id,
      date: { $gte: start, $lte: end }
    });

    // Fetch categories for O(1) lookup
    const categories = await Category.find();
    const categoryMap = {};
    categories.forEach(c => categoryMap[c._id.toString()] = c.name);

    const categoryTotals = {};

    expenses.forEach(e => {
      let categoryName = 'Uncategorized';
      if (e.category && e.category.$id) {
        categoryName = categoryMap[e.category.$id.toString()] || 'Uncategorized';
      }
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0.0) + e.amount;
    });

    res.status(200).json(categoryTotals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an expense
router.put('/:id', async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;

    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).send('Expense not found');
    }

    if (amount !== undefined) expense.amount = parseFloat(amount);
    if (description !== undefined) expense.description = description;
    if (date !== undefined) expense.date = new Date(date + 'T00:00:00Z');

    if (category) {
      const categoryId = category.id || category._id;
      if (mongoose.Types.ObjectId.isValid(categoryId)) {
        expense.category = {
          $ref: 'categories',
          $id: new mongoose.Types.ObjectId(categoryId)
        };
      }
    }

    await expense.save();

    const populatedList = await getPopulatedExpenses({ _id: expense._id });
    const populated = populatedList[0];

    res.status(200).json(populated);
  } catch (err) {
    res.status(404).send('Expense not found');
  }
});

// Delete an expense
router.delete('/:id', async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.status(204).end(); // No content (matches Spring's NO_CONTENT)
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
