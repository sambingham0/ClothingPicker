import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private tokenKey = 'clothes_picker_token';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // On service init, try to load user info from token if present
    const token = this.getToken();
    if (token) {
      this.http
        .get<User>(`${environment.apiUrl}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .subscribe({
          next: (user) => this.currentUserSubject.next(user),
          error: () => this.logout(),
        });
    }
  }

  get currentUser$(): Observable<User | null> {
    return this.currentUserSubject.asObservable();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private setToken(token: string) {
    localStorage.setItem(this.tokenKey, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  signIn(email: string, password: string): Promise<void> {
    return this.http
      .post<{ token: string; user: User }>(`${environment.apiUrl}/auth/login`, {
        email,
        password,
      })
      .pipe(
        tap((resp) => {
          this.setToken(resp.token);
          this.currentUserSubject.next(resp.user);
        })
      ).toPromise().then(() => {});
  }

  signUp(email: string, password: string): Promise<void> {
    return this.http
      .post<{ token: string; user: User }>(`${environment.apiUrl}/auth/register`, {
        email,
        password,
      })
      .pipe(
        tap((resp) => {
          this.setToken(resp.token);
          this.currentUserSubject.next(resp.user);
        })
      ).toPromise().then(() => {});
  }

  signOut(): Promise<void> {
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
    return Promise.resolve();
  }

  logout() {
    this.signOut();
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}