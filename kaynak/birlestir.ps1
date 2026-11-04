# index.html + css + js (Three.js dahil) dosyalarini tek bir oyun.html'de birlestirir.
# Masaustu (derle.ps1) ve telefon (derle-apk.ps1) surumleri ayni dosyayi kullanir.
param([Parameter(Mandatory = $true)][string]$Hedef)
$ErrorActionPreference = 'Stop'
$k = $PSScriptRoot
$u = New-Object System.Text.UTF8Encoding($false)
$html = [IO.File]::ReadAllText("$k\index.html", $u)
$css  = [IO.File]::ReadAllText("$k\css\stil.css", $u)
$ico  = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$k\ikon.png"))
$html = $html.Replace('<link rel="stylesheet" href="css/stil.css">', "<style>`n$css</style>")
foreach ($src in @('lib/three.min.js', 'js/ek.js', 'js/sahne.js', 'js/avatar.js', 'js/oyun.js', 'js/ekstra.js', 'js/oyunlar.js')) {
  $js = [IO.File]::ReadAllText("$k\$($src.Replace('/', '\'))", $u)
  $tag = "<script src=`"$src`"></script>"
  if (-not $html.Contains($tag)) { throw "index.html icinde $tag bulunamadi." }
  $html = $html.Replace($tag, "<script>`n$js</script>")
}
$html = $html.Replace('href="ikon.png"', "href=`"data:image/png;base64,$ico`"")
[IO.File]::WriteAllText($Hedef, $html, $u)
