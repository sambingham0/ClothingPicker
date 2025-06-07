import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: 'login.html',
  styleUrl: 'login.css',
  imports: [FormsModule, CommonModule]
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  isSignUp = false;
  loading = false;
  errorMessage = '';

  async onSubmit(form: NgForm) {
    if (!form.valid) return;

    this.loading = true;
    this.errorMessage = '';
    
    const { email, password } = form.value;

    try {
      if (this.isSignUp) {
        await this.authService.signUp(email, password);
      } else {
        await this.authService.signIn(email, password);
      }
      this.router.navigate(['/']);
    } catch (error: any) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  toggleMode() {
    this.isSignUp = !this.isSignUp;
    this.errorMessage = '';
  }

  private getErrorMessage(error: any): string {
    if (error.status === 401) {
      return 'Invalid email or password';
    } else if (error.status === 400) {
      return error.error?.message || 'Invalid request';
    } else if (error.status === 409) {
      return 'Email is already registered';
    }
    return error.message || 'An error occurred';
  }
}