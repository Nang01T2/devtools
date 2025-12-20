using FluentValidation;

namespace {project_name}.Application.Features.{plural_entity}.Commands.Create{entity};

public class Create{entity}Validator : AbstractValidator<Create{entity}Command>
{
    public Create{entity}Validator()
    {
        // Example rules - customize per entity
        // RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        // RuleFor(x => x.Email).EmailAddress();
    }
}