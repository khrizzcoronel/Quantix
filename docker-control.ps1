<#
.SYNOPSIS
    Script de control unificado para el cluster Docker de Quantix.
.EXAMPLE
    .\docker-control.ps1 up
    .\docker-control.ps1 status
    .\docker-control.ps1 logs backend
    .\docker-control.ps1 test
    .\docker-control.ps1 seed
    .\docker-control.ps1 down
#>

param (
    [Parameter(Position=0)]
    [ValidateSet("up", "down", "restart", "status", "ps", "logs", "build", "seed", "test", "shell-backend", "shell-db", "clean")]
    [string]$Command = "status",

    [Parameter(Position=1)]
    [string]$Service = ""
)

switch ($Command) {
    "up" {
        Write-Host "==> Levantando servicios de Quantix en Docker (build + background)..." -ForegroundColor Cyan
        docker compose up -d --build
        Write-Host ""
        Write-Host "==> Estado del cluster:" -ForegroundColor Cyan
        docker compose ps
        Write-Host ""
        Write-Host "Servicios disponibles:" -ForegroundColor Green
        Write-Host "  - Frontend:  http://localhost:5173" -ForegroundColor Green
        Write-Host "  - Backend:   http://localhost:8000 (Swagger: http://localhost:8000/docs)" -ForegroundColor Green
        Write-Host "  - pgAdmin:   http://localhost:5050" -ForegroundColor Green
        Write-Host "  - Postgres:  localhost:5433" -ForegroundColor Green
    }
    "down" {
        Write-Host "==> Deteniendo servicios de Quantix..." -ForegroundColor Yellow
        docker compose down
    }
    "restart" {
        Write-Host "==> Reiniciando servicios..." -ForegroundColor Cyan
        if ($Service) {
            docker compose restart $Service
        } else {
            docker compose restart
        }
    }
    "status" {
        docker compose ps
    }
    "ps" {
        docker compose ps
    }
    "logs" {
        if ($Service) {
            docker compose logs -f $Service
        } else {
            docker compose logs -f --tail=100
        }
    }
    "build" {
        Write-Host "==> Reconstruyendo imagenes..." -ForegroundColor Cyan
        docker compose build
    }
    "seed" {
        Write-Host "==> Sembrando datos demo en la base de datos de Docker..." -ForegroundColor Cyan
        docker compose exec backend python -m app.seed
    }
    "test" {
        Write-Host "==> Ejecutando suite de testing dentro del contenedor Backend..." -ForegroundColor Cyan
        docker compose exec backend python -m pytest tests/ -v
    }
    "shell-backend" {
        docker compose exec -it backend /bin/bash
    }
    "shell-db" {
        docker compose exec -it db psql -U quantix_user -d quantix_db
    }
    "clean" {
        Write-Host "==> Limpiando contenedores y volumenes de Quantix..." -ForegroundColor Red
        docker compose down -v
    }
}
