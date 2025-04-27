# PowerShell script to prepare CoChat for Netlify deployment

# Create a temporary directory for deployment
$tempDir = Join-Path $env:TEMP "cochat-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy project files excluding large voice models
Write-Host "Copying project files to temporary directory..."
$excludeDirs = @("app/voices", ".git", "__pycache__", "venv", ".idea", ".vscode")
$excludeFiles = @("*.onnx", "*.bin", "*.zip", "*.tar.gz")

Get-ChildItem -Path . -Recurse | Where-Object {
    $path = $_.FullName.Replace($PWD.Path, "").TrimStart("\")
    -not ($excludeDirs | Where-Object { $path -like "$_*" }) -and
    -not ($excludeFiles | Where-Object { $path -like "$_" })
} | ForEach-Object {
    $destPath = Join-Path $tempDir $_.FullName.Replace($PWD.Path, "").TrimStart("\")
    $destDir = Split-Path $destPath -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir | Out-Null
    }
    if (Test-Path $_.FullName -PathType Leaf) {
        Copy-Item -Path $_.FullName -Destination $destPath -Force
    }
}

Write-Host "Installing dependencies..."
pip install -r requirements.txt --target "$tempDir\python_libs"

Write-Host "Build complete. Deployment package prepared at: $tempDir"

Write-Host "Installing Netlify CLI if not already installed..."
if (-not (Get-Command netlify -ErrorAction SilentlyContinue)) {
    npm install -g netlify-cli
}

Write-Host "Deploying to Netlify..."
Push-Location $tempDir
netlify deploy --dir=. --prod
Pop-Location

Write-Host "Deployment complete. Cleaning up..."
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Deployment script finished. Check above for deployment status and URL."
