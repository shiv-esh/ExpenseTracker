package stqm.expenseTracker.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import stqm.expenseTracker.model.Category;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

}
