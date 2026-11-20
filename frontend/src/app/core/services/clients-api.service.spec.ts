import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ClientsApiService } from './clients-api.service';

describe('ClientsApiService', () => {
  let service: ClientsApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ClientsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests the relative client list endpoint with page and page size', () => {
    service.getClients({ page: 2, pageSize: 50, search: '' }).subscribe();

    const request = httpTesting.expectOne(candidate => candidate.url === '/api/clients');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('50');
    expect(request.request.params.has('search')).toBe(false);
    request.flush({ items: [], page: 2, pageSize: 50, totalCount: 0, totalPages: 0 });
  });

  it('includes the search parameter when a search is provided', () => {
    service.getClients({ page: 1, pageSize: 20, search: 'Smith' }).subscribe();

    const request = httpTesting.expectOne(candidate => candidate.url === '/api/clients');
    expect(request.request.params.get('search')).toBe('Smith');
    request.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
  });
});
