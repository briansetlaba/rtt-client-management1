import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Client, ClientPageChange } from '../models/client.model';

@Component({
  selector: 'app-client-table',
  imports: [ButtonModule, TableModule],
  templateUrl: './client-table.component.html'
})
export class ClientTableComponent {
  readonly clients = input.required<Client[]>();
  readonly totalRecords = input.required<number>();
  readonly loading = input.required<boolean>();
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly pageSizeOptions = input.required<number[]>();
  readonly emptyMessage = input.required<string>();

  readonly pageChange = output<ClientPageChange>();
  readonly editClient = output<Client>();

  protected readonly firstRecordIndex = computed(() => (this.page() - 1) * this.pageSize());

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const pageSize = event.rows ?? this.pageSize();
    const firstRecordIndex = event.first ?? 0;
    this.pageChange.emit({ page: Math.floor(firstRecordIndex / pageSize) + 1, pageSize });
  }
}
