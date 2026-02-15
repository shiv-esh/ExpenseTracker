package stqm.expenseTracker.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import stqm.expenseTracker.model.Category;

@Repository
public interface CategoryRepository extends MongoRepository<Category, String> {
}
