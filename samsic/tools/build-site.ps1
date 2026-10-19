<#
.SYNOPSIS
  Assemble le dossier `site/` : UNIQUEMENT les fichiers à publier (liste blanche).

.DESCRIPTION
  Utilisé à la fois en local et par le workflow GitHub Actions (.github/workflows/pages.yml), pour
  qu'il n'y ait qu'un seul endroit où décider de ce qui devient public.
  Sont publiés : index.html, oauth-callback.html, css/, js/, img/, fonts/ (et un .nojekyll).
  Ne sont JAMAIS publiés : docs/ et tout Markdown (informations internes), serve.json, tools/,
  video/ (projet de la vidéo de présentation, moteur de démonstration compris), pages de test
  (_*.html), archives .zip.
  Le script échoue si un fichier interdit se retrouve dans `site/`, ou si l'adresse `localhost`
  est restée en dur dans un fichier publié.

.EXAMPLE
  ./tools/build-site.ps1            # écrit site/
  ./tools/build-site.ps1 -Out dist  # autre dossier de sortie
#>
param([string]$Out = 'site')

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$files = @('index.html', 'oauth-callback.html')
$dirs = @('css', 'js', 'img', 'fonts')
$forbidden = @('serve.json', 'mock-doc.js', 'demo-engine.js')

foreach ($item in $files + $dirs) {
    if (-not (Test-Path $item)) { throw "Fichier ou dossier à publier introuvable : $item" }
}

if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Path $Out | Out-Null
Copy-Item $files -Destination $Out
foreach ($dir in $dirs) { Copy-Item $dir -Destination $Out -Recurse }
New-Item -ItemType File -Path (Join-Path $Out '.nojekyll') | Out-Null   # pas de traitement Jekyll

# ---- Contrôles --------------------------------------------------------------------------------
$published = Get-ChildItem $Out -Recurse -File -Force
foreach ($file in $published) {
    $relative = $file.FullName.Substring((Resolve-Path $Out).Path.Length + 1)
    if ($forbidden -contains $file.Name -or $file.Name -like '_*.html' -or $file.Extension -in '.md', '.zip') {
        throw "Fichier interdit dans la publication : $relative"
    }
}

$textFiles = $published | Where-Object { $_.Extension -in '.html', '.js', '.css' }
# Une URL localhost entre guillemets = adresse codée en dur (les commentaires qui en parlent sont tolérés).
$hardCoded = $textFiles | Select-String -Pattern '["'']https?://(localhost|127\.0\.0\.1)'
if ($hardCoded) {
    $hardCoded | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber)  $($_.Line.Trim())" }
    throw "Une adresse localhost est restée en dur dans un fichier publié (voir ci-dessus)."
}

$size = ($published | Measure-Object Length -Sum).Sum
Write-Host ("Site assemblé dans '{0}' : {1} fichiers, {2:N0} Ko." -f $Out, $published.Count, ($size / 1KB))
Get-ChildItem $Out -Force | ForEach-Object { Write-Host ("  " + $_.Name + $(if ($_.PSIsContainer) { '/' } else { '' })) }
