# build-portable.ps1
# Builds the React frontend and packages it inside the Spring Boot backend JAR
# Result is a single runnable .jar file in the /portable directory

$ErrorActionPreference = "Stop"

Write-Host "Starting Portable Build..." -ForegroundColor Cyan

# 1. Build Frontend with Relative Paths
Write-Host "1/6. Building Frontend..." -ForegroundColor Yellow
$env:VITE_CONVERT_SERVER_URL = "/convert/word-to-pdf"
npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

# 2. Prepare Backend Static Resources
Write-Host "2/6. Copying frontend to backend resources..." -ForegroundColor Yellow
$staticDir = "server-java/src/main/resources/static"

# Ensure directory exists and is empty
if (Test-Path $staticDir) {
    Remove-Item -Path "$staticDir/*" -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $staticDir | Out-Null
}

# Copy dist content to static
Copy-Item -Path "dist/*" -Destination $staticDir -Recurse

# 3. Build Backend (Fat JAR)
Write-Host "3/6. Building Backend JAR..." -ForegroundColor Yellow
Push-Location server-java
mvn clean package -DskipTests
if ($LASTEXITCODE -ne 0) { 
    Pop-Location
    throw "Backend build failed" 
}
Pop-Location

# 4. Organize Output
Write-Host "4/6. Organizing Output..." -ForegroundColor Yellow
$outputDir = "portable"
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

# Find the built jar
$jarFile = Get-ChildItem -Path "server-java/target/*.jar" | Where-Object { $_.Name -notlike "*original*" } | Select-Object -First 1
if (!$jarFile) { throw "Could not find built JAR file" }

Copy-Item -Path $jarFile.FullName -Destination "$outputDir/pdf-editor.jar"

# 5. Create Helper Script
Write-Host "5/6. Creating Start Script..." -ForegroundColor Yellow
$startScript = @"
@echo off
echo Starting PDF Editor Portable...
echo.
echo NOTE: You must have Java installed for this to work.
echo Open http://localhost:8082 in your browser once the server starts.
echo.
java -jar pdf-editor.jar
pause
"@
Set-Content -Path "$outputDir/start.bat" -Value $startScript

# 6. Cleanup
Write-Host "6/6. Cleaning up..." -ForegroundColor Yellow
# Remove static files from source tree to keep dev environment clean
if (Test-Path $staticDir) {
    Remove-Item -Path "$staticDir/*" -Recurse -Force
}

Write-Host "Done! Portable version is located in: $outputDir" -ForegroundColor Green
Write-Host "You can copy the entire '$outputDir' folder to your USB stick." -ForegroundColor Green
