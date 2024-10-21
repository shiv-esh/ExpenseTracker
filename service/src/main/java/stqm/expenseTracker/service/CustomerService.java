package stqm.expenseTracker.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import stqm.expenseTracker.model.Customer;
import stqm.expenseTracker.repository.CustomerRepository;

import java.util.List;
import java.util.Optional;

@Service
public class CustomerService {

    @Autowired
    private CustomerRepository customerRepository;

    // Add a new customer
    public Customer addCustomer(Customer customer) {
        return customerRepository.save(customer);
    }

    // Get all customers
    public List<Customer> getAllCustomers() {
        return customerRepository.findAll();
    }

    // Get a customer by ID
    public Optional<Customer> getCustomerById(Long id) {
        return customerRepository.findById(id);
    }

    // Update a customer
    public Customer updateCustomer(Long id, Customer updatedCustomer) throws Exception {
        Optional<Customer> existingCustomerOpt = customerRepository.findById(id);

        if (existingCustomerOpt.isPresent()) {
            Customer existingCustomer = existingCustomerOpt.get();
            existingCustomer.setFirstName(updatedCustomer.getFirstName());
            existingCustomer.setLastName(updatedCustomer.getLastName());
            existingCustomer.setEmail(updatedCustomer.getEmail());
            existingCustomer.setPhoneNumber(updatedCustomer.getPhoneNumber());
            existingCustomer.setAddress(updatedCustomer.getAddress());
            return customerRepository.save(existingCustomer);
        } else {
            throw new Exception("Customer not found with ID: " + id);
        }
    }

    // Delete a customer by ID
    public void deleteCustomer(Long id) {
        customerRepository.deleteById(id);
    }
}
