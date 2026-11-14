using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace TutorMatching.BuildingBlocks.Hosting;
public static class DependencyReadinessExtensions
{
    public static IServiceCollection AddDependencyReadiness(this IServiceCollection services,string name,Func<IServiceProvider,CancellationToken,Task<bool>> probe){
        services.AddHealthChecks().Add(new HealthCheckRegistration(name,sp=>new DependencyReadiness(sp.GetRequiredService<IServiceScopeFactory>(),probe),null,["ready"],TimeSpan.FromSeconds(3)));
        return services;
    }
}
public sealed class DependencyReadiness(IServiceScopeFactory scopes,Func<IServiceProvider,CancellationToken,Task<bool>> probe):IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,CancellationToken cancellationToken=default){
        try{await using var scope=scopes.CreateAsyncScope();return await probe(scope.ServiceProvider,cancellationToken)?HealthCheckResult.Healthy():HealthCheckResult.Unhealthy("Required dependency is unavailable.");}
        catch(Exception exception) when(exception is not OutOfMemoryException){return HealthCheckResult.Unhealthy("Required dependency is unavailable.",exception);}
    }
}
