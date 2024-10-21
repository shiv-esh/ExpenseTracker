package stqm.expenseTracker.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import stqm.expenseTracker.model.Customer;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {

}
