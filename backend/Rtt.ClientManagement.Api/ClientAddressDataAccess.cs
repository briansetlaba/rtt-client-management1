using Microsoft.Data.Sqlite;

namespace Rtt.ClientManagement.Api;

public sealed class ClientAddressDataAccess(SqliteConnectionFactory connectionFactory)
{
    private const string AddressColumns = "AddressId, ClientId, AddressType, AddressLine1, AddressLine2, City, Province, PostalCode, CreatedAt";

    public async Task<IReadOnlyList<ClientAddressResponse>?> GetAddressesAsync(long clientId, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        if (!await ClientDataAccess.ClientExistsAsync(connection, clientId, cancellationToken))
        {
            return null;
        }

        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT {AddressColumns} FROM ClientAddress WHERE ClientId = $clientId ORDER BY AddressId;";
        command.Parameters.AddWithValue("$clientId", clientId);

        var addresses = new List<ClientAddressResponse>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            addresses.Add(ReadAddress(reader));
        }

        return addresses;
    }

    public async Task<ClientAddressResponse?> GetAddressAsync(long clientId, long addressId, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT {AddressColumns} FROM ClientAddress WHERE ClientId = $clientId AND AddressId = $addressId;";
        command.Parameters.AddWithValue("$clientId", clientId);
        command.Parameters.AddWithValue("$addressId", addressId);
        return await ReadSingleAddressAsync(command, cancellationToken);
    }

    public async Task<ClientAddressResponse?> CreateAddressAsync(long clientId, ClientAddressDetails address, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            INSERT INTO ClientAddress (ClientId, AddressType, AddressLine1, AddressLine2, City, Province, PostalCode)
            SELECT $clientId, $addressType, $addressLine1, $addressLine2, $city, $province, $postalCode
            WHERE EXISTS (SELECT 1 FROM Client WHERE ClientId = $clientId)
            RETURNING {AddressColumns};
            """;
        command.Parameters.AddWithValue("$clientId", clientId);
        AddAddressDetailParameters(command, address);
        return await ReadSingleAddressAsync(command, cancellationToken);
    }

    public async Task<ClientAddressResponse?> UpdateAddressAsync(long clientId, long addressId, ClientAddressDetails address, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            UPDATE ClientAddress
            SET AddressType = $addressType,
                AddressLine1 = $addressLine1,
                AddressLine2 = $addressLine2,
                City = $city,
                Province = $province,
                PostalCode = $postalCode
            WHERE ClientId = $clientId AND AddressId = $addressId
            RETURNING {AddressColumns};
            """;
        command.Parameters.AddWithValue("$clientId", clientId);
        command.Parameters.AddWithValue("$addressId", addressId);
        AddAddressDetailParameters(command, address);
        return await ReadSingleAddressAsync(command, cancellationToken);
    }

    public async Task<bool> DeleteAddressAsync(long clientId, long addressId, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM ClientAddress WHERE ClientId = $clientId AND AddressId = $addressId;";
        command.Parameters.AddWithValue("$clientId", clientId);
        command.Parameters.AddWithValue("$addressId", addressId);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    private static void AddAddressDetailParameters(SqliteCommand command, ClientAddressDetails address)
    {
        command.Parameters.AddWithValue("$addressType", address.AddressType);
        command.Parameters.AddWithValue("$addressLine1", address.AddressLine1);
        command.Parameters.AddWithValue("$addressLine2", SqliteValues.FromNullable(address.AddressLine2));
        command.Parameters.AddWithValue("$city", address.City);
        command.Parameters.AddWithValue("$province", SqliteValues.FromNullable(address.Province));
        command.Parameters.AddWithValue("$postalCode", SqliteValues.FromNullable(address.PostalCode));
    }

    private static async Task<ClientAddressResponse?> ReadSingleAddressAsync(SqliteCommand command, CancellationToken cancellationToken)
    {
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadAddress(reader) : null;
    }

    private static ClientAddressResponse ReadAddress(SqliteDataReader reader) => new(
        reader.GetInt64(0),
        reader.GetInt64(1),
        reader.GetString(2),
        reader.GetString(3),
        reader.IsDBNull(4) ? null : reader.GetString(4),
        reader.GetString(5),
        reader.IsDBNull(6) ? null : reader.GetString(6),
        reader.IsDBNull(7) ? null : reader.GetString(7),
        SqliteValues.ParseUtcTimestamp(reader.GetString(8)));
}
