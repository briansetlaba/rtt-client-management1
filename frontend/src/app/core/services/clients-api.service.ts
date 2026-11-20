import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Client, ClientListQuery, ClientSaveRequest, PagedResponse } from '../../features/clients/models/client.model';

const clientsUrl = '/api/clients';

@Injectable({ providedIn: 'root' })
export class ClientsApiService {
  private readonly http = inject(HttpClient);

  getClients(query: ClientListQuery): Observable<PagedResponse<Client>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);

    if (query.search) {
      params = params.set('search', query.search);
    }

    return this.http.get<PagedResponse<Client>>(clientsUrl, { params });
  }

  createClient(request: ClientSaveRequest): Observable<Client> {
    return this.http.post<Client>(clientsUrl, request);
  }

  updateClient(clientId: number, request: ClientSaveRequest): Observable<Client> {
    return this.http.put<Client>(`${clientsUrl}/${clientId}`, request);
  }

  deleteClient(clientId: number): Observable<void> {
    return this.http.delete<void>(`${clientsUrl}/${clientId}`);
  }
}
