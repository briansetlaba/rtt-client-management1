using System.Buffers;
using System.Globalization;
using System.Text;
using Microsoft.Data.Sqlite;

namespace Rtt.ClientManagement.Api;

public static class ClientAddressCsvWriter
{
    private const string HeaderRow = "ClientId,FirstName,LastName,Gender,DateOfBirth,AddressType,AddressLine1,AddressLine2,City,Province,PostalCode\r\n";
    private const string RowTerminator = "\r\n";
    private const char FormulaGuardPrefix = '\'';

    private static readonly SearchValues<char> CharactersRequiringQuotes = SearchValues.Create(",\"\r\n");
    private static readonly SearchValues<char> FormulaTriggerCharacters = SearchValues.Create("=+-@\t\r");

    public static async Task WriteAsync(SqliteDataReader reader, TextWriter writer, CancellationToken cancellationToken)
    {
        await writer.WriteAsync(HeaderRow.AsMemory(), cancellationToken);

        var row = new StringBuilder(256);
        while (await reader.ReadAsync(cancellationToken))
        {
            row.Clear();
            row.Append(CultureInfo.InvariantCulture, $"{reader.GetInt64(0)}");

            for (var ordinal = 1; ordinal < reader.FieldCount; ordinal++)
            {
                row.Append(',');
                if (!reader.IsDBNull(ordinal))
                {
                    AppendTextField(row, reader.GetString(ordinal));
                }
            }

            row.Append(RowTerminator);
            await writer.WriteAsync(row, cancellationToken);
        }
    }

    private static void AppendTextField(StringBuilder row, string value)
    {
        if (value.Length == 0)
        {
            return;
        }

        var requiresFormulaGuard = FormulaTriggerCharacters.Contains(value[0]);
        if (!value.AsSpan().ContainsAny(CharactersRequiringQuotes))
        {
            if (requiresFormulaGuard)
            {
                row.Append(FormulaGuardPrefix);
            }

            row.Append(value);
            return;
        }

        row.Append('"');
        if (requiresFormulaGuard)
        {
            row.Append(FormulaGuardPrefix);
        }

        foreach (var character in value)
        {
            row.Append(character == '"' ? "\"\"" : character);
        }

        row.Append('"');
    }
}
