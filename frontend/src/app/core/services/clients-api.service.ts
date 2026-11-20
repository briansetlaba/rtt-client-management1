import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Client, ClientListQuery, PagedResponse } from '../../features/clients/models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientsApiService {
  private readonly http = inject(HttpClient);

  getClients(query: ClientListQuery): Observable<PagedResponse<Client>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);

    if (query.search) {
      params = params.set('search', query.search);
    }

    return this.http.get<PagedResponse<Client>>('/api/clients', { params });
  }
}
