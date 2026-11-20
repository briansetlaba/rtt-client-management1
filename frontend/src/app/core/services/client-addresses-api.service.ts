import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ClientAddress, ClientAddressRequest } from '../../features/clients/models/client-address.model';

@Injectable({ providedIn: 'root' })
export class ClientAddressesApiService {
  private readonly http = inject(HttpClient);

  getAddresses(clientId: number): Observable<ClientAddress[]> {
    return this.http.get<ClientAddress[]>(addressesUrl(clientId));
  }

  getAddress(clientId: number, addressId: number): Observable<ClientAddress> {
    return this.http.get<ClientAddress>(`${addressesUrl(clientId)}/${addressId}`);
  }

  createAddress(clientId: number, request: ClientAddressRequest): Observable<ClientAddress> {
    return this.http.post<ClientAddress>(addressesUrl(clientId), request);
  }

  updateAddress(clientId: number, addressId: number, request: ClientAddressRequest): Observable<ClientAddress> {
    return this.http.put<ClientAddress>(`${addressesUrl(clientId)}/${addressId}`, request);
  }

  deleteAddress(clientId: number, addressId: number): Observable<void> {
    return this.http.delete<void>(`${addressesUrl(clientId)}/${addressId}`);
  }
}

function addressesUrl(clientId: number): string {
  return `/api/clients/${clientId}/addresses`;
}
