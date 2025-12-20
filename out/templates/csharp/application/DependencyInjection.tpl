using MediatR;
using Microsoft.Extensions.DependencyInjection;
using {project_name}.Application.Mapping;
using Microsoft.Extensions.Hosting;
using System.Reflection;

namespace {project_name}.Application;

public static class DependencyInjection
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        builder.Services.AddAutoMapper(cfg => 
            cfg.AddMaps(Assembly.GetExecutingAssembly()));

        {dbcontext_registration}

        builder.Services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        builder.Services.AddMediatR(cfg => {
            cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
            //cfg.AddOpenRequestPreProcessor(typeof(LoggingBehaviour<>));
            //cfg.AddOpenBehavior(typeof(UnhandledExceptionBehaviour<,>));
            //cfg.AddOpenBehavior(typeof(AuthorizationBehaviour<,>));
            //cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
            //cfg.AddOpenBehavior(typeof(PerformanceBehaviour<,>));
        });
    }
}