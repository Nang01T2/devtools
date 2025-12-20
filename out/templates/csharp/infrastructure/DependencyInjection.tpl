using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
//using {project_name}.Domain.Interfaces;
using {project_name}.Infrastructure.Data;
{if_include_repository}
using {project_name}.Infrastructure.Repositories;
{endif}

namespace {project_name}.Infrastructure;

public static class DependencyInjection
{
    public static void AddInfrastructureServices(this IHostApplicationBuilder builder)
    {
        var connectionString = builder.Configuration.GetConnectionString("ConnectionString");
		Guard.Against.Null(connectionString, message: "Connection string 'ConnectionString' not found.");

{if_include_repository}
        builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
{endif}

        builder.Services.AddDbContext<AppDbContext>((sp, options) =>
		{
			options.UseSqlServer(connectionString);
		});
    }
}