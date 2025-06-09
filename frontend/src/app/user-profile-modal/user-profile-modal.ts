import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-profile-modal',
  templateUrl: './user-profile-modal.html',
  styleUrl: './user-profile-modal.css',
  imports: [CommonModule]
})
export class UserProfileModal {
  private _visible = false;
  authService = inject(AuthService);
  private router = inject(Router);

  set visible(value: boolean) {
    this._visible = value;
  }

  get visible(): boolean {
    return this._visible;
  }

  async logout() {
    try {
      await this.authService.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  close() {
    this.visible = false;
  }
}