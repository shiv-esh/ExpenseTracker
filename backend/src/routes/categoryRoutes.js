const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// Add a category
router.post('/add', async (req, res) => {
  try {
    const { name } = req.body;
    const newCategory = new Category({ name });
    const saved = await newCategory.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).send('Category not found');
    }
    res.status(200).json(category);
  } catch (err) {
    res.status(404).send('Category not found');
  }
});

// Update category
router.put('/update/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true } // Return updated document
    );
    if (!updated) {
      return res.status(404).send('Category not found');
    }
    res.status(200).json(updated);
  } catch (err) {
    res.status(404).send('Category not found');
  }
});

// Delete category
router.delete('/delete/:id', async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).send('Category not found');
    }
    res.status(200).send('Category deleted successfully');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
