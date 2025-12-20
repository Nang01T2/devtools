using MediatR;
using {project_name}.Domain.Entities;
using {project_name}.Domain.Interfaces;

namespace {project_name}.Application.Features.{plural_entity}.Commands.Update{entity};

public class Update{entity}CommandHandler : IRequestHandler<Update{entity}Command, Update{entity}Response>
{
    private readonly IRepository<{entity}> _repository;

    public Update{entity}CommandHandler(IRepository<{entity}> repository)
    {
        _repository = repository;
    }

    public async Task<Update{entity}Response> Handle(Update{entity}Command request, CancellationToken cancellationToken)
    {
        var entity = await _repository.GetByIdAsync(request.Id);
        if (entity == null)
            throw new KeyNotFoundException($"Entity with id {request.Id} not found.");

        {mapping}

        await _repository.UpdateAsync(entity);

        return new Update{entity}Response { Id = entity.Id };
    }
}