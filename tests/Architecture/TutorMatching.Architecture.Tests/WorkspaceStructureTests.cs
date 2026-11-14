namespace TutorMatching.Architecture.Tests;

public sealed class WorkspaceStructureTests
{
    private static readonly string RepositoryRoot = FindRepositoryRoot();

    public static TheoryData<string> RequiredProjects => new()
    {
        "src/BuildingBlocks/TutorMatching.BuildingBlocks/TutorMatching.BuildingBlocks.csproj",
        "src/Gateway/TutorMatching.Gateway/TutorMatching.Gateway.csproj",
        "src/Services/Identity/TutorMatching.Identity.Api/TutorMatching.Identity.Api.csproj",
        "src/Services/Tutor/TutorMatching.Tutor.Api/TutorMatching.Tutor.Api.csproj",
        "src/Services/Student/TutorMatching.Student.Api/TutorMatching.Student.Api.csproj",
        "src/Services/Scheduling/TutorMatching.Scheduling.Api/TutorMatching.Scheduling.Api.csproj",
        "src/Services/Notification/TutorMatching.Notification.Api/TutorMatching.Notification.Api.csproj",
    };

    [Theory]
    [MemberData(nameof(RequiredProjects))]
    public void RequiredProjectExists(string relativePath)
    {
        var absolutePath = Path.Combine(
            RepositoryRoot,
            relativePath.Replace('/', Path.DirectorySeparatorChar));

        Assert.True(File.Exists(absolutePath), $"Missing required project: {relativePath}");
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "TutorMatching.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new InvalidOperationException("Could not locate repository root.");
    }
}

