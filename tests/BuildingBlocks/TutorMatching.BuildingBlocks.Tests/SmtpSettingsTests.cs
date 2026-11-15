using Microsoft.Extensions.Configuration;
using TutorMatching.BuildingBlocks.Email;

namespace TutorMatching.BuildingBlocks.Tests;

public sealed class SmtpSettingsTests
{
    private static IConfiguration Config(params (string Key, string? Value)[] entries) =>
        new ConfigurationBuilder().AddInMemoryCollection(entries.ToDictionary(e => e.Key, e => e.Value)).Build();

    [Fact]
    public void MailpitIgnoresSavedGmailCredentials()
    {
        var settings = SmtpSettings.FromConfiguration(Config(("Email:Provider", "mailpit"),
            ("Email:Gmail:Username", "sender@gmail.com"), ("Email:Gmail:AppPassword", "saved-secret")));
        Assert.Equal("mailpit", settings.Host);
        Assert.Equal(1025, settings.Port);
        Assert.False(settings.EnableSsl);
        Assert.Null(settings.Username);
        Assert.Null(settings.Password);
        using var client = settings.CreateClient();
        Assert.Null(client.Credentials);
    }

    [Fact]
    public void GmailSelectsAuthenticatedStartTlsAndSender()
    {
        var settings = SmtpSettings.FromConfiguration(Config(("Email:Provider", " GMAIL "),
            ("Email:Gmail:Username", "sender@gmail.com"), ("Email:Gmail:AppPassword", "abcd efgh ijkl mnop")));
        Assert.Equal("smtp.gmail.com", settings.Host);
        Assert.Equal(587, settings.Port);
        Assert.True(settings.EnableSsl);
        Assert.Equal("sender@gmail.com", settings.From);
        Assert.Equal("abcdefghijklmnop", settings.Password);
        using var client = settings.CreateClient();
        Assert.Equal("sender@gmail.com", client.Credentials!.GetCredential(settings.Host, settings.Port, "smtp")!.UserName);
        Assert.DoesNotContain(settings.Password!, settings.ToString());
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("sender@gmail.com", "")]
    [InlineData("", "secret")]
    public void GmailRejectsMissingCredentials(string? username, string? password) =>
        Assert.Throws<InvalidOperationException>(() => SmtpSettings.FromConfiguration(Config(
            ("Email:Provider", "gmail"), ("Email:Gmail:Username", username), ("Email:Gmail:AppPassword", password))));

    [Theory]
    [InlineData("sender.name", "sender.name@gmail.com")]
    [InlineData(" sender123 ", "sender123@gmail.com")]
    [InlineData("sender@school.edu", "sender@school.edu")]
    public void GmailAcceptsBareUsernameOrFullAddress(string input, string expected)
    {
        var settings = SmtpSettings.FromConfiguration(Config(("Email:Provider", "gmail"),
            ("Email:Gmail:Username", input), ("Email:Gmail:AppPassword", "test-password")));
        Assert.Equal(expected, settings.Username);
        Assert.Equal(expected, settings.From);
    }

    [Theory]
    [InlineData("sender@@gmail.com")]
    [InlineData("sender name")]
    [InlineData("Sender <sender@gmail.com>")]
    public void InvalidGmailAddressReportsConfigurationVariable(string username)
    {
        var error = Assert.Throws<InvalidOperationException>(() => SmtpSettings.FromConfiguration(Config(
            ("Email:Provider", "gmail"), ("Email:Gmail:Username", username), ("Email:Gmail:AppPassword", "test-password"))));
        Assert.Contains("GMAIL_USERNAME", error.Message);
    }

    [Fact]
    public void InvalidProviderDoesNotSilentlyFallBack() =>
        Assert.Throws<InvalidOperationException>(() => SmtpSettings.FromConfiguration(Config(("Email:Provider", "gmal"))));

    [Fact]
    public void ExistingDirectSmtpConfigurationStillWorks()
    {
        var settings = SmtpSettings.FromConfiguration(Config(("Email:Host", "localhost"), ("Email:Port", "2525")));
        Assert.Equal("localhost", settings.Host);
        Assert.Equal(2525, settings.Port);
    }
}
