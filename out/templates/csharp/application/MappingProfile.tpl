using AutoMapper;
using {project_name}.Domain.Entities;
using {project_name}.Application.Features.{plural_entity};

namespace {project_name}.Application.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // Example: Entity → DTO
        // CreateMap<{entity}, {entity}Dto>();

        // Example: CreateCommand → Entity
        // CreateMap<Create{entity}Command, {entity}>();

        // Example: UpdateCommand → Entity
        // CreateMap<Update{entity}Command, {entity}>();

        // Add mappings for each entity below
        {mappings}
    }
}