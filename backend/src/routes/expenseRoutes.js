const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const User = require('../models/User');
const Category = require('../models/Category');

// Format a raw lean date to YYYY-MM-DD string
const formatDate = (d) => {
  const dt = new Date(d);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Format a raw lean expense document for the Angular frontend
const formatExpense = (exp, userMap, categoryMap) => {
  // exp.user and exp.category are Spring Boot DBRefs: { $ref: 'collection', $id: ObjectId }
  // .lean() preserves these fields untouched (bypasses Mongoose $ field stripping)
  const userId = exp.user && exp.user.$id ? exp.user.$id.toString() : null;
  const categoryId = exp.category && exp.category.$id ? exp.category.$id.toString() : null;

  const user = userId && userMap[userId] ? { id: userMap[userId]._id.toString(), username: userMap[userId].username } : null;
  const category = categoryId && categoryMap[categoryId] ? { id: categoryMap[categoryId]._id.toString(), name: categoryMap[categoryId].name } : null;

  return {
    id: exp._id.toString(),
    description: exp.description || null,
    amount: exp.amount,
    date: formatDate(exp.date),
    user,
    category
  };
};

// Helper: fetch all expenses for a query, with manually resolved DBRef population via .lean()
const getPopulatedExpenses = async (query) => {
  const [expenses, users, categories] = await Promise.all([
    Expense.find(query).lean(),
    User.find().lean(),
    Category.find().lean()
  ]);

  const userMap = {};
  users.forEach(u => { userMap[u._id.toString()] = u; });

  const categoryMap = {};
  categories.forEach(c => { categoryMap[c._id.toString()] = c; });

  return expenses.map(exp => formatExpense(exp, userMap, categoryMap));
};

// Record an expense
router.post('/record', async (req, res) => {
  try {
    const { description, amount, date, user, category } = req.body;

    if (!user || !category) {
      return res.status(400).json({ error: 'User and Category objects are required.' });
    }

    const userId = user.id || user._id;
    const categoryId = category.id || category._id;

    if (!userId || !categoryId) {
      return res.status(400).json({ error: 'User ID and Category ID are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ error: 'Invalid user or category ID format.' });
    }

    // Use MongoDB native driver to insert with $ fields intact (bypasses Mongoose $ stripping on save)
    const col = mongoose.connection.collection('expenses');
    const result = await col.insertOne({
      description: description || null,
      amount: parseFloat(amount),
      date: new Date(date + 'T00:00:00Z'),
      user: { $ref: 'users', $id: new mongoose.Types.ObjectId(userId) },
      category: { $ref: 'categories', $id: new mongoose.Types.ObjectId(categoryId) }
    });

    const populatedList = await getPopulatedExpenses({ _id: result.insertedId });
    res.status(201).json(populatedList[0]);
  } catch (err) {
    console.error('[POST /record]', err.stack || err.message);
    res.status(400).json({ error: err.message });
  }
});

// Get all expenses
router.get('/', async (req, res) => {
  try {
    res.status(200).json(await getPopulatedExpenses({}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get expenses by user
router.get('/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(200).json([]);
    res.status(200).json(await getPopulatedExpenses({ 'user.$id': user._id }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get daily total for a user
router.get('/total', async (req, res) => {
  try {
    const { username, date } = req.query;
    if (!username || !date) return res.status(400).json({ error: 'Username and date parameters are required' });

    const user = await User.findOne({ username }).lean();
    if (!user) return res.status(200).json(0.0);

    const start = new Date(date + 'T00:00:00Z');
    const end = new Date(date + 'T23:59:59.999Z');

    const expenses = await Expense.find({ 'user.$id': user._id, date: { $gte: start, $lte: end } }).lean();
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
    if (!username || !startDate || !endDate) return res.status(400).json({ error: 'Username, startDate, and endDate are required' });

    const user = await User.findOne({ username }).lean();
    if (!user) return res.status(200).json(0.0);

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59.999Z');

    const expenses = await Expense.find({ 'user.$id': user._id, date: { $gte: start, $lte: end } }).lean();
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
    if (!username || !startDate || !endDate) return res.status(400).json({ error: 'Username, startDate, and endDate are required' });

    const user = await User.findOne({ username }).lean();
    if (!user) return res.status(200).json({});

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59.999Z');

    const [expenses, categories] = await Promise.all([
      Expense.find({ 'user.$id': user._id, date: { $gte: start, $lte: end } }).lean(),
      Category.find().lean()
    ]);

    const categoryMap = {};
    categories.forEach(c => { categoryMap[c._id.toString()] = c.name; });

    const categoryTotals = {};
    expenses.forEach(e => {
      // .lean() preserves $id as a real BSON ObjectId so .toString() gives the hex string
      const categoryId = e.category && e.category.$id ? e.category.$id.toString() : null;
      const name = (categoryId && categoryMap[categoryId]) || 'Uncategorized';
      categoryTotals[name] = (categoryTotals[name] || 0.0) + e.amount;
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

    const updateFields = {};
    if (amount !== undefined) updateFields.amount = parseFloat(amount);
    if (description !== undefined) updateFields.description = description;
    if (date !== undefined) updateFields.date = new Date(date + 'T00:00:00Z');

    if (category) {
      const categoryId = category.id || category._id;
      if (mongoose.Types.ObjectId.isValid(categoryId)) {
        updateFields.category = { $ref: 'categories', $id: new mongoose.Types.ObjectId(categoryId) };
      }
    }

    // Use native driver to update so $ fields are preserved correctly
    const col = mongoose.connection.collection('expenses');
    const result = await col.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'Expense not found' });

    const populatedList = await getPopulatedExpenses({ _id: result._id });
    res.status(200).json(populatedList[0]);
  } catch (err) {
    console.error('[PUT /:id]', err.stack || err.message);
    res.status(404).json({ error: 'Expense not found' });
  }
});

// Delete an expense
router.delete('/:id', async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
