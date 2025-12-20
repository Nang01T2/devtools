using MediatR;

namespace {project_name}.Application.Features.{plural_entity}.Commands.Delete{entity};

public class Delete{entity}Command : IRequest<Delete{entity}Response>
{
    public Guid Id { get; set; }
}