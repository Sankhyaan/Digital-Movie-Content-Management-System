# =============================================================================
# CINEVERSE — BULK 10K TMDB FETCHER
# =============================================================================

$apiKey = "f0197a9fc1809810ff1f5485f7d6d78d"
$outputFile = Join-Path $PSScriptRoot "raw_10k_candidates.json"

Write-Host "🎬 Commencing TMDB batch harvester for 10,000 catalog expansion..." -ForegroundColor Cyan

$tasks = @()

# 1. Popular & Top Movies
1..130 | ForEach-Object { $tasks += @{ Type = "Movie"; Url = "https://api.themoviedb.org/3/discover/movie?api_key=$apiKey&sort_by=popularity.desc&page=$_&vote_count.gte=30" } }
1..70  | ForEach-Object { $tasks += @{ Type = "Movie"; Url = "https://api.themoviedb.org/3/movie/top_rated?api_key=$apiKey&page=$_" } }
1..60  | ForEach-Object { $tasks += @{ Type = "Movie"; Url = "https://api.themoviedb.org/3/discover/movie?api_key=$apiKey&sort_by=vote_count.desc&page=$_" } }

# 2. Popular & Top TV Series
1..130 | ForEach-Object { $tasks += @{ Type = "Series"; Url = "https://api.themoviedb.org/3/discover/tv?api_key=$apiKey&sort_by=popularity.desc&page=$_&vote_count.gte=20" } }
1..70  | ForEach-Object { $tasks += @{ Type = "Series"; Url = "https://api.themoviedb.org/3/tv/top_rated?api_key=$apiKey&page=$_" } }
1..60  | ForEach-Object { $tasks += @{ Type = "Series"; Url = "https://api.themoviedb.org/3/discover/tv?api_key=$apiKey&sort_by=vote_count.desc&page=$_" } }

# 3. Genre Specifics (Sci-Fi, Anime, Action)
1..40  | ForEach-Object { $tasks += @{ Type = "Movie"; Url = "https://api.themoviedb.org/3/discover/movie?api_key=$apiKey&with_genres=878&page=$_" } }
1..40  | ForEach-Object { $tasks += @{ Type = "Series"; Url = "https://api.themoviedb.org/3/discover/tv?api_key=$apiKey&with_genres=10765&page=$_" } }
1..40  | ForEach-Object { $tasks += @{ Type = "Movie"; Url = "https://api.themoviedb.org/3/discover/movie?api_key=$apiKey&with_genres=16&page=$_" } }
1..40  | ForEach-Object { $tasks += @{ Type = "Series"; Url = "https://api.themoviedb.org/3/discover/tv?api_key=$apiKey&with_genres=16&page=$_" } }

Write-Host "Total batch requests planned: $($tasks.Count)" -ForegroundColor Yellow

$allResults = [System.Collections.Generic.List[PSObject]]::new()
$seenIds = [System.Collections.Generic.HashSet[int]]::new()
$startTime = Get-Date
$reqCount = 0

foreach ($task in $tasks) {
    $reqCount++
    try {
        $resp = Invoke-RestMethod -Uri $task.Url -TimeoutSec 10 -ErrorAction SilentlyContinue
        if ($resp -and $resp.results) {
            foreach ($item in $resp.results) {
                if ($item.id -and -not $seenIds.Contains([int]$item.id)) {
                    [void]$seenIds.Add([int]$item.id)
                    $item | Add-Member -NotePropertyName "contentType" -NotePropertyValue $task.Type -Force
                    $allResults.Add($item)
                }
            }
        }
    } catch {
        # continue silently on error
    }

    if ($reqCount % 25 -eq 0 -or $reqCount -eq $tasks.Count) {
        $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
        $pct = [math]::Round(($reqCount / $tasks.Count) * 100)
        Write-Host "  [$pct%] Processed $reqCount/$($tasks.Count) requests | Collected $($allResults.Count) unique titles ($elapsed s)" -ForegroundColor Green
    }

    # Stop early if we have over 10,000 unique candidates
    if ($allResults.Count -ge 10500) {
        Write-Host "🎯 Reached $($allResults.Count) unique candidates! Stopping download early." -ForegroundColor Cyan
        break
    }
}

Write-Host "Saving $($allResults.Count) candidate titles to $outputFile..." -ForegroundColor Yellow
$json = $allResults | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText($outputFile, $json, [System.Text.Encoding]::UTF8)

$totalSec = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
Write-Host "✅ Download complete in $totalSec seconds! Saved to $outputFile" -ForegroundColor Green
