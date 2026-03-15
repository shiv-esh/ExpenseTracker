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

    // Range filter state (spending summary card)
    filterMode: 'monthly' | 'weekly' | 'custom' = 'monthly';
    rangeTotal: number | null = null;
    rangeLoading: boolean = false;
    customStartDate: string = '';
    customEndDate: string = '';

    // Analytics state
    categoryTotals: { [key: string]: number } = {};
    analyticsLoading: boolean = false;

    // Expense list filter & pagination
    listFilterDate: string = '';
    listFilterActive: boolean = false;
    currentPage: number = 1;
    pageSize: number = 10;

    newExpense = {
        amount: null,
        category: null,
        description: '',
        date: ''
    };

    // Edit state
    isEditing: boolean = false;
    editingId: string | null = null;

    constructor(
        private authService: AuthService,
        private expenseService: ExpenseService,
        private router: Router
    ) {
        this.newExpense.date = this.formatDate(new Date());
    }

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
        this.loadAnalytics();
    }

    loadExpenses() {
        this.expenseService.getExpensesByUser(this.user.username).subscribe(data => {
            // Sort descending by date on arrival
            this.expenses = (data || []).sort((a: any, b: any) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );
        });
    }

    // Derived list shown in the table
    get filteredExpenses(): any[] {
        if (this.listFilterActive && this.listFilterDate) {
            return this.expenses.filter(e => e.date === this.listFilterDate);
        }
        return this.expenses;
    }

    toggleListFilter() {
        this.listFilterActive = !this.listFilterActive;
        this.currentPage = 1; // Reset to first page when filtering
        if (!this.listFilterActive) {
            this.listFilterDate = '';
        }
    }

    get paginatedExpenses(): any[] {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        return this.filteredExpenses.slice(startIndex, startIndex + this.pageSize);
    }

    get totalPages(): number {
        return Math.ceil(this.filteredExpenses.length / this.pageSize) || 1;
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }

    loadCategories() {
        this.expenseService.getCategories().subscribe(data => {
            this.categories = data;
        });
    }

    saveExpense() {
        const expenseData = {
            ...this.newExpense,
            user: this.user
        };

        if (this.isEditing && this.editingId) {
            this.expenseService.updateExpense(this.editingId, expenseData).subscribe(() => {
                this.loadAllData();
                this.cancelEdit();
            });
        } else {
            this.expenseService.recordExpense(expenseData).subscribe(() => {
                this.loadAllData();
                this.resetForm();
            });
        }
    }

    private loadAllData() {
        this.loadExpenses();
        this.loadDailyTotal();
        this.loadRangeTotal();
        this.loadAnalytics();
    }

    editExpense(expense: any) {
        this.isEditing = true;
        this.editingId = expense.id;
        this.newExpense = {
            amount: expense.amount,
            category: this.categories.find(c => c.id === expense.category?.id) || expense.category,
            description: expense.description || '',
            date: expense.date
        };
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    cancelEdit() {
        this.isEditing = false;
        this.editingId = null;
        this.resetForm();
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
            this.loadAnalytics();
        });
    }

    // --- Range filter helpers ---
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private getDateRange(): { startDate: string; endDate: string } {
        const today = new Date();
        if (this.filterMode === 'monthly') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return {
                startDate: this.formatDate(start),
                endDate: this.formatDate(end)
            };
        } else if (this.filterMode === 'weekly') {
            const dayOfWeek = today.getDay(); // 0 = Sun
            const start = new Date(today);
            start.setDate(today.getDate() - dayOfWeek);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return {
                startDate: this.formatDate(start),
                endDate: this.formatDate(end)
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

    loadAnalytics() {
        const { startDate, endDate } = this.getDateRange();
        if (!startDate || !endDate) return;
        this.analyticsLoading = true;
        this.expenseService.getCategoryAnalytics(this.user.username, startDate, endDate).subscribe({
            next: (data) => {
                this.categoryTotals = data || {};
                this.analyticsLoading = false;
            },
            error: () => {
                this.categoryTotals = {};
                this.analyticsLoading = false;
            }
        });
    }

    get categoryAnalyticsArray() {
        return Object.entries(this.categoryTotals)
            .sort((a, b) => b[1] - a[1]) // Sort by amount descending
            .map(([name, value]) => ({ name, value }));
    }

    get totalCategoryAmount(): number {
        return Object.values(this.categoryTotals).reduce((a: number, b: number) => a + b, 0);
    }

    // Chart helpers
    getCategoryColor(index: number): string {
        const colors = [
            '#e63946', '#f4a261', '#2a9d8f', '#264653', '#e9c46a', 
            '#457b9d', '#1d3557', '#a8dadc', '#9b5de5', '#f15bb5'
        ];
        return colors[index % colors.length];
    }

    getStrokeOffset(amount: number, index: number): number {
        const circumference = 440; // 2 * pi * r (r=70)
        let previousTotal = 0;
        const array = this.categoryAnalyticsArray;
        for (let i = 0; i < index; i++) {
            previousTotal += array[i].value;
        }
        
        // This is for a stacked donut implementation
        const total = this.totalCategoryAmount;
        if (total === 0) return circumference;
        
        return circumference - (amount / total) * circumference;
    }

    // Since we're doing a simple SVG donut, we need the "start offset" 
    // which is tricky with just CSS stroke-dashoffset if elements overlap.
    // A better way for a single SVG circle with multiple segments is to stack them.
    getRotation(index: number): string {
        const total = this.totalCategoryAmount;
        if (total === 0) return 'rotate(0)';
        
        const array = this.categoryAnalyticsArray;
        let previousTotal = 0;
        for (let i = 0; i < index; i++) {
            previousTotal += array[i].value;
        }
        
        const angle = (previousTotal / total) * 360;
        return `rotate(${angle - 90}deg)`; // -90 to start from top
    }

    setFilter(mode: 'monthly' | 'weekly' | 'custom') {
        this.filterMode = mode;
        if (mode !== 'custom') {
            this.loadRangeTotal();
            this.loadAnalytics();
        }
    }

    applyCustomRange() {
        this.loadRangeTotal();
        this.loadAnalytics();
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
            date: this.formatDate(new Date())
        };
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}
