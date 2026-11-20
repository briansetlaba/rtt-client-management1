using System.Globalization;
using Microsoft.Data.Sqlite;

namespace Rtt.ClientManagement.Api;

public sealed class ClientDataAccess(SqliteConnectionFactory connectionFactory)
{
    private const string ClientColumns = "ClientId, FirstName, LastName, Gender, DateOfBirth, CreatedAt, UpdatedAt";
    private const string DateOfBirthFormat = "yyyy-MM-dd";
    private const string NameSearchCondition = "($namePattern IS NULL OR FirstName LIKE $namePattern ESCAPE '\\' OR LastName LIKE $namePattern ESCAPE '\\')";

    public async Task<PagedResponse<ClientResponse>> GetClientPageAsync(int page, int pageSize, string? search, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        var namePattern = CreateNamePattern(search);

        await using var countCommand = connection.CreateCommand();
        countCommand.CommandText = $"SELECT COUNT(*) FROM Client WHERE {NameSearchCondition};";
        countCommand.Parameters.AddWithValue("$namePattern", (object?)namePattern ?? DBNull.Value);
        var totalCount = Convert.ToInt64(await countCommand.ExecuteScalarAsync(cancellationToken));

        var clients = new List<ClientResponse>(pageSize);
        if (totalCount > 0)
        {
            await using var pageCommand = connection.CreateCommand();
            pageCommand.CommandText = $"SELECT {ClientColumns} FROM Client WHERE {NameSearchCondition} ORDER BY ClientId LIMIT $limit OFFSET $offset;";
            pageCommand.Parameters.AddWithValue("$namePattern", (object?)namePattern ?? DBNull.Value);
            pageCommand.Parameters.AddWithValue("$limit", pageSize);
            pageCommand.Parameters.AddWithValue("$offset", (long)(page - 1) * pageSize);

            await using var reader = await pageCommand.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                clients.Add(ReadClient(reader));
            }
        }

        var totalPages = (totalCount + pageSize - 1) / pageSize;
        return new PagedResponse<ClientResponse>(clients, page, pageSize, totalCount, totalPages);
    }

    public async Task<ClientResponse?> GetClientAsync(long clientId, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT {ClientColumns} FROM Client WHERE ClientId = $clientId;";
        command.Parameters.AddWithValue("$clientId", clientId);
        return await ReadSingleClientAsync(command, cancellationToken);
    }

    public async Task<ClientResponse> CreateClientAsync(ClientDetails client, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            INSERT INTO Client (FirstName, LastName, Gender, DateOfBirth)
            VALUES ($firstName, $lastName, $gender, $dateOfBirth)
            RETURNING {ClientColumns};
            """;
        AddClientDetailParameters(command, client);
        return await ReadSingleClientAsync(command, cancellationToken)
            ?? throw new InvalidOperationException("The inserted client was not returned.");
    }

    public async Task<ClientResponse?> UpdateClientAsync(long clientId, ClientDetails client, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            UPDATE Client
            SET FirstName = $firstName,
                LastName = $lastName,
                Gender = $gender,
                DateOfBirth = $dateOfBirth,
                UpdatedAt = CURRENT_TIMESTAMP
            WHERE ClientId = $clientId
            RETURNING {ClientColumns};
            """;
        AddClientDetailParameters(command, client);
        command.Parameters.AddWithValue("$clientId", clientId);
        return await ReadSingleClientAsync(command, cancellationToken);
    }

    public async Task<bool> DeleteClientAsync(long clientId, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM Client WHERE ClientId = $clientId;";
        command.Parameters.AddWithValue("$clientId", clientId);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    private static string? CreateNamePattern(string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return null;
        }

        var escapedSearch = search.Trim()
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_");
        return $"%{escapedSearch}%";
    }

    private static void AddClientDetailParameters(SqliteCommand command, ClientDetails client)
    {
        command.Parameters.AddWithValue("$firstName", client.FirstName);
        command.Parameters.AddWithValue("$lastName", client.LastName);
        command.Parameters.AddWithValue("$gender", client.Gender);
        command.Parameters.AddWithValue("$dateOfBirth",
            client.DateOfBirth is { } dateOfBirth
                ? dateOfBirth.ToString(DateOfBirthFormat, CultureInfo.InvariantCulture)
                : DBNull.Value);
    }

    private static async Task<ClientResponse?> ReadSingleClientAsync(SqliteCommand command, CancellationToken cancellationToken)
    {
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadClient(reader) : null;
    }

    private static ClientResponse ReadClient(SqliteDataReader reader) => new(
        reader.GetInt64(0),
        reader.GetString(1),
        reader.GetString(2),
        reader.GetString(3),
        reader.IsDBNull(4) ? null : DateOnly.ParseExact(reader.GetString(4), DateOfBirthFormat, CultureInfo.InvariantCulture),
        ParseUtcTimestamp(reader.GetString(5)),
        reader.IsDBNull(6) ? null : ParseUtcTimestamp(reader.GetString(6)));

    private static DateTime ParseUtcTimestamp(string value) =>
        DateTime.Parse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal);
}
