import { HttpErrorResponse } from '@angular/common/http';
import { Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { Observable, Subject } from 'rxjs';
import { ClientsApiService } from '../../../core/services/clients-api.service';
import { Client, ClientListQuery, ClientPageChange, PagedResponse } from '../models/client.model';
import { ClientListPage } from './client-list.page';

interface RecordedRequest {
  query: ClientListQuery;
  response: Subject<PagedResponse<Client>>;
}

class RecordingClientsApi {
  readonly requests: RecordedRequest[] = [];

  getClients(query: ClientListQuery): Observable<PagedResponse<Client>> {
    const response = new Subject<PagedResponse<Client>>();
    this.requests.push({ query, response });
    return response.asObservable();
  }
}

interface ClientListPageState {
  query: Signal<ClientListQuery>;
  clients: Signal<Client[]>;
  totalRecords: Signal<number>;
  loading: Signal<boolean>;
  errorMessage: Signal<string | null>;
  emptyMessage: Signal<string>;
  onSearchInput(value: string): void;
  clearSearch(): void;
  onPageChange(change: ClientPageChange): void;
  retry(): void;
}

function pageOf(page: number, pageSize: number, totalCount: number, firstName: string): PagedResponse<Client> {
  return {
    items: [{ clientId: page, firstName, lastName: 'Test', gender: 'Other', dateOfBirth: null, createdAt: '2026-11-20T08:00:00Z', updatedAt: null }],
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize)
  };
}

describe('ClientListPage', () => {
  let api: RecordingClientsApi;
  let fixture: ComponentFixture<ClientListPage>;
  let page: ClientListPageState;

  beforeEach(async () => {
    vi.useFakeTimers();
    api = new RecordingClientsApi();
    TestBed.configureTestingModule({
      providers: [providePrimeNG(), { provide: ClientsApiService, useValue: api }]
    });
    fixture = TestBed.createComponent(ClientListPage);
    page = fixture.componentInstance as unknown as ClientListPageState;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('requests the first page exactly once on start, ignoring the table initial lazy event', () => {
    page.onPageChange({ page: 1, pageSize: 20 });

    expect(api.requests.map(request => request.query)).toEqual([{ page: 1, pageSize: 20, search: '' }]);
    expect(page.loading()).toBe(true);

    api.requests[0].response.next(pageOf(1, 20, 41, 'First'));
    expect(page.loading()).toBe(false);
    expect(page.clients()[0].firstName).toBe('First');
    expect(page.totalRecords()).toBe(41);
  });

  it('requests the selected page and resets to page 1 when the page size changes', () => {
    page.onPageChange({ page: 2, pageSize: 20 });
    page.onPageChange({ page: 3, pageSize: 50 });

    expect(api.requests.map(request => request.query)).toEqual([
      { page: 1, pageSize: 20, search: '' },
      { page: 2, pageSize: 20, search: '' },
      { page: 1, pageSize: 50, search: '' }
    ]);
  });

  it('debounces search input, trims it, caps it at 100 characters and resets to page 1', () => {
    page.onPageChange({ page: 3, pageSize: 20 });
    page.onSearchInput('J');
    page.onSearchInput('Jo');
    page.onSearchInput('  John  ');
    vi.advanceTimersByTime(299);
    expect(api.requests.length).toBe(2);

    vi.advanceTimersByTime(1);
    expect(api.requests.length).toBe(3);
    expect(api.requests[2].query).toEqual({ page: 1, pageSize: 20, search: 'John' });

    page.onSearchInput('x'.repeat(150));
    vi.advanceTimersByTime(300);
    expect(api.requests[3].query.search.length).toBe(100);
  });

  it('restores the unfiltered listing when the search is cleared', () => {
    page.onSearchInput('Smith');
    vi.advanceTimersByTime(300);
    page.clearSearch();
    vi.advanceTimersByTime(300);

    expect(api.requests.map(request => request.query.search)).toEqual(['', 'Smith', '']);
    expect(page.emptyMessage()).toBe('No clients found.');
  });

  it('does not request again when typing settles back on the current search', () => {
    page.onSearchInput('a');
    page.onSearchInput('');
    vi.advanceTimersByTime(300);

    expect(api.requests.length).toBe(1);
  });

  it('cancels obsolete requests so stale responses cannot overwrite newer results', () => {
    page.onPageChange({ page: 2, pageSize: 20 });
    page.onPageChange({ page: 3, pageSize: 20 });
    const [, obsolete, current] = api.requests;

    expect(obsolete.response.observed).toBe(false);
    obsolete.response.next(pageOf(2, 20, 60, 'Stale'));
    expect(page.clients()).toEqual([]);

    current.response.next(pageOf(3, 20, 60, 'Current'));
    expect(page.clients()[0].firstName).toBe('Current');
    expect(page.query().page).toBe(3);
  });

  it('clears previous rows while a new page is loading', () => {
    api.requests[0].response.next(pageOf(1, 20, 60, 'First'));
    page.onPageChange({ page: 2, pageSize: 20 });

    expect(page.clients()).toEqual([]);
    expect(page.loading()).toBe(true);
  });

  it('shows a concise error and retries the same request', () => {
    page.onPageChange({ page: 2, pageSize: 20 });
    api.requests[1].response.error(new HttpErrorResponse({ status: 0, statusText: 'Unknown Error', error: 'stack trace details' }));

    expect(page.loading()).toBe(false);
    expect(page.errorMessage()).toBe('The client service could not be reached. Check that the API is running, then retry.');
    expect(page.clients()).toEqual([]);

    page.retry();
    expect(api.requests[2].query).toEqual({ page: 2, pageSize: 20, search: '' });
    expect(page.errorMessage()).toBeNull();

    api.requests[2].response.next(pageOf(2, 20, 30, 'Recovered'));
    expect(page.clients()[0].firstName).toBe('Recovered');
  });

  it('uses a search-specific empty message', () => {
    page.onSearchInput('Nobody');
    vi.advanceTimersByTime(300);
    api.requests[1].response.next({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });

    expect(page.emptyMessage()).toBe('No clients match "Nobody".');
  });
});
