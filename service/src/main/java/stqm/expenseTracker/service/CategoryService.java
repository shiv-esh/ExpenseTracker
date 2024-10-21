package stqm.expenseTracker.service;



import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import stqm.expenseTracker.model.Category;
import stqm.expenseTracker.repository.CategoryRepository;

import java.util.List;
import java.util.Optional;

@Service
public class CategoryService {

    @Autowired
    private CategoryRepository categoryRepository;

    public Category addCategory(Category category) {
        return categoryRepository.save(category);
    }

    public List<Category> getAllCategories() {
        return categoryRepository.findAll();
    }

    public Optional<Category> getCategoryById(Long id) {
        return categoryRepository.findById(id);
    }

    public Category updateCategory(Long id, Category updatedCategory) throws Exception {
        Optional<Category> existingCategoryOpt = categoryRepository.findById(id);

        if (existingCategoryOpt.isPresent()) {
            Category existingCategory = existingCategoryOpt.get();
            existingCategory.setName(updatedCategory.getName());
            return categoryRepository.save(existingCategory);
        } else {
            throw new Exception("Category not found with ID: " + id);
        }
    }

    public void deleteCategory(Long id) {
        categoryRepository.deleteById(id);
    }
}
