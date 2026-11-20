using System.Data;
using Microsoft.Data.Sqlite;

namespace Rtt.ClientManagement.Api;

public sealed class ClientExportDataAccess(SqliteConnectionFactory connectionFactory)
{
    private const string ClientAddressExportQuery = """
        SELECT Client.ClientId,
               Client.FirstName,
               Client.LastName,
               Client.Gender,
               Client.DateOfBirth,
               ClientAddress.AddressType,
               ClientAddress.AddressLine1,
               ClientAddress.AddressLine2,
               ClientAddress.City,
               ClientAddress.Province,
               ClientAddress.PostalCode
        FROM Client
        LEFT JOIN ClientAddress ON ClientAddress.ClientId = Client.ClientId
        ORDER BY Client.ClientId, ClientAddress.AddressId;
        """;

    public async Task<SqliteDataReader> OpenClientAddressReaderAsync(CancellationToken cancellationToken)
    {
        var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        try
        {
            var command = connection.CreateCommand();
            command.CommandText = ClientAddressExportQuery;
            return await command.ExecuteReaderAsync(CommandBehavior.CloseConnection, cancellationToken);
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }
}
