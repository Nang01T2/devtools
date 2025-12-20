using MediatR;
using {project_name}.Domain.Entities;
using {project_name}.Domain.Interfaces;

namespace {project_name}.Application.Features.{plural_entity}.Commands.Create{entity};

public class Create{entity}CommandHandler : IRequestHandler<Create{entity}Command, Create{entity}Response>
{
    private readonly IRepository<{entity}> _repository;

    public Create{entity}CommandHandler(IRepository<{entity}> repository)
    {
        _repository = repository;
    }

    public async Task<Create{entity}Response> Handle(Create{entity}Command request, CancellationToken cancellationToken)
    {
        var entity = new {entity}
        {
            {mapping}
        };

        await _repository.AddAsync(entity);

        return new Create{entity}Response { Id = entity.Id };
    }
}