#!/usr/bin/env pwsh
<#
.SYNOPSIS
  OpenCode Review Cycle for SpecPilot - runs bug review + performance review
  
.DESCRIPTION
  Orchestrates AI code review workflow using omniroute/mimopro model:
  1. Analyzes codebase for bugs, security issues, race conditions
  2. Analyzes codebase for performance bottlenecks, N+1 queries, memory leaks
  3. Generates Markdown reports in review/ folder with timestamp
  4. Copilot automatically fixes issues and cleans up reports
  5. Runs up to MaxIterations (default 2) iterations
  
.EXAMPLE
  & ".project-ai\workflows\review-cycle-v2.ps1"
  & ".project-ai\workflows\review-cycle-v2.ps1" -MaxIterations 1
  & ".project-ai\workflows\review-cycle-v2.ps1" -MaxIterations 100
  
.NOTES
  Requires: Git, OpenCode CLI, access to codebase
  Model: omniroute/mimopro
  Output: review/{timestamp}-bug-review.md, review/{timestamp}-performance-review.md
#>

param(
    [switch]$SkipBug = $false,
    [switch]$SkipPerformance = $false,
    [string]$ReviewDir = "review",
    [int]$MaxIterations = 2
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Set UTF-8 encoding for proper output handling
[System.Environment]::SetEnvironmentVariable("PYTHONIOENCODING", "utf-8")
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Header {
    param([string]$Message)
    Write-Host "`n" -NoNewline
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
}

function Write-Progress-Step {
    param([string]$Message)
    Write-Host "  [*] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [+] $Message" -ForegroundColor Green
}

function Write-Error-Msg {
    param([string]$Message)
    Write-Host "  [-] $Message" -ForegroundColor Red
}

function Get-RecentChanges {
    try {
        $diff = git diff --cached HEAD 2>$null
        if (-not $diff) {
            $diff = git diff HEAD 2>$null
        }
        return $diff
    }
    catch {
        return "No git changes available"
    }
}

function Remove-ReviewFiles {
    try {
        $reviewFiles = Get-ChildItem -Path $ReviewDir -Filter "*-bug-review.md", "*-performance-review.md" -ErrorAction SilentlyContinue
        if ($reviewFiles) {
            $reviewFiles | Remove-Item -Force
            Write-Success "Cleaned up review files from previous iteration"
        }
    }
    catch {
        Write-Warning "Could not clean up review files: $_"
    }
}

function Invoke-BugReview {
    Write-Header "Bug Review"
    Write-Progress-Step "Running OpenCode bug review agent..."
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $bugReviewFile = "$ReviewDir/$timestamp-bug-review.md"
    
    $prompt = @"
You are a Senior Code Reviewer. Review the codebase in the current directory.

Focus areas:
- Bugs, logic errors, edge cases, error handling
- Security issues: injection, auth bypass, data exposure
- Race conditions: concurrent locks, unique index enforcement, atomic operations
- Resource leaks: connections, file handles, event listeners
- Append-only violations: no UPDATE on versioned content
- Worker isolation: worktree cleanup, process boundaries
- Cross-platform: path handling, process spawning
- TypeORM/DB transaction atomicity

Read relevant source files, then write a structured Markdown bug review report.
Format:
## Bug Review Report
### Summary
### Findings (CRITICAL/HIGH/MEDIUM/LOW with file:line, issue, fix)
### Clean Areas

Save the report to file: $bugReviewFile
"@
    
    try {
        Write-Progress-Step "Invoking: opencode run --model omniroute/mimopro"
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $tempFile = [System.IO.Path]::GetTempFileName()
        & opencode run --model omniroute/mimopro $prompt 2>$null 1>$tempFile
        $exitCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEAP
        
        if (Test-Path $tempFile) {
            [string]$rawOutput = Get-Content -Path $tempFile -Raw
            Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
            
            if ($rawOutput -and $rawOutput.Trim().Length -gt 10) {
                $rawOutput | Out-File -FilePath $bugReviewFile -Encoding UTF8 -Force
                Write-Success "Bug review saved: $bugReviewFile"
                return $bugReviewFile
            }
        }
        # Fallback: check if opencode wrote directly to our file
        if (Test-Path $bugReviewFile) {
            Write-Success "Bug review saved: $bugReviewFile"
            return $bugReviewFile
        }
        Write-Error-Msg "Bug review returned no output (exit: $exitCode)"
        throw "OpenCode bug review returned no useful content"
    }
    catch {
        Write-Error-Msg "Bug review failed: $_"
        throw
    }
}

function Invoke-PerformanceReview {
    Write-Header "Performance Review"
    Write-Progress-Step "Running OpenCode performance review agent..."
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $perfReviewFile = "$ReviewDir/$timestamp-performance-review.md"
    
    $prompt = @"
You are a Senior Performance Engineer. Review the codebase in the current directory.

Focus areas:
- N+1 queries: missing eager loading, missing JOINs
- Missing database indexes on query columns
- Oversized API payloads (no pagination, no field filtering)
- Frontend: unnecessary re-renders, missing memoization, bundle size
- Memory leaks: event listeners not removed, closures, uncleaned subscriptions
- Lock contention: SELECT FOR UPDATE scope, transaction duration
- Queue/worker: BullMQ concurrency=1 bottlenecks, job processing efficiency
- Socket.IO: broadcast scope, room management
- Process overhead: new process per request instead of pooling
- Missing caching for expensive operations

Read relevant source files, then write a structured Markdown performance review report.
Format:
## Performance Review Report
### Summary
### Findings (CRITICAL/HIGH/MEDIUM/LOW with file:line, issue, before/after fix, estimated impact)
### Well-Optimized Areas

Save the report to file: $perfReviewFile
"@
    
    try {
        Write-Progress-Step "Invoking: opencode run --model omniroute/mimopro"
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $tempFile = [System.IO.Path]::GetTempFileName()
        & opencode run --model omniroute/mimopro $prompt 2>$null 1>$tempFile
        $exitCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEAP
        
        if (Test-Path $tempFile) {
            [string]$rawOutput = Get-Content -Path $tempFile -Raw
            Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
            
            if ($rawOutput -and $rawOutput.Trim().Length -gt 10) {
                $rawOutput | Out-File -FilePath $perfReviewFile -Encoding UTF8 -Force
                Write-Success "Performance review saved: $perfReviewFile"
                return $perfReviewFile
            }
        }
        # Fallback: check if opencode wrote directly to our file
        if (Test-Path $perfReviewFile) {
            Write-Success "Performance review saved: $perfReviewFile"
            return $perfReviewFile
        }
        Write-Error-Msg "Performance review returned no output (exit: $exitCode)"
        throw "OpenCode performance review returned no useful content"
    }
    catch {
        Write-Error-Msg "Performance review failed: $_"
        throw
    }
}

function Print-ReviewSummary {
    param(
        [string]$BugReportFile,
        [string]$PerfReportFile,
        [int]$CurrentIteration,
        [int]$MaxIterations
    )
    
    Write-Header "Iteration $CurrentIteration/$MaxIterations Complete"
    
    if ($BugReportFile) {
        Write-Host "  [*] Bug Review:         $BugReportFile" -ForegroundColor Cyan
    }
    if ($PerfReportFile) {
        Write-Host "  [*] Performance Review: $PerfReportFile" -ForegroundColor Cyan
    }
    
    Write-Host ""
}

# ============================================================================
# Main Workflow
# ============================================================================

function Main {
    Write-Host ""
    Write-Header "SPECPILOT OpenCode Review Cycle (Max $MaxIterations iterations)"
    Write-Host ""
    Write-Host "  Current Directory: $(Get-Location)" -ForegroundColor Gray
    Write-Host "  Review Output Dir: $ReviewDir" -ForegroundColor Gray
    Write-Host "  Max Iterations: $MaxIterations" -ForegroundColor Gray
    Write-Host ""
    
    # Ensure review directory exists
    if (-not (Test-Path $ReviewDir)) {
        New-Item -ItemType Directory -Path $ReviewDir -Force | Out-Null
        Write-Success "Created review directory: $ReviewDir"
    }
    
    $iteration = 0
    $continueReview = $true
    
    try {
        while ($continueReview -and $iteration -lt $MaxIterations) {
            $iteration++
            
            Write-Header "Iteration $iteration/$MaxIterations"
            Write-Host ""
            
            $bugReportFile = $null
            $perfReportFile = $null
            
            # Bug Review
            if (-not $SkipBug) {
                $bugReportFile = Invoke-BugReview
            }
            else {
                Write-Host "  [x] Skipped bug review" -ForegroundColor Gray
            }
            
            Write-Host ""
            
            # Performance Review
            if (-not $SkipPerformance) {
                $perfReportFile = Invoke-PerformanceReview
            }
            else {
                Write-Host "  [x] Skipped performance review" -ForegroundColor Gray
            }
            
            # Summary for this iteration
            Print-ReviewSummary -BugReportFile $bugReportFile -PerfReportFile $perfReportFile `
                -CurrentIteration $iteration -MaxIterations $MaxIterations
            
            # Instruction for Copilot to fix
            if ($iteration -lt $MaxIterations) {
                Write-Host ""
                Write-Header "COPILOT: Fix Issues & Next Iteration"
                Write-Host ""
                Write-Host "  [+] Review reports saved:" -ForegroundColor Green
                if ($bugReportFile) {
                    Write-Host "     - $bugReportFile" -ForegroundColor Cyan
                }
                if ($perfReportFile) {
                    Write-Host "     - $perfReportFile" -ForegroundColor Cyan
                }
                Write-Host ""
                Write-Host "  [*] Your Task:" -ForegroundColor Yellow
                Write-Host "     1. Read the review reports above" -ForegroundColor Gray
                Write-Host "     2. Fix all valid issues in source code" -ForegroundColor Gray
                Write-Host "     3. After fixes, review files will be auto-cleaned" -ForegroundColor Gray
                Write-Host "     4. Iteration $($iteration + 1) will run automatically" -ForegroundColor Gray
                Write-Host ""
                Write-Host "  [*] Preparing cleanup & next iteration..." -ForegroundColor Yellow
                Start-Sleep -Milliseconds 1000
                
                # Clean up review files for next iteration
                Remove-ReviewFiles
            }
        }
        
        
        Write-Host ""
        Write-Header "REVIEW CYCLE FINISHED (Fully Automatic)"
        Write-Host ""
        Write-Host "  Completed iterations: $iteration/$MaxIterations" -ForegroundColor Cyan
        Write-Host "  Review reports: review/*.md" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  [*] Next: Manual Validation & Commit" -ForegroundColor Cyan
        Write-Host "     1. Review findings di review/*.md" -ForegroundColor Yellow
        Write-Host "     2. Fix issues yang belum ter-fix" -ForegroundColor Yellow
        Write-Host "     3. pnpm run lint; pnpm run typecheck; pnpm run test" -ForegroundColor Yellow
        Write-Host "     4. git add . && git commit -m '...' && git push" -ForegroundColor Yellow
        Write-Host ""
        
        exit 0
    }
    catch {
        Write-Error-Msg "Review cycle failed: $_"
        Write-Host "  Stack: $($_.ScriptStackTrace)" -ForegroundColor Red
        exit 1
    }
}

# Run main workflow
Main
