const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  user: {
    $ref: {
      type: String,
      default: 'users'
    },
    $id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  category: {
    $ref: {
      type: String,
      default: 'categories'
    },
    $id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    }
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      
      // Re-map DBRef populated objects to clean objects for the frontend
      if (ret.user) {
        ret.user = ret.user.$id || ret.user;
      }
      if (ret.category) {
        ret.category = ret.category.$id || ret.category;
      }
      
      // Format ISO Date string to simple YYYY-MM-DD
      if (ret.date) {
        const d = new Date(ret.date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        ret.date = `${year}-${month}-${day}`;
      }
      
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.model('Expense', expenseSchema, 'expenses');
