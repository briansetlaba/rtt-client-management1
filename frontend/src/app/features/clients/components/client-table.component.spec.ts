import { TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { Client, ClientPageChange } from '../models/client.model';
import { ClientTableComponent } from './client-table.component';

const sampleClients: Client[] = [
  { clientId: 21, firstName: 'Thandi', lastName: 'Nkosi', gender: 'Female', dateOfBirth: '1985-03-21', createdAt: '2026-11-20T08:00:00Z', updatedAt: null },
  { clientId: 22, firstName: 'Pieter', lastName: 'Smit', gender: 'Male', dateOfBirth: null, createdAt: '2026-11-20T08:00:00Z', updatedAt: null }
];

async function renderTable(clients: Client[], loading: boolean, emptyMessage = 'No clients found.') {
  TestBed.configureTestingModule({ providers: [providePrimeNG()] });
  const fixture = TestBed.createComponent(ClientTableComponent);
  fixture.componentRef.setInput('clients', clients);
  fixture.componentRef.setInput('totalRecords', 45);
  fixture.componentRef.setInput('loading', loading);
  fixture.componentRef.setInput('page', 2);
  fixture.componentRef.setInput('pageSize', 20);
  fixture.componentRef.setInput('pageSizeOptions', [10, 20, 50, 100]);
  fixture.componentRef.setInput('emptyMessage', emptyMessage);
  await fixture.whenStable();
  return fixture;
}

describe('ClientTableComponent', () => {
  it('renders the five client columns and one row per client', async () => {
    const fixture = await renderTable(sampleClients, false);
    const element: HTMLElement = fixture.nativeElement;

    const headers = Array.from(element.querySelectorAll('th')).map(header => header.textContent?.trim());
    expect(headers).toEqual(['Client ID', 'First Name', 'Last Name', 'Gender', 'Date of Birth']);

    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Thandi');
    expect(rows[1].textContent).toContain('—');
    expect(element.textContent).toContain('Showing 21 to 40 of 45 clients');
  });

  it('shows the empty message only when not loading', async () => {
    const idle = await renderTable([], false, 'No clients match "zz".');
    expect((idle.nativeElement as HTMLElement).textContent).toContain('No clients match "zz".');

    TestBed.resetTestingModule();
    const loading = await renderTable([], true, 'No clients match "zz".');
    expect((loading.nativeElement as HTMLElement).textContent).not.toContain('No clients match');
  });

  it('translates zero-based table offsets into one-based API pages', async () => {
    const fixture = await renderTable(sampleClients, false);
    const emitted: ClientPageChange[] = [];
    fixture.componentInstance.pageChange.subscribe(change => emitted.push(change));

    const table = fixture.componentInstance as unknown as { onLazyLoad(event: { first: number; rows: number }): void };
    table.onLazyLoad({ first: 0, rows: 20 });
    table.onLazyLoad({ first: 40, rows: 20 });
    table.onLazyLoad({ first: 0, rows: 50 });

    expect(emitted).toEqual([
      { page: 1, pageSize: 20 },
      { page: 3, pageSize: 20 },
      { page: 1, pageSize: 50 }
    ]);
  });
});
