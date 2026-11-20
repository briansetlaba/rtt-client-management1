using System.Globalization;

namespace Rtt.ClientManagement.Api;

public static class SqliteValues
{
    public static object FromNullable(string? value) => (object?)value ?? DBNull.Value;

    public static DateTime ParseUtcTimestamp(string value) =>
        DateTime.Parse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal);
}
