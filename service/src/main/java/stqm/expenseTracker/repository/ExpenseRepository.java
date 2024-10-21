package stqm.expenseTracker.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import stqm.expenseTracker.model.Expense;

@Repository



public interface ExpenseRepository extends JpaRepository<Expense, Long> {
}
