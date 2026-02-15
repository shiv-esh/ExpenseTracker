package stqm.expenseTracker.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import stqm.expenseTracker.model.Expense;
import stqm.expenseTracker.model.User;

import java.util.List;

@Repository
public interface ExpenseRepository extends MongoRepository<Expense, String> {
    List<Expense> findByUser(User user);
}
