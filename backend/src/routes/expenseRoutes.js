const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const User = require('../models/User');
const Category = require('../models/Category');

// Robust helper to extract a clean 24-character hexadecimal ID string from any MongoDB representation
const extractIdString = (field) => {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (field instanceof mongoose.Types.ObjectId) return field.toString();
  if (field._id) return extractIdString(field._id);
  if (field.$id) return extractIdString(field.$id);
  if (field.$oid) return extractIdString(field.$oid);
  if (typeof field === 'object') {
    // If it has a toString method that yields a valid 24-char hex string
    const str = field.toString();
    if (str && str.length === 24 && /^[0-9a-fA-F]{24}$/.test(str)) {
      return str;
    }
    // Check serialized output for $oid properties (often returned from Atlas)
    try {
      const serialized = JSON.parse(JSON.stringify(field));
      if (serialized && serialized.$oid) return serialized.$oid;
      if (serialized && serialized.$id) return extractIdString(serialized.$id);
    } catch (e) {}
  }
  return null;
};

// Robust helper to construct a query that matches either String or ObjectId representation
const buildIdQuery = (fieldPath, idValue) => {
  const query = {};
  if (!idValue) return query;

  const idStr = extractIdString(idValue);
  if (!idStr) return query;

  const ids = [idStr];
  if (mongoose.Types.ObjectId.isValid(idStr)) {
    ids.push(new mongoose.Types.ObjectId(idStr));
  }

  query[fieldPath] = { $in: ids };
  return query;
};

// Format a raw date to YYYY-MM-DD string
const formatDate = (d) => {
  const dt = new Date(d);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Format a raw lean expense document for the Angular frontend
const formatExpense = (exp, userMap, categoryMap) => {
  const userId = extractIdString(exp.user);
  const categoryId = extractIdString(exp.category);

  const user = userId && userMap[userId] 
    ? { id: extractIdString(userMap[userId]._id), username: userMap[userId].username } 
    : null;

  const category = categoryId && categoryMap[categoryId] 
    ? { id: extractIdString(categoryMap[categoryId]._id), name: categoryMap[categoryId].name } 
    : null;

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
  users.forEach(u => {
    const idStr = extractIdString(u._id);
    if (idStr) userMap[idStr] = u;
  });

  const categoryMap = {};
  categories.forEach(c => {
    const idStr = extractIdString(c._id);
    if (idStr) categoryMap[idStr] = c;
  });

  return expenses.map(exp => formatExpense(exp, userMap, categoryMap));
};

// DEBUG: Expose raw document structures for diagnosis
router.get('/debug/raw', async (req, res) => {
  try {
    const expenses = await mongoose.connection.collection('expenses').find().toArray();
    const categories = await mongoose.connection.collection('categories').find().toArray();
    const users = await mongoose.connection.collection('users').find().toArray();
    
    // Get unique category IDs referenced by expenses
    const referencedCategoryIds = [...new Set(expenses.map(e => extractIdString(e.category) || 'null'))];
    
    res.json({
      categories: categories.map(c => ({ id: extractIdString(c._id), name: c.name })),
      referencedCategoryIds,
      sampleExpense: expenses[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    
    const query = buildIdQuery('user.$id', user._id);
    res.status(200).json(await getPopulatedExpenses(query));
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

    const userQuery = buildIdQuery('user.$id', user._id);
    const expenses = await Expense.find({
      ...userQuery,
      date: { $gte: start, $lte: end }
    }).lean();

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

    const userQuery = buildIdQuery('user.$id', user._id);
    const expenses = await Expense.find({
      ...userQuery,
      date: { $gte: start, $lte: end }
    }).lean();

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

    const userQuery = buildIdQuery('user.$id', user._id);
    const [expenses, categories] = await Promise.all([
      Expense.find({
        ...userQuery,
        date: { $gte: start, $lte: end }
      }).lean(),
      Category.find().lean()
    ]);

    const categoryMap = {};
    categories.forEach(c => {
      const idStr = extractIdString(c._id);
      if (idStr) categoryMap[idStr] = c.name;
    });

    const categoryTotals = {};
    expenses.forEach(e => {
      const categoryId = extractIdString(e.category);
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
