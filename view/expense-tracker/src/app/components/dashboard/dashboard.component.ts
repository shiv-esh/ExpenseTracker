import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ExpenseService } from '../../services/expense.service';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
    user: any;
    expenses: any[] = [];
    categories: any[] = [];
    dailyTotal: number = 0;
    newExpense = {
        amount: null,
        category: null,
        description: '',
        date: new Date().toISOString().split('T')[0]
    };

    constructor(
        private authService: AuthService,
        private expenseService: ExpenseService,
        private router: Router
    ) { }

    ngOnInit() {
        this.user = this.authService.getCurrentUser();
        if (!this.user) {
            this.router.navigate(['/login']);
            return;
        }
        this.loadExpenses();
        this.loadCategories();
        this.loadDailyTotal();
    }

    loadExpenses() {
        this.expenseService.getExpensesByUser(this.user.username).subscribe(data => {
            this.expenses = data;
        });
    }

    loadCategories() {
        this.expenseService.getCategories().subscribe(data => {
            this.categories = data;
        });
    }

    addExpense() {
        const expenseData = {
            ...this.newExpense,
            user: this.user
        };
        this.expenseService.recordExpense(expenseData).subscribe(() => {
            this.loadExpenses();
            this.loadDailyTotal();
            this.resetForm();
        });
    }

    loadDailyTotal() {
        this.expenseService.getDailyTotal(this.user.username, this.newExpense.date).subscribe(total => {
            this.dailyTotal = total;
        });
    }

    onDateChange() {
        this.loadDailyTotal();
    }

    resetForm() {
        this.newExpense = {
            amount: null,
            category: null,
            description: '',
            date: new Date().toISOString().split('T')[0]
        };
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}
