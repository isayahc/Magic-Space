param(
    [ValidateSet('cloud', 'local', 'both')][string]$Mode = 'both',
    [string]$Workspace = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Push-Location (Join-Path $PSScriptRoot '..')
$temp = $null
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.14+ from https://nodejs.org first.' }
    $nodeVersion = & node --version
    if ($LASTEXITCODE -ne 0 -or [version]$nodeVersion.TrimStart('v') -lt [version]'22.14.0') { throw 'Node.js 22.14+ is required.' }
    if ($Workspace -and ($Mode -eq 'cloud' -or -not (Test-Path (Join-Path $Workspace 'main.py')))) {
        throw '-Workspace needs an existing ComfyUI directory containing main.py, with local/both mode.'
    }
    $command = Get-Command opencode -ErrorAction SilentlyContinue
    if ($command) {
        $env:MAGIC_SPACE_OPENCODE = $command.Source
    } else {
        $install = Join-Path $HOME '.local\share\magic-space\opencode'
        $binary = Get-ChildItem $install -Filter opencode.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $binary) {
            $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64-baseline' }
            $temp = Join-Path ([IO.Path]::GetTempPath()) ('magic-space-' + [guid]::NewGuid())
            New-Item -ItemType Directory -Path $temp -Force | Out-Null
            $zip = Join-Path $temp 'opencode.zip'
            Invoke-WebRequest "https://opencode.ai/update/api/latest/cli/opencode/opencode-windows-$arch.zip" -OutFile $zip -UseBasicParsing
            New-Item -ItemType Directory -Path $install -Force | Out-Null
            Expand-Archive -Path $zip -DestinationPath $install -Force
            $binary = Get-ChildItem $install -Filter opencode.exe -Recurse | Select-Object -First 1
            if (-not $binary) { throw 'OpenCode archive did not contain opencode.exe.' }
        }
        $env:MAGIC_SPACE_OPENCODE = $binary.FullName
    }
    if ($Mode -ne 'cloud') {
        $uv = Get-Command uv -ErrorAction SilentlyContinue
        if ($uv) { $env:MAGIC_SPACE_UV = $uv.Source }
        else {
            $bin = Join-Path (Get-Location) '.magic-space\bin'
            $env:MAGIC_SPACE_UV = Join-Path $bin 'uv.exe'
            if (-not (Test-Path $env:MAGIC_SPACE_UV)) {
                if (-not $temp) {
                    $temp = Join-Path ([IO.Path]::GetTempPath()) ('magic-space-' + [guid]::NewGuid())
                    New-Item -ItemType Directory -Path $temp -Force | Out-Null
                }
                $installer = Join-Path $temp 'uv.ps1'
                Invoke-WebRequest 'https://astral.sh/uv/install.ps1' -OutFile $installer -UseBasicParsing
                $previous = $env:UV_UNMANAGED_INSTALL
                try {
                    $env:UV_UNMANAGED_INSTALL = $bin
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
                    if ($LASTEXITCODE -ne 0) { throw 'uv installation failed.' }
                } finally { $env:UV_UNMANAGED_INSTALL = $previous }
            }
        }
    }
    & node scripts/configure.mjs $Mode $Workspace
    if ($LASTEXITCODE -ne 0) { throw 'Configuration failed; see the message above.' }
} finally {
    if ($temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
    Pop-Location
}
