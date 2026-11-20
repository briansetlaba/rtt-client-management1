import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ClientContact } from '../models/client-contact.model';

@Component({
  selector: 'app-client-contact-list',
  imports: [ButtonModule, TableModule],
  templateUrl: './client-contact-list.component.html'
})
export class ClientContactListComponent {
  readonly contacts = input.required<ClientContact[]>();
  readonly loading = input.required<boolean>();
  readonly deletingContactId = input<number | null>(null);

  readonly editContact = output<ClientContact>();
  readonly deleteContact = output<ClientContact>();

  protected actionLabel(action: string, contact: ClientContact): string {
    return `${action} ${contact.contactType} contact ${contact.contactValue}`;
  }
}
