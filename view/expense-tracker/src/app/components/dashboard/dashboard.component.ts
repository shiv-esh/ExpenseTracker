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
    listFilterStartDate: string = '';
    listFilterEndDate: string = '';
    listFilterCategory: string = '';
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

    // Add/Edit now lives in a dialog instead of an always-open form
    modalOpen: boolean = false;

    // Monthly budget (new — persisted locally per user)
    budget: number = 900;

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

        const savedBudget = localStorage.getItem(`expense-tracker-budget-${this.user.username}`);
        if (savedBudget) this.budget = parseFloat(savedBudget);

        this.loadExpenses();
        this.loadCategories();
        this.loadDailyTotal();
        this.loadRangeTotal();
        this.loadAnalytics();
    }

    loadExpenses() {
        this.expenseService.getExpensesByUser(this.user.username).subscribe(data => {
            this.expenses = (data || []).sort((a: any, b: any) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );
        });
    }

    get filteredExpenses(): any[] {
        let filtered = this.expenses;
        if (this.listFilterActive) {
            if (this.listFilterStartDate) {
                filtered = filtered.filter(e => e.date >= this.listFilterStartDate);
            }
            if (this.listFilterEndDate) {
                filtered = filtered.filter(e => e.date <= this.listFilterEndDate);
            }
            if (this.listFilterCategory) {
                filtered = filtered.filter(e => e.category?.id === this.listFilterCategory);
            }
        }
        return filtered;
    }

    toggleListFilter() {
        this.listFilterActive = !this.listFilterActive;
        this.currentPage = 1;
        if (!this.listFilterActive) {
            this.listFilterStartDate = '';
            this.listFilterEndDate = '';
            this.listFilterCategory = '';
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
        if (this.currentPage < this.totalPages) this.currentPage++;
    }

    prevPage() {
        if (this.currentPage > 1) this.currentPage--;
    }

    loadCategories() {
        this.expenseService.getCategories().subscribe(data => {
            this.categories = data;
        });
    }

    // --- Modal (Add / Edit) ---
    openAddModal() {
        this.isEditing = false;
        this.editingId = null;
        this.resetForm();
        this.modalOpen = true;
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
        this.modalOpen = true;
    }

    closeModal() {
        this.modalOpen = false;
        this.isEditing = false;
        this.editingId = null;
        this.resetForm();
    }

    saveExpense() {
        const expenseData = {
            ...this.newExpense,
            user: this.user
        };

        if (this.isEditing && this.editingId) {
            this.expenseService.updateExpense(this.editingId, expenseData).subscribe(() => {
                this.loadAllData();
                this.closeModal();
            });
        } else {
            this.expenseService.recordExpense(expenseData).subscribe(() => {
                this.loadAllData();
                this.closeModal();
            });
        }
    }

    private loadAllData() {
        this.loadExpenses();
        this.loadDailyTotal();
        this.loadRangeTotal();
        this.loadAnalytics();
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

    // --- Budget ---
    setBudget(value: string) {
        const n = parseFloat(value);
        if (!isNaN(n) && n >= 0) {
            this.budget = n;
            localStorage.setItem(`expense-tracker-budget-${this.user.username}`, String(n));
        }
    }

    get monthSpent(): number {
        const now = new Date();
        const start = this.formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
        const end = this.formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        return this.expenses
            .filter(e => e.date >= start && e.date <= end)
            .reduce((a, e) => a + e.amount, 0);
    }

    get budgetPercent(): number {
        return this.budget > 0 ? (this.monthSpent / this.budget) * 100 : 0;
    }

    get budgetPercentClamped(): number {
        return Math.min(100, this.budgetPercent);
    }

    get overBudget(): boolean {
        return this.budgetPercent > 100;
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
            return { startDate: this.formatDate(start), endDate: this.formatDate(end) };
        } else if (this.filterMode === 'weekly') {
            const dayOfWeek = today.getDay();
            const start = new Date(today);
            start.setDate(today.getDate() - dayOfWeek);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return { startDate: this.formatDate(start), endDate: this.formatDate(end) };
        } else {
            return { startDate: this.customStartDate, endDate: this.customEndDate };
        }
    }

    loadRangeTotal() {
        const { startDate, endDate } = this.getDateRange();
        if (!startDate || !endDate) return;
        this.rangeLoading = true;
        this.expenseService.getTotalByDateRange(this.user.username, startDate, endDate).subscribe({
            next: (total) => { this.rangeTotal = total; this.rangeLoading = false; },
            error: () => { this.rangeTotal = null; this.rangeLoading = false; }
        });
    }

    loadAnalytics() {
        const { startDate, endDate } = this.getDateRange();
        if (!startDate || !endDate) return;
        this.analyticsLoading = true;
        this.expenseService.getCategoryAnalytics(this.user.username, startDate, endDate).subscribe({
            next: (data) => { this.categoryTotals = data || {}; this.analyticsLoading = false; },
            error: () => { this.categoryTotals = {}; this.analyticsLoading = false; }
        });
    }

    get categoryAnalyticsArray() {
        return Object.entries(this.categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([name, value]) => ({ name, value }));
    }

    get totalCategoryAmount(): number {
        return Object.values(this.categoryTotals).reduce((a: number, b: number) => a + b, 0);
    }

    // Chart helpers — a fixed, hue-varied palette assigned by category identity
    // (not by sort rank) so a given category keeps the same color across
    // date ranges. Kept separate from the nav/button accent, which stays gold.
    private readonly categoryPalette: string[] = [
        '#b68235', // gold (brand accent)
        '#159c85', // teal
        '#b1502f', // rust
        '#3f5aa0', // slate blue
        '#9c8419', // olive
        '#9c3f78', // mauve
        '#3f8a2f', // forest
        '#a83a5a', // wine
    ];

    getCategoryColor(name: string): string {
        const idx = this.categories.findIndex(c => c.name === name);
        return this.categoryPalette[(idx >= 0 ? idx : 0) % this.categoryPalette.length];
    }

    getStrokeOffset(amount: number, index: number): number {
        const circumference = 440;
        const total = this.totalCategoryAmount;
        if (total === 0) return circumference;
        return circumference - (amount / total) * circumference;
    }

    getRotation(index: number): string {
        const total = this.totalCategoryAmount;
        if (total === 0) return 'rotate(0)';
        const array = this.categoryAnalyticsArray;
        let previousTotal = 0;
        for (let i = 0; i < index; i++) previousTotal += array[i].value;
        const angle = (previousTotal / total) * 360;
        return `rotate(${angle - 90}deg)`;
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
