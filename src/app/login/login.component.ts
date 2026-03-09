import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ReactiveFormsModule, CommonModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.css'
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);

    loginForm = this.fb.group({
        username: ['', Validators.required],
        password: ['', Validators.required]
    });

    isSubmitting = false;
    errorMessage = '';

    onSubmit() {
        if (this.loginForm.invalid) return;
        this.isSubmitting = true;
        this.errorMessage = '';
        const { username, password } = this.loginForm.value;

        this.authService.login(username!, password!).subscribe({
            next: () => {
                // Redirection handled by service
                this.isSubmitting = false;
            },
            error: (err) => {
                this.errorMessage = err.error?.message || 'Login failed. Please check credentials.';
                this.isSubmitting = false;
            }
        });
    }
}
