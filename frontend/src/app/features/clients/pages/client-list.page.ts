import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { Subject, catchError, debounceTime, filter, map, of, switchMap, tap } from 'rxjs';
import { ClientsApiService } from '../../../core/services/clients-api.service';
import { ClientTableComponent } from '../components/client-table.component';
import { Client, ClientListQuery, ClientPageChange, PagedResponse } from '../models/client.model';

const searchDebounceMilliseconds = 300;
const maximumSearchLength = 100;
const defaultPageSize = 20;

interface ClientLoadResult {
  response: PagedResponse<Client> | null;
  errorMessage: string | null;
}

@Component({
  selector: 'app-client-list-page',
  imports: [ClientTableComponent, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, MessageModule],
  templateUrl: './client-list.page.html',
  styleUrl: './client-list.page.scss'
})
export class ClientListPage {
  private readonly clientsApi = inject(ClientsApiService);
  private readonly searchInputs = new Subject<string>();
  private readonly queryRequests = new Subject<ClientListQuery>();

  protected readonly maximumSearchLength = maximumSearchLength;
  protected readonly pageSizeOptions = [10, 20, 50, 100];

  protected readonly searchText = signal('');
  protected readonly query = signal<ClientListQuery>({ page: 1, pageSize: defaultPageSize, search: '' });
  protected readonly clients = signal<Client[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly emptyMessage = computed(() => {
    const search = this.query().search;
    return search ? `No clients match "${search}".` : 'No clients found.';
  });

  constructor() {
    this.searchInputs
      .pipe(
        map(normalizeSearch),
        debounceTime(searchDebounceMilliseconds),
        filter(search => search !== this.query().search),
        takeUntilDestroyed()
      )
      .subscribe(search => this.queryRequests.next({ ...this.query(), search, page: 1 }));

    this.queryRequests
      .pipe(
        tap(query => this.startLoading(query)),
        switchMap(query => this.loadClients(query)),
        takeUntilDestroyed()
      )
      .subscribe(result => this.completeLoading(result));

    this.queryRequests.next(this.query());
  }

  protected onSearchInput(value: string): void {
    this.searchText.set(value);
    this.searchInputs.next(value);
  }

  protected clearSearch(): void {
    this.onSearchInput('');
  }

  protected onPageChange(change: ClientPageChange): void {
    const currentQuery = this.query();

    if (change.pageSize !== currentQuery.pageSize) {
      this.queryRequests.next({ ...currentQuery, pageSize: change.pageSize, page: 1 });
    } else if (change.page !== currentQuery.page) {
      this.queryRequests.next({ ...currentQuery, page: change.page });
    }
  }

  protected retry(): void {
    this.queryRequests.next(this.query());
  }

  private startLoading(query: ClientListQuery): void {
    this.query.set(query);
    this.clients.set([]);
    this.errorMessage.set(null);
    this.loading.set(true);
  }

  private loadClients(query: ClientListQuery) {
    return this.clientsApi.getClients(query).pipe(
      map((response): ClientLoadResult => ({ response, errorMessage: null })),
      catchError((error: unknown) => of<ClientLoadResult>({ response: null, errorMessage: describeLoadError(error) }))
    );
  }

  private completeLoading(result: ClientLoadResult): void {
    this.clients.set(result.response?.items ?? []);
    this.totalRecords.set(result.response?.totalCount ?? 0);
    this.errorMessage.set(result.errorMessage);
    this.loading.set(false);
  }
}

function normalizeSearch(value: string): string {
  return value.trim().slice(0, maximumSearchLength);
}

const unreachableServiceStatuses = [0, 502, 503, 504];

function describeLoadError(error: unknown): string {
  if (error instanceof HttpErrorResponse && unreachableServiceStatuses.includes(error.status)) {
    return 'The client service could not be reached. Check that the API is running, then retry.';
  }

  if (error instanceof HttpErrorResponse && error.status === 400) {
    return 'The client search request was not accepted. Adjust the search and retry.';
  }

  return 'Clients could not be loaded. Please retry.';
}
