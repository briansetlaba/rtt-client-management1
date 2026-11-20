import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'clients' },
  {
    path: 'clients',
    title: 'Clients | RTT Client Management',
    loadComponent: () => import('./features/clients/pages/client-list.page').then(module => module.ClientListPage)
  },
  { path: '**', redirectTo: 'clients' }
];
