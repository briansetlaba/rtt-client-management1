using Microsoft.Data.Sqlite;
using Rtt.ClientManagement.Api;

var builder = WebApplication.CreateBuilder(args);

var configuredDatabasePath = builder.Configuration["Database:Path"]
    ?? throw new InvalidOperationException("Database:Path is not configured.");
var databasePath = Path.GetFullPath(configuredDatabasePath, builder.Environment.ContentRootPath);

var connectionString = new SqliteConnectionStringBuilder
{
    DataSource = databasePath,
    Mode = SqliteOpenMode.ReadWrite,
    ForeignKeys = true
}.ToString();

builder.Services.AddSingleton(new SqliteConnectionFactory(connectionString));
builder.Services.AddSingleton<ClientDataAccess>();
builder.Services.AddSingleton<ClientAddressDataAccess>();
builder.Services.AddSingleton<ClientContactDataAccess>();
builder.Services.AddSingleton<ClientExportDataAccess>();
builder.Services.AddProblemDetails();
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = false);

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (!File.Exists(databasePath))
{
    app.Logger.LogError("SQLite database not found at {DatabasePath}. Run database initialization from the repository root.", databasePath);
}

string[] requiredTableNames = ["Client", "ClientAddress", "ClientContact"];

app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));

app.MapGet("/health/database", async (SqliteConnectionFactory connectionFactory, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    var unavailableResponse = Results.Json(new { status = "Unhealthy", database = "Unavailable" }, statusCode: StatusCodes.Status503ServiceUnavailable);

    try
    {
        await using var connection = await connectionFactory.OpenConnectionAsync(cancellationToken);

        await using var foreignKeysCommand = connection.CreateCommand();
        foreignKeysCommand.CommandText = "PRAGMA foreign_keys;";
        var foreignKeysEnabled = Convert.ToInt64(await foreignKeysCommand.ExecuteScalarAsync(cancellationToken)) == 1;

        await using var requiredTablesCommand = connection.CreateCommand();
        requiredTablesCommand.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ($clientTable, $clientAddressTable, $clientContactTable);";
        requiredTablesCommand.Parameters.AddWithValue("$clientTable", requiredTableNames[0]);
        requiredTablesCommand.Parameters.AddWithValue("$clientAddressTable", requiredTableNames[1]);
        requiredTablesCommand.Parameters.AddWithValue("$clientContactTable", requiredTableNames[2]);
        var existingRequiredTableCount = Convert.ToInt64(await requiredTablesCommand.ExecuteScalarAsync(cancellationToken));

        if (!foreignKeysEnabled || existingRequiredTableCount != requiredTableNames.Length)
        {
            logger.LogError("Database health check failed. Foreign keys enabled: {ForeignKeysEnabled}. Required tables found: {ExistingRequiredTableCount} of {RequiredTableCount}.",
                foreignKeysEnabled, existingRequiredTableCount, requiredTableNames.Length);
            return unavailableResponse;
        }

        return Results.Ok(new { status = "Healthy", database = "Connected" });
    }
    catch (SqliteException exception)
    {
        logger.LogError(exception, "Database health check could not connect to the SQLite database.");
        return unavailableResponse;
    }
});

app.MapClientExportEndpoints();
app.MapClientEndpoints();
app.MapClientAddressEndpoints();
app.MapClientContactEndpoints();

app.Run();
