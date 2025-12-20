using MediatR;

namespace {project_name}.Application.Features.{plural_entity}.Queries.GetAll{entity};

public class GetAll{entity}Query : IRequest<GetAll{entity}QueryResponse>
{
	// Pagination
	public int PageNumber { get; set; } = 1;
	public int PageSize { get; set; } = 10;

	// Optional eager-loading includes (e.g., "Orders,Customer")
	public string[] Includes { get; set; } = Array.Empty<string>();
}