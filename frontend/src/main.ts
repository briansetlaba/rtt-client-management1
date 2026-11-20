import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppShellComponent } from './app/layout/app-shell.component';

bootstrapApplication(AppShellComponent, appConfig).catch(error => console.error(error));
