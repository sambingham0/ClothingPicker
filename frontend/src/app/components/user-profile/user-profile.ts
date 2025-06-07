import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-profile',
  template: `
    <div class="user-profile" *ngIf="authService.user$ | async as user">
      <span class="user-email">{{ user.email }}</span>
      <button (click)="logout()" class="logout-btn">Logout</button>
    </div>
  `,
  styles: [`
    .user-profile {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.5rem;
    }

    .user-email {
      font-size: 0.9rem;
      color: #666;
    }

    .logout-btn {
      background-color: #e74c3c;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .logout-btn:hover {
      background-color: #c0392b;
    }
  `],
  imports: [CommonModule]
})
export class UserProfileComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  async logout() {
    try {
      await this.authService.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}