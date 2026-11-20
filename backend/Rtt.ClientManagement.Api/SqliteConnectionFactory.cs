using Microsoft.Data.Sqlite;

namespace Rtt.ClientManagement.Api;

public sealed class SqliteConnectionFactory(string connectionString)
{
    public async Task<SqliteConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        var connection = new SqliteConnection(connectionString);
        try
        {
            await connection.OpenAsync(cancellationToken);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }
}
