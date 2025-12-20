<Project Sdk="Microsoft.NET.Sdk">
    <PropertyGroup>
        <RootNamespace>{project_name}.Application</RootNamespace>
        <AssemblyName>{project_name}.Application</AssemblyName>
    </PropertyGroup>

    <ItemGroup>
        <PackageReference Include="Ardalis.GuardClauses" />
        <PackageReference Include="AutoMapper"/>
        <PackageReference Include="FluentValidation"/>
        <PackageReference Include="FluentValidation.DependencyInjectionExtensions" />
        <PackageReference Include="MediatR" />
        <PackageReference Include="Microsoft.Extensions.Hosting" />
        <PackageReference Include="Microsoft.EntityFrameworkCore" />
        <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" />
        <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" >
          <PrivateAssets>all</PrivateAssets>
          <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
        </PackageReference>
        <PackageReference Include="System.Linq.Dynamic.Core" />
    </ItemGroup>

    <ItemGroup>
        <ProjectReference Include="..\{project_name}.Domain\{project_name}.Domain.csproj" />
    </ItemGroup>
</Project>
