using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;

namespace TutorMatching.BuildingBlocks.Email;

public sealed record SmtpSettings(string Host, int Port, bool EnableSsl, string From,
    string? Username = null, string? Password = null)
{
    public static SmtpSettings FromConfiguration(IConfiguration config)
    {
        var provider = config["Email:Provider"]?.Trim().ToLowerInvariant();
        if (provider == "mailpit")
            return new(config["Email:Mailpit:Host"] ?? "mailpit", 1025, false,
                "no-reply@demo.tutormatching.local");
        if (provider == "gmail")
        {
            var username = config["Email:Gmail:Username"]?.Trim();
            var password = config["Email:Gmail:AppPassword"]?.Replace(" ", "");
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
                throw new InvalidOperationException("Gmail requires GMAIL_USERNAME and GMAIL_APP_PASSWORD in .env.");
            if (System.Text.RegularExpressions.Regex.IsMatch(username, @"^[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*$"))
                username += "@gmail.com";
            if (!MailAddress.TryCreate(username, out var address) ||
                !string.Equals(address.Address, username, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("GMAIL_USERNAME must be an email address or a Gmail username without @gmail.com.");
            return new("smtp.gmail.com", 587, true, username, username, password);
        }
        if (!string.IsNullOrEmpty(provider))
            throw new InvalidOperationException("EMAIL_PROVIDER must be mailpit or gmail.");

        // Preserve direct SMTP configuration for existing local service setups.
        return new(config["Email:Host"] ?? "localhost", config.GetValue("Email:Port", 1025),
            config.GetValue("Email:EnableSsl", false),
            config["Email:From"] ?? "no-reply@demo.tutormatching.local",
            config["Email:Username"], config["Email:Password"]);
    }

    public SmtpClient CreateClient()
    {
        var client = new SmtpClient(Host, Port) { EnableSsl = EnableSsl };
        if (!string.IsNullOrWhiteSpace(Username))
            client.Credentials = new NetworkCredential(Username, Password);
        return client;
    }

    public override string ToString() => $"SMTP {Host}:{Port} (TLS={EnableSsl})";
}
