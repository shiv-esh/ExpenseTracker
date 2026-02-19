package stqm.expenseTracker.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import stqm.expenseTracker.model.Expense;
import stqm.expenseTracker.model.User;
import stqm.expenseTracker.repository.ExpenseRepository;
import stqm.expenseTracker.repository.UserRepository;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
public class ExpenseService {
    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private UserRepository userRepository;

    public Expense recordExpense(Expense expense) {
        return expenseRepository.save(expense);
    }

    public List<Expense> getAllExpenses() {
        return expenseRepository.findAll();
    }

    public List<Expense> getExpensesByUser(String username) {
        Optional<User> user = userRepository.findByUsername(username);
        if (user.isPresent()) {
            return expenseRepository.findByUser(user.get());
        }
        return Collections.emptyList();
    }

    public double getDailyTotal(String username, String date) {
        Optional<User> user = userRepository.findByUsername(username);
        if (user.isPresent()) {
            LocalDate localDate = LocalDate.parse(date);
            List<Expense> expenses = expenseRepository.findByUserAndDate(user.get(), localDate);
            return expenses.stream().mapToDouble(Expense::getAmount).sum();
        }
        return 0.0;
    }

    public double getTotalByDateRange(String username, String startDate, String endDate) {
        Optional<User> user = userRepository.findByUsername(username);
        if (user.isPresent()) {
            LocalDate start = LocalDate.parse(startDate);
            LocalDate end = LocalDate.parse(endDate);
            List<Expense> expenses = expenseRepository.findByUserAndDateBetween(user.get(), start, end);
            return expenses.stream().mapToDouble(Expense::getAmount).sum();
        }
        return 0.0;
    }

    public void deleteExpense(String id) {
        expenseRepository.deleteById(id);
    }
}
