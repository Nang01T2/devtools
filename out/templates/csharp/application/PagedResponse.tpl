using {project_name}.Common;

namespace {project_name}.Features.{plural_entity};

public class GetAll{plural_entity}Response : PagedResponse<{dto}>
{
    public GetAll{plural_entity}Response(
        IEnumerable<{dto}> items,
        int totalCount,
        int pageNumber,
        int pageSize)
        : base(items, totalCount, pageNumber, pageSize)
    {
    }
}