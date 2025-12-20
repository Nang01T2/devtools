using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {project_name}.Domain.Entities;

namespace {project_name}.Infrastructure.Data.Configurations;

public class {class_name}Configuration : IEntityTypeConfiguration<{class_name}>
{
    public void Configure(EntityTypeBuilder<{class_name}> builder)
    {
        builder.ToTable("{table_name}");

        // Primary Key
        builder.HasKey({pk_property});

        // Properties
        {property_config}

        // Relationships
        {relationship_config}

        // Indexes & Unique Constraints
        {index_config}
        
        // Check Constraints
        {check_config}
    }
}