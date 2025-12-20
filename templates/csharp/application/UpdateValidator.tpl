using FluentValidation;

namespace {project_name}.Application.Features.{plural_entity}.Commands.Update{entity};

public class Update{entity}Validator : AbstractValidator<Update{entity}Command>
{
    public Update{entity}Validator()
    {
        RuleFor(x => x.Id).NotEmpty();
        // Add other validation rules as needed
    }
}