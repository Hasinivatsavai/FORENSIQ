@echo off
setlocal EnableExtensions DisableDelayedExpansion
pushd "%~dp0" || exit /b 1

if not exist compose.yaml goto :missing_project
where docker.exe >nul 2>&1 || goto :missing_docker
docker compose version || goto :missing_docker
docker info --format "{{.OSType}}" >nul 2>&1 || goto :engine_stopped

:start_services
echo Starting FORENSIQ with its SQLite data volume. The first build downloads dependencies.
docker compose up --build --wait
if errorlevel 1 goto :failed
choice /C YN /M "Create your first administrator account now? Choose N if you already have one."
if errorlevel 2 goto :open_site
if not errorlevel 1 goto :failed
docker compose exec app python -m app.cli init-admin
if errorlevel 1 goto :failed

:open_site
for /f "delims=" %%P in ('docker compose port app 8080') do (
    echo Open http://%%P/
    start "" "http://%%P/"
    goto :done
)
goto :failed

:missing_project
echo Extract the complete ZIP, then run this launcher beside compose.yaml.
goto :failed
:missing_docker
echo Install Docker Desktop for Windows with Docker Compose, then start Docker Desktop.
echo https://docs.docker.com/desktop/setup/install/windows-install/
goto :failed
:engine_stopped
echo Start Docker Desktop from the Windows Start menu and wait for its Linux engine to run.
goto :failed
:failed
echo Setup stopped. See the message above.
pause
popd
exit /b 1
:done
popd
exit /b 0
