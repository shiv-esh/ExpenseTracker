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

    // Range filter state
    filterMode: 'monthly' | 'weekly' | 'custom' = 'monthly';
    rangeTotal: number | null = null;
    rangeLoading: boolean = false;
    customStartDate: string = '';
    customEndDate: string = '';

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
        // Init custom range to current month
        const now = new Date();
        this.customStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        this.customEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        this.loadExpenses();
        this.loadCategories();
        this.loadDailyTotal();
        this.loadRangeTotal();
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
            this.loadRangeTotal();
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

    deleteExpense(id: string) {
        if (!confirm('Are you sure you want to delete this expense?')) return;
        this.expenseService.deleteExpense(id).subscribe(() => {
            this.loadExpenses();
            this.loadDailyTotal();
            this.loadRangeTotal();
        });
    }

    // --- Range filter helpers ---
    private getDateRange(): { startDate: string; endDate: string } {
        const today = new Date();
        if (this.filterMode === 'monthly') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        } else if (this.filterMode === 'weekly') {
            const dayOfWeek = today.getDay(); // 0 = Sun
            const start = new Date(today);
            start.setDate(today.getDate() - dayOfWeek);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        } else {
            return {
                startDate: this.customStartDate,
                endDate: this.customEndDate
            };
        }
    }

    loadRangeTotal() {
        const { startDate, endDate } = this.getDateRange();
        if (!startDate || !endDate) return;
        this.rangeLoading = true;
        this.expenseService.getTotalByDateRange(this.user.username, startDate, endDate).subscribe({
            next: (total) => {
                this.rangeTotal = total;
                this.rangeLoading = false;
            },
            error: () => {
                this.rangeTotal = null;
                this.rangeLoading = false;
            }
        });
    }

    setFilter(mode: 'monthly' | 'weekly' | 'custom') {
        this.filterMode = mode;
        if (mode !== 'custom') {
            this.loadRangeTotal();
        }
    }

    applyCustomRange() {
        this.loadRangeTotal();
    }

    get filterLabel(): string {
        const { startDate, endDate } = this.getDateRange();
        return `${startDate} → ${endDate}`;
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
