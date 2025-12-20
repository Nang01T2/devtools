<Project Sdk="Microsoft.NET.Sdk">

    <PropertyGroup>
      <RootNamespace>{project_name}.Infrastructure</RootNamespace>
      <AssemblyName>{project_name}.Infrastructure</AssemblyName>
    </PropertyGroup>

    <ItemGroup>
        <PackageReference Include="Azure.Identity" />
        <PackageReference Include="Microsoft.AspNetCore.Diagnostics.EntityFrameworkCore" />
        <PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" />
        <PackageReference Include="Microsoft.EntityFrameworkCore" />
        <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" />
        <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" >
          <PrivateAssets>all</PrivateAssets>
          <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
        </PackageReference>
    </ItemGroup>

    <ItemGroup>
        <ProjectReference Include="..\{project_name}.Application\{project_name}.Application.csproj" />
    </ItemGroup>

</Project>
    