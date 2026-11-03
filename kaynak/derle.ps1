# Oyunu tek oyun.html'de birlestirir (birlestir.ps1) ve "Vegas Yolu.exe" dosyasini yeniden derler.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
& "$PSScriptRoot\birlestir.ps1" -Hedef "$env:TEMP\oyun.html"
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /codepage:65001 "/out:$PWD\..\Vegas Yolu.exe" "/win32icon:$PWD\vegas-yolu.ico" "/resource:$env:TEMP\oyun.html,oyun.html" /reference:System.Windows.Forms.dll "$PWD\VegasYolu.cs"
if ($LASTEXITCODE -ne 0) { throw 'Derleme basarisiz.' }
Write-Host 'Tamam: Vegas Yolu.exe guncellendi.'
