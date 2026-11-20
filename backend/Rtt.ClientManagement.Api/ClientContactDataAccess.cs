using Microsoft.Data.Sqlite;

namespace Rtt.ClientManagement.Api;

public sealed class ClientContactDataAccess(SqliteConnectionFactory connectionFactory)
{
    private const string ContactColumns = "ContactId, ClientId, ContactType, ContactValue, CreatedAt";

    public async Task<IReadOnlyList<ClientContactResponse>?> GetContactsAsync(long clientId, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        if (!await ClientDataAccess.ClientExistsAsync(connection, clientId, cancellationToken))
        {
            return null;
        }

        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT {ContactColumns} FROM ClientContact WHERE ClientId = $clientId ORDER BY ContactId;";
        command.Parameters.AddWithValue("$clientId", clientId);

        var contacts = new List<ClientContactResponse>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            contacts.Add(ReadContact(reader));
        }

        return contacts;
    }

    public async Task<ClientContactResponse?> GetContactAsync(long clientId, long contactId, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT {ContactColumns} FROM ClientContact WHERE ClientId = $clientId AND ContactId = $contactId;";
        command.Parameters.AddWithValue("$clientId", clientId);
        command.Parameters.AddWithValue("$contactId", contactId);
        return await ReadSingleContactAsync(command, cancellationToken);
    }

    public async Task<ClientContactResponse?> CreateContactAsync(long clientId, ClientContactDetails contact, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            INSERT INTO ClientContact (ClientId, ContactType, ContactValue)
            SELECT $clientId, $contactType, $contactValue
            WHERE EXISTS (SELECT 1 FROM Client WHERE ClientId = $clientId)
            RETURNING {ContactColumns};
            """;
        command.Parameters.AddWithValue("$clientId", clientId);
        AddContactDetailParameters(command, contact);
        return await ReadSingleContactAsync(command, cancellationToken);
    }

    public async Task<ClientContactResponse?> UpdateContactAsync(long clientId, long contactId, ClientContactDetails contact, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            UPDATE ClientContact
            SET ContactType = $contactType,
                ContactValue = $contactValue
            WHERE ClientId = $clientId AND ContactId = $contactId
            RETURNING {ContactColumns};
            """;
        command.Parameters.AddWithValue("$clientId", clientId);
        command.Parameters.AddWithValue("$contactId", contactId);
        AddContactDetailParameters(command, contact);
        return await ReadSingleContactAsync(command, cancellationToken);
    }

    public async Task<bool> DeleteContactAsync(long clientId, long contactId, CancellationToken cancellationToken)
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM ClientContact WHERE ClientId = $clientId AND ContactId = $contactId;";
        command.Parameters.AddWithValue("$clientId", clientId);
        command.Parameters.AddWithValue("$contactId", contactId);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    private static void AddContactDetailParameters(SqliteCommand command, ClientContactDetails contact)
    {
        command.Parameters.AddWithValue("$contactType", contact.ContactType);
        command.Parameters.AddWithValue("$contactValue", contact.ContactValue);
    }

    private static async Task<ClientContactResponse?> ReadSingleContactAsync(SqliteCommand command, CancellationToken cancellationToken)
    {
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadContact(reader) : null;
    }

    private static ClientContactResponse ReadContact(SqliteDataReader reader) => new(
        reader.GetInt64(0),
        reader.GetInt64(1),
        reader.GetString(2),
        reader.GetString(3),
        SqliteValues.ParseUtcTimestamp(reader.GetString(4)));
}
