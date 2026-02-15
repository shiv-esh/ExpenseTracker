import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.css']
})
export class RegisterComponent {
    user = { username: '', password: '', role: 'USER' };
    errorMessage = '';

    constructor(private authService: AuthService, private router: Router) { }

    register() {
        this.authService.register(this.user).subscribe({
            next: () => this.router.navigate(['/login']),
            error: (err) => this.errorMessage = err.error || 'Registration failed'
        });
    }
}
