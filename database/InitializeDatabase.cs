#:package Microsoft.Data.Sqlite@10.0.14
#:property PublishAot=false

using Microsoft.Data.Sqlite;

var schemaDirectory = Path.Combine("database", "schema");
var databasePath = args.Length > 0 ? args[0] : Path.Combine("database", "data", "clients.db");

if (!Directory.Exists(schemaDirectory))
{
    Console.Error.WriteLine($"Schema directory not found: {Path.GetFullPath(schemaDirectory)}. Run from the project root.");
    return 1;
}

var schemaFiles = Directory.GetFiles(schemaDirectory, "*.sql");
Array.Sort(schemaFiles, StringComparer.Ordinal);

if (schemaFiles.Length == 0)
{
    Console.Error.WriteLine($"No schema files found in {Path.GetFullPath(schemaDirectory)}.");
    return 1;
}

Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(databasePath))!);

var connectionString = new SqliteConnectionStringBuilder
{
    DataSource = databasePath,
    Mode = SqliteOpenMode.ReadWriteCreate,
    ForeignKeys = true
}.ToString();

try
{
    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    using (var foreignKeysCommand = connection.CreateCommand())
    {
        foreignKeysCommand.CommandText = "PRAGMA foreign_keys;";
        if (Convert.ToInt64(foreignKeysCommand.ExecuteScalar()) != 1)
        {
            Console.Error.WriteLine("Foreign key enforcement could not be enabled.");
            return 1;
        }
    }

    using var transaction = connection.BeginTransaction();

    foreach (var schemaFile in schemaFiles)
    {
        var schemaFileName = Path.GetFileName(schemaFile);
        try
        {
            using var schemaCommand = connection.CreateCommand();
            schemaCommand.Transaction = transaction;
            schemaCommand.CommandText = File.ReadAllText(schemaFile);
            schemaCommand.ExecuteNonQuery();
            Console.WriteLine($"Applied {schemaFileName}");
        }
        catch (SqliteException exception)
        {
            transaction.Rollback();
            Console.Error.WriteLine($"Failed to apply {schemaFileName}: {exception.Message}");
            Console.Error.WriteLine("No schema changes were committed.");
            return 1;
        }
    }

    transaction.Commit();
}
catch (SqliteException exception)
{
    Console.Error.WriteLine($"Database initialization failed for {Path.GetFullPath(databasePath)}: {exception.Message}");
    return 1;
}

Console.WriteLine($"Database initialized: {Path.GetFullPath(databasePath)}");
return 0;
