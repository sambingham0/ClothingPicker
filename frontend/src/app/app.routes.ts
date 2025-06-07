import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login';
import { Picker } from './picker/picker';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { 
    path: '', 
    component: Picker, 
    canActivate: [AuthGuard] 
  },
  { path: '**', redirectTo: '/' }
];