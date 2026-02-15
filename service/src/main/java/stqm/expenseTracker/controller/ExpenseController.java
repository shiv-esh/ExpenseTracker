package stqm.expenseTracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import stqm.expenseTracker.model.Expense;
import stqm.expenseTracker.service.ExpenseService;

import java.util.List;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {
    @Autowired
    private ExpenseService expenseService;

    @PostMapping("/record")
    public ResponseEntity<Expense> recordExpense(@RequestBody Expense expense) {
        return new ResponseEntity<>(expenseService.recordExpense(expense), HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Expense>> getAllExpenses() {
        return new ResponseEntity<>(expenseService.getAllExpenses(), HttpStatus.OK);
    }

    @GetMapping("/user/{username}")
    public ResponseEntity<List<Expense>> getExpensesByUser(@PathVariable String username) {
        return new ResponseEntity<>(expenseService.getExpensesByUser(username), HttpStatus.OK);
    }

    @GetMapping("/total")
    public ResponseEntity<Double> getDailyTotal(@RequestParam String username, @RequestParam String date) {
        return new ResponseEntity<>(expenseService.getDailyTotal(username, date), HttpStatus.OK);
    }
}
