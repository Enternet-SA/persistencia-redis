#Requires -RunAsAdministrator
<#
  setup-wsl-redis.ps1
  ------------------------------------------------------------------
  Repara WSL (error Wsl/CallMsi/Install/REGDB_E_CLASSNOTREG) e instala
  lo necesario para correr Redis dentro de Ubuntu (WSL2).

  COMO EJECUTAR:
    1. Clic derecho sobre PowerShell  ->  "Ejecutar como administrador"
    2. Permite scripts en esta sesion:
         Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    3. Corre este archivo:
         .\setup-wsl-redis.ps1
    4. REINICIA el equipo cuando termine.
    5. Tras reiniciar (de nuevo como admin):
         wsl --update
         wsl --install -d Ubuntu
       (Ubuntu pedira crear usuario/clave la primera vez.)
  ------------------------------------------------------------------
#>

Write-Host "==> Habilitando caracteristicas de Windows (WSL + Plataforma de maquina virtual)..." -ForegroundColor Cyan
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Write-Host "==> Re-registrando el paquete de la app WSL (corrige REGDB_E_CLASSNOTREG)..." -ForegroundColor Cyan
Get-AppxPackage -AllUsers *WindowsSubsystemForLinux* | ForEach-Object {
    try {
        Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\AppxManifest.xml" -ErrorAction Stop
        Write-Host "    Registrado: $($_.Name)" -ForegroundColor DarkGray
    } catch {
        Write-Host "    (Aviso) No se pudo re-registrar $($_.Name): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==> HECHO. Ahora:" -ForegroundColor Green
Write-Host "    1) REINICIA el equipo." -ForegroundColor Green
Write-Host "    2) Abre PowerShell como admin y ejecuta:" -ForegroundColor Green
Write-Host "         wsl --update" -ForegroundColor Green
Write-Host "         wsl --install -d Ubuntu" -ForegroundColor Green
Write-Host "    3) Dentro de Ubuntu instala Redis con el script: install-redis.sh" -ForegroundColor Green
