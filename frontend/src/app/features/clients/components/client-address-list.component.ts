import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ClientAddress } from '../models/client-address.model';

@Component({
  selector: 'app-client-address-list',
  imports: [ButtonModule, TableModule],
  templateUrl: './client-address-list.component.html'
})
export class ClientAddressListComponent {
  readonly addresses = input.required<ClientAddress[]>();
  readonly loading = input.required<boolean>();
  readonly deletingAddressId = input<number | null>(null);

  readonly editAddress = output<ClientAddress>();
  readonly deleteAddress = output<ClientAddress>();

  protected addressLines(address: ClientAddress): string {
    return [address.addressLine1, address.addressLine2].filter(Boolean).join(', ');
  }

  protected actionLabel(action: string, address: ClientAddress): string {
    return `${action} ${address.addressType} address ${address.addressLine1}`;
  }
}
