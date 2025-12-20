using MediatR;

namespace {project_name}.Application.Features.{plural_entity}.Commands.Update{entity};

public class Update{entity}Command : IRequest<Update{entity}Response>
{
    public Guid Id { get; set; }

    {properties}
}