@echo off
setlocal
set "PROBE_EXE=%~dp0SelectionProbe\bin\Debug\net10.0-windows\Lexforge.SelectionProbe.exe"

if not exist "%PROBE_EXE%" (
  echo Selection Probe has not been built yet.
  echo Build it with: dotnet build Ai_context\SelectionProbe\SelectionProbe.csproj
  pause
  exit /b 1
)

start "" "%PROBE_EXE%"
endlocal
