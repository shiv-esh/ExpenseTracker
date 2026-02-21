import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ExpenseService {
    private apiUrl = `${environment.apiUrl}/api/expenses`;

    constructor(private http: HttpClient) { }

    getExpensesByUser(username: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/user/${username}`);
    }

    recordExpense(expense: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/record`, expense);
    }

    getDailyTotal(username: string, date: string): Observable<number> {
        return this.http.get<number>(`${this.apiUrl}/total`, {
            params: { username, date }
        });
    }

    getTotalByDateRange(username: string, startDate: string, endDate: string): Observable<number> {
        return this.http.get<number>(`${this.apiUrl}/total/range`, {
            params: { username, startDate, endDate }
        });
    }

    deleteExpense(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    getCategories(): Observable<any[]> {
        return this.http.get<any[]>(`${environment.apiUrl}/api/categories`);
    }
}
