package stqm.expenseTracker.model;


import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter @Setter
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private double price;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = true)
    private String description;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;
    // Getters and Setters
}
