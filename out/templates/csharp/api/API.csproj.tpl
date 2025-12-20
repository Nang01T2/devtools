<Project Sdk="Microsoft.NET.Sdk.Web">

    <PropertyGroup>
        <RootNamespace>{project_name}.API</RootNamespace>
        <AssemblyName>{project_name}.API</AssemblyName>
    </PropertyGroup>

    <ItemGroup>
        <PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" />
        <PackageReference Include="Microsoft.AspNetCore.Mvc.NewtonsoftJson" />
        <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" />
        <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" >
          <PrivateAssets>all</PrivateAssets>
          <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
        </PackageReference>
        <PackageReference Include="Asp.Versioning.Mvc" />
    </ItemGroup>

    <ItemGroup>
        <ProjectReference Include="..\{project_name}.Application\{project_name}.Application.csproj" />
        <ProjectReference Include="..\{project_name}.Infrastructure\{project_name}.Infrastructure.csproj" />
    </ItemGroup>

</Project>
    