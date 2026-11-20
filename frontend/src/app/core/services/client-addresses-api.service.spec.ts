import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ClientAddress, ClientAddressRequest } from '../../features/clients/models/client-address.model';
import { ClientAddressesApiService } from './client-addresses-api.service';

const request: ClientAddressRequest = { addressType: 'Residential', addressLine1: '1 First Street', addressLine2: null, city: 'Durban', province: null, postalCode: '4001' };
const stored: ClientAddress = { addressId: 5, clientId: 7, createdAt: '2026-11-20T08:00:00Z', ...request };

describe('ClientAddressesApiService', () => {
  let service: ClientAddressesApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ClientAddressesApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists and reads addresses through the client route', () => {
    let listed: ClientAddress[] = [];
    let single: ClientAddress | null = null;
    service.getAddresses(7).subscribe(addresses => (listed = addresses));
    service.getAddress(7, 5).subscribe(address => (single = address));

    const list = httpTesting.expectOne('/api/clients/7/addresses');
    const one = httpTesting.expectOne('/api/clients/7/addresses/5');
    expect([list.request.method, one.request.method]).toEqual(['GET', 'GET']);
    list.flush([stored]);
    one.flush(stored);

    expect(listed).toEqual([stored]);
    expect(single).toEqual(stored);
  });

  it('creates with POST and the request body only', () => {
    service.createAddress(7, request).subscribe();

    const httpRequest = httpTesting.expectOne('/api/clients/7/addresses');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual(request);
    expect(['addressId', 'clientId', 'createdAt'].some(key => key in httpRequest.request.body)).toBe(false);
    httpRequest.flush(stored, { status: 201, statusText: 'Created' });
  });

  it('updates with PUT to the address URL', () => {
    service.updateAddress(7, 5, request).subscribe();

    const httpRequest = httpTesting.expectOne('/api/clients/7/addresses/5');
    expect(httpRequest.request.method).toBe('PUT');
    expect(httpRequest.request.body).toEqual(request);
    httpRequest.flush(stored);
  });

  it('deletes with DELETE and no body, completing on 204 and propagating 404', () => {
    let completed = false;
    let failedStatus = 0;
    service.deleteAddress(7, 5).subscribe({ complete: () => (completed = true) });
    service.deleteAddress(7, 6).subscribe({ error: (error: { status: number }) => (failedStatus = error.status) });

    const deleted = httpTesting.expectOne('/api/clients/7/addresses/5');
    expect([deleted.request.method, deleted.request.body]).toEqual(['DELETE', null]);
    deleted.flush(null, { status: 204, statusText: 'No Content' });
    httpTesting.expectOne('/api/clients/7/addresses/6').flush(null, { status: 404, statusText: 'Not Found' });

    expect([completed, failedStatus]).toEqual([true, 404]);
  });
});
